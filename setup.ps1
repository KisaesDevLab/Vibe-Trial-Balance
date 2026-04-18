<#
  Vibe Trial Balance - One-Time Dev Environment Setup

  Run in PowerShell as Administrator:
    Set-ExecutionPolicy Bypass -Scope Process -Force
    .\setup.ps1
#>

$ErrorActionPreference = "Stop"

# ============================================================
# CONFIG - Edit these before running
# ============================================================
$GITHUB_REPO = "https://github.com/KisaesDevLab/Vibe-Trial-Balance.git"
$PROJECT_DIR = "$env:USERPROFILE\Projects\Vibe-Trial-Balance"

$DB_USER = "vibetb"
$DB_PASS = "localdev123"
$DB_NAME = "vibe_tb_db"

# Default ports (will be adjusted if conflicts are detected)
$PORT_DB = 5432
$PORT_PGADMIN = 5050
$PORT_SERVER = 3001
$PORT_CLIENT = 5173

# ============================================================
# HELPER FUNCTIONS
# ============================================================

function Write-Step($step, $message) {
    Write-Host ""
    Write-Host "[$step] $message" -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray
}

function Write-OK($message) {
    Write-Host "  [OK] $message" -ForegroundColor Green
}

function Write-Skip($message) {
    Write-Host "  [SKIP] $message (already done)" -ForegroundColor Yellow
}

function Write-Fail($message) {
    Write-Host "  [FAIL] $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "  $message" -ForegroundColor Gray
}

function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    $env:Path = $machinePath + ";" + $userPath
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

function Resolve-Port($port, $name) {
    if (Test-PortInUse $port) {
        $process = Get-PortProcess $port
        $processInfo = if ($process) { " by '$process'" } else { "" }
        $suggested = Find-NextAvailablePort $port

        Write-Host ""
        Write-Host "  [!] Port $port ($name) is already in use$processInfo." -ForegroundColor Yellow
        Write-Host "      Suggested alternative: $suggested" -ForegroundColor Cyan

        $userInput = Read-Host "      Enter port for $name [$suggested]"
        if ([string]::IsNullOrWhiteSpace($userInput)) {
            $chosen = $suggested
        } else {
            $chosen = [int]$userInput
        }

        # Verify chosen port is free
        if (Test-PortInUse $chosen) {
            Write-Host "      Port $chosen is also in use. Using $suggested instead." -ForegroundColor Yellow
            $chosen = $suggested
        }

        Write-OK "$name will use port $chosen"
        return $chosen
    }
    else {
        Write-OK "Port $port ($name) is available"
        return $port
    }
}

# ============================================================
# PRE-FLIGHT CHECK
# ============================================================

Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host "  Vibe Trial Balance - Dev Environment Setup" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "Please run this script as Administrator!"
    Write-Host "  Right-click PowerShell, choose Run as Administrator" -ForegroundColor Yellow
    Write-Host "  Then run: Set-ExecutionPolicy Bypass -Scope Process -Force" -ForegroundColor Yellow
    Write-Host "  Then run: .\setup.ps1" -ForegroundColor Yellow
    exit 1
}

$hasWinget = Test-Command "winget"
if (-not $hasWinget) {
    Write-Fail "winget not found. Install App Installer from the Microsoft Store."
    Write-Host "  https://apps.microsoft.com/detail/9nblggh4nns1" -ForegroundColor Yellow
    exit 1
}
Write-OK "winget is available"

# ============================================================
# STEP 1: GIT
# ============================================================

Write-Step "1/8" "Checking Git"

if (Test-Command "git") {
    $gitVersion = git --version
    Write-Skip "Git is installed ($gitVersion)"
}
else {
    Write-Info "Installing Git..."
    winget install --id Git.Git --accept-source-agreements --accept-package-agreements -e
    Refresh-Path

    if (Test-Command "git") {
        Write-OK "Git installed successfully"
    }
    else {
        Write-Fail "Git installation failed. Install manually from https://git-scm.com/download/win"
        Write-Host "  After installing, restart this script." -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================
# STEP 2: NODE.JS
# ============================================================

Write-Step "2/8" "Checking Node.js"

if (Test-Command "node") {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion.TrimStart("v").Split(".")[0])

    if ($majorVersion -ge 20) {
        Write-Skip "Node.js $nodeVersion is installed (meets v20+ requirement)"
    }
    else {
        Write-Info "Node.js $nodeVersion is too old. Installing v20 LTS..."
        winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e
        Refresh-Path
    }
}
else {
    Write-Info "Installing Node.js 20 LTS..."
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e
    Refresh-Path
}

if (Test-Command "node") {
    $nodeVersion = node --version
    Write-OK "Node.js $nodeVersion ready"
    $npmVersion = npm --version
    Write-OK "npm v$npmVersion ready"
}
else {
    Write-Fail "Node.js not found after install. Close this window, reopen PowerShell as Admin, and run the script again."
    exit 1
}

# ============================================================
# STEP 3: DOCKER
# ============================================================

Write-Step "3/8" "Checking Docker Desktop"

if (Test-Command "docker") {
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Skip "Docker Desktop is installed and running"
        }
        else {
            Write-Fail "Docker is installed but not running."
            Write-Host "  Start Docker Desktop from the Start Menu, wait for it to finish loading," -ForegroundColor Yellow
            Write-Host "  then run this script again." -ForegroundColor Yellow
            exit 1
        }
    }
    catch {
        Write-Fail "Docker is installed but not responding."
        Write-Host "  Start Docker Desktop, wait for it to finish loading, then re-run this script." -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Info "Installing Docker Desktop..."
    Write-Info "(This may take a few minutes and require a restart)"
    winget install --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements -e

    Write-Host ""
    Write-Host "  !! IMPORTANT !!" -ForegroundColor Yellow
    Write-Host "  Docker Desktop was just installed. You need to:" -ForegroundColor Yellow
    Write-Host "    1. Restart your computer" -ForegroundColor White
    Write-Host "    2. Open Docker Desktop from the Start Menu" -ForegroundColor White
    Write-Host "    3. Wait until it says Docker Desktop is running" -ForegroundColor White
    Write-Host "    4. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 0
}

# ============================================================
# STEP 4: PORT CONFLICT DETECTION
# ============================================================

Write-Step "4/8" "Checking for port conflicts"

$PORT_DB = Resolve-Port $PORT_DB "PostgreSQL"
$PORT_PGADMIN = Resolve-Port $PORT_PGADMIN "pgAdmin"
$PORT_SERVER = Resolve-Port $PORT_SERVER "Backend API"
$PORT_CLIENT = Resolve-Port $PORT_CLIENT "Frontend (Vite)"

Write-Host ""
Write-Info "Ports: PostgreSQL=$PORT_DB  pgAdmin=$PORT_PGADMIN  Server=$PORT_SERVER  Client=$PORT_CLIENT"

# ============================================================
# STEP 5: CLONE / FIND REPO
# ============================================================

Write-Step "5/8" "Setting up project directory"

if (Test-Path "$PROJECT_DIR\.git") {
    Write-Skip "Project already exists at $PROJECT_DIR"
    Set-Location $PROJECT_DIR
    Write-Info "Pulling latest changes..."
    git pull origin main 2>$null
}
elseif (Test-Path $PROJECT_DIR) {
    Write-Info "Directory exists but no git repo. Initializing..."
    Set-Location $PROJECT_DIR
    if (-not (Test-Path ".git")) {
        git init
        Write-Info "To add a remote repo run: git remote add origin YOUR_REPO_URL"
    }
}
else {
    Write-Info "Cloning from $GITHUB_REPO..."
    $parentDir = Split-Path $PROJECT_DIR -Parent
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    git clone $GITHUB_REPO $PROJECT_DIR
    Set-Location $PROJECT_DIR
    Write-OK "Cloned repository"
}

# ============================================================
# STEP 6: CREATE CONFIG FILES (if missing)
# ============================================================

Write-Step "6/8" "Checking configuration files"

if (Test-Path "server\.env") {
    Write-Skip "server/.env file exists"
    # Update ports in existing .env if they differ from defaults
    $envContent = Get-Content "server\.env" -Raw
    if ($PORT_SERVER -ne 3001) {
        $envContent = $envContent -replace "(?m)^PORT=.*", "PORT=$PORT_SERVER"
    }
    if ($PORT_DB -ne 5432) {
        $envContent = $envContent -replace "(?m)^DB_PORT=.*", "DB_PORT=$PORT_DB"
    }
    if ($PORT_CLIENT -ne 5173) {
        $envContent = $envContent -replace "(?m)^ALLOWED_ORIGIN=.*", "ALLOWED_ORIGIN=http://localhost:$PORT_CLIENT"
    }
    $envContent | Set-Content -Path "server\.env" -Encoding UTF8 -NoNewline
    Write-Info "Updated server/.env with resolved ports"
}
else {
    Write-Info "Creating server/.env with dev defaults..."
    $randomSuffix = Get-Random -Maximum 999999
    $envLines = @(
        "# Database (matches docker-compose.yml)",
        "DB_HOST=127.0.0.1",
        "DB_PORT=$PORT_DB",
        "DB_NAME=$DB_NAME",
        "DB_USER=$DB_USER",
        "DB_PASSWORD=$DB_PASS",
        "",
        "# Auth",
        "JWT_SECRET=local-dev-secret-$randomSuffix",
        "JWT_EXPIRY=8h",
        "",
        "# Anthropic API (optional — can also configure in Admin > Settings)",
        "ANTHROPIC_API_KEY=",
        "",
        "# Server",
        "PORT=$PORT_SERVER",
        "NODE_ENV=development",
        "ALLOWED_ORIGIN=http://localhost:$PORT_CLIENT"
    )
    $envLines | Set-Content -Path "server\.env" -Encoding UTF8
    Write-OK "Created server/.env"
}

