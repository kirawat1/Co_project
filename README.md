# ระบบจัดการสหกิจศึกษา (Co-operative Education Management System)

ระบบจัดการสหกิจศึกษาสำหรับวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น  
รองรับ 3 บทบาท: นักศึกษา · อาจารย์ · เจ้าหน้าที่

---

## Tech Stack

| ส่วน        | เทคโนโลยี                      |
| ----------- | ------------------------------ |
| Backend     | Node.js 22 + Express 4         |
| ORM / DB    | Prisma 4 + MySQL 8             |
| Frontend    | React 19 + TypeScript + Vite 7 |
| Styling     | Tailwind CSS 4                 |
| Auth        | JWT (jsonwebtoken) + bcryptjs  |
| File Upload | Multer                         |
| PDF         | jspdf + pdf-lib                |
| Testing     | Jest + Supertest               |

---

## โครงสร้างโปรเจกต์

```
Co_project/
├── backend/                  # Express API server
│   ├── controllers/          # Business logic
│   ├── middlewares/          # JWT auth, upload
│   ├── routes/               # API routes
│   ├── prisma/               # Schema + migrations
│   ├── scripts/              # Utility scripts
│   ├── __tests__/            # Jest tests
│   └── server.js             # Entry point
├── Frontend/                 # React + TypeScript SPA
│   └── src/
│       ├── components/       # Pages + components (A_*, T_*, S_*)
│       └── utils/            # PDF generators, helpers
├── CHANGELOG.md
└── README.md
```

---

## การติดตั้ง

### ข้อกำหนดเบื้องต้น

- Node.js ≥ 18
- MySQL 8
- XAMPP (หรือ MySQL standalone)

### 1. Clone และติดตั้ง

```bash
# Backend
cd backend
npm install

# Frontend
cd ../Frontend
npm install
```

### 2. ตั้งค่า Environment

```bash
# สร้างไฟล์ .env จาก template
cp backend/.env.example backend/.env
cp Frontend/.env.example Frontend/.env
```

แก้ไข `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/coop_mysql_db?charset=utf8mb4"
JWT_SECRET=your_random_secret_min_32_chars
KKU_API_TOKEN=your_kku_api_token
```

### 3. สร้างฐานข้อมูล

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 4. สร้าง User แรก

```bash
# สร้าง admin/staff
node scripts/create_user.js --username=admin01 --email=admin@kku.ac.th --password=MyPassword --role=staff

# สร้างอาจารย์
node scripts/create_user.js --username=teacher01 --email=teacher@kku.ac.th --password=MyPassword --role=teacher

# Hash password สำหรับ SQL manual
node scripts/hash_password.js MyPassword
```

---

## การรันระบบ

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd Frontend
npm run dev
```

เปิดเบราว์เซอร์: [http://localhost:5173](http://localhost:5173)

---

## API Endpoints หลัก

| Prefix           | ใครใช้            | ตัวอย่าง                                |
| ---------------- | ----------------- | --------------------------------------- |
| `/api/auth`      | ทุกคน             | POST `/signin`, POST `/login/sso`       |
| `/api/students`  | นศ. / อาจารย์     | GET `/me`, PUT `/me`                    |
| `/api/coop`      | นศ.               | POST `/apply`, GET `/supervision/me`    |
| `/api/docs`      | นศ.               | POST `/upload`, GET `/my-application`   |
| `/api/teacher`   | อาจารย์           | GET `/me`, GET `/supervisions`          |
| `/api/admin`     | เจ้าหน้าที่       | GET `/students`, GET `/dashboard-stats` |
| `/api/companies` | เจ้าหน้าที่ / นศ. | GET `/`, POST `/`                       |

---

## Roles & สิทธิ์

| Role      | หน้าที่                                       | Path         |
| --------- | --------------------------------------------- | ------------ |
| `student` | ยื่นสมัคร, อัปโหลดเอกสาร, นัดหมายนิเทศ        | `/student/*` |
| `teacher` | พิจารณาคำร้อง, ยืนยันวันนิเทศ, ตรวจ T002/T003 | `/teacher/*` |
| `staff`   | จัดการระบบทั้งหมด, ออกหนังสือ                 | `/admin/*`   |

---

## การทดสอบ

### Frontend (Playwright)

```bash
cd Frontend
npx playwright test          # รัน UI tests ทั้งหมด (64 tests)
npx playwright test --ui     # เปิด Playwright UI mode
npx playwright show-report   # ดู HTML report
```

ไฟล์ test อยู่ที่ `Frontend/tests/`: student.spec.ts, admin.spec.ts, teacher.spec.ts

### Backend (Jest)

```bash
cd backend
npm test          # รัน Jest ทั้งหมด
npm run test:watch  # watch mode
```

ไฟล์ test อยู่ที่ `backend/__tests__/`:

- `authMiddleware.test.js` — verifyToken, verifyRole
- `authController.test.js` — signIn, getProfile
- `coopController.test.js` — submit, updateStatus, deleteDocument
- `studentController.test.js` — getStudents pagination, getMyProfile

---

## ฟีเจอร์หลัก

- **นักศึกษา**: ยื่นสมัคร → อัปโหลดเอกสาร (T000/T002/T003) → นัดหมายนิเทศ → ติดตามสถานะ
- **อาจารย์**: พิจารณาคำร้อง → ยืนยันวันนิเทศ → ตรวจเอกสาร → ปฏิทินนิเทศ
- **เจ้าหน้าที่**: จัดการรอบสหกิจ → จัดการบริษัท → ออกหนังสือ → Dashboard
- **KKU SSO**: Login ผ่าน KKU Single Sign-On (สำหรับ production)
- **ปฏิทินนิเทศ**: แสดงวันที่จองพร้อมขอบสีทุก role

---

## Environment Variables

### Backend

| Key             | คำอธิบาย                    | ตัวอย่าง                       |
| --------------- | --------------------------- | ------------------------------ |
| `PORT`          | Port ของ backend            | `5000`                         |
| `FRONTEND_URL`  | URL ของ frontend (CORS)     | `http://localhost:5173`        |
| `DATABASE_URL`  | MySQL connection string     | `mysql://root:pw@localhost/db` |
| `JWT_SECRET`    | Secret สำหรับ JWT (≥32 ตัว) | `random_long_string`           |
| `KKU_API_TOKEN` | Token จากสำนักทะเบียน KKU   | จากเจ้าหน้าที่ IT              |

### Frontend

| Key            | คำอธิบาย                                                  |
| -------------- | --------------------------------------------------------- |
| `VITE_API_URL` | URL ของ backend (production เท่านั้น, dev ใช้ Vite proxy) |

---

## หมายเหตุ

- **Development**: Vite proxy `/api/*` และ `/uploads/*` ไปที่ `localhost:5000` อัตโนมัติ
- **Production**: ตั้ง `VITE_API_URL` และ `FRONTEND_URL` ให้ตรงกับ domain จริง
- JWT token หมดอายุใน 24 ชั่วโมง — ระบบจะ redirect กลับ login อัตโนมัติ
