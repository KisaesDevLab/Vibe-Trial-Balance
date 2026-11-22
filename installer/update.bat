@echo off
title Vibe Trial Balance - Update
cd /d "%~dp0"

echo.
echo   ============================================
echo     Vibe Trial Balance - Updating
echo   ============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo   [!] Docker Desktop is not running. Start it first.
    pause
    exit /b 1
)

echo   Stopping current containers...
docker compose -f docker-compose.prod.yml down

echo   Downloading the latest images (this may take a few minutes)...
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate

echo.
echo   Waiting for app to become ready...
:wait
timeout /t 3 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost/api/v1/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait

echo.
echo   Update complete! App is running at http://localhost
echo.
start http://localhost
pause
