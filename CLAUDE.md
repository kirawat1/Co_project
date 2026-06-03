# CLAUDE.md — คู่มือสำหรับ Claude Code

ไฟล์นี้ให้ context ที่จำเป็นสำหรับ Claude ในการช่วยพัฒนาโปรเจกต์นี้

---

## โปรเจกต์คืออะไร

ระบบจัดการสหกิจศึกษา (Co-op) สำหรับวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น  
Backend: Express + Prisma + MySQL | Frontend: React 19 + TypeScript + Vite + Tailwind

---

## โครงสร้างและ Convention

### Backend (`backend/`)

```
controllers/    ← business logic, ไม่มี route definition
routes/         ← route definition เท่านั้น, import controller
middlewares/    ← authMiddleware.js (verifyToken, verifyRole)
prisma/         ← schema.prisma + migrations
scripts/        ← utility: create_user.js, migrate_passwords.js
__tests__/      ← Jest tests พร้อม mock Prisma
```

**Pattern ที่ใช้ทั่วทั้ง backend:**
```js
// routes: verifyToken ก่อน verifyRole เสมอ
router.post('/endpoint', verifyToken, verifyRole('staff', 'teacher'), controller.fn);

// controllers: try/catch ทุก async function
exports.fn = async (req, res) => {
  try {
    ...
    res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: '...' });
  }
};
```

**Role names (ตรงกับ Prisma enum — lowercase เสมอ):**
- `student`, `teacher`, `staff`
- `verifyRole` เป็น case-insensitive แล้ว

**Status codes:**
- `401` = token หมดอายุ/ผิด → frontend auto-logout
- `403` = มีสิทธิ์ไม่พอ
- `404` = ไม่พบข้อมูล
- `409` = conflict (เช่น วันนิเทศซ้ำ)

### Frontend (`Frontend/src/components/`)

**Naming convention:**
- `A_*.tsx` = Admin/Staff components
- `T_*.tsx` = Teacher components
- `S_*.tsx` = Student components
- `M_*.tsx` = Mentor components

**Auth token:** เก็บใน `localStorage.getItem("coop.token")`

**API calls pattern:**
```ts
const res = await axios.get("/api/...", {
  headers: { Authorization: `Bearer ${token}` }
});
```
ใช้ relative path เสมอ (ไม่มี `http://localhost:5000`) — Vite proxy จัดการ

**Pagination response format** จาก `/api/students`:
```ts
// API คืน { data: [...], meta: { total, page, limit, totalPages } }
const arr = Array.isArray(data) ? data : (data?.data ?? []);
```

---

## Database (Prisma + MySQL)

**Schema:** `backend/prisma/schema.prisma`

**Tables หลัก:**
- `User` — ข้อมูล login (role: student/teacher/staff)
- `Student` — ข้อมูลนักศึกษา (FK: userId)
- `Teacher` — ข้อมูลอาจารย์ (FK: userId)
- `StudentCoop` — สถานะการสมัครสหกิจ
- `SupervisionAppointment` — การนัดหมายนิเทศ
- `Document` — ไฟล์อัปโหลดต่างๆ
- `Company` — บริษัทฝึกงาน
- `CoopPeriod` — รอบปีการศึกษา

**Prisma commands:**
```bash
npx prisma migrate dev    # สร้าง migration ใหม่ (dev)
npx prisma migrate deploy # apply migrations (production)
npx prisma studio         # GUI สำหรับดู data
```

---

## การรัน

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 5173)
cd Frontend && npm run dev

# Tests
cd backend && npm test
```

---

## Scripts ที่มีประโยชน์

```bash
# สร้าง user ใหม่
node backend/scripts/create_user.js --username=xxx --email=xxx --password=xxx --role=staff

# Hash password (เอาไปใส่ใน MySQL โดยตรง)
node backend/scripts/hash_password.js <password>

# Hash plaintext passwords เก่าทั้งหมดใน DB
node backend/scripts/migrate_passwords.js
```

---

## Routing Architecture

**Express route mounting (server.js):**
```
/api/auth       → authRoutes
/api/students   → studentRoutes
/api/coop       → coopRoutes  ← รวม supervision/me, supervision/propose, supervision/calendar
/api/docs       → docRoutes
/api/teacher    → teacherRoutes
/api/teachers   → teacherRoutes (dup mount)
/api/admin      → adminRoutes
/api/companies  → companyRoutes
/api/visits     → visitRoutes
/api            → supervisionRoutes  ← admin + teacher supervision routes
```

**สำคัญ:** Student supervision routes (`/api/coop/supervision/*`) ต้องอยู่ใน `coopRoutes.js`  
ไม่ใช่ `supervisionRoutes.js` เพราะ `/api/coop/*` ถูกจับโดย coopRouter ก่อน `/api/*`

---

## ข้อควรระวัง

1. **JWT_SECRET** ต้องตั้งใน `.env` ก่อน start server — มี startup check
2. **Role case**: DB เก็บ lowercase (`student`, `teacher`, `staff`) — `verifyRole` case-insensitive
3. **Pagination**: `/api/students` คืน `{ data: [], meta: {} }` — ต้อง unwrap ทุกที่ที่ใช้
4. **Uploads**: ไฟล์อยู่ที่ `backend/uploads/` — Vite proxy forward `/uploads/*` ให้แล้ว
5. **proposedDates**: เก็บเป็น JSON string ใน DB → ต้อง `JSON.parse()` ก่อนใช้
6. **SupervisionStatus**: calendar ต้อง filter `DATE_CONFIRMED | LETTER_UPLOADED | COMPLETED`

---

## Tests

**รัน:** `cd backend && npm test`

**Mock pattern:**
```js
// mock Prisma ที่ __tests__/__mocks__/prismaClient.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
// หรือ
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => require('./__mocks__/prismaClient'))
}));
```

**Setup:** `__tests__/setup.js` ตั้งค่า env ทดสอบ (JWT_SECRET, DATABASE_URL)

---

## ไฟล์ที่แก้บ่อย

| ไฟล์ | เมื่อไหร่ควรแก้ |
|------|----------------|
| `backend/routes/adminRoutes.js` | เพิ่ม/แก้ admin endpoint |
| `backend/controllers/supervisionController.js` | logic นิเทศ |
| `backend/middlewares/authMiddleware.js` | verifyToken, verifyRole |
| `Frontend/src/components/SupervisionCalendar.tsx` | UI ปฏิทิน |
| `Frontend/src/main.tsx` | global axios interceptor |
| `CHANGELOG.md` | บันทึกการเปลี่ยนแปลงทุกครั้ง |
