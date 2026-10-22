# เน็ต KKU บน VM — login อัตโนมัติ + เฝ้าเน็ตหลุด

VM อยู่หลังหน้า login ของเครือข่าย KKU (captive portal `login.kku.ac.th`) — ต้อง login ก่อนถึงออกอินเทอร์เน็ตได้
และ session นี้**หลุดเองได้ระหว่างที่เครื่องเปิดอยู่** (ไม่ใช่แค่ตอน reboot) พอหลุด:

- เว็บผ่าน ngrok ล่มเงียบ ๆ (`ERR_NGROK_3200`) ทั้งที่ PM2 ยังขึ้น online
- `deploy.ps1` ดึงโค้ด / `npm install` ไม่ได้

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|---------|
| `network-login.js` + `network-login.config.json` | login หน้า portal ด้วย Playwright (รหัสอยู่ใน config — gitignored) |
| `startup.ps1` | ตอนเปิดเครื่อง: login แล้วค่อย start ระบบ |
| `network-keepalive.ps1` | เช็กเน็ตจริง (HTTPS ไปหน้าที่ต้องตอบ 204 — portal ปลอมไม่ได้) → หลุดค่อย login ใหม่ |
| `register-network-keepalive.ps1` | ลงทะเบียน task `CoopNetworkKeepAlive` ให้รันทุก 15 นาที |
| `network-keepalive.status` | เวลาที่เช็กล่าสุด + ผล (เขียนทุกรอบ = หลักฐานว่า task ยังทำงาน) |
| `network-keepalive.log` | บันทึกเฉพาะตอนเน็ตหลุด: login ใหม่แล้วกลับมาไหม (เกิน 1 MB เก็บไว้ 1 ไฟล์เก่า) |

`deploy.ps1` เรียก `network-keepalive.ps1` ก่อนดึงโค้ดด้วย — เน็ตหลุดอยู่จะ login ให้ก่อน ถ้ายังไม่ได้จะหยุดพร้อมบอกว่าเป็นปัญหาเน็ต (ไม่ใช่ conflict)

## ติดตั้ง / อัปเดต task (ครั้งเดียว)

เปิด PowerShell แบบ **Run as administrator** ด้วยบัญชีที่ใช้รันระบบ (บัญชีเดียวกับที่เคยรัน `network-login.js` ได้):

```powershell
cd C:\Co_project\docs
PowerShell -ExecutionPolicy Bypass -File .\register-network-keepalive.ps1
```

สคริปต์จะพิมพ์ว่า task เดิมตั้งไว้อย่างไรก่อน (ผู้ใช้ / รันเฉพาะตอน login ค้างอยู่หรือไม่ / ทุกกี่ชั่วโมง / ผลรันล่าสุด) แล้วตั้งใหม่เป็น:

- ทุก 15 นาที ไม่มีวันหมดอายุ
- รันได้แม้ไม่มีใคร login ค้างที่ VM (`S4U` — ไม่ต้องเก็บรหัสผ่าน Windows)
- รันทีละรอบ ไม่เกิน 5 นาที

ถ้าบรรทัดท้ายเตือนว่า repeat duration ไม่ใช่ indefinite ให้แก้ใน Task Scheduler ตามที่สคริปต์บอก

ถ้า Playwright เปิด browser ไม่ได้ตอนไม่มีคน login (เห็นใน log ว่า `network-login.js exit 1`) ลงทะเบียนแบบเดิม:
`.\register-network-keepalive.ps1 -LogonType Interactive` (ต้องมีคน login ค้างไว้ที่ VM)

## ตรวจว่าทำงาน

```powershell
Start-ScheduledTask CoopNetworkKeepAlive; Start-Sleep 20
Get-ScheduledTaskInfo CoopNetworkKeepAlive | Select LastRunTime, LastTaskResult   # 0 = ออนไลน์
Get-Content C:\Co_project\docs\network-keepalive.status                       # เวลาเช็กล่าสุด
Get-Content C:\Co_project\docs\network-keepalive.log -Tail 20                 # ประวัติเน็ตหลุด
```

เช็กเน็ตด้วยมือ (ไม่ login ไม่เขียนไฟล์): `.\network-keepalive.ps1 -CheckOnly` → `ONLINE` / `OFFLINE`

## อ่าน log

| บรรทัด | ความหมาย |
|--------|----------|
| `OFFLINE - running network-login.js` | เจอเน็ตหลุด |
| `network-login.js exit 0 : ...` | ผลของสคริปต์ login (ข้อความจาก Playwright) |
| `[OK] back online` | login ใหม่แล้วเน็ตกลับมา |
| `[ERR] still offline after login` | login แล้วยังออกเน็ตไม่ได้ — ดูรหัสใน `network-login.config.json` / หน้า portal เปลี่ยนไปหรือไม่ / เครือข่ายคณะมีปัญหา |

`network-keepalive.status` เก่ากว่า 15–20 นาที = task ไม่ได้รัน → ดู `Get-ScheduledTaskInfo CoopNetworkKeepAlive`
