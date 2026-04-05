@echo off
title Vibe Trial Balance - Stopping
cd /d "%~dp0"

echo.
echo   Stopping Vibe Trial Balance...
docker compose -f docker-compose.prod.yml down
echo.
echo   Vibe Trial Balance has been stopped.
echo   Your data is preserved and will be available next time you start.
echo.
pause
