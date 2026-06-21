# =====================================================
# Co-op System - KKU Network Keep-Alive
# Runs every 2 hours via Task Scheduler ("CoopNetworkKeepAlive") to re-run
# the captive-portal login, since the KKU-Net session can drop mid-uptime
# (not just on reboot) and silently knock ngrok offline (ERR_NGROK_3200).
# network-login.js is idempotent - if already logged in it just exits.
# =====================================================
$PROJECT_DIR = "C:\Co_project"
$LOG_FILE = "$PROJECT_DIR\docs\network-keepalive.log"

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path $LOG_FILE -Value $line
}

Set-Location "$PROJECT_DIR\docs"
$output = node network-login.js 2>&1 | Out-String
Write-Log $output.Trim()
