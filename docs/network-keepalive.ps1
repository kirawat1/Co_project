# =====================================================
# Co-op System - KKU Network watchdog
# Task Scheduler "CoopNetworkKeepAlive" runs this every 15 minutes (register-network-keepalive.ps1).
# The KKU-Net captive-portal session can drop while the VM is running (not only on reboot); the
# site then goes offline silently (ngrok ERR_NGROK_3200, git pull / npm install fail).
#   1. Check real internet: HTTPS GET of a 204 page - a captive portal cannot fake it over HTTPS
#   2. Online  -> only stamp docs\network-keepalive.status (proof that the task is running)
#      Offline -> run network-login.js, check again, write both to docs\network-keepalive.log
# Exit code: 0 = online (after login if needed), 1 = still offline - deploy.ps1 uses this.
# Usage: .\network-keepalive.ps1              (what the task runs)
#        .\network-keepalive.ps1 -CheckOnly   (print ONLINE/OFFLINE, no login, no files)
# See docs\network.md
# =====================================================
param(
    [string]$ProjectDir = "C:\Co_project",
    [switch]$CheckOnly,
    [string]$CheckUrl = "https://www.gstatic.com/generate_204"
)

$DocsDir    = Join-Path $ProjectDir "docs"
$LogFile    = Join-Path $DocsDir "network-keepalive.log"
$StatusFile = Join-Path $DocsDir "network-keepalive.status"

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Test-Internet {
    try {
        # PowerShell 5.1 may default to TLS 1.0 - the check page needs TLS 1.2
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        # A captive portal answers with a redirect or a certificate error instead of 204 -> exception -> offline
        $r = Invoke-WebRequest -Uri $CheckUrl -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0 -ErrorAction Stop
        return ($r.StatusCode -eq 204)
    } catch {
        return $false
    }
}

function Set-Status($state) {
    Set-Content -Path $StatusFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $state"
}

$online = Test-Internet
if ($CheckOnly) {
    if ($online) { Write-Host "ONLINE" } else { Write-Host "OFFLINE" }
    if ($online) { exit 0 } else { exit 1 }
}

# Keep the log small: past 1 MB, keep one previous file
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 1MB) {
    Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
}

if ($online) {
    Set-Status "online"
    exit 0
}

Write-Log "OFFLINE - running network-login.js"
Push-Location $DocsDir
$output = node network-login.js 2>&1 | Out-String
$loginExit = $LASTEXITCODE
Pop-Location
Write-Log "network-login.js exit $loginExit : $($output.Trim())"

# The portal needs a moment before traffic flows
Start-Sleep -Seconds 5
if (Test-Internet) {
    Write-Log "[OK] back online"
    Set-Status "online (re-logged in)"
    exit 0
}
Write-Log "[ERR] still offline after login - check network-login.config.json or the portal page"
Set-Status "OFFLINE"
exit 1
