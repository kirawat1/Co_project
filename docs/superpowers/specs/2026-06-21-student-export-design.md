# Export รายชื่อนักศึกษา (Excel) จาก Dashboard — Design

> **For agentic workers:** ใช้ superpowers:writing-plans เพื่อสร้าง implementation plan จาก spec นี้

**Goal:** เพิ่มปุ่ม "Export Excel" ใน A_Dashboard.tsx (staff) และ T_Dashboard.tsx (teacher) ให้ดาวน์โหลดรายชื่อนักศึกษา 1 แถว = 1 คน พร้อมสถานะ/บริษัท/อาจารย์ที่ปรึกษา

**Architecture:** Backend endpoint ใหม่ generate ไฟล์ .xlsx ด้วย library `xlsx` (มีอยู่แล้วใน backend/package.json) ส่งกลับเป็น file download ตรง (`Content-Disposition: attachment`) ไม่ต้องเพิ่ม dependency ฝั่ง frontend

**Tech Stack:** Express + Prisma + `xlsx` (backend), React + axios (frontend)

---

## Context

ระบบมี dashboard อยู่แล้ว (`A_Dashboard.tsx` สำหรับ staff, `T_Dashboard.tsx` สำหรับอาจารย์) แสดงตัวเลขสรุป (จำนวนนักศึกษา, สถานะคำร้อง) แบบ aggregate count เท่านั้น ยังไม่มีทางดาวน์โหลดรายชื่อจริงเป็นไฟล์ Excel สำหรับเอาไปทำเอกสารราชการ/ติดตามรายคน

ของเดิมที่เกี่ยวข้อง:
- `backend/controllers/studentController.js:exports.getStudents` — list นักศึกษาแบบ paginate (ใช้ใน A_Students.tsx) include `user`, `coop.company`, `coop.mentor`, `documents`, `coopApplicationForm.gradeSheetUrl` — **ไม่ include** `generalAdvisor`/`coopAdvisor`
- `backend/controllers/teacherController.js:exports.getMyStudents` — มี permission logic อยู่แล้ว: ถ้า `Teacher.isCoopTeacher === true` คืนนักศึกษาทั้งหมด, ถ้าไม่ใช่คืนเฉพาะที่ `generalAdvisorId` หรือ `coopAdvisorId` ตรงกับ teacher คนนั้น
- `backend/controllers/studentImportController.js` — ใช้ `xlsx` package อ่านไฟล์ import อยู่แล้ว (เป็น dependency พร้อมใช้)

## API

### `GET /api/admin/students/export?coopPeriodId=<id|all>`
- Middleware: `verifyToken, verifyRole('staff')`
- ดึงนักศึกษาทั้งหมด (ไม่ paginate) filter ตาม `coopPeriodId` ถ้าไม่ใช่ `all`
- คืนไฟล์ .xlsx ตรง

### `GET /api/teacher/students/export?coopPeriodId=<id|all>`
- Middleware: `verifyToken` (role teacher)
- ใช้ permission logic เดียวกับ `getMyStudents`:
  - `isCoopTeacher === true` → ทุกคน (filter ตาม period)
  - ไม่ใช่ → เฉพาะ `generalAdvisorId === teacher.id OR coopAdvisorId === teacher.id`
- คืนไฟล์ .xlsx ตรง

ทั้งสอง endpoint ใช้ฟังก์ชัน generate workbook ร่วมกัน (`backend/utils/studentExport.js`) รับ array ของ student records (พร้อม include ที่จำเป็น) แล้วคืน Buffer ของไฟล์ .xlsx

## คอลัมน์ในไฟล์ (เรียงซ้าย→ขวา)

