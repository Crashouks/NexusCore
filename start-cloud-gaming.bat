@echo off
cd /d "%~dp0\nexuscore\agent"
title NexusCore Cloud Gaming Agent
echo.
echo  Starting cloud gaming agent...
echo  Requires the site/API to be running first (start-site-network.bat).
echo  Config: nexuscore\agent\config.json
echo.
call start-agent.bat
