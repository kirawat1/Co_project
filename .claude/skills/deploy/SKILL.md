---
name: deploy
description: Deploy Co-op system บน VM — pull code จาก GitHub, migrate DB, build frontend, restart backend. ใช้เมื่อต้องการ update โปรเจกต์บน production VM
allowed-tools: Bash PowerShell
---

# Deploy Co-op System — VM Production

ใช้ skill นี้เมื่อต้องการ update โปรเจกต์บน VM หลังจาก push code ขึ้น GitHub แล้ว

## Checklist

ทำทีละขั้นตามลำดับ อย่าข้ามขั้น

### 1. Pull code ใหม่จาก GitHub

- [ ] Pull latest code:
  ```powershell
  cd C:\Co_project
  git pull origin main
  ```
  Expected: เห็น files ที่ update หรือ `Already up to date.`

### 2. Install dependencies (ถ้ามี package ใหม่)

- [ ] Backend:
  ```powershell
  cd C:\Co_project\backend
  npm install
  ```

- [ ] Frontend:
  ```powershell
  cd C:\Co_project\Frontend
  npm install
  ```

### 3. Run database migrations (ถ้ามี schema เปลี่ยน)

- [ ] Apply migrations:
  ```powershell
  cd C:\Co_project\backend
  npx prisma migrate deploy
  ```
  Expected: `All migrations have been applied` หรือ `No pending migrations`

  ถ้าเห็น error `EPERM` เกี่ยวกับ DLL → backend กำลังรันอยู่, หยุดก่อน:
  ```powershell
  pm2 stop coop-backend
  npx prisma migrate deploy
  ```

### 4. Build frontend

- [ ] Build:
  ```powershell
  cd C:\Co_project\Frontend
  npx vite build
  ```
  Expected: เห็น `✓ built in X.XXs` และมีโฟลเดอร์ `dist/`

### 5. Restart backend

- [ ] Restart:
  ```powershell
  pm2 restart coop-backend
  ```
  Expected: status เป็น `online`

- [ ] ตรวจ logs:
  ```powershell
  pm2 logs coop-backend --lines 10 --nostream
  ```
  Expected: เห็น `Server running at http://localhost:5000` ไม่มี error

### 6. ตรวจ Nginx รันอยู่

- [ ] ตรวจ:
  ```powershell
  tasklist | findstr nginx
  ```
  ถ้าไม่มี nginx.exe → Start Nginx:
  ```powershell
  Set-Location C:\nginx
  .\nginx.exe
  ```

### 7. ตรวจ ngrok tunnel รันอยู่

- [ ] ตรวจว่า ngrok รันอยู่ในหน้าต่างไหนหรือเปล่า
  ถ้าไม่มี → รัน tunnel ใหม่ใน PowerShell แยก:
  ```powershell
  ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev
  ```

### 8. Verify

- [ ] เปิด browser → `https://apply-happiness-margarine.ngrok-free.dev`
- [ ] Login ได้ปกติ
- [ ] ถ้าทุกอย่างปกติ → แจ้ง user ว่า deploy สำเร็จ

## Troubleshooting

- **Backend crash** → `pm2 logs coop-backend --lines 30` ดู error
- **Frontend blank** → ตรวจ `C:\Co_project\Frontend\dist\index.html` มีไหม
- **ngrok offline** → รัน `ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev` ใหม่
- **DB migration error** → ตรวจ `.env` DATABASE_URL ถูกต้อง, MySQL service รันอยู่