# =====================================================
# Co-op System — VM Setup Script
# รันใน PowerShell (Admin) บน Windows 11
# =====================================================

Write-Host "=== Co-op VM Setup ===" -ForegroundColor Cyan

# ---- 1. Git ----
Write-Host "`n[1/5] Installing Git..." -ForegroundColor Yellow
winget install Git.Git --silent --accept-source-agreements --accept-package-agreements

# ---- 2. Node.js 22 LTS ----
Write-Host "`n[2/5] Installing Node.js 22 LTS..." -ForegroundColor Yellow
winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements

# ---- 3. MySQL 8 ----
Write-Host "`n[3/5] Installing MySQL 8..." -ForegroundColor Yellow
winget install Oracle.MySQL --silent --accept-source-agreements --accept-package-agreements

# ---- 4. Cloudflared ----
Write-Host "`n[4/5] Installing Cloudflared..." -ForegroundColor Yellow
winget install Cloudflare.cloudflared --silent --accept-source-agreements --accept-package-agreements

# ---- 5. Nginx ----
Write-Host "`n[5/5] Downloading Nginx..." -ForegroundColor Yellow
$nginxVersion = "1.26.2"
$nginxUrl = "http://nginx.org/download/nginx-$nginxVersion.zip"
$nginxZip = "C:\nginx-$nginxVersion.zip"

Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing
Expand-Archive -Path $nginxZip -DestinationPath "C:\" -Force
if (Test-Path "C:\nginx") { Remove-Item "C:\nginx" -Recurse -Force }
Rename-Item "C:\nginx-$nginxVersion" "C:\nginx"
Remove-Item $nginxZip

Write-Host "`n=== Refreshing PATH ===" -ForegroundColor Cyan
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# ---- PM2 (ต้องหลัง Node.js) ----
Write-Host "`n[+] Installing PM2 globally..." -ForegroundColor Yellow
npm install -g pm2

# ---- Verify ----
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
Write-Host "Git:         $(git --version 2>$null)" -ForegroundColor Green
Write-Host "Node.js:     $(node --version 2>$null)" -ForegroundColor Green
Write-Host "npm:         $(npm --version 2>$null)" -ForegroundColor Green
Write-Host "PM2:         $(pm2 --version 2>$null)" -ForegroundColor Green
Write-Host "MySQL:       $(mysql --version 2>$null)" -ForegroundColor Green
Write-Host "Nginx:       $(C:\nginx\nginx.exe -v 2>&1)" -ForegroundColor Green
Write-Host "Cloudflared: $(cloudflared --version 2>$null)" -ForegroundColor Green

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "ถ้า Node/Git ยัง error ให้ปิด PowerShell แล้วเปิดใหม่ (PATH refresh)" -ForegroundColor Yellow
Write-Host "ถ้า MySQL ยัง error ให้ restart เครื่องแล้วลองใหม่" -ForegroundColor Yellow
