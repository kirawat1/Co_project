# ระบบจัดการสหกิจศึกษา (Co-operative Education Management System)

เว็บแอปพลิเคชันจัดการสหกิจศึกษาของวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น
รวมงานตั้งแต่นักศึกษายื่นคำร้อง ส่งเอกสาร ออกหนังสือราชการ นัดนิเทศ จนถึงส่งแบบประเมินและเล่มรายงานไว้ในระบบเดียว
รองรับหลายหลักสูตรในวิทยาลัย (แต่ละหลักสูตรมีรอบ กำหนดส่ง และอาจารย์ประจำวิชาของตัวเอง)

- แผนภาพฐานข้อมูล: [`docs/design/er-diagram.md`](docs/design/er-diagram.md)

---

## ผู้ใช้งานและบทบาท

| บทบาท | ใคร | ทำอะไรในระบบ |
|---|---|---|
| `student` | นักศึกษา | ยื่นคำร้อง · ส่งเอกสารใบสมัคร (CP-T000) · อัปโหลดใบตอบรับ · กรอก T002/T003 · เสนอวันนิเทศ · ติดตามสถานะและกำหนดส่ง |
| `teacher` | อาจารย์ที่ปรึกษา | ตรวจ T002/T003 · เลือกวันนิเทศจากวันที่นักศึกษาเสนอ · บันทึกผลนิเทศ |
| `teacher` + ประจำวิชา | อาจารย์ประจำวิชาของหลักสูตร | ทุกอย่างของอาจารย์ + พิจารณาคำร้อง · ดูแลรอบ/กำหนดส่ง/นักศึกษาของหลักสูตรตัวเอง |
| `staff` | เจ้าหน้าที่สหกิจศึกษา | ดูแลทุกหลักสูตร · ตรวจเอกสาร · ออกหนังสือราชการ · จัดการนิเทศ · ข้อมูลพื้นฐาน · ตั้งค่าระบบ · บันทึกการใช้งาน |

## ขั้นตอนสหกิจในระบบ

| # | ขั้นตอน | ผู้ดำเนินการ | ผู้ตรวจ / ผลลัพธ์ |
|---|---|---|---|
| 1 | ยื่นคำร้องขอเข้าร่วมโครงการ | นักศึกษา | อาจารย์ประจำวิชา / เจ้าหน้าที่ พิจารณาคำร้อง |
| 2 | ส่งเอกสารใบสมัคร (CP-T000) | นักศึกษา | เจ้าหน้าที่ตรวจเอกสารรายไฟล์ |
| 3 | หนังสือขอความอนุเคราะห์ | เจ้าหน้าที่ออกหนังสือ | นักศึกษานำไปยื่นบริษัท |
| 4 | ใบตอบรับจากบริษัท | นักศึกษาอัปโหลด | เจ้าหน้าที่ตรวจใบตอบรับ |
| 5 | หนังสือส่งตัว | เจ้าหน้าที่ออกหนังสือ | นักศึกษาเริ่มฝึกสหกิจ |
| 6 | แบบฟอร์ม T002 (งาน/ที่พัก) และ T003 (โครงร่างรายงาน) | นักศึกษา | อาจารย์ที่ปรึกษา / เจ้าหน้าที่ตรวจ |
| 7 | นัดหมายนิเทศ | นักศึกษาเสนอวัน | อาจารย์เลือกวัน · เจ้าหน้าที่ออกหนังสือขอเข้านิเทศ |
| 8 | แบบประเมินและเล่มรายงาน (T005–T008) | นักศึกษา / พี่เลี้ยง | เจ้าหน้าที่ตั้งค่าลิงก์และคำชี้แจง |

สถานะของนักศึกษาเก็บใน `StudentCoop.status` (enum `CoopStatus` ใน `backend/prisma/schema.prisma`)
ข้ามขั้นไม่ได้ — ทุกการเปลี่ยนสถานะตรวจที่ฝั่งเซิร์ฟเวอร์ว่าอยู่ขั้นที่ถูกต้อง

