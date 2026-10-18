# Giang Ho (jx2-web) PowerShell Dev Launcher
# Usage:
#   .\start-dev.ps1
#   .\start-dev.ps1 -BackendPort 5000 -FrontendPort 3000
param (
    [int]$BackendPort = 5000,
    [int]$FrontendPort = 3000
)

$env:PORT = "$BackendPort"
$env:VITE_PORT = "$FrontendPort"
$env:VITE_API_BASE = "http://localhost:${BackendPort}/api"

Write-Host "====================================================" -ForegroundColor Green
Write-Host " Starting Giang Ho Frontend + Backend Environment   " -ForegroundColor Green
Write-Host " Backend Port : $BackendPort" -ForegroundColor Cyan
Write-Host " Frontend Port: $FrontendPort" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Green

node scripts/dev.js

