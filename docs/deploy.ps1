# =====================================================
# Co-op System - Deploy Script
# Run this script on the VM to start/update the system
# Usage: .\deploy.ps1
#        .\deploy.ps1 -UpdateOnly    (skip service start)
#        .\deploy.ps1 -ServicesOnly  (only start services)
# =====================================================
param(
    [switch]$UpdateOnly,
    [switch]$ServicesOnly
)

$NGROK_DOMAIN = "apply-happiness-margarine.ngrok-free.dev"
$PROJECT_DIR  = "C:\Co_project"
$NGINX_DIR    = "C:\nginx"
$DB_USER      = "coopuser"
$DB_NAME      = "coop_mysql_db"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-WARN($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-ERR($msg)  { Write-Host "    [ERR] $msg" -ForegroundColor Red }

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# ─── START SERVICES ────────────────────────────────
if (-not $UpdateOnly) {
    Write-Step "Starting MySQL..."
    $mysqlSvc = Get-Service | Where-Object { $_.Name -like "*mysql*" } | Select-Object -First 1
    if ($mysqlSvc) {
        if ($mysqlSvc.Status -ne "Running") {
            Start-Service $mysqlSvc.Name -ErrorAction SilentlyContinue
            Start-Sleep 3
        }
        Write-OK "MySQL: $($mysqlSvc.Status)"
    } else {
        Write-WARN "MySQL service not found"
    }

    Write-Step "Starting Backend (PM2)..."
    $pm2Status = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    $backend = $pm2Status | Where-Object { $_.name -eq "coop-backend" } | Select-Object -First 1
    if ($backend -and $backend.pm2_env.status -eq "online") {
        Write-OK "Backend already online"
    } else {
        pm2 resurrect 2>$null
        Start-Sleep 2
        $pm2Status = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
        $backend = $pm2Status | Where-Object { $_.name -eq "coop-backend" } | Select-Object -First 1
        if (-not $backend) {
            cd $PROJECT_DIR\backend
            pm2 start server.js --name coop-backend 2>$null
            pm2 save 2>$null
        }
        Write-OK "Backend started"
    }

    Write-Step "Starting Nginx..."
    $nginxProc = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxProc) {
        Write-OK "Nginx already running"
    } else {
        Set-Location $NGINX_DIR
        Start-Process ".\nginx.exe" -WindowStyle Hidden
        Start-Sleep 2
        if (Get-Process nginx -ErrorAction SilentlyContinue) {
            Write-OK "Nginx started"
        } else {
            Write-ERR "Nginx failed to start - check C:\nginx\conf\nginx.conf"
        }
    }
}

if ($ServicesOnly) {
    Write-Step "Starting ngrok tunnel..."
    Write-Host "    Run in a separate window:" -ForegroundColor Gray
    Write-Host "    ngrok http 80 --domain=$NGROK_DOMAIN" -ForegroundColor White
    Write-Host ""
    Write-OK "https://$NGROK_DOMAIN"
    exit 0
}

# ─── UPDATE CODE ───────────────────────────────────
Write-Step "Pulling latest code from GitHub..."
Set-Location $PROJECT_DIR
$gitResult = git pull origin main 2>&1
Write-Host "    $gitResult" -ForegroundColor Gray
Write-OK "Code updated"

Write-Step "Installing backend dependencies..."
Set-Location $PROJECT_DIR\backend
npm install --silent 2>$null
Write-OK "Done"

Write-Step "Running database migrations..."
$migrateResult = npx prisma migrate deploy 2>&1
if ($migrateResult -match "error") {
    Write-WARN "Migration error - stopping backend first..."
    pm2 stop coop-backend 2>$null
    npx prisma migrate deploy 2>&1 | Out-Null
    pm2 start coop-backend 2>$null
} else {
    Write-OK "Migrations applied"
}

Write-Step "Building frontend..."
Set-Location $PROJECT_DIR\Frontend
npm install --silent 2>$null
npx vite build 2>&1 | Select-String "built in|error" | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
if (Test-Path "$PROJECT_DIR\Frontend\dist\index.html") {
    Write-OK "Frontend built successfully"
} else {
    Write-ERR "Frontend build failed - check errors above"
    exit 1
}

Write-Step "Restarting backend..."
pm2 restart coop-backend 2>$null
Start-Sleep 2
$status = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue | Where-Object { $_.name -eq "coop-backend" }
if ($status -and $status.pm2_env.status -eq "online") {
    Write-OK "Backend online"
} else {
    Write-ERR "Backend may have crashed - run: pm2 logs coop-backend"
}

# ─── SUMMARY ───────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Deploy Complete!" -ForegroundColor Green
Write-Host "  Site: https://$NGROK_DOMAIN" -ForegroundColor White
Write-Host "  Status: https://$NGROK_DOMAIN/api/status" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  If ngrok is not running, open a new window and run:" -ForegroundColor Yellow
Write-Host "  ngrok http 80 --domain=$NGROK_DOMAIN" -ForegroundColor White
Write-Host ""