if (Test-Path "docker-compose.yml") {
    Write-Skip "docker-compose.yml exists"
    # Update port mappings if non-default
    if ($PORT_DB -ne 5432 -or $PORT_PGADMIN -ne 5050) {
        $dcContent = Get-Content "docker-compose.yml" -Raw
        if ($PORT_DB -ne 5432) {
            $dcContent = $dcContent -replace '"5432:5432"', "`"${PORT_DB}:5432`""
        }
        if ($PORT_PGADMIN -ne 5050) {
            $dcContent = $dcContent -replace '"5050:5050"', "`"${PORT_PGADMIN}:5050`""
        }
        $dcContent | Set-Content -Path "docker-compose.yml" -Encoding UTF8 -NoNewline
        Write-Info "Updated docker-compose.yml with resolved ports"
    }
}
else {
    Write-Fail "docker-compose.yml is missing!"
    Write-Host "  Make sure you have committed the starter kit files to your repo." -ForegroundColor Yellow
    exit 1
}

# ============================================================
# STEP 7: START POSTGRESQL
# ============================================================

Write-Step "7/8" "Starting PostgreSQL database"

$dbRunning = docker ps --filter "name=vibe-tb-db" --format "{{.Names}}" 2>$null
if ($dbRunning -eq "vibe-tb-db") {
    Write-Skip "PostgreSQL container is already running"
}
else {
    $dbExists = docker ps -a --filter "name=vibe-tb-db" --format "{{.Names}}" 2>$null
    if ($dbExists -eq "vibe-tb-db") {
        Write-Info "Starting existing PostgreSQL container..."
        docker compose start db
    }
    else {
        Write-Info "Creating and starting PostgreSQL container..."
        docker compose up -d db
    }

    Write-Info "Waiting for PostgreSQL to accept connections..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker exec vibe-tb-db pg_isready -U $DB_USER 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }

    if ($ready) {
        Write-OK "PostgreSQL is ready"
    }
    else {
        Write-Fail "PostgreSQL did not start in time. Check: docker compose logs db"
        exit 1
    }
}

$testQuery = docker exec vibe-tb-db psql -U $DB_USER -d $DB_NAME -c "SELECT 1 AS connected;" -t 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-OK "Database connection verified"
}
else {
    Write-Fail "Cannot connect to database. Check: docker compose logs db"
    exit 1
}

$pgAdminRunning = docker ps --filter "name=vibe-tb-pgadmin" --format "{{.Names}}" 2>$null
if ($pgAdminRunning -ne "vibe-tb-pgadmin") {
    Write-Info "Starting pgAdmin (database browser)..."
    docker compose up -d pgadmin 2>$null
    Write-OK "pgAdmin available at http://localhost:$PORT_PGADMIN (admin@local.dev / admin)"
}

# ============================================================
# STEP 8: INSTALL DEPENDENCIES + MIGRATE + SEED
# ============================================================

Write-Step "8/8" "Installing dependencies and setting up database"

if (Test-Path "package.json") {
    Write-Info "Installing root dependencies..."
    npm install 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed at project root"
        exit 1
    }
    Write-OK "Root dependencies installed"
}

if (Test-Path "server\package.json") {
    Write-Info "Installing server dependencies..."
    Push-Location server
    npm install 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed in server/"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-OK "Server dependencies installed"

    if (Test-Path "server\migrations") {
        Write-Info "Running database migrations..."
        Push-Location server
        npx knex migrate:latest --knexfile knexfile.js 2>&1 | ForEach-Object { Write-Info "  $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Migration failed. Check the error above."
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-OK "Database migrations complete"

        $tableCount = docker exec vibe-tb-db psql -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>$null
        $tableCount = $tableCount.Trim()
        Write-OK "$tableCount tables created"
    }

    if (Test-Path "server\seeds") {
        Write-Info "Seeding database with default data..."
        Push-Location server
        npx knex seed:run --knexfile knexfile.js 2>&1 | ForEach-Object { Write-Info "  $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Seeding failed. Check the error above."
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-OK "Database seeded (admin user + tax codes + demo data)"
    }
}

if (Test-Path "client\package.json") {
    Write-Info "Installing client dependencies..."
    Push-Location client
    npm install 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed in client/"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-OK "Client dependencies installed"
}

# ============================================================
# FINAL VERIFICATION
# ============================================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Project location:  $PROJECT_DIR" -ForegroundColor White
Write-Host "  PostgreSQL:        localhost:$PORT_DB (user: $DB_USER)" -ForegroundColor White
Write-Host "  pgAdmin:           http://localhost:$PORT_PGADMIN" -ForegroundColor White
Write-Host "    Login:           admin@local.dev / admin" -ForegroundColor Gray
Write-Host "    Add server:      Host=db  Port=5432  User=$DB_USER  Pass=$DB_PASS" -ForegroundColor Gray
Write-Host ""

Write-Host "  To start the app:" -ForegroundColor Cyan
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Frontend:  http://localhost:$PORT_CLIENT" -ForegroundColor White
Write-Host "  Backend:   http://localhost:$PORT_SERVER" -ForegroundColor White
Write-Host ""
Write-Host "  Default login:  admin / admin  (change immediately)" -ForegroundColor Yellow
Write-Host ""
