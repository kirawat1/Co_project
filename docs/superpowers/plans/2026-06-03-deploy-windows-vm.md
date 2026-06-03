# Deploy to Windows 11 VM — Implementation Plan

> **หมายเหตุ:** แผนนี้เป็น deployment guide ไม่ใช่ code implementation — ดำเนินการทีละ task บน VM เป้าหมายโดยตรง

**Goal:** Deploy Co-op system บน Windows 11 VM (4 cores, 16 GB RAM, 200 GB HDD) ให้รันจริงบน port 80 โดยใช้ Nginx เป็น reverse proxy + serve static files และ PM2 จัดการ Node.js process

**Architecture:** Nginx รับ request ทั้งหมดที่ port 80 → `/api/*` และ `/uploads/*` proxy ไปยัง Node.js backend port 5000 → frontend static files (`dist/`) เสิร์ฟตรงจาก Nginx. PM2 จัดการ Node.js lifecycle และ auto-restart เมื่อ VM reboot.

**Tech Stack:** Node.js 22 LTS, MySQL 8, PM2, Nginx for Windows, Windows 11

---

## ข้อมูลที่ต้องเตรียมก่อน

| ข้อมูล | ค่า |
|---|---|
| IP ของ VM | เช่น `192.168.1.100` (ดูจาก `ipconfig`) |
| Port ที่ใช้ | 80 (หรือ 3000 ถ้า 80 ถูก block) |
| Google Client ID | จาก Google Cloud Console |
| JWT Secret | สร้างใหม่สำหรับ production |
| DB Password | กำหนดใหม่สำหรับ production |

---

## Task 1: ติดตั้ง Software ที่จำเป็น

**ทำบน VM เป้าหมาย (Windows 11)**

- [ ] **Step 1: ติดตั้ง Git**

ดาวน์โหลด: https://git-scm.com/download/win → ติดตั้ง default settings

ตรวจ:
```
git --version
```
Expected: `git version 2.x.x`

- [ ] **Step 2: ติดตั้ง Node.js 22 LTS**

ดาวน์โหลด: https://nodejs.org/en → เลือก **22 LTS** → ติดตั้ง (tick "Add to PATH")

ตรวจ:
```
node --version
npm --version
```
Expected: `v22.x.x` และ `10.x.x`

- [ ] **Step 3: ติดตั้ง PM2 globally**

เปิด **Command Prompt (Admin)**:
```
npm install -g pm2
pm2 --version
```
Expected: `5.x.x`

- [ ] **Step 4: ติดตั้ง MySQL 8 Community Server**

ดาวน์โหลด: https://dev.mysql.com/downloads/installer/ → เลือก "MySQL Installer for Windows"

ใน installer เลือก:
- Setup Type: **Server only**
- Authentication: **Use Strong Password Encryption (Recommended)**
- Root password: ตั้งรหัสผ่านที่แข็งแกร่ง เก็บไว้
- Windows Service: ✓ Start MySQL at system startup
- Service Name: `MySQL80`

ตรวจ:
```
mysql -u root -p --version
```
Expected: `8.x.x`

- [ ] **Step 5: ติดตั้ง Nginx for Windows**

ดาวน์โหลด: http://nginx.org/en/download.html → **nginx/Windows** (stable version เช่น `nginx-1.26.x`)

แตกไฟล์ไปที่ `C:\nginx`

ตรวจ:
```
C:\nginx\nginx.exe -v
```
Expected: `nginx version: nginx/1.26.x`

---

## Task 2: Clone โปรเจกต์และตั้งค่า Environment

**ทำบน VM**

- [ ] **Step 1: Clone โปรเจกต์**

```
cd C:\
git clone <repository-url> Co_project
cd C:\Co_project
```

ถ้าไม่มี remote repo ให้ copy folder จาก dev machine แทน (ตรวจให้แน่ใจว่ามี `backend/` และ `Frontend/`)

- [ ] **Step 2: สร้าง backend/.env**

สร้างไฟล์ `C:\Co_project\backend\.env`:

