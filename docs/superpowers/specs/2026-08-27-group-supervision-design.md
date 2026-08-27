# Group Supervision — Implementation Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` to implement task-by-task.

**Goal:** อาจารย์สามารถยืนยันนัดนิเทศสำหรับนักศึกษาหลายคนในบริษัทเดียวกันพร้อมกันในครั้งเดียว โดยเลือกจากวันที่มี overlap ระหว่างนักศึกษา

**Architecture:** เพิ่ม `groupId` optional field บน `SupervisionAppointment` เพื่อเชื่อม appointment ที่นัดพร้อมกัน — แต่ละนักศึกษายังมี appointment เป็นของตัวเอง flow เดิมไม่เปลี่ยน อาจารย์ได้ view ใหม่ที่จัดกลุ่มตามบริษัทและแสดง overlap ของวันที่

**Tech Stack:** Prisma + MySQL, Express, React 19 + TypeScript + Tailwind

---

## Global Constraints

- Role middleware: `verifyToken` ก่อน `verifyRole` เสมอ
- Teacher role: `verifyRole('teacher')` หรือ `verifyCoopTeacherOrStaff`
- API response format: `{ ok: true, data }` / `{ ok: false, message }`
- `studentId @unique` บน `SupervisionAppointment` คงอยู่ — ไม่เปลี่ยน
- `proposedDates` เป็น JSON string → ต้อง `JSON.parse()` ก่อนใช้
- frontend ใช้ relative path เสมอ (ไม่มี `http://localhost:5000`)
- token: `localStorage.getItem("coop.token")`

---

## Task 1: Schema — เพิ่ม groupId

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: `npx prisma migrate dev --name add_group_supervision`

**Change:**
```prisma
model SupervisionAppointment {
  // ... existing fields ...
  groupId String? // UUID เชื่อม appointment ที่นัดพร้อมกัน (null = นัดเดี่ยว)
}
```

**Test:** `npx prisma migrate dev` สำเร็จ ไม่มี error, `groupId` column อยู่ใน DB

---

## Task 2: Backend — GET /api/teacher/supervisions/by-company

**Files:**
- Modify: `backend/controllers/supervisionController.js` (เพิ่ม `getSupervisionsByCompany`)
- Modify: `backend/routes/teacherRoutes.js` (เพิ่ม route)

**Logic:**
1. หา teacher จาก `req.user.id`
2. `findMany` SupervisionAppointment ที่ `teacherId === teacher.id` และ status ≠ COMPLETED
3. Group ตาม `student.coop.companyId`
4. สำหรับแต่ละบริษัท: parse `proposedDates` ของแต่ละนักศึกษา หา intersection (วันที่ปรากฏในนักศึกษา ≥ 1 คน)
5. Return grouped structure

**Response shape:**
```json
{
  "ok": true,
  "companies": [
    {
      "companyId": "uuid",
      "companyName": "บริษัท ABC",
      "students": [
        {
          "appointmentId": 1,
          "studentId": 10,
          "studentName": "สมชาย ใจดี",
          "studentCode": "651234567",
          "proposedDates": ["2026-09-01T10:00", "2026-09-02T13:00"],
          "status": "PENDING_TEACHER",
          "groupId": null
        }
      ],
      "commonDates": ["2026-09-01T10:00"]
    }
  ]
}
```

**commonDates:** วันที่ปรากฏในนักศึกษา ≥ 2 คน (เปรียบเทียบ date string ตรงๆ)

**Route:**
```js
router.get('/supervisions/by-company', verifyToken, verifyRole('teacher'), supervisionController.getSupervisionsByCompany);
```

---

## Task 3: Backend — POST /api/teacher/supervisions/confirm-group

**Files:**
- Modify: `backend/controllers/supervisionController.js` (เพิ่ม `confirmGroupSupervision`)
- Modify: `backend/routes/teacherRoutes.js` (เพิ่ม route)

