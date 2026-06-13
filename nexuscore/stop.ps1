# Stop NexusCore dev processes on API + Vite ports (including Vite fallback 5174+)
$ports = 5000, 5173, 5174, 5175, 5176
$killed = 0

foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping $($proc.ProcessName) (PID $($proc.Id)) on port $port" -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }
}

# Stop orphaned NexusCore.Api if still running
Get-Process -Name "NexusCore.Api" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping NexusCore.Api (PID $($_.Id))" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $killed++
}

$ts = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $ts) {
    $default = "${env:ProgramFiles}\Tailscale\tailscale.exe"
    if (Test-Path $default) { $ts = Get-Command $default -ErrorAction SilentlyContinue }
}
if ($ts) {
    & $ts.Source serve reset 2>$null
    Write-Host "Tailscale HTTPS serve disabled (back to HTTP-only)." -ForegroundColor DarkGray
}

if ($killed -eq 0) {
    Write-Host "Nothing running on ports 5000 or 5173-5176." -ForegroundColor DarkGray
} else {
    Write-Host "Stopped $killed process(es). You can run start-site-network.bat now." -ForegroundColor Green
}