```
# Database
DATABASE_URL="mysql://coopuser:YOUR_DB_PASSWORD@localhost:3306/coop_mysql_db"

# JWT
JWT_SECRET=GENERATE_A_RANDOM_64_CHAR_STRING_HERE

# Server
PORT=5000
NODE_ENV=production

# Frontend URL (สำหรับ CORS)
FRONTEND_URL=http://YOUR_VM_IP

# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com

# KKU REG API (ถ้ามี)
KKU_REG_BASE_URL=https://reg2.kku.ac.th/api/v1.2
KKU_REG_CLIENT_ID=
KKU_REG_CLIENT_SECRET=
```

สร้าง JWT_SECRET โดยรัน:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
คัดลอก output ไปใส่ `JWT_SECRET=`

- [ ] **Step 3: สร้าง Frontend/.env**

สร้างไฟล์ `C:\Co_project\Frontend\.env`:

```
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

---

## Task 3: ตั้งค่า MySQL Database

**ทำบน VM**

- [ ] **Step 1: Login MySQL และสร้าง database + user**

```
mysql -u root -p
```

ใน MySQL prompt:
```sql
CREATE DATABASE coop_mysql_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'coopuser'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON coop_mysql_db.* TO 'coopuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

- [ ] **Step 2: ติดตั้ง backend dependencies**

```
cd C:\Co_project\backend
npm install
```

Expected: ติดตั้งเสร็จโดยไม่มี error

- [ ] **Step 3: Run Prisma migrations**

```
npx prisma migrate deploy
```

Expected: ข้อความ `All migrations have been applied successfully.`

ถ้าเห็น error `Environment variable not found: DATABASE_URL` ให้ตรวจว่า `.env` อยู่ถูกที่

- [ ] **Step 4: สร้าง admin user**

```
node scripts/create_user.js --username=admin --email=admin@kku.ac.th --password=YOUR_ADMIN_PASSWORD --role=staff
```

- [ ] **Step 5: ทดสอบ backend เริ่มได้**

```
node server.js
```

Expected: `Server running at http://localhost:5000`

กด `Ctrl+C` หยุด

---

## Task 4: Build Frontend

**ทำบน VM**

- [ ] **Step 1: ติดตั้ง frontend dependencies**

```
cd C:\Co_project\Frontend
npm install
```

- [ ] **Step 2: Build**

```
npm run build
```