**Request body:**
```json
{
  "appointmentIds": [1, 2, 3],
  "confirmedDate": "2026-09-01T10:00:00.000Z"
}
```

**Logic:**
1. Validate: `appointmentIds` ต้องมี ≥ 1 รายการ, `confirmedDate` ต้องเป็น valid date
2. Verify: appointment ทุกตัวต้อง `teacherId === teacher.id` (ป้องกัน unauthorized)
3. Verify: `confirmedDate` ต้องอยู่ใน `proposedDates` ของนักศึกษาแต่ละคน (parse JSON, เปรียบเทียบ datestring)
4. Generate UUID สำหรับ `groupId` (ถ้า `appointmentIds.length > 1`; ถ้า 1 คน groupId = null)
5. `updateMany` ทุก appointment: `{ confirmedDate, status: 'DATE_CONFIRMED', groupId }`
6. Return `{ ok: true, groupId, updatedCount }`

**Route:**
```js
router.post('/supervisions/confirm-group', verifyToken, verifyRole('teacher'), supervisionController.confirmGroupSupervision);
```

**Error cases:**
- 403: appointment ไม่ใช่ของ teacher นี้
- 400: confirmedDate ไม่อยู่ใน proposedDates ของนักศึกษาคนใดคนหนึ่ง

---

## Task 4: Frontend — T_GroupSupervision.tsx (Teacher view)

**Files:**
- Create: `Frontend/src/components/T_GroupSupervision.tsx`

**UI flow:**
1. `useEffect` → `GET /api/teacher/supervisions/by-company`
2. แสดงรายการบริษัท — accordion หรือ card แต่ละบริษัท
3. ภายในแต่ละบริษัท: ตารางแสดงนักศึกษา (ชื่อ, รหัส, วันที่เสนอ, status)
4. ถ้า `commonDates.length > 0`: แสดงปุ่ม "นัดพร้อมกัน" → เปิด modal
5. **Modal:** dropdown เลือกวันจาก `commonDates`, checkbox เลือกนักศึกษา (pre-checked เฉพาะคนที่มีวันนั้น), ปุ่ม Confirm
6. Confirm → `POST /api/teacher/supervisions/confirm-group` → reload data

**State:**
```ts
interface CompanyGroup {
  companyId: string;
  companyName: string;
  students: StudentAppointment[];
  commonDates: string[];
}
```

**ถ้าบริษัทมีนักศึกษาคนเดียว** หรือ **ไม่มี commonDates**: ซ่อนปุ่ม "นัดพร้อมกัน" — ยังดูข้อมูลได้แต่นัดกลุ่มไม่ได้

---

## Task 5: เพิ่ม tab ใน T_SupervisionReview.tsx

**Files:**
- Modify: `Frontend/src/components/T_SupervisionReview.tsx`

**Change:** เพิ่ม tab "นิเทศตามบริษัท" ข้าง tab ที่มีอยู่ → render `<T_GroupSupervision />`

ไม่เปลี่ยน logic ของ tab เดิม

---

## Task 6: Calendar — แสดง group appointment รวมกัน

**Files:**
- Modify: `Frontend/src/components/SupervisionCalendar.tsx`

**Change:** ใน render ของ calendar events ถ้า appointment หลายตัวมี `groupId` เดียวกัน → แสดงเป็น event เดียว label "นิเทศกลุ่ม (N คน) — บริษัท X"

Group โดย `groupId` ก่อน render; appointment ที่ `groupId = null` render ปกติ

---

## Data Flow Summary

```
นักศึกษา → เสนอวัน (flow เดิม ไม่เปลี่ยน)
                    ↓
อาจารย์ → GET /by-company → เห็น overlap ของวันที่
                    ↓
อาจารย์ → POST /confirm-group → update หลาย appointment พร้อมกัน + groupId UUID
                    ↓
Calendar → group appointment ที่ groupId เดียวกัน → แสดงเป็น event เดียว
```
