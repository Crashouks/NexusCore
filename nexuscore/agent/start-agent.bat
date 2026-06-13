@echo off
cd /d "%~dp0"
title NexusCore Cloud Agent

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing agent dependencies...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist config.json (
  echo.
  echo  No config.json found.
  echo  Admin -^> Cloud -^> your machine -^> Agent Setup -^> Download config.json
  echo  Save it here as config.json, then run this script again.
  echo.
  if exist config.example.json (
    echo  Opening config.example.json as a template...
    copy /Y config.example.json config.json >nul
    notepad config.json
  )
  pause
  exit /b 1
)

echo.
echo  NexusCore Cloud Agent
echo  Folder: %CD%
echo.
node index.js
echo.
pause
