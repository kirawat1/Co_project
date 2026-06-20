# =====================================================
# Co-op System - VM Boot Startup Script
# Runs via Task Scheduler at every VM startup:
#   1. Log in to KKU Network captive portal (login.kku.ac.th)
#   2. Start MySQL / PM2 backend / Nginx / ngrok (deploy.ps1 -ServicesOnly)
# =====================================================
$PROJECT_DIR = "C:\Co_project"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-ERR($msg)  { Write-Host "    [ERR] $msg" -ForegroundColor Red }

Write-Step "Logging in to KKU Network captive portal..."
Set-Location "$PROJECT_DIR\docs"
node network-login.js
if ($LASTEXITCODE -ne 0) {
    Write-ERR "Network login failed - internet/intranet may be unavailable. Continuing anyway..."
} else {
    Write-OK "Network login complete"
}

Write-Step "Starting services..."
PowerShell -ExecutionPolicy Bypass -File "$PROJECT_DIR\docs\deploy.ps1" -ServicesOnly
