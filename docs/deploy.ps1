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
$SITE_DOMAIN  = "coop.computing.kku.ac.th"
$PROJECT_DIR  = "C:\Co_project"
$NGINX_DIR    = "C:\nginx"

# Domain mode = the live nginx config serves HTTPS (docs\nginx.conf copied in, see docs\domain-migration.md).
# ngrok then only redirects old links to https://$SITE_DOMAIN. Set to $false to stop starting ngrok at all.
$KEEP_NGROK_REDIRECT = $true
$DOMAIN_MODE = (Test-Path "$NGINX_DIR\conf\nginx.conf") -and (Select-String -Path "$NGINX_DIR\conf\nginx.conf" -Pattern "listen 443 ssl" -Quiet)
$SITE_URL = if ($DOMAIN_MODE) { "https://$SITE_DOMAIN" } else { "https://$NGROK_DOMAIN" }

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-WARN($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-ERR($msg)  { Write-Host "    [ERR] $msg" -ForegroundColor Red }

# Check if PM2 process is online using text output (avoids ConvertFrom-Json duplicate key bug in PS5.1)
function Get-PM2Online($name) {
    $lines = pm2 list --no-color 2>$null
    return ($lines | Where-Object { $_ -match [regex]::Escape($name) -and $_ -match "online" }).Count -gt 0
}

# Harmless when a more specific scope (e.g. "powershell -ExecutionPolicy Bypass") already overrides it - swallow that warning
try { Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction Stop } catch {}

# Backend/ngrok are started elevated (boot task runs with highest privileges). A non-admin shell cannot reach
# that PM2 daemon: every pm2 command spawns a new empty daemon (24 had piled up) and "pm2 stop" never
# releases the Prisma engine lock -> "Prisma generate failed". So code updates require Administrator.
# -ServicesOnly (boot, via startup.ps1) is not blocked: it only starts what is not running.
$IS_ADMIN = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IS_ADMIN -and -not $ServicesOnly) {
    Write-ERR "Run PowerShell as Administrator (right-click > Run as administrator), then run deploy.ps1 again."
    exit 1
}

# More than one PM2 daemon = leftovers from earlier non-admin runs. Stop all node processes and let the
# service start below bring backend/ngrok back on a single daemon (pm2 resurrect / pm2 start).
if ($IS_ADMIN -and -not $UpdateOnly) {
    $daemons = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'pm2\\lib\\Daemon\.js' })
    if ($daemons.Count -gt 1) {
        Write-Step "Cleaning up $($daemons.Count) stale PM2 daemons (site is down for a moment)..."
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep 2
        Write-OK "Stopped all node processes"
    }
}

# --- START SERVICES ------------------------------------------------
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
    if (Get-PM2Online "coop-backend") {
        Write-OK "Backend already online"
    } else {
        pm2 resurrect 2>$null
        Start-Sleep 2
        if (-not (Get-PM2Online "coop-backend")) {
            Set-Location $PROJECT_DIR\backend
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

    Write-Step "Starting ngrok tunnel via PM2..."
    if ($DOMAIN_MODE -and -not $KEEP_NGROK_REDIRECT) {
        pm2 delete ngrok-tunnel 2>$null | Out-Null
        pm2 save 2>$null | Out-Null
        Write-OK "ngrok off (domain mode) - site: $SITE_URL"
    } elseif (Get-PM2Online "ngrok-tunnel") {
        Write-OK "ngrok already running: https://$NGROK_DOMAIN"
    } else {
        pm2 delete ngrok-tunnel 2>$null
        pm2 start "$PROJECT_DIR\docs\start-ngrok.js" --name ngrok-tunnel 2>$null
        pm2 save 2>$null
        Start-Sleep 4
        Write-OK "ngrok started: https://$NGROK_DOMAIN"
    }
}

if ($ServicesOnly) {
    Write-OK $SITE_URL
    exit 0
}

# --- UPDATE CODE ---------------------------------------------------
# The KKU-Net login can drop while the VM is up - check (and re-login) before git/npm need the internet
Write-Step "Checking internet (re-login to KKU-Net if needed)..."
PowerShell -NoProfile -ExecutionPolicy Bypass -File "$PROJECT_DIR\docs\network-keepalive.ps1" -ProjectDir $PROJECT_DIR | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-ERR "No internet - KKU-Net login did not help. See docs\network-keepalive.log, then re-run deploy."
    exit 1
}
Write-OK "Internet OK"

Write-Step "Pulling latest code from GitHub..."
Set-Location $PROJECT_DIR
$gitResult = git pull origin main 2>&1
Write-Host "    $gitResult" -ForegroundColor Gray
if ($LASTEXITCODE -ne 0) {
    if ("$gitResult" -match "Could not resolve host|Failed to connect|unable to access|Connection timed out|Could not connect") {
        Write-ERR "git pull failed - cannot reach GitHub (network). Run: node docs\network-login.js, then re-run deploy."
    } else {
        Write-ERR "git pull failed - aborting deploy. Fix conflicts then re-run."
    }
    exit 1
}
Write-OK "Code updated"

# npm output stays visible (a slow network looked like a hang when it was hidden); no audit/fund = fewer network calls
Write-Step "Installing backend dependencies (can take a few minutes on a slow network)..."
Set-Location $PROJECT_DIR\backend
npm install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) {
    Write-ERR "npm install (backend) failed - check the errors above / the network, then re-run deploy."
    exit 1
}
Write-OK "Done"

Write-Step "Generating Prisma Client..."
npx prisma generate 2>&1 | Out-Null
$prismaGenerateOk = ($LASTEXITCODE -eq 0)
if (-not $prismaGenerateOk) {
    Write-WARN "Prisma generate failed - stopping backend and retrying..."
    pm2 stop coop-backend 2>$null
    npx prisma generate 2>&1 | Out-Null
    $prismaGenerateOk = ($LASTEXITCODE -eq 0)
    pm2 start coop-backend 2>$null
    pm2 save 2>$null
    if (-not $prismaGenerateOk) {
        Write-ERR "Prisma generate failed - check file locks on node_modules\.prisma"
        exit 1
    }
} else {
    Write-OK "Prisma Client generated"
}

Write-Step "Running database migrations..."
npx prisma migrate deploy 2>&1 | Out-Null
$migrateOk = ($LASTEXITCODE -eq 0)
if (-not $migrateOk) {
    Write-WARN "Migration failed - stopping backend and retrying..."
    pm2 stop coop-backend 2>$null
    npx prisma migrate deploy 2>&1 | Out-Null
    $migrateOk = ($LASTEXITCODE -eq 0)
    pm2 start coop-backend 2>$null
    pm2 save 2>$null
    if (-not $migrateOk) {
        Write-ERR "Migration failed - check DB connection and schema"
        exit 1
    }
} else {
    Write-OK "Migrations applied"
}

Write-Step "Building frontend..."
Set-Location $PROJECT_DIR\Frontend
npm install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) {
    Write-ERR "npm install (frontend) failed - check the errors above / the network, then re-run deploy."
    exit 1
}
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
if (Get-PM2Online "coop-backend") {
    Write-OK "Backend online"
} else {
    Write-ERR "Backend may have crashed - run: pm2 logs coop-backend"
}

# --- SUMMARY -------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Deploy Complete!" -ForegroundColor Green
Write-Host "  Site: $SITE_URL" -ForegroundColor White
Write-Host "  Status: $SITE_URL/api/status" -ForegroundColor Gray
if ($DOMAIN_MODE -and $KEEP_NGROK_REDIRECT) {
    Write-Host "  (old ngrok link redirects to $SITE_URL)" -ForegroundColor Gray
}
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
