# =====================================================
# Co-op System — Setup Script (Task 2-9)
# รันหลัง install-vm.ps1 เสร็จแล้ว
# เปิด PowerShell (Admin) ใหม่แล้วรัน script นี้
# =====================================================

Write-Host "=== Co-op System Setup ===" -ForegroundColor Cyan
Write-Host ""

# ---- รับค่าจาก User ----
$VM_IP = Read-Host "IP ของ VM นี้ (กด Enter ถ้าใช้ Cloudflare Tunnel, พิมพ์ IP ถ้าใช้ LAN เช่น 192.168.1.100)"
if (-not $VM_IP) { $VM_IP = "localhost" }

$MYSQL_ROOT_PASS = Read-Host "MySQL root password (ที่ตั้งตอนติดตั้ง)" -AsSecureString
$MYSQL_ROOT_PASS = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($MYSQL_ROOT_PASS))

$DB_PASS = Read-Host "ตั้ง password สำหรับ database user ใหม่ (coopuser)"
$GOOGLE_CLIENT_ID = Read-Host "Google Client ID (กด Enter ถ้ายังไม่มี)"

$FRONTEND_URL = if ($VM_IP -eq "localhost") { "http://localhost" } else { "http://$VM_IP" }

Write-Host ""
Write-Host "=== [1/6] Clone โปรเจกต์ ===" -ForegroundColor Yellow

if (-not (Test-Path "C:\Co_project")) {
    git clone https://github.com/kirawat1/Co_project.git C:\Co_project
} else {
    Write-Host "มีโปรเจกต์แล้ว — git pull..." -ForegroundColor Gray
    Set-Location C:\Co_project
    git pull origin main
}
Set-Location C:\Co_project

Write-Host ""
Write-Host "=== [2/6] สร้าง Database ===" -ForegroundColor Yellow

$sqlCmds = @"
CREATE DATABASE IF NOT EXISTS coop_mysql_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'coopuser'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON coop_mysql_db.* TO 'coopuser'@'localhost';
FLUSH PRIVILEGES;
"@
$sqlCmds | mysql -u root -p"$MYSQL_ROOT_PASS" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Database created OK" -ForegroundColor Green
} else {
    Write-Host "MySQL error — ตรวจ root password อีกครั้ง" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== [3/6] ตั้งค่า Environment Files ===" -ForegroundColor Yellow

# สร้าง JWT_SECRET
$JWT_SECRET = -join ((48..57) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

# backend/.env
@"
PORT=5000
NODE_ENV=production
DATABASE_URL=mysql://coopuser:$DB_PASS@localhost:3306/coop_mysql_db?charset=utf8mb4
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=$FRONTEND_URL
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
KKU_REG_BASE_URL=https://reg2.kku.ac.th/api/v1.2
KKU_REG_CLIENT_ID=
KKU_REG_CLIENT_SECRET=
"@ | Set-Content "C:\Co_project\backend\.env" -Encoding UTF8

Write-Host "backend/.env created" -ForegroundColor Green

# Frontend/.env
@"
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
"@ | Set-Content "C:\Co_project\Frontend\.env" -Encoding UTF8

Write-Host "Frontend/.env created" -ForegroundColor Green

Write-Host ""
Write-Host "=== [4/6] Install dependencies + Migrate DB ===" -ForegroundColor Yellow

Set-Location C:\Co_project\backend
npm install --silent
npx prisma migrate deploy
Write-Host "Migrations applied" -ForegroundColor Green

Write-Host ""
Write-Host "=== [5/6] Build Frontend ===" -ForegroundColor Yellow

Set-Location C:\Co_project\Frontend
npm install --silent
npm run build
Write-Host "Frontend built → dist/" -ForegroundColor Green

Write-Host ""
Write-Host "=== [6/6] ตั้งค่า Nginx ===" -ForegroundColor Yellow

$nginxConf = @"
worker_processes  4;
events { worker_connections  1024; }
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;
    server {
        listen 80;
        server_name $VM_IP;
        root   C:/Co_project/Frontend/dist;
        index  index.html;
        # Blocked on the public (ngrok-tunneled) listener — only reachable via
        # the 127.0.0.1-only server block below.
        location = /api/internal-status { return 404; }
        location /api/ {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
        }
        location /uploads/ {
            proxy_pass http://localhost:5000;
        }
        location / {
            try_files `$uri `$uri/ /index.html;
        }
    }
    # VM-local-only status dashboard — ngrok never tunnels this port,
    # so it is reachable only from inside the VM (e.g. http://localhost:8888/status.html).
    server {
        listen 127.0.0.1:8888;
        root   C:/Co_project/Frontend/dist;
        location /api/internal-status {
            proxy_pass http://localhost:5000/api/internal-status;
        }
        location / {
            try_files `$uri `$uri/ /index.html;
        }
    }
}
"@
$nginxConf | Set-Content "C:\nginx\conf\nginx.conf" -Encoding UTF8
Write-Host "Nginx configured" -ForegroundColor Green

# Start Nginx
$nginxRunning = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginxRunning) { & C:\nginx\nginx.exe -s stop; Start-Sleep 2 }
& C:\nginx\nginx.exe
Write-Host "Nginx started" -ForegroundColor Green

Write-Host ""
Write-Host "=== Start Backend with PM2 ===" -ForegroundColor Yellow
Set-Location C:\Co_project\backend
pm2 delete coop-backend 2>$null
pm2 start server.js --name coop-backend
pm2 save
Write-Host "Backend started with PM2" -ForegroundColor Green

Write-Host ""
Write-Host "=== Cloudflare Tunnel ===" -ForegroundColor Yellow
Write-Host "เพื่อให้คนนอกเข้าได้ รัน:" -ForegroundColor Cyan
Write-Host "  cloudflared tunnel --url http://localhost:80" -ForegroundColor White
Write-Host "จะได้ URL แบบ https://xxxx.trycloudflare.com" -ForegroundColor Gray
Write-Host "อัปเดต URL นั้นใน Google Cloud Console → Authorized JavaScript Origins" -ForegroundColor Gray

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Local URL:   http://localhost" -ForegroundColor Green
if ($VM_IP -ne "localhost") {
    Write-Host "LAN URL:     http://$VM_IP" -ForegroundColor Green
}
Write-Host ""
Write-Host "pm2 status         — ดู backend status" -ForegroundColor Gray
Write-Host "pm2 logs           — ดู backend logs" -ForegroundColor Gray
Write-Host "pm2 restart coop-backend  — restart backend" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
