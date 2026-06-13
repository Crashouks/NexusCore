# NexusCore — starts website/API and cloud agent in separate windows
$Root = $PSScriptRoot

Write-Host ""
Write-Host "  NexusCore full stack" -ForegroundColor Cyan
Write-Host "  Window 1: Website + API (start.ps1)" -ForegroundColor DarkGray
Write-Host "  Window 2: Cloud agent (nexuscore/agent)" -ForegroundColor DarkGray
Write-Host ""

Start-Process powershell -WorkingDirectory $Root -ArgumentList @(
  "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$Root\start.ps1`""
) | Out-Null

Start-Sleep -Seconds 2

$agentDir = Join-Path $Root "nexuscore\agent"
if (-not (Test-Path $agentDir)) {
  Write-Host "  Agent folder not found: $agentDir" -ForegroundColor Red
  exit 1
}

Start-Process cmd -WorkingDirectory $agentDir -ArgumentList @("/k", "start-agent.bat") | Out-Null

Write-Host "  Started app + agent in separate windows." -ForegroundColor Green
Write-Host ""
Write-Host "  First time? Admin -> Cloud -> your PC -> Agent Setup -> Download config.json" -ForegroundColor Yellow
Write-Host "  Save it to nexuscore/agent/config.json then restart the agent window." -ForegroundColor Yellow
Write-Host ""
