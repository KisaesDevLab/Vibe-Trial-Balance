<#
  Vibe Trial Balance - Start Script
  Run from PowerShell or double-click via Launch.bat
#>

Set-ExecutionPolicy Bypass -Scope Process -Force
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

function Write-OK($msg)   { Write-Host "  [OK]  $msg" -ForegroundColor Green  }
function Write-Info($msg) { Write-Host "  [...] $msg" -ForegroundColor Gray   }
function Write-Warn($msg) { Write-Host "  [!]   $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [ERR] $msg" -ForegroundColor Red    }

function Stop-WithError {
    Write-Host ""
    Write-Host "  Press any key to close..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

function Test-PortInUse($port) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $connections -and @($connections).Count -gt 0)
    }
    catch {
        return $false
    }
}

function Get-PortProcess($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) { return $proc.ProcessName }
        }
    }
    catch {}
    return $null
}

function Find-NextAvailablePort($startPort) {
    $candidate = $startPort + 1
    while ($candidate -lt ($startPort + 100)) {
        if (-not (Test-PortInUse $candidate)) {
            return $candidate
        }
        $candidate++
    }
    return $candidate
}

# Read configured ports from server/.env (fall back to defaults)
$PORT_SERVER = 3001
$PORT_CLIENT = 5173

if (Test-Path "server\.env") {
    Get-Content "server\.env" | ForEach-Object {
        if ($_ -match "^PORT=(\d+)") { $script:PORT_SERVER = [int]$Matches[1] }
        if ($_ -match "^ALLOWED_ORIGIN=.*:(\d+)") { $script:PORT_CLIENT = [int]$Matches[1] }
    }
}

Clear-Host
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    Vibe Trial Balance - Starting Up"           -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Docker Desktop ────────────────────────────────────────────────────────

Write-Info "Checking Docker Desktop..."
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Docker is not running. Please open Docker Desktop and wait for it to fully start."
    Write-Warn "Then run this script again."
    Stop-WithError
}
Write-OK "Docker is running"

# ── 2. Port conflict check ───────────────────────────────────────────────────

Write-Info "Checking for port conflicts..."

# Check server port
if (Test-PortInUse $PORT_SERVER) {
    $proc = Get-PortProcess $PORT_SERVER
    $procInfo = if ($proc) { " by '$proc'" } else { "" }
    $suggested = Find-NextAvailablePort $PORT_SERVER
    Write-Warn "Port $PORT_SERVER (Backend API) is in use$procInfo."
    $userInput = Read-Host "      Enter port for Backend API [$suggested]"
    $PORT_SERVER = if ([string]::IsNullOrWhiteSpace($userInput)) { $suggested } else { [int]$userInput }

    # Update server/.env
    if (Test-Path "server\.env") {
        $envContent = Get-Content "server\.env" -Raw
        $envContent = $envContent -replace "(?m)^PORT=.*", "PORT=$PORT_SERVER"
        $envContent | Set-Content -Path "server\.env" -Encoding UTF8 -NoNewline
    }
    Write-OK "Backend API will use port $PORT_SERVER"
}
else {
    Write-OK "Port $PORT_SERVER (Backend API) is available"
}

# Check client port
if (Test-PortInUse $PORT_CLIENT) {
    $proc = Get-PortProcess $PORT_CLIENT
    $procInfo = if ($proc) { " by '$proc'" } else { "" }
    $suggested = Find-NextAvailablePort $PORT_CLIENT
    Write-Warn "Port $PORT_CLIENT (Frontend) is in use$procInfo."
    $userInput = Read-Host "      Enter port for Frontend [$suggested]"
    $PORT_CLIENT = if ([string]::IsNullOrWhiteSpace($userInput)) { $suggested } else { [int]$userInput }

    # Update server/.env ALLOWED_ORIGIN
    if (Test-Path "server\.env") {
        $envContent = Get-Content "server\.env" -Raw
        $envContent = $envContent -replace "(?m)^ALLOWED_ORIGIN=.*", "ALLOWED_ORIGIN=http://localhost:$PORT_CLIENT"
        $envContent | Set-Content -Path "server\.env" -Encoding UTF8 -NoNewline
    }
    Write-OK "Frontend will use port $PORT_CLIENT"
}
else {
    Write-OK "Port $PORT_CLIENT (Frontend) is available"
}

# ── 3. PostgreSQL container ───────────────────────────────────────────────────

Write-Info "Starting PostgreSQL container..."
docker compose up -d db 2>&1 | Out-Null

$dbReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    docker exec vibe-tb-db pg_isready -U vibetb 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
}

if (-not $dbReady) {
    Write-Fail "PostgreSQL did not become ready. Check Docker Desktop logs."
    Stop-WithError
}
Write-OK "PostgreSQL is ready"

# ── 4. Install dependencies ───────────────────────────────────────────────────

Write-Info "Installing dependencies..."
npm install --silent 2>&1 | Out-Null
Push-Location server; npm install --silent 2>&1 | Out-Null; Pop-Location
Push-Location client; npm install --silent 2>&1 | Out-Null; Pop-Location
Write-OK "Dependencies installed"

# ── 5. Run migrations ─────────────────────────────────────────────────────────

Write-Info "Running database migrations..."
Push-Location server
$migOut = npx knex migrate:latest --knexfile knexfile.js 2>&1
$migExit = $LASTEXITCODE
Pop-Location

if ($migExit -ne 0) {
    Write-Fail "Migration failed:"
    Write-Host ($migOut | Out-String) -ForegroundColor Red
    Stop-WithError
}
Write-OK "Database schema is up to date"

# ── 6. Open browser (delayed) ─────────────────────────────────────────────────

$browserPort = $PORT_CLIENT
$null = Start-Job -ScriptBlock {
    param($p)
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:$p"
} -ArgumentList $browserPort

# ── 7. Start servers ──────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "    All systems go!  Starting servers..."      -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://localhost:$PORT_CLIENT" -ForegroundColor White
Write-Host "  Backend  : http://localhost:$PORT_SERVER" -ForegroundColor White

# Show the first-boot admin password if one was generated by setup.ps1. On
# repeat runs this is just a reminder; after the user rotates it, the value
# here is stale but harmless (login will require the rotated password).
$adminPw = $null
if (Test-Path "server\.env") {
    foreach ($line in Get-Content "server\.env") {
        if ($line -match "^INITIAL_ADMIN_PASSWORD=(.+)$") { $adminPw = $Matches[1]; break }
    }
}
if ($adminPw) {
    Write-Host "  Login    : admin / $adminPw" -ForegroundColor Cyan
    Write-Host "             (only valid on first login — you'll be asked to change it)" -ForegroundColor Gray
} else {
    Write-Host "  Login    : use your existing admin password" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

npm run dev
