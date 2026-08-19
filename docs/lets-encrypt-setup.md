# Let's Encrypt Setup — coop.computing.kku.ac.th

## เงื่อนไขก่อนเริ่ม
- DNS ชี้ `coop.computing.kku.ac.th` → IP ของ VM แล้ว
- Port 80 บน VM เปิดรับ internet ได้
- nginx กำลังรันอยู่ด้วย `nginx-http-only.conf`

---

## ขั้นตอน

### 1. สร้าง folder สำหรับ ACME challenge
```powershell
New-Item -ItemType Directory -Force -Path C:\letsencrypt\webroot\.well-known\acme-challenge
```

### 2. ดาวน์โหลด win-acme
```powershell
# ดาวน์โหลดจาก GitHub releases
$url = "https://github.com/win-acme/win-acme/releases/latest/download/win-acme.v2.x.x.x64.pluggable.zip"
Invoke-WebRequest $url -OutFile C:\win-acme.zip
Expand-Archive C:\win-acme.zip -DestinationPath C:\win-acme
```
หรือโหลด manual จาก: https://github.com/win-acme/win-acme/releases

### 3. ใช้ nginx-http-only.conf ที่มี ACME location
```powershell
copy C:\Co_project\docs\nginx-http-only.conf C:\nginx\conf\nginx.conf
C:\nginx\nginx.exe -t        # ตรวจ syntax
C:\nginx\nginx.exe -s reload # reload
```

### 4. ขอ SSL cert
```powershell
New-Item -ItemType Directory -Force -Path C:\nginx\ssl

cd C:\win-acme
.\wacs.exe `
  --target manual `
  --host coop.computing.kku.ac.th `
  --validation filesystem `
  --webroot C:\letsencrypt\webroot `
  --store pemfiles `
  --pemfilespath C:\nginx\ssl `
  --pemfilesdefaultpem cert.pem `
  --pemfilesdefaultprivatekey key.pem `
  --emailaddress zabatayew@gmail.com `
  --accepttos
```

win-acme จะ:
1. วาง challenge file ใน `C:\letsencrypt\webroot\.well-known\acme-challenge\`
2. ตรวจสอบกับ Let's Encrypt server
3. ออก cert และบันทึก `cert.pem` + `key.pem` ใน `C:\nginx\ssl\`
4. ตั้ง Windows Scheduled Task ต่ออายุทุก 60 วันอัตโนมัติ

### 5. เปลี่ยนเป็น HTTPS nginx config
```powershell
copy C:\Co_project\docs\nginx.conf C:\nginx\conf\nginx.conf
C:\nginx\nginx.exe -t
C:\nginx\nginx.exe -s reload
```

### 6. อัปเดต .env บน VM
```
FRONTEND_URL=https://coop.computing.kku.ac.th
```
แล้ว restart backend:
```powershell
pm2 restart coop-backend
```

### 7. ตรวจสอบ
เปิด https://coop.computing.kku.ac.th → ต้องเห็น 🔒 และระบบทำงานปกติ

---

## Auto-renewal
win-acme สร้าง Windows Scheduled Task ชื่อ "win-acme renewal" ไว้แล้ว
รันทุกวันและต่ออายุอัตโนมัติเมื่อ cert เหลืออายุ < 30 วัน

ตรวจสอบได้ด้วย:
```powershell
Get-ScheduledTask | Where-Object { $_.TaskName -like "*win-acme*" }
```

หรือ renewal manual:
```powershell
cd C:\win-acme
.\wacs.exe --renew --force
```

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|---|---|
| challenge ไม่ผ่าน | ตรวจ `http://coop.computing.kku.ac.th/.well-known/acme-challenge/test` เข้าได้ไหม |
| DNS ยังไม่ชี้ | `nslookup coop.computing.kku.ac.th` ต้องได้ IP ของ VM |
| Port 80 ปิด | ตรวจ firewall VM และ firewall มหาลัย |
| cert บันทึกผิด format | เพิ่ม `--store pemfiles` ให้ครบ |
