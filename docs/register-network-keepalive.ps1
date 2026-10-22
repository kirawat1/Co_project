# =====================================================
# Co-op System - register the KKU network watchdog in Task Scheduler
# Run once on the VM in PowerShell "Run as administrator", logged in as the account that
# runs the system (the one that ran network-login.js before, e.g. "project"):
#   PowerShell -ExecutionPolicy Bypass -File C:\Co_project\docs\register-network-keepalive.ps1
# Replaces task "CoopNetworkKeepAlive" (was: every 2 hours) with:
#   every 15 minutes, runs whether the user is logged on or not (S4U - no password stored),
#   one run at a time, max 5 minutes per run.
# Prints how the old task was set up first - that explains drops that were not recovered.
# See docs\network.md
# =====================================================
param(
    [string]$ProjectDir = "C:\Co_project",
    [int]$Minutes = 15,
    # S4U = run whether logged on or not. Interactive = only while this user is logged on (old behaviour)
    [ValidateSet("S4U", "Interactive")] [string]$LogonType = "S4U"
)

$ErrorActionPreference = "Stop"
$TaskName = "CoopNetworkKeepAlive"
$script = Join-Path $ProjectDir "docs\network-keepalive.ps1"
if (-not (Test-Path $script)) { Write-Host "[ERR] $script not found - git pull first" -ForegroundColor Red; exit 1 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "[ERR] node not found in PATH" -ForegroundColor Red; exit 1 }

# --- 1. How the old task was set up ---------------------------------
$old = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($old) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Existing task $TaskName :" -ForegroundColor Yellow
    Write-Host "  State          : $($old.State)"
    Write-Host "  User / logon   : $($old.Principal.UserId) / $($old.Principal.LogonType)   (Interactive = runs only while that user is logged on)"
    foreach ($t in $old.Triggers) {
        Write-Host "  Trigger        : start $($t.StartBoundary)  repeat $($t.Repetition.Interval)  for $($t.Repetition.Duration)  enabled=$($t.Enabled)"
    }
    Write-Host "  Last run       : $($info.LastRunTime)  result $($info.LastTaskResult)   (0 = success)"
    Write-Host "  Next run       : $($info.NextRunTime)"
    Write-Host ""
} else {
    Write-Host "No existing $TaskName task." -ForegroundColor Yellow
}

# --- 2. Register ------------------------------------------------------
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -ProjectDir `"$ProjectDir`"" `
    -WorkingDirectory (Join-Path $ProjectDir "docs")
# No -RepetitionDuration = repeat indefinitely (checked after registering below)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
$user = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType $LogonType -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description "Co-op: check internet every $Minutes min, re-login to KKU-Net only when offline (docs\network.md)" -Force | Out-Null

# --- 3. Read back -----------------------------------------------------
$new = Get-ScheduledTask -TaskName $TaskName
$rep = $new.Triggers[0].Repetition
Write-Host "[OK] $TaskName registered: user $($new.Principal.UserId) / $($new.Principal.LogonType), every $($rep.Interval)" -ForegroundColor Green
if ($rep.Duration) {
    Write-Host "[!!] Repeat duration is $($rep.Duration), not indefinite. Fix in Task Scheduler: $TaskName > Triggers > Edit >" -ForegroundColor Yellow
    Write-Host "     'Repeat task every 15 minutes for a duration of: Indefinitely'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test one run now and check the result:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask $TaskName; Start-Sleep 20"
Write-Host "  Get-ScheduledTaskInfo $TaskName | Select LastRunTime, LastTaskResult   # 0 = online"
Write-Host "  Get-Content $ProjectDir\docs\network-keepalive.status                  # time of the last check"
Write-Host "  Get-Content $ProjectDir\docs\network-keepalive.log -Tail 20            # only written when it was offline"
