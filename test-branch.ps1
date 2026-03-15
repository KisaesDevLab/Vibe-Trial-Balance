<#
  Trial Balance App - Test a Branch
  Usage: .\test-branch.ps1 build/phase-2
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="Branch name to test (e.g. build/phase-2)")]
    [string]$BranchName
)

$ErrorActionPreference = "Continue"

function Write-OK($message) { Write-Host "  [OK] $message" -ForegroundColor Green }
function Write-Info($message) { Write-Host "  $message" -ForegroundColor Gray }
function Write-Fail($message) { Write-Host "  [FAIL] $message" -ForegroundColor Red }

Write-Host ""
Write-Host "Testing branch: $BranchName" -ForegroundColor Cyan
Write-Host ""

# Check Docker
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker Desktop is not running! Start it first."
    exit 1
}

# Make sure database is running
$dbRunning = docker ps --filter "name=trialbalance-db" --format "{{.Names}}" 2>$null
if ($dbRunning -ne "trialbalance-db") {
    Write-Info "Starting PostgreSQL..."
    docker compose up -d db 2>$null
    for ($i = 0; $i -lt 15; $i++) {
        docker exec trialbalance-db pg_isready -U trialbalance 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }
    Write-OK "PostgreSQL started"
}

# Stash any local changes
$status = git status --porcelain
if ($status) {
    Write-Info "Stashing your uncommitted changes..."
    git stash push -m "auto-stash before testing $BranchName"
    Write-OK "Changes stashed (get them back with: git stash pop)"
}

# Fetch and checkout the branch
Write-Info "Fetching latest from remote..."
git fetch origin 2>$null

Write-Info "Switching to branch: $BranchName"
git checkout $BranchName 2>$null
if ($LASTEXITCODE -ne 0) {
    git checkout -b $BranchName "origin/$BranchName" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Branch $BranchName not found locally or on remote."
        Write-Host "  Available remote branches:" -ForegroundColor Yellow
        git branch -r | Where-Object { $_ -notmatch "HEAD" } | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        exit 1
    }
}

git pull origin $BranchName 2>$null
Write-OK "On branch: $BranchName"

# Install dependencies
Write-Info "Installing dependencies..."
npm install --silent 2>$null
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
Write-OK "Dependencies installed"

# Run migrations
if (Test-Path "server\migrations") {
    Write-Info "Running database migrations..."
    Push-Location server
    npx knex migrate:latest --knexfile knexfile.ts 2>&1 | ForEach-Object { Write-Info "  $_" }
    Pop-Location
    Write-OK "Migrations applied"
}

# Start servers
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Branch $BranchName is ready to test!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  Health:    http://localhost:3001/api/v1/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  When done testing:" -ForegroundColor Yellow
Write-Host "    Ctrl+C to stop servers" -ForegroundColor White
Write-Host "    git checkout main        - go back to main" -ForegroundColor White
Write-Host "    git stash pop            - restore your stashed changes" -ForegroundColor White
Write-Host ""

npm run dev
