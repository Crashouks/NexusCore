@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
echo.
echo App and agent are running in other windows. You can close this one.
timeout /t 6 >nul
