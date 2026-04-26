$ErrorActionPreference = "SilentlyContinue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"
$port = 8000

function Get-BackendStatus {
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

function Start-Backend {
    $running = Get-BackendStatus
    if ($running) {
        Write-Host "Server already running on port $port" -ForegroundColor Green
        return
    }
    
    Write-Host "Starting Chrome Assistant Backend..." -ForegroundColor Yellow
    $env:PORT = $port
    Start-Process python -ArgumentList "server.py" -WorkingDirectory $backendPath -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    if (Get-BackendStatus) {
        Write-Host "Server started successfully on port $port" -ForegroundColor Green
    } else {
        Write-Host "Failed to start server" -ForegroundColor Red
    }
}

function Stop-Backend {
    $running = Get-BackendStatus
    if (-not $running) {
        Write-Host "Server is not running" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Stopping server..." -ForegroundColor Yellow
    Get-Process python | Where-Object { $_.MainWindowTitle -like "*Chrome Assistant*" } | Stop-Process -Force
    Stop-Process -Name python -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    if (-not (Get-BackendStatus)) {
        Write-Host "Server stopped" -ForegroundColor Green
    }
}

function Show-Status {
    if (Get-BackendStatus) {
        Write-Host "Server: RUNNING" -ForegroundColor Green
        Write-Host "Port: $port"
        Write-Host "URL: http://localhost:$port"
    } else {
        Write-Host "Server: NOT RUNNING" -ForegroundColor Red
        Write-Host "Start with: .\start.ps1" -ForegroundColor Gray
    }
}

switch ($args[0]) {
    "start" { Start-Backend }
    "stop" { Stop-Backend }
    "restart" { Stop-Backend; Start-Backend }
    default { Show-Status }
}