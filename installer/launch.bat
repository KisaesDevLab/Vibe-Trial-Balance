@echo off
title Vibe Trial Balance
cd /d "%~dp0"

echo.
echo   ============================================
echo     Vibe Trial Balance - Starting Up
echo   ============================================
echo.

:: ── Docker Desktop must be running ─────────────────────────────────────────
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

:: ── Port 80 conflict detection ─────────────────────────────────────────────
:: The client nginx container binds to port 80. If something else (IIS, Skype
:: classic, another local web server) is listening, the container will fail
:: with a cryptic bind error — we detect it here and surface a human message
:: before Docker gets involved.
powershell -Command "$c = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue; if ($c) { $p = Get-Process -Id $c[0].OwningProcess -ErrorAction SilentlyContinue; if ($p) { Write-Output ('BLOCKED_BY: ' + $p.ProcessName) } else { Write-Output 'BLOCKED_BY: unknown' } } else { Write-Output 'FREE' }" > "%TEMP%\vibetb_port80.txt" 2>nul
set /p PORT80_STATUS=<"%TEMP%\vibetb_port80.txt"
del "%TEMP%\vibetb_port80.txt" 2>nul
echo %PORT80_STATUS% | findstr /i "BLOCKED_BY" >nul
if not errorlevel 1 (
    echo.
    echo   [!] Port 80 on this computer is already in use.
    echo       %PORT80_STATUS%
    echo.
    echo       Stop the conflicting program (common culprits: IIS, Skype Classic,
    echo       or another local web server) and run this script again.
    echo.
    pause
    exit /b 1
)

:: ── Start the containers (building on first run) ───────────────────────────
docker compose -f docker-compose.prod.yml ps --format "{{.Name}}" 2>nul | findstr /i "vibetb" >nul 2>&1
if not errorlevel 1 (
    echo   [OK] Containers are already running
    goto :healthy
)

echo   Starting containers...
echo   ^(First run builds the images locally and can take 5-10 minutes on a fresh machine.
echo    Subsequent starts are fast.^)
docker compose -f docker-compose.prod.yml up -d --build
if errorlevel 1 (
    echo.
    echo   [ERROR] Failed to start containers.
    echo           Review the output above. Most common causes:
    echo             * Docker Desktop still initializing — wait 30s and retry.
    echo             * Missing .env file — reinstall to regenerate it.
    echo             * Disk full.
    pause
    exit /b 1
)

:healthy
:: ── Wait for the health endpoint to report ready ───────────────────────────
:: Budget: 10 minutes. On first boot the server must run migrations, seed the
:: DB, and start Node before /api/v1/health returns 200.
echo.
echo   Waiting for the app to come online (up to 10 minutes on first launch)...
set ATTEMPTS=0

:wait
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 200 (
    echo.
    echo   [ERROR] App did not start within 10 minutes.
    echo          Something failed during boot. Run this to inspect logs:
    echo            docker compose -f docker-compose.prod.yml logs --tail 100
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul

powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost/api/v1/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait

:: ── Surface the first-boot admin password ──────────────────────────────────
:: .env is the authoritative source — that's what the seed reads to set the
:: bootstrap password. FIRST_LOGIN.txt is just a human-readable copy.
:: (Earlier we tried parsing FIRST_LOGIN.txt with findstr /i "Password", but
:: the file has 3 lines containing that substring and the FOR loop left
:: ADMIN_PW set to garbage from the last descriptive line. .env has exactly
:: one line matching INITIAL_ADMIN_PASSWORD= so the parse is unambiguous.)
set ADMIN_PW=
if exist .env (
    for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"INITIAL_ADMIN_PASSWORD=" .env') do set ADMIN_PW=%%B
)
:: Only show the banner if the DB still has a temp password. Query the server
:: with the candidate password; if it returns mustChangePassword=true we know
:: the user hasn't rotated yet.
set FIRST_BOOT=
if not "%ADMIN_PW%"=="" (
    powershell -Command "try { $body = @{username='admin'; password=$env:ADMIN_PW} | ConvertTo-Json -Compress; $r = Invoke-RestMethod -Uri 'http://localhost/api/v1/auth/login' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5; if ($r.data.user.mustChangePassword) { Write-Output 'first' } else { Write-Output 'rotated' } } catch { Write-Output 'unknown' }" > "%TEMP%\vibetb_auth.txt" 2>nul
    set /p FIRST_BOOT=<"%TEMP%\vibetb_auth.txt"
    del "%TEMP%\vibetb_auth.txt" 2>nul
)

echo.
echo   ============================================
echo     Vibe Trial Balance is running!
echo   ============================================
echo.
echo   App:     http://localhost
if "%FIRST_BOOT%"=="first" (
    echo.
    echo   First-time login ^(you'll be asked to pick a new password^):
    echo     Username:  admin
    echo     Password:  %ADMIN_PW%
    echo.
    if exist FIRST_LOGIN.txt (
        echo   Opening FIRST_LOGIN.txt so you can copy-paste the password.
        echo   Keep that window open until you've signed in and changed the password.
        start "" notepad.exe "%CD%\FIRST_LOGIN.txt"
    )
) else (
    echo   Login:   use your admin account
    :: The user has rotated the password, so FIRST_LOGIN.txt is stale noise.
    :: Sweep it so the next launch doesn't show misleading credentials.
    if exist FIRST_LOGIN.txt (
        del /q FIRST_LOGIN.txt >nul 2>&1
    )
)
echo.

:: Open the app in the default browser
start http://localhost

echo   Press any key to close this window.
echo   ^(The app keeps running in the background.^)
pause >nul
