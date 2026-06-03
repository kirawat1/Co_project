---
name: deploy
description: Deploy Co-op system on VM - pull from GitHub, migrate DB, build frontend, restart services. Use after code push or VM reboot.
allowed-tools: Bash PowerShell
---

# Deploy Co-op System - VM Production

Use this skill to:
- Update the project after pushing code to GitHub
- Start all services after VM reboot

## Checklist

### 0. Start Services After Reboot (if VM just restarted)

- [ ] Start MySQL:
  ```powershell
  Start-Service MySQL84
  Start-Sleep 3
  ```
  If service name is wrong, find it:
  ```powershell
  Get-Service | Where-Object { $_.Name -like "*mysql*" }
  ```

- [ ] Start PM2 + Backend:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  pm2 resurrect
  Start-Sleep 3
  pm2 status
  ```
  If coop-backend is not listed:
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

- [ ] Start ngrok tunnel (keep this window open):
  ```powershell
  ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev
  ```

---

### 1. Pull latest code from GitHub

- [ ] Pull:
  ```powershell
  cd C:\Co_project
  git pull origin main
  ```

### 2. Install dependencies (if packages changed)

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

### 3. Run database migrations

- [ ] Migrate:
  ```powershell
  cd C:\Co_project\backend
  npx prisma migrate deploy
  ```
  If EPERM error (DLL locked), stop PM2 first:
  ```powershell
  pm2 stop coop-backend
  npx prisma migrate deploy
  pm2 start coop-backend
  ```

### 4. Build frontend

- [ ] Build:
  ```powershell
  cd C:\Co_project\Frontend
  npx vite build
  ```
  Expected: built in X.XXs with dist/ folder created

### 5. Restart backend

- [ ] Restart:
  ```powershell
  pm2 restart coop-backend
  pm2 logs coop-backend --lines 10 --nostream
  ```
  Expected: Server running at http://localhost:5000

### 6. Verify

- [ ] Open browser: https://apply-happiness-margarine.ngrok-free.dev
- [ ] Login works normally
- [ ] Report to user: deploy complete

## Troubleshooting

| Problem | Fix |
|---|---|
| MySQL not starting | `Start-Service MySQL84` |
| Backend crash | `pm2 logs coop-backend --lines 30` |
| Nginx not starting | `Set-Location C:\nginx` then `.\nginx.exe -t` |
| ngrok offline | Re-run `ngrok http 80 --domain=apply-happiness-margarine.ngrok-free.dev` |
| CORS error | Check `FRONTEND_URL` in `C:\Co_project\backend\.env` matches ngrok URL |
| Frontend blank page | Check `C:\Co_project\Frontend\dist\index.html` exists |