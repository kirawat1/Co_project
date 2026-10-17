# =====================================================
# Co-op System - register nightly backup in Task Scheduler
# Run once on the VM as Administrator:
#   PowerShell -ExecutionPolicy Bypass -File C:\Co_project\docs\register-backup-task.ps1
# Creates two tasks:
#   CoopBackup        every day 02:00   node backend\scripts\backup.js
#   CoopBackupVerify  every Sunday 03:30 node backend\scripts\backup.js --verify
# Settings (BACKUP_DIR, BACKUP_KEEP_DAYS, BACKUP_MIRROR_DIR) are read from backend\.env
# See docs\backup.md
# =====================================================
param(
    [string]$ProjectDir = "C:\Co_project",
    [string]$BackupTime = "02:00",
    [string]$VerifyTime = "03:30"
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host "[ERR] node not found in PATH" -ForegroundColor Red; exit 1 }
$script = Join-Path $ProjectDir "backend\scripts\backup.js"
if (-not (Test-Path $script)) { Write-Host "[ERR] $script not found - git pull first" -ForegroundColor Red; exit 1 }

# SYSTEM can read the project and write to local disks. If BACKUP_MIRROR_DIR is a network
# share, SYSTEM usually has no access to it - re-register with -User <account> in Task Scheduler.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)

$tasks = @(
    @{ Name = "CoopBackup"; Args = "`"$script`""; Trigger = (New-ScheduledTaskTrigger -Daily -At $BackupTime);
       Desc = "Co-op: nightly MySQL dump + uploads copy (docs\backup.md)" },
    @{ Name = "CoopBackupVerify"; Args = "`"$script`" --verify"; Trigger = (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $VerifyTime);
       Desc = "Co-op: weekly restore test of the latest backup into a scratch DB (docs\backup.md)" }
)

foreach ($t in $tasks) {
    $action = New-ScheduledTaskAction -Execute $node -Argument $t.Args -WorkingDirectory (Join-Path $ProjectDir "backend")
    Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $t.Trigger -Principal $principal `
        -Settings $settings -Description $t.Desc -Force | Out-Null
    Write-Host "[OK] $($t.Name) registered" -ForegroundColor Green
}

Write-Host ""
Write-Host "Run the first backup now and check the result:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask CoopBackup"
Write-Host "  Get-ScheduledTaskInfo CoopBackup | Select LastRunTime, LastTaskResult   # 0 = success"
Write-Host "  Get-Content C:\coop-backups\backup.log -Tail 10"
