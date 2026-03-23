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
$GITHUB_REPO = "https://github.com/YOUR_USERNAME/vibe-tb.git"
$PROJECT_DIR = "$env:USERPROFILE\Projects\vibe-tb"

$DB_USER = "vibetb"
$DB_PASS = "localdev123"
$DB_NAME = "vibe_tb_db"
$DB_PORT = "5432"

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

Write-Step "1/7" "Checking Git"

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

Write-Step "2/7" "Checking Node.js"

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

Write-Step "3/7" "Checking Docker Desktop"

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
# STEP 4: CLONE / FIND REPO
# ============================================================

Write-Step "4/7" "Setting up project directory"

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
    if ($GITHUB_REPO -like "*YOUR_USERNAME*") {
        Write-Info "No GitHub repo URL configured. Creating local project..."
        New-Item -ItemType Directory -Path $PROJECT_DIR -Force | Out-Null
        Set-Location $PROJECT_DIR
        git init
        Write-OK "Created project at $PROJECT_DIR"
        Write-Host "  TIP: Update GITHUB_REPO at the top of setup.ps1 with your actual repo URL" -ForegroundColor Yellow
    }
    else {
        Write-Info "Cloning from $GITHUB_REPO..."
        $parentDir = Split-Path $PROJECT_DIR -Parent
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        git clone $GITHUB_REPO $PROJECT_DIR
        Set-Location $PROJECT_DIR
        Write-OK "Cloned repository"
    }
}

# ============================================================
# STEP 5: CREATE CONFIG FILES (if missing)
# ============================================================

Write-Step "5/7" "Checking configuration files"

if (Test-Path ".env") {
    Write-Skip ".env file exists"
}
else {
    Write-Info "Creating .env with dev defaults..."
    $randomSuffix = Get-Random -Maximum 999999
    $envLines = @(
        "# Database (matches docker-compose.yml)",
        "DB_HOST=127.0.0.1",
        "DB_PORT=$DB_PORT",
        "DB_NAME=$DB_NAME",
        "DB_USER=$DB_USER",
        "DB_PASSWORD=$DB_PASS",
        "",
        "# Auth",
        "JWT_SECRET=local-dev-secret-$randomSuffix",
        "JWT_EXPIRY=1h",
        "",
        "# Anthropic API (add your key when you reach Phase 5)",
        "ANTHROPIC_API_KEY=",
        "",
        "# Server",
        "PORT=3001",
        "NODE_ENV=development"
    )
    $envLines | Set-Content -Path ".env" -Encoding UTF8
    Write-OK "Created .env"
}

if (Test-Path "docker-compose.yml") {
    Write-Skip "docker-compose.yml exists"
}
else {
    Write-Fail "docker-compose.yml is missing!"
    Write-Host "  Make sure you have committed the starter kit files to your repo." -ForegroundColor Yellow
    exit 1
}

# ============================================================
# STEP 6: START POSTGRESQL
# ============================================================

Write-Step "6/7" "Starting PostgreSQL database"

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
    Write-OK "pgAdmin available at http://localhost:5050 (admin@local.dev / admin)"
}

# ============================================================
# STEP 7: INSTALL DEPENDENCIES + MIGRATE + SEED
# ============================================================

Write-Step "7/7" "Installing dependencies and setting up database"

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
        npx knex migrate:latest --knexfile knexfile.ts 2>&1 | ForEach-Object { Write-Info "  $_" }
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
        npx knex seed:run --knexfile knexfile.ts 2>&1 | ForEach-Object { Write-Info "  $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Seeding failed. Check the error above."
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-OK "Database seeded (admin user + tax line references)"
    }
}
else {
    Write-Info "server/package.json not found - skipping server setup"
    Write-Info "(This is normal if Claude Code has not built Phase 1 yet)"
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
else {
    Write-Info "client/package.json not found - skipping client setup"
    Write-Info "(This is normal if Claude Code has not built Phase 1 yet)"
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
Write-Host "  PostgreSQL:        localhost:$DB_PORT (user: $DB_USER)" -ForegroundColor White
Write-Host "  pgAdmin:           http://localhost:5050" -ForegroundColor White
Write-Host "    Login:           admin@local.dev / admin" -ForegroundColor Gray
Write-Host "    Add server:      Host=db  Port=5432  User=$DB_USER  Pass=$DB_PASS" -ForegroundColor Gray
Write-Host ""

if (Test-Path "server\src\app.ts") {
    Write-Host "  To start the backend:" -ForegroundColor Cyan
    Write-Host "    cd server" -ForegroundColor White
    Write-Host "    npm run dev" -ForegroundColor White
    Write-Host "    Then open: http://localhost:3001/api/v1/health" -ForegroundColor Gray
    Write-Host ""
}

if (Test-Path "client\package.json") {
    Write-Host "  To start the frontend:" -ForegroundColor Cyan
    Write-Host "    cd client" -ForegroundColor White
    Write-Host "    npm run dev" -ForegroundColor White
    Write-Host "    Then open: http://localhost:5173" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "  Or start both at once:" -ForegroundColor Cyan
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Next step:" -ForegroundColor Yellow
Write-Host "  Open Claude Code at claude.ai/code, connect your repo," -ForegroundColor Yellow
Write-Host "  and tell it: Read specs/plan.md. Start Phase 1." -ForegroundColor Yellow
Write-Host ""
