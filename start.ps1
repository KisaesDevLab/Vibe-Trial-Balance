<#
  Trial Balance App - Daily Start Script
  Run: .\start.ps1
#>

$ErrorActionPreference = "Continue"
$PROJECT_DIR = $PSScriptRoot

function Write-OK($message) { Write-Host "  [OK] $message" -ForegroundColor Green }
function Write-Info($message) { Write-Host "  $message" -ForegroundColor Gray }
function Write-Fail($message) { Write-Host "  [FAIL] $message" -ForegroundColor Red }

Write-Host ""
Write-Host "Starting Trial Balance App..." -ForegroundColor Cyan
Write-Host ""

Set-Location $PROJECT_DIR

# 1. Check Docker is running
Write-Info "Checking Docker..."
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker Desktop is not running!"
    Write-Host "  Start Docker Desktop from the Start Menu and wait for it to load." -ForegroundColor Yellow
    Write-Host "  Then run this script again." -ForegroundColor Yellow
    exit 1
}
Write-OK "Docker is running"

# 2. Start database
Write-Info "Starting PostgreSQL..."
$dbRunning = docker ps --filter "name=trialbalance-db" --format "{{.Names}}" 2>$null
if ($dbRunning -eq "trialbalance-db") {
    Write-OK "PostgreSQL already running"
}
else {
    docker compose up -d db 2>$null
    for ($i = 0; $i -lt 15; $i++) {
        docker exec trialbalance-db pg_isready -U trialbalance 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }
    Write-OK "PostgreSQL started"
}

# 3. Start pgAdmin
$pgRunning = docker ps --filter "name=trialbalance-pgadmin" --format "{{.Names}}" 2>$null
if ($pgRunning -ne "trialbalance-pgadmin") {
    docker compose up -d pgadmin 2>$null
}

# 4. Pull latest code
Write-Info "Pulling latest code..."
$branch = git branch --show-current 2>$null
if ($branch) {
    git pull origin $branch 2>$null
    Write-OK "On branch: $branch (pulled latest)"
}
else {
    Write-Info "Not on a branch or no remote - skipping pull"
}

# 5. Install dependencies if needed
Write-Info "Checking dependencies..."
if (Test-Path "server\package.json") {
    Push-Location server
    npm install --silent 2>$null
    Pop-Location
}
if (Test-Path "client\package.json") {
    Push-Location client
    npm install --silent 2>$null
    Pop-Location
}
npm install --silent 2>$null
Write-OK "Dependencies up to date"

# 6. Run any pending migrations
if (Test-Path "server\migrations") {
    Write-Info "Checking for new migrations..."
    Push-Location server
    $migrationOutput = npx knex migrate:latest --knexfile knexfile.ts 2>&1
    Pop-Location
    if ($migrationOutput -match "already up to date") {
        Write-OK "Database schema up to date"
    }
    else {
        Write-OK "New migrations applied"
    }
}

# 7. Start both servers
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Ready! Starting servers..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  pgAdmin:   http://localhost:5050" -ForegroundColor White
Write-Host "  Health:    http://localhost:3001/api/v1/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host ""

npm run dev