Expected: เห็น `✓ built in X.XXs` และมีโฟลเดอร์ `C:\Co_project\Frontend\dist\` สร้างขึ้นมา

ตรวจว่ามีไฟล์:
```
dir C:\Co_project\Frontend\dist\
```
Expected: เห็น `index.html` และโฟลเดอร์ `assets\`

---

## Task 5: ตั้งค่า Nginx

**ทำบน VM**

- [ ] **Step 1: สร้าง Nginx config**

แก้ไขไฟล์ `C:\nginx\conf\nginx.conf` ให้เป็น:

```nginx
worker_processes  4;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 50M;

    server {
        listen       80;
        server_name  localhost;

        # Frontend static files
        root   C:/Co_project/Frontend/dist;
        index  index.html;

        # Proxy API to Node.js backend
        location /api/ {
            proxy_pass         http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
        }

        # Proxy uploads to Node.js backend
        location /uploads/ {
            proxy_pass http://localhost:5000;
        }

        # SPA fallback — ทุก path ที่ไม่มีไฟล์จริงให้ส่ง index.html
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

**หมายเหตุ:** ถ้า VM ใช้ IP อื่น (เช่น 192.168.x.x) ให้เปลี่ยน `server_name` เป็น IP นั้นหรือคง `localhost` ไว้ก็ได้

- [ ] **Step 2: ทดสอบ config**

```
C:\nginx\nginx.exe -t
```
Expected: `syntax is ok` และ `test is successful`

- [ ] **Step 3: Start Nginx**

```
C:\nginx\nginx.exe
```

ตรวจว่า Nginx รันอยู่:
```
tasklist | findstr nginx
```
Expected: เห็น `nginx.exe`

- [ ] **Step 4: ตั้งให้ Nginx Start อัตโนมัติด้วย Windows Task Scheduler**

เปิด **Task Scheduler** → Create Basic Task:
- Name: `Nginx Autostart`
- Trigger: **When the computer starts**
- Action: **Start a program**
- Program: `C:\nginx\nginx.exe`

---

## Task 6: ตั้งค่า PM2 รัน Backend

**ทำบน VM**

- [ ] **Step 1: Start backend ด้วย PM2**

```
cd C:\Co_project\backend
pm2 start server.js --name "coop-backend" --env production
```

Expected: PM2 แสดง status `online` สำหรับ `coop-backend`

- [ ] **Step 2: ตรวจสอบ backend รันปกติ**

```
pm2 logs coop-backend --lines 20
```

Expected: เห็น `Server running at http://localhost:5000` ไม่มี error

- [ ] **Step 3: Save PM2 process list**

```
pm2 save
```

- [ ] **Step 4: ตั้ง PM2 startup บน Windows**

```
pm2 startup
```

PM2 จะพิมพ์คำสั่งให้รัน — copy และรันคำสั่งนั้น (จะมี path ยาวๆ ให้รัน)

ทางเลือก: ใช้ **nssm** ทำ PM2 เป็น Windows Service:
```
npm install -g nssm
nssm install pm2-coop "C:\Users\%USERNAME%\AppData\Roaming\npm\pm2.cmd" "resurrect"
nssm set pm2-coop Start SERVICE_AUTO_START
net start pm2-coop
```

---

## Task 7: ตั้งค่า Google OAuth + Firewall

**ทำบน VM และ Google Cloud Console**

- [ ] **Step 1: เพิ่ม VM IP ใน Google Cloud Console**

ไปที่ [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → คลิก Client ID → เพิ่มใน **Authorized JavaScript origins**:

```
http://YOUR_VM_IP
http://YOUR_VM_IP:80
```

กด **Save**

- [ ] **Step 2: เปิด port 80 ใน Windows Firewall**

เปิด **Windows Defender Firewall with Advanced Security** → Inbound Rules → New Rule:
- Rule Type: Port
- Protocol: TCP, Port: **80**
- Action: Allow the connection
- Profile: Domain, Private, Public (เลือกตามความเหมาะสม)
- Name: `CoopSystem-HTTP`

หรือผ่าน PowerShell (Admin):
```powershell
New-NetFirewallRule -DisplayName "CoopSystem HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

- [ ] **Step 3: ทดสอบเข้าจาก browser บน VM**

เปิด browser → `http://localhost`

Expected: เห็นหน้า Login ของระบบ

- [ ] **Step 4: ทดสอบเข้าจาก machine อื่นในเครือข่าย**

จาก machine อื่น → `http://YOUR_VM_IP`

Expected: เห็นหน้า Login เช่นกัน

---

## Task 8: สร้างไฟล์ Start/Stop Scripts

**ทำบน VM**

- [ ] **Step 1: สร้าง start script**

สร้างไฟล์ `C:\Co_project\start.bat`:
```bat
@echo off
echo Starting Coop System...
cd /d C:\Co_project\backend
call pm2 start server.js --name "coop-backend" 2>nul || call pm2 restart coop-backend
call pm2 save
cd /d C:\nginx
start nginx.exe
echo Coop System started!
pause
```

- [ ] **Step 2: สร้าง stop script**

สร้างไฟล์ `C:\Co_project\stop.bat`:
```bat
@echo off
echo Stopping Coop System...
call pm2 stop coop-backend
cd /d C:\nginx
nginx.exe -s stop
echo Coop System stopped!
pause
```

- [ ] **Step 3: สร้าง restart + deploy script**

สร้างไฟล์ `C:\Co_project\deploy.bat` — ใช้เมื่อมี code update:
```bat
@echo off
echo === Co-op System Deployment ===

echo [1/4] Pulling latest code...
cd /d C:\Co_project
git pull origin main

echo [2/4] Running DB migrations...
cd backend
call npm install
call npx prisma migrate deploy

echo [3/4] Building frontend...
cd ..\Frontend
call npm install
call npm run build

echo [4/4] Restarting backend...
call pm2 restart coop-backend

echo === Deployment complete! ===
pause
```

---

## Task 9: เปิดให้ภายนอกเข้าได้ด้วย Cloudflare Tunnel

**ทำบน VM — ต้องการ Cloudflare account (ฟรี)**

### วิธีที่ 1: Quick Tunnel (ทดสอบด่วน — ไม่ต้องสมัคร)

- [ ] **Step 1: ดาวน์โหลด cloudflared**

ไปที่ https://github.com/cloudflare/cloudflared/releases/latest → ดาวน์โหลด `cloudflared-windows-amd64.exe`

บันทึกไว้ที่ `C:\cloudflared\cloudflared.exe`

- [ ] **Step 2: รัน Quick Tunnel**

```
C:\cloudflared\cloudflared.exe tunnel --url http://localhost:80
```

Expected output (ภายใน 30 วินาที):
```
Your quick Tunnel has been created! Visit it at:
https://xxxx-xxxx-xxxx.trycloudflare.com
```

URL นี้ใช้ได้ทันที เข้าได้จากทุกที่ในโลก — แต่จะหมดเมื่อปิด terminal

---

### วิธีที่ 2: Permanent Tunnel (ใช้งานจริง — ต้องมี Cloudflare account + domain)

**ต้องการ:**
- Cloudflare account (ฟรี): https://dash.cloudflare.com/sign-up
- Domain ที่ผูกกับ Cloudflare (ย้าย NS มา Cloudflare) เช่น `yourdomain.com`
- หรือใช้ subdomain ฟรีจาก Cloudflare Pages (ถ้ามี plan)

- [ ] **Step 1: Login Cloudflare**

```
C:\cloudflared\cloudflared.exe tunnel login
```

Browser จะเปิดขึ้น → เลือก domain ที่ต้องการ → Authorize

Expected: `You have successfully logged in.`

- [ ] **Step 2: สร้าง Tunnel**

```
C:\cloudflared\cloudflared.exe tunnel create coop-tunnel
```

Expected: จะแสดง Tunnel ID เช่น `a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx` และสร้างไฟล์ credential ที่ `C:\Users\<username>\.cloudflared\`

- [ ] **Step 3: สร้าง config file**

สร้างไฟล์ `C:\Users\<username>\.cloudflared\config.yml`:

```yaml
tunnel: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # Tunnel ID จาก step 2
credentials-file: C:\Users\<username>\.cloudflared\a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  - hostname: coop.yourdomain.com   # subdomain ที่ต้องการ
    service: http://localhost:80
  - service: http_status:404
```

**แก้:**
- `tunnel:` ใส่ Tunnel ID จาก step 2
- `credentials-file:` ใส่ path ไฟล์ .json ที่สร้างใน step 2
- `hostname:` ใส่ subdomain ที่ต้องการ เช่น `coop.kku.ac.th` หรือ `app.yourdomain.com`

- [ ] **Step 4: ผูก DNS**

```
C:\cloudflared\cloudflared.exe tunnel route dns coop-tunnel coop.yourdomain.com
```

Expected: `Added CNAME coop.yourdomain.com which will route to this tunnel.`

- [ ] **Step 5: ทดสอบ Tunnel ทำงาน**

```
C:\cloudflared\cloudflared.exe tunnel run coop-tunnel
```

Expected: เห็น `Registered tunnel connection` ไม่มี error

เปิด browser → `https://coop.yourdomain.com`

Expected: เห็นหน้า Login ของระบบ พร้อม HTTPS อัตโนมัติ

- [ ] **Step 6: ติดตั้ง cloudflared เป็น Windows Service (auto-start)**

```
C:\cloudflared\cloudflared.exe service install
net start cloudflared
```

Expected: `The cloudflared service has been successfully installed.`

ตรวจ:
```
sc query cloudflared
```
Expected: `STATE: 4  RUNNING`

- [ ] **Step 7: อัปเดต Google OAuth**

ใน Google Cloud Console → OAuth Client ID → เพิ่ม **Authorized JavaScript origins**:
```
https://coop.yourdomain.com
```

Rebuild Frontend เพื่อให้ใช้ URL ใหม่ (ถ้า VITE_GOOGLE_CLIENT_ID เดิมอยู่แล้ว ไม่ต้องแก้):
```
cd C:\Co_project\Frontend
npm run build
```

- [ ] **Step 8: อัปเดต backend CORS**

แก้ `C:\Co_project\backend\.env`:
```
FRONTEND_URL=https://coop.yourdomain.com
```

Restart backend:
```
pm2 restart coop-backend
```

---

### สรุปความแตกต่าง

| | Quick Tunnel | Permanent Tunnel |
|---|---|---|
| ต้องสมัคร | ไม่ต้อง | ต้องมี Cloudflare account |
| ต้องมี domain | ไม่ต้อง | ต้องมี |
| URL | สุ่มทุกครั้ง | คงที่ |
| HTTPS | ✅ อัตโนมัติ | ✅ อัตโนมัติ |
| Auto-start | ❌ | ✅ (service) |
| ค่าใช้จ่าย | ฟรี | ฟรี (ถ้าใช้ plan ฟรี) |
| เหมาะกับ | ทดสอบ / demo | ใช้งานจริง |

---

## Verification Checklist

หลัง deploy เสร็จ ตรวจทั้งหมดนี้:

- [ ] `http://YOUR_VM_IP` โหลดหน้า Login ได้
- [ ] Login เป็น staff ด้วย email+password ได้
- [ ] Login เป็น นักศึกษา ด้วย Google (@kkumail.com) ได้
- [ ] อัปโหลดไฟล์ได้ (ทดสอบใน T000 หรือ gateway)
- [ ] `http://YOUR_VM_IP/api/auth/me` คืน 401 (ไม่ใช่ 404)
- [ ] `pm2 status` แสดง `coop-backend` status `online`
- [ ] `tasklist | findstr nginx` แสดง `nginx.exe`
- [ ] Restart VM แล้ว ทุกอย่างยังรันอยู่

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| Nginx ไม่ start — port 80 ถูกใช้ | `netstat -ano \| findstr :80` หา PID แล้ว kill, หรือเปลี่ยน Nginx port เป็น 8080 |
| Backend crash — JWT_SECRET not set | ตรวจ `backend\.env` ว่าไฟล์อยู่ถูกที่และมี JWT_SECRET |
| Frontend แสดง blank page | ตรวจ `C:\Co_project\Frontend\dist\index.html` มีอยู่ไหม, ตรวจ Nginx root path ใช้ forward slash `/` ไม่ใช่ `\` |
| Google OAuth ไม่ทำงาน | ตรวจ `VITE_GOOGLE_CLIENT_ID` ใน `Frontend\.env` และ rebuild, ตรวจ authorized origins ใน Google Console |
| DB connection failed | ตรวจ `DATABASE_URL` ใน `backend\.env`, ตรวจ MySQL service รันอยู่ไหมด้วย `services.msc` |
| PM2 ไม่ auto-start หลัง reboot | ทำ Task 6 Step 4 ซ้ำ หรือสร้าง Windows Task Scheduler ให้รัน `pm2 resurrect` |

---

## หมายเหตุเพิ่มเติม

**HTTPS (Production-grade):**
ถ้าต้องการ HTTPS จำเป็นสำหรับ Google OAuth บน domain จริง ใช้ [mkcert](https://github.com/FiloSottile/mkcert) สำหรับ internal CA หรือ Let's Encrypt สำหรับ public domain

**Uploads persistence:**
โฟลเดอร์ `backend/uploads/` เก็บไฟล์ที่นักศึกษาอัปโหลด — backup folder นี้สม่ำเสมอ

**Database backup:**
```bat
mysqldump -u coopuser -p coop_mysql_db > C:\backup\coop_%date:~-4,4%%date:~-7,2%%date:~-10,2%.sql
```
