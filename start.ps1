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

# ── 2. PostgreSQL container ───────────────────────────────────────────────────

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

# ── 3. Install dependencies ───────────────────────────────────────────────────

Write-Info "Installing dependencies..."
npm install --silent 2>&1 | Out-Null
Push-Location server; npm install --silent 2>&1 | Out-Null; Pop-Location
Push-Location client; npm install --silent 2>&1 | Out-Null; Pop-Location
Write-OK "Dependencies installed"

# ── 4. Run migrations ─────────────────────────────────────────────────────────

Write-Info "Running database migrations..."
Push-Location server
$migOut = npx tsx ./node_modules/knex/bin/cli.js migrate:latest --knexfile knexfile.ts 2>&1
$migExit = $LASTEXITCODE
Pop-Location

if ($migExit -ne 0) {
    Write-Fail "Migration failed:"
    Write-Host ($migOut | Out-String) -ForegroundColor Red
    Stop-WithError
}
Write-OK "Database schema is up to date"

# ── 5. Open browser (delayed) ─────────────────────────────────────────────────

$null = Start-Job {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:5173"
}

# ── 6. Start servers ──────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "    All systems go!  Starting servers..."      -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:3001" -ForegroundColor White
Write-Host "  Login    : admin / admin"         -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

npm run dev