---

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Backend | Node.js 22 · Express 4 |
| ฐานข้อมูล | MySQL 8 · Prisma 4 (ORM + migrations) |
| Frontend | React 19 · TypeScript · Vite 7 · Tailwind CSS 4 |
| ยืนยันตัวตน | JWT (jsonwebtoken) + bcryptjs · Google OAuth (นักศึกษา, ไม่บังคับ) |
| เอกสาร | jsPDF + pdf-lib (PDF) · Word (.doc แบบ HTML/MHTML) · xlsx (Excel นำเข้า/ส่งออก) · fflate (zip) |
| ทดสอบ | Jest + Supertest (backend) · Playwright (e2e) |

## โครงสร้างโปรเจกต์

```
Co_project/
├── backend/                     Express API
│   ├── server.js                จุดเริ่มต้น · mount routes
│   ├── routes/                  นิยาม endpoint เท่านั้น (verifyToken → verifyRole → controller)
│   ├── controllers/             business logic
│   ├── middlewares/             ตรวจ token/บทบาท · อัปโหลดไฟล์ · rate limit
│   ├── utils/                   ตรรกะที่ใช้ร่วมกัน (กำหนดส่ง, เลขหนังสือ, สิทธิ์ตามหลักสูตร ฯลฯ)
│   ├── prisma/                  schema.prisma + migrations
│   ├── scripts/                 เครื่องมือ: สร้างบัญชี · สำรองข้อมูล · ตรวจข้อมูล · ER diagram
│   │   ├── dev/                 ข้อมูลทดสอบ/ตัวอย่าง (seed_demo.js)
│   │   └── one-off/             สคริปต์แก้ข้อมูลครั้งเดียว (รันบนระบบจริงแล้ว เก็บไว้อ้างอิง)
│   └── __tests__/               Jest (mock Prisma)
├── Frontend/                    React SPA
│   ├── src/components/          หน้าจอ: A_* = เจ้าหน้าที่ · T_* = อาจารย์ · S_* = นักศึกษา
│   ├── src/utils/               สร้าง PDF/Word หนังสือและแบบฟอร์ม · ตัวช่วย
│   └── tests/                   Playwright e2e
└── docs/
    ├── design/                  แผนภาพฐานข้อมูล (ER diagram)
    ├── history/                 CHANGELOG ฉบับละเอียด
    └── *.ps1 / *.md / nginx*    ติดตั้งและดูแลเครื่องจริง (ดู docs/README.md)
```

---

## เริ่มใช้งานบนเครื่อง (พร้อมข้อมูลตัวอย่าง)

ต้องมี Node.js 22 และ MySQL 8 (หรือ XAMPP)

```bash
# 1. ติดตั้ง package
cd backend  && npm install
cd ../Frontend && npm install

# 2. ตั้งค่า
cp backend/.env.example backend/.env
#    แก้ใน backend/.env:
#      DATABASE_URL="mysql://root:รหัส@localhost:3306/coop_demo?charset=utf8mb4"   ← ฐานใหม่ ชื่ออะไรก็ได้
#      JWT_SECRET=...   ← สร้างด้วย node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
#      NODE_ENV=development
cp Frontend/.env.example Frontend/.env      # ไม่ใช้ Google login ก็ปล่อยค่าตัวอย่างไว้ได้

# 3. สร้างตาราง + ใส่ข้อมูลตัวอย่าง
cd backend
npx prisma migrate deploy
node scripts/dev/seed_demo.js               # พิมพ์รายชื่อบัญชีออกมา · รหัสผ่านทุกบัญชี Demo@1234

# 4. รัน (2 หน้าต่าง)
cd backend  && npm run dev                  # http://localhost:5000
cd Frontend && npm run dev                  # http://localhost:5173  ← เปิดหน้านี้
```

ข้อมูลตัวอย่าง (ชื่อสมมติทั้งหมด): เจ้าหน้าที่ 1 · อาจารย์ 5 · บริษัท 4 · นักศึกษา 18 คนกระจายทุกขั้นของกระบวนการ
ตัวอย่างบัญชี: `staff@example.ac.th` (เจ้าหน้าที่) · `somchai.r@example.ac.th` (อาจารย์ประจำวิชา) · `anucha.ph@example.com` (นักศึกษาที่ฝึกงานอยู่)
ในหน้าเข้าสู่ระบบต้องเลือกบทบาทให้ตรงกับบัญชี · `seed_demo.js` จะหยุดเองถ้าฐานมีบัญชีอยู่แล้ว (กันใส่ซ้ำ/ใส่ระบบจริง)

