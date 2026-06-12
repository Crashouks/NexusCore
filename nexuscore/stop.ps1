# Stop NexusCore dev processes on ports 5000 and 5173
$ports = 5000, 5173
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

if ($killed -eq 0) {
    Write-Host "Nothing running on ports 5000 or 5173." -ForegroundColor DarkGray
} else {
    Write-Host "Stopped $killed process(es). You can run start.bat now." -ForegroundColor Green
}