| Header (ไทย) | Source |
|---|---|
| รหัสนักศึกษา | `student.studentId` |
| ชื่อ-นามสกุล | `${prefix} ${firstName} ${lastName}` |
| สาขา | `student.major` |
| ชั้นปี | `student.year` |
| สถานะสหกิจ | แปลจาก `student.coop.status` ผ่าน object `COOP_STATUS_LABEL_TH` ใหม่ใน `backend/utils/coopStatusLabels.js` — พอร์ต field `label` จาก `Frontend/src/components/StatusBadge.tsx:STATUS_CONFIG` มาเป็น `{ STATUS_KEY: "label ไทย" }` ล้วน (ไม่เอา color/icon/isInternship) ครบทุก key ที่มีอยู่ใน `STATUS_CONFIG` ปัจจุบัน (NOT_SUBMITTED, APPLYING, QUALIFIED, QUALIFICATION_FAILED, APPLICATION_EDITS_REQUIRED, WAITING_FOR_STAFF_CHECK, EDITS_REQUIRED, DOCS_APPROVED, REQ_LETTER_ISSUED, PLACEMENT_LETTER_ISSUED, WAITING_FOR_PLACEMENT_LETTER, WAITING_FOR_STAFF_CHECK_LETTER, ACCEPTANCE_CHECKED, INTERNSHIP_STARTED, T002_SUBMITTED, T002_EDITS_REQUIRED, T003_SUBMITTED, T003_EDITS_REQUIRED, T004_SUBMITTED, T004_EDITS_REQUIRED, PENDING_TEACHER, TEACHER_REJECTED, DATE_CONFIRMED, LETTER_UPLOADED, COMPLETED, WAITING) ถ้า status เป็น null/ไม่อยู่ใน map → fallback เป็น `"ยังไม่ยื่นสหกิจ"` (label ของ WAITING/NOT_SUBMITTED) |
| บริษัท | `student.coop.company.name` หรือ "-" ถ้ายังไม่เลือก |
| อาจารย์ที่ปรึกษาทั่วไป | `${generalAdvisor.firstName} ${generalAdvisor.lastName}` หรือ "-" |
| อาจารย์ที่ปรึกษาสหกิจ | `${coopAdvisor.firstName} ${coopAdvisor.lastName}` หรือ "-" |

Header row ตัวหนา (ใช้ `xlsx` cell style พื้นฐาน — ไม่ต้องซับซ้อน), sheet name = "นักศึกษา"

## Prisma query

ทั้งสอง endpoint ต้อง include เพิ่มจาก query เดิม:
```js
include: {
  coop: { include: { company: true } },
  generalAdvisor: { select: { firstName: true, lastName: true } },
  coopAdvisor: { select: { firstName: true, lastName: true } },
}
```
ไม่ paginate (ดึงทั้งหมดที่ match filter ในครั้งเดียว — จำนวนนักศึกษาต่อรอบไม่เกินหลักร้อย ไม่กระทบ performance)

## Frontend

ปุ่ม "📥 Export Excel" วางข้าง dropdown เลือกรอบปีการศึกษาใน `A_Dashboard.tsx` และ `T_Dashboard.tsx`

กดแล้ว:
```ts
const res = await axios.get(`/api/admin/students/export?coopPeriodId=${selectedPeriod}`, {
  headers: { Authorization: `Bearer ${token}` },
  responseType: 'blob',
});
const url = window.URL.createObjectURL(new Blob([res.data]));
const a = document.createElement('a');
a.href = url;
a.download = `students_${selectedPeriod}.xlsx`;
a.click();
```
(T_Dashboard.tsx เรียก `/api/teacher/students/export` แทน)

## Error handling

- ไม่มีนักศึกษาตรงตาม filter → ยังคืนไฟล์ .xlsx ที่มีแค่ header row (ไม่ error) — ปกติของรายงานสรุปที่ผลลัพธ์เป็น 0 แถว
- DB error → 500 JSON ตามแพทเทิร์นเดิมของ controllers อื่น (จะไม่ใช่ไฟล์ binary ในเคส error)

## Testing

`backend/__tests__/studentExportUtil.test.js` (ใหม่) — unit test ฟังก์ชัน generate workbook: ส่ง mock student array เข้าไป ตรวจว่า worksheet มี header ถูกต้อง และจำนวนแถวตรงกับ input

`backend/__tests__/studentController.test.js` / `teacherController.test.js` — เพิ่ม test case สำหรับ endpoint export: mock prisma คืน student list, ตรวจว่า response `Content-Type` เป็น xlsx mimetype และ permission filter (`generalAdvisorId`/`coopAdvisorId` where clause) ถูกเรียกถูกต้องสำหรับอาจารย์ปกติ vs isCoopTeacher