### เริ่มแบบฐานว่าง (ไม่มีข้อมูลตัวอย่าง)

```bash
cd backend
npx prisma migrate deploy
node scripts/create_user.js --username=admin01 --email=admin@example.ac.th --password=รหัสที่แข็งแรง --role=staff
```
จากนั้นเข้าระบบเป็นเจ้าหน้าที่ แล้วตั้งหลักสูตร รอบสหกิจ และหัวข้อเอกสารในเมนูตั้งค่า

---

## การทดสอบ

```bash
cd backend  && npm test        # Jest — unit/integration (~2,000 เคส, ไม่ต้องใช้ฐานจริง)
cd Frontend && npx playwright test tests/<ไฟล์>.spec.ts    # e2e — ต้องรัน backend + frontend + ฐานทดสอบ
```
e2e บางชุดสร้างข้อมูลทดสอบในฐานเอง — ใช้ฐานแยก ไม่ใช่ฐานที่มีข้อมูลจริง

## สคริปต์ที่ใช้บ่อย (ในโฟลเดอร์ backend)

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `node scripts/create_user.js --username=… --email=… --password=… --role=staff` | สร้างบัญชี |
| `node scripts/dev/seed_demo.js` | ข้อมูลตัวอย่าง (ฐานว่างเท่านั้น) |
| `node scripts/er_diagram.js` | สร้าง `docs/design/er-diagram.md` ใหม่หลังแก้ schema |
| `node scripts/check_data_consistency.js` | ตรวจข้อมูลที่ไม่ควรเกิด (อ่านอย่างเดียว) |
| `node scripts/backup.js` · `--verify` | สำรองฐานข้อมูล + ไฟล์อัปโหลด · ตรวจไฟล์สำรอง |
| `npx prisma migrate dev --name <ชื่อ>` | สร้าง migration หลังแก้ `schema.prisma` |
| `npx prisma studio` | เปิดดู/แก้ข้อมูลในฐานผ่านเบราว์เซอร์ |

## ค่าตั้งค่า (backend/.env)

| ค่า | จำเป็น | คำอธิบาย |
|---|---|---|
| `DATABASE_URL` | ✓ | MySQL connection string |
| `JWT_SECRET` | ✓ | สตริงสุ่ม ≥ 64 ตัวอักษร (server ไม่ start ถ้าไม่มี) |
| `PORT` | | ค่าเริ่มต้น 5000 |
| `FRONTEND_URL` | | origin ที่อนุญาต (CORS) คั่นหลายค่าด้วยคอมมา |
| `NODE_ENV` | | `development` บนเครื่องพัฒนา · `production` บนเครื่องจริง |
| `GOOGLE_CLIENT_ID` | | เปิดให้นักศึกษาเข้าสู่ระบบด้วย Google (ต้องตั้ง `VITE_GOOGLE_CLIENT_ID` ใน Frontend/.env ด้วย) |
| `API_RATE_LIMIT_MAX` | | จำนวนคำขอสูงสุดต่อ 15 นาที (ค่าเริ่มต้น 2000) |
| `BACKUP_DIR` · `BACKUP_MIRROR_DIR` | | ที่เก็บไฟล์สำรอง (ดู `docs/backup.md`) |

## หมายเหตุสำหรับผู้พัฒนา

- ตอนพัฒนา Vite ส่งต่อ `/api/*` และ `/uploads/*` ไปที่ `localhost:5000` ให้เอง — ฝั่งหน้าเว็บเรียก API ด้วย path แบบสัมพัทธ์เสมอ
- route ทุกตัว: `verifyToken` ก่อน `verifyRole(...)` · token หมดอายุ/ผิด = 401 (หน้าเว็บ logout ให้เอง) · สิทธิ์ไม่พอ = 403 · ข้อมูลชนกัน = 409
- ไฟล์ที่อัปโหลดอยู่ที่ `backend/uploads/` (ไม่อยู่ใน git) และเปิดได้เฉพาะผู้ที่มีสิทธิ์ในข้อมูลนั้น
- บันทึกการเปลี่ยนแปลงทุกครั้งใน `CHANGELOG.md`
