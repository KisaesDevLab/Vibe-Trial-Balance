@echo off
title Vibe Trial Balance
cd /d "%~dp0"

echo.
echo   ============================================
echo     Vibe Trial Balance - Starting Up
echo   ============================================
echo.

:: Check Docker Desktop is running
echo   Checking Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Docker Desktop is not running.
    echo       Please start Docker Desktop from the Start Menu,
    echo       wait for it to finish loading, then try again.
    echo.
    pause
    exit /b 1
)
echo   [OK] Docker Desktop is running

:: Check if containers are already running
docker compose -f docker-compose.prod.yml ps --format "{{.Name}}" 2>nul | findstr /i "vibetb" >nul 2>&1
if not errorlevel 1 (
    echo   [OK] Containers are already running
    goto :healthy
)

:: Start containers (build on first run, cached after)
echo   Starting containers (first run may take 3-5 minutes)...
docker compose -f docker-compose.prod.yml up -d --build
if errorlevel 1 (
    echo.
    echo   [ERROR] Failed to start containers. Check Docker Desktop logs.
    pause
    exit /b 1
)

:healthy
echo   Waiting for app to become ready...
set ATTEMPTS=0

:wait
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    echo.
    echo   [ERROR] App did not start within 3 minutes.
    echo          Check: docker compose -f docker-compose.prod.yml logs
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul

:: Use PowerShell to test health endpoint (curl may not be available)
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost/api/v1/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait

echo.
echo   ============================================
echo     Vibe Trial Balance is running!
echo   ============================================
echo.
echo   App:     http://localhost
echo   Login:   admin / admin  (change immediately)
echo.

:: Open browser
start http://localhost

echo   Press any key to close this window.
echo   (The app keeps running in the background.)
pause >nul
