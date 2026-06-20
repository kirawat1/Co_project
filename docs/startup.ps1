# =====================================================
# Co-op System - VM Boot Startup Script
# Runs via Task Scheduler at every VM startup:
#   1. Log in to KKU Network captive portal (login.kku.ac.th)
#   2. Start MySQL / PM2 backend / Nginx / ngrok (deploy.ps1 -ServicesOnly)
# All output is also written to docs\startup.log so a Task Scheduler run
# (which has no visible console) can be diagnosed afterward.
# =====================================================
$PROJECT_DIR = "C:\Co_project"
$LOG_FILE = "$PROJECT_DIR\docs\startup.log"

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content -Path $LOG_FILE -Value $line
}

"" | Add-Content -Path $LOG_FILE
Write-Log "===== startup.ps1 run started (user: $env:USERNAME) ====="

Write-Log "==> Logging in to KKU Network captive portal..."
Set-Location "$PROJECT_DIR\docs"
$loginOutput = node network-login.js 2>&1 | Out-String
Write-Log $loginOutput.Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Log "[ERR] Network login failed - internet/intranet may be unavailable. Continuing anyway..."
} else {
    Write-Log "[OK] Network login complete"
}

Write-Log "==> Starting services..."
$deployOutput = PowerShell -ExecutionPolicy Bypass -File "$PROJECT_DIR\docs\deploy.ps1" -ServicesOnly 2>&1 | Out-String
Write-Log $deployOutput.Trim()

Write-Log "===== startup.ps1 run finished ====="
