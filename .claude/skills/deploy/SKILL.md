---
name: deploy
description: Deploy Co-op system บน VM — pull code จาก GitHub, migrate DB, build frontend, restart services. ใช้เมื่อต้องการ update โปรเจกต์หรือหลัง VM reboot
allowed-tools: Bash PowerShell
---

# Deploy Co-op System — VM Production

ใช้ skill นี้เมื่อ:
- ต้องการ update โปรเจกต์หลัง push code ขึ้น GitHub
- หลัง VM reboot ต้องการ start ทุก service ใหม่

## Checklist

### 0. Start Services หลัง Reboot (ถ้า VM เพิ่ง restart)

- [ ] Start MySQL:
  ```powershell
  Start-Service MySQL84
  Start-Sleep 3
  ```

- [ ] Start PM2 + Backend:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  pm2 resurrect
  Start-Sleep 3
  pm2 status
  ```
  ถ้า `coop-backend` ไม่อยู่ในรายการ:
  ```powershell
  cd C:\Co_project\backend
  pm2 start server.js --name coop-backend
  pm2 save
  ```

- [ ] Start Nginx:
  ```powershell
  Set-Location C:\nginx
  .\nginx.exe
  Start-Sleep 2
  tasklist | findstr nginx
  ```

- [ ] Start ngrok tunnel:
  ```powershell
  ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev
  ```
  **เปิดหน้าต่างนี้ทิ้งไว้** อย่าปิด

---

### 1. Pull code ใหม่จาก GitHub (ถ้ามี code update)

- [ ] Pull latest code:
  ```powershell
  cd C:\Co_project
  git pull origin main
  ```

### 2. Install dependencies (ถ้ามี package ใหม่)

- [ ] Backend + Frontend:
  ```powershell
  cd C:\Co_project\backend
  npm install
  cd ..\Frontend
  npm install
  ```

### 3. Run database migrations

- [ ] Apply migrations:
  ```powershell
  cd C:\Co_project\backend
  npx prisma migrate deploy
  ```

### 4. Build frontend

- [ ] Build:
  ```powershell
  cd C:\Co_project\Frontend
  npx vite build
  ```

### 5. Restart backend

- [ ] Restart:
  ```powershell
  pm2 restart coop-backend
  pm2 logs coop-backend --lines 10 --nostream
  ```

### 6. Verify

- [ ] เปิด browser → `https://apply-happiness-margarine.ngrok-free.dev`
- [ ] Login ได้ปกติ
- [ ] แจ้ง user ว่า deploy สำเร็จ

## Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| MySQL ไม่ start | `Start-Service MySQL84` หรือ `Get-Service \| Where-Object { $_.Name -like "*mysql*" }` หาชื่อจริง |
| Backend crash | `pm2 logs coop-backend --lines 30` ดู error |
| Nginx ไม่ start | `Set-Location C:\nginx` แล้ว `.\nginx.exe -t` ตรวจ config |
| ngrok offline | รัน `ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev` ใหม่ |
| CORS error | ตรวจ `FRONTEND_URL` ใน `C:\Co_project\backend\.env` ให้ตรงกับ ngrok URL |
| DB migration EPERM | `pm2 stop coop-backend` ก่อน แล้ว migrate แล้วค่อย start ใหม่ |