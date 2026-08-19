@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo  Sculpting the Silence
echo ==========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-server.ps1"
echo.
pause
