# สำรองข้อมูลและกู้คืน

ทุกคืนตอน 02:00 ระบบสำรองสองอย่าง:

| อะไร | ไปไหน | เก็บนานแค่ไหน |
|---|---|---|
| ฐานข้อมูล (`mysqldump` → `.sql.gz`) | `C:\coop-backups\db\coop_db-YYYYMMDD-HHMM.sql.gz` | 14 วัน (เก็บ 3 ไฟล์ล่าสุดเสมอ แม้จะเก่ากว่านั้น) |
| ไฟล์อัปโหลด (`backend\uploads`) | `C:\coop-backups\uploads\` | ตลอดไป: คัดลอกเฉพาะไฟล์ใหม่หรือไฟล์ที่เปลี่ยน และไม่ลบไฟล์ในที่สำรอง ไฟล์ที่ถูกลบออกจากระบบจึงยังกู้ได้ |

ทุกวันอาทิตย์ตอน 03:30 ระบบทดสอบกู้ dump ล่าสุดลงฐานชั่วคราว แล้วนับแถวทุกตารางเทียบกับฐานจริง เสร็จแล้วลบฐานชั่วคราวทิ้ง

ผลทุกครั้งเขียนต่อท้ายใน `C:\coop-backups\backup.log` ส่วน `last-backup.json` บอกเวลาและไฟล์ของการสำรองครั้งล่าสุด

> ⚠️ ที่สำรองที่อยู่บนดิสก์เดียวกับ VM ช่วยได้แค่ตอนลบข้อมูลพลาดหรือข้อมูลเสีย ถ้า VM หรือดิสก์เสียทั้งก้อน ที่สำรองก็หายไปด้วย
> **ควรตั้ง `BACKUP_MIRROR_DIR`** ให้ชี้ไปยังไดรฟ์อื่นหรือแชร์เครือข่ายของคณะ

## ติดตั้งบน VM (ครั้งเดียว)

1. `git pull` แล้วรัน `deploy.ps1` ตามปกติ
2. ตั้งค่าใน `C:\Co_project\backend\.env` ถ้าไม่ใส่ จะใช้ค่าในวงเล็บ:
   ```
   BACKUP_DIR=D:\coop-backups          # (C:\coop-backups) ต้องอยู่นอกโฟลเดอร์โปรเจกต์
   BACKUP_KEEP_DAYS=14                 # (14)
   BACKUP_MIRROR_DIR=\\fileserver\coop-backup   # (ไม่มี) สำเนาที่สอง
   ```
3. เปิด PowerShell แบบ **Run as Administrator**:
   ```powershell
   PowerShell -ExecutionPolicy Bypass -File C:\Co_project\docs\register-backup-task.ps1
   Start-ScheduledTask CoopBackup
   Get-Content C:\coop-backups\backup.log -Tail 10
   ```
   ต้องเห็น `[OK] ฐานข้อมูล → ...` และ `[OK] ไฟล์อัปโหลด: ...`
4. ทดสอบกู้หนึ่งครั้ง:
   ```powershell
   cd C:\Co_project\backend
   node scripts\backup.js --verify
   ```
   ต้องเห็น `[OK] กู้ได้ครบ N ตาราง` (หรือ `[OK] ไฟล์สำรองครบ N ตาราง`) และ `[OK] ไฟล์อัปโหลดในที่สำรองครบ N ไฟล์ที่ฐานอ้างถึง`
   - `[ERR] ไฟล์อัปโหลดใน…ไม่ครบ` = ไฟล์ยังอยู่ในระบบแต่ไม่อยู่ในที่สำรอง → รัน `node scripts\backup.js` ใหม่แล้วตรวจอีกครั้ง
   - `[WARN] ฐานอ้างถึงไฟล์ที่ไม่มีในระบบอยู่แล้ว` = ไฟล์หายจากระบบไปก่อนแล้ว (ไม่ใช่ปัญหาของการสำรอง) — เอกสารพวกนั้นเปิดไม่ได้อยู่แล้ว ให้นักศึกษาส่งใหม่
   - `[WARN] ยังไม่ได้ตั้ง BACKUP_MIRROR_DIR` = ยังไม่มีสำเนานอกเครื่อง (ดูกล่องเตือนด้านบน)

   > บัญชีใน `DATABASE_URL` มีสิทธิ์แค่ฐานของระบบ (เช่น `coopuser`) → สร้างฐานชั่วคราวไม่ได้ สคริปต์จะ **ตรวจตัวไฟล์แทนเอง** (แตกทั้งไฟล์ · มีครบทุกตาราง · นับแถวเทียบฐานจริง) ไม่ต้องให้สิทธิ์เพิ่ม
   > ข้อจำกัด: ไม่ได้ลองโหลดเข้า MySQL จริง — ถ้าอยากทดสอบเต็ม ให้สิทธิ์ด้วย root: ``GRANT ALL PRIVILEGES ON `coop_mysql_db_%`.* TO 'coopuser'@'localhost';``

> ถ้าใช้ `BACKUP_MIRROR_DIR` เป็นแชร์เครือข่าย บัญชี SYSTEM มักเข้าแชร์ไม่ได้
> ให้เปิด Task Scheduler → `CoopBackup` → Properties → "Change User or Group" แล้วเลือกบัญชีที่เข้าแชร์ได้

## ตรวจว่ายังสำรองอยู่

```powershell
Get-ScheduledTaskInfo CoopBackup | Select LastRunTime, LastTaskResult   # LastTaskResult 0 = สำเร็จ
Get-Content C:\coop-backups\last-backup.json
Get-ChildItem C:\coop-backups\db | Sort LastWriteTime -Desc | Select -First 3
```

ถ้าเห็น `[ERR]` ใน `backup.log` สาเหตุที่พบบ่อยมีดังนี้

| ข้อความ | แก้ |
|---|---|
| `หา mysqldump ไม่เจอ` | หา path ด้วย `Get-ChildItem "C:\Program Files\MySQL\MySQL Server*\bin\mysqldump.exe"` แล้วตั้ง `MYSQLDUMP_PATH=<path นั้น>` ใน `.env` (VM ใช้ MySQL 8.4) |
| `Plugin caching_sha2_password could not be loaded` | สคริปต์ไปเจอ mysqldump ของ MariaDB/XAMPP ให้ตั้ง `MYSQLDUMP_PATH` ชี้ไปที่ MySQL Server 8 |
| `Access denied` | รหัสใน `DATABASE_URL` ไม่ตรง หรือบัญชีไม่มีสิทธิ์ `SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER` |
| `dump ไม่ครบ` | ดิสก์เต็มหรือ MySQL หลุดกลางทาง ให้ดูพื้นที่ดิสก์ |

## กู้คืนจริง (ข้อมูลเสีย/ลบพลาด)

**แบบปลอดภัย:** กู้ลงฐานแยก (บัญชีสิทธิ์ฐานเดียวสร้างฐานใหม่ไม่ได้ — รันคำสั่งด้วยบัญชี root: `$env:DATABASE_URL="mysql://root:<รหัส>@localhost:3306/coop_mysql_db"` ก่อน แล้วปิดหน้าต่างเมื่อเสร็จ) แล้วดึงเฉพาะข้อมูลที่ต้องการ ระบบที่ใช้งานอยู่ไม่ต้องหยุด

```powershell
cd C:\Co_project\backend
node scripts\backup.js --restore=C:\coop-backups\db\coop_db-20261016-0200.sql.gz --database=coop_mysql_db_old
# แล้วใช้ MySQL Workbench / SQL ดึงแถวที่ต้องการจาก coop_mysql_db_old กลับไป coop_mysql_db
```

**แบบทับทั้งฐาน:** ใช้ตอนฐานเสียทั้งก้อน ข้อมูลหลังเวลาสำรองจะหายทั้งหมด

```powershell
pm2 stop all                                   # หยุด backend ก่อน
cd C:\Co_project\backend
node scripts\backup.js                         # สำรองสภาพปัจจุบันไว้ก่อน เผื่อกู้ผิดไฟล์
node scripts\backup.js --restore=C:\coop-backups\db\coop_db-20261016-0200.sql.gz --database=coop_db --force
npx prisma migrate deploy                      # ถ้า dump เก่ากว่า migration ล่าสุด
pm2 start all
```

**ไฟล์อัปโหลด:** คัดลอกกลับจาก `C:\coop-backups\uploads\` ไปยัง `C:\Co_project\backend\uploads\`

```powershell
robocopy C:\coop-backups\uploads C:\Co_project\backend\uploads /E /XO   # /XO = ไม่ทับไฟล์ที่ใหม่กว่า
```

## ซ้อมกู้บนเครื่องอื่น (กรณี VM เสียทั้งเครื่อง) — ควรทำภาคเรียนละครั้ง

บน VM บัญชีของระบบลองโหลดเข้า MySQL จริงไม่ได้ (สิทธิ์ฐานเดียว) การซ้อมบนเครื่องอื่นจึงเป็นทางเดียวที่พิสูจน์ได้ว่ากู้ได้จริง

1. คัดลอกจาก VM (หรือจาก `BACKUP_MIRROR_DIR`) ไปเครื่องที่มี MySQL 8 + Node + โค้ดโปรเจกต์:
   - dump ล่าสุด `C:\coop-backups\db\coop_db-….sql.gz`
   - โฟลเดอร์ `C:\coop-backups\uploads\` ทั้งโฟลเดอร์
   > ไฟล์มีข้อมูลส่วนบุคคลของนักศึกษาทั้งคณะ — ใช้เครื่องของคณะ ลบทิ้งเมื่อซ้อมเสร็จ
2. บนเครื่องนั้น (`backend\.env` ชี้ MySQL ของเครื่องนั้นด้วยบัญชีที่สร้างฐานได้ เช่น root):
   ```powershell
   cd <โปรเจกต์>\backend
   node scripts\backup.js --restore=D:\drill\coop_db-20261108-0200.sql.gz --database=coop_drill
   $env:DATABASE_URL="mysql://root:<รหัส>@localhost:3306/coop_drill"
   npx prisma migrate status        # ต้องเห็น "Database schema is up to date!" (ไม่ใช่ = dump เก่ากว่าโค้ด → npx prisma migrate deploy)
   ```
3. วางไฟล์อัปโหลด: `robocopy D:\drill\uploads <โปรเจกต์>\backend\uploads /E`
4. `npm run dev` แล้วลองเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่ · เปิดเอกสารนักศึกษาสัก 2–3 ไฟล์ · เปิดหนังสือที่ออกแล้ว 1 ฉบับ
5. เสร็จแล้ว: `DROP DATABASE coop_drill;` และลบโฟลเดอร์ที่คัดลอกมา

ซ้อมบนเครื่องพัฒนา 2026-11-08 (ฐานในเครื่อง): กู้ได้ครบ 33 ตาราง · migration 93 ตัวตรงกับโค้ด · ไฟล์อัปโหลดในที่สำรองครบ 80 ไฟล์ · hash รหัสผ่านใช้ตรวจรหัสได้

## หมายเหตุ

- รหัสผ่านฐานข้อมูลส่งให้ mysqldump ผ่านไฟล์ option ชั่วคราว ซึ่งลบทันทีหลังใช้ รหัสจึงไม่โผล่ใน command line หรือ process list
- dump ใช้ `--single-transaction` ระบบจึงไม่ต้องหยุดระหว่างสำรอง ตาราง InnoDB ได้ภาพข้อมูล ณ เวลาเดียวกัน
- ไฟล์ dump มีข้อมูลส่วนบุคคลของนักศึกษาทั้งคณะ อย่าเก็บไว้ในโฟลเดอร์ที่แชร์สาธารณะ
