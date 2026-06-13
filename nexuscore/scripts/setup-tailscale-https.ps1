# Configure Tailscale Serve (HTTPS on your tailnet) and update nexuscore/.env
param(
    [int]$WebPort = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $root '.env'

function Get-TailscaleExe {
    $cmd = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $default = "${env:ProgramFiles}\Tailscale\tailscale.exe"
    if (Test-Path $default) { return $default }
    return $null
}

function Get-TailscaleDnsName([string]$TailscaleExe) {
    $jsonText = & $TailscaleExe status --json 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "tailscale status failed. Run: tailscale up"
    }
    $json = $jsonText | ConvertFrom-Json
    $name = $json.Self.DNSName
    if ([string]::IsNullOrWhiteSpace($name)) {
        throw "Could not read Tailscale DNS name. Enable MagicDNS in the Tailscale admin console."
    }
    return $name.TrimEnd('.')
}

function Upsert-EnvLine([string[]]$Lines, [string]$Key, [string]$Value) {
    $pattern = "^\s*$([regex]::Escape($Key))="
    $filtered = @($Lines | Where-Object { $_ -notmatch $pattern })
    while ($filtered.Count -gt 0 -and [string]::IsNullOrWhiteSpace($filtered[-1])) {
        $filtered = $filtered[0..($filtered.Count - 2)]
    }
    $filtered += "$Key=$Value"
    return ,$filtered
}

$ts = Get-TailscaleExe
if (-not $ts) {
    Write-Host "Tailscale CLI not found." -ForegroundColor Red
    Write-Host "Install Tailscale from https://tailscale.com/download and run: tailscale up" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  NexusCore HTTPS (Tailscale Serve)" -ForegroundColor Cyan
Write-Host ""

$dnsName = Get-TailscaleDnsName $ts
$webUrl = "https://$dnsName"
$apiUrl = "https://$dnsName/api"

Write-Host "  Tailscale hostname: $dnsName" -ForegroundColor DarkGray
Write-Host "  Resetting previous serve config..." -ForegroundColor DarkGray
& $ts serve reset 2>&1 | Out-Null

Write-Host "  Serving http://127.0.0.1:$WebPort over HTTPS on your tailnet..." -ForegroundColor DarkGray
& $ts serve --bg $WebPort
if ($LASTEXITCODE -ne 0) {
    Write-Host "tailscale serve failed. Try: tailscale serve --bg http://127.0.0.1:$WebPort" -ForegroundColor Yellow
    & $ts serve --bg "http://127.0.0.1:$WebPort"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

$lines = @()
if (Test-Path $envPath) {
    $lines = @(Get-Content $envPath)
} elseif (Test-Path (Join-Path $root '.env.example')) {
    $lines = @(Get-Content (Join-Path $root '.env.example'))
}

$lines = Upsert-EnvLine $lines 'NETWORK_MODE' '1'
$lines = Upsert-EnvLine $lines 'API_BIND' '0.0.0.0'
$lines = Upsert-EnvLine $lines 'HTTPS_MODE' '1'
$lines = Upsert-EnvLine $lines 'PUBLIC_WEB_URL' $webUrl
$lines = Upsert-EnvLine $lines 'PUBLIC_API_URL' $apiUrl
$lines += ''
Set-Content -Path $envPath -Value ($lines -join "`n") -Encoding UTF8

$env:HTTPS_MODE = '1'
$env:NETWORK_MODE = '1'
$env:PUBLIC_WEB_URL = $webUrl
$env:PUBLIC_API_URL = $apiUrl

& node (Join-Path $PSScriptRoot 'sync-network-env.js') --network --https

Write-Host ""
Write-Host "  HTTPS ready (Tailscale only - not public internet):" -ForegroundColor Green
Write-Host "  Website:  $webUrl" -ForegroundColor White
Write-Host "  API:      $apiUrl" -ForegroundColor White
Write-Host ""
Write-Host "  On your player PC (Kali): open $webUrl in the browser." -ForegroundColor DarkGray
Write-Host "  Agent on this PC can still use http://localhost:5000/api" -ForegroundColor DarkGray
Write-Host "  Disable HTTPS serve: tailscale serve reset" -ForegroundColor DarkGray
Write-Host ""
