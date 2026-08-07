# Notification Creation — Design Spec

**Date:** 2026-08-07  
**Status:** Approved

---

## Goal

เติมส่วนที่ขาดของระบบแจ้งเตือน: สร้าง `Notification` record ใน DB เมื่อเกิด event สำคัญ ทำให้ badge count ใน sidebar ของนักศึกษา อาจารย์ และ staff แสดงตัวเลขจริง และเพิ่ม polling 60 วินาทีเพื่อให้ badge อัปเดตโดยไม่ต้อง reload

---

## สิ่งที่มีอยู่แล้ว — ไม่แตะ

| ชั้น | สิ่งที่มี |
|---|---|
| DB | `Notification` model ใน `schema.prisma` |
| Backend helper | `backend/utils/notificationHelper.js` — `createNotifications(userIds, {type, title, message, link, relatedId})` + `getStaffAndCoopTeacherIds()` |
| Backend routes | `GET /api/notifications/counts`, `POST /api/notifications/mark-all-read` |
| Frontend hook | `Frontend/src/hooks/useNotifCounts.ts` |
| Frontend sidebar | S/T/A Sidebar ทั้ง 3 ตัว wire badge counts ไว้ครบ |
| `docController.js` | T002/T003/T000/CP-ACCEPTANCE upload → notify staff + coopTeacher ✓ |

`createNotifications` deduplicates ด้วย: ถ้า user มี unread notification ประเภทเดียวกัน + relatedId เดียวกันอยู่แล้ว จะไม่สร้างซ้ำ

---

## Events ที่ต้องเพิ่ม — 8 จุด

### Event 1 — สถานะ Co-op เปลี่ยน (staff ผ่าน coopController)
- **Controller:** `backend/controllers/coopController.js` → `updateCoopStatus`
- **ใครรับ:** นักศึกษา (`student.userId`)
- **Type logic:**
  - new status `REQ_LETTER_ISSUED` → type `REQ_LETTER_ISSUED`, title `"ออกหนังสือขอความอนุเคราะห์แล้ว"`
  - new status `PLACEMENT_LETTER_ISSUED` → type `PLACEMENT_LETTER_ISSUED`, title `"ออกหนังสือส่งตัวแล้ว"`
  - อื่นๆ → type `STATUS_UPDATED`, title `"สถานะสหกิจของคุณได้รับการอัปเดต"`
- **link:** `/student/dashboard`
- **relatedId:** `String(studentId)` (Student PK)

### Event 2 — สถานะเปลี่ยนผ่าน admin panel
- **Controllers:** `backend/controllers/adminDocController.js`
  - `reviewStudentStatus` (staff เปลี่ยนสถานะด้วยตนเอง)
  - `updateCoopApplicationStatus` (bulk status update)
- **ใครรับ + type logic:** เหมือน Event 1
- **หมายเหตุ:** ทั้งสอง function ต้อง include `student: { select: { userId: true } }` ใน query เพื่อดึง userId

### Event 3 — อาจารย์ review T002
- **Controllers:**
  - `backend/controllers/teacherController.js` → `reviewT002`
  - `backend/controllers/adminDocController.js` → `reviewT002`
- **ใครรับ:** นักศึกษา (`student.userId`)
- **type:** `T002_REVIEWED`
- **title:** `"ผลการตรวจสอบ T002 แบบแจ้งรายละเอียดงาน"`
- **message:** ขึ้นอยู่กับ status — `"อาจารย์อนุมัติ T002 แล้ว"` / `"อาจารย์ขอแก้ไข T002"`
- **link:** `/student/docs-t002`
- **relatedId:** `String(studentId)`

### Event 4 — อาจารย์ review T003
- **Controllers:**
  - `backend/controllers/teacherController.js` → `reviewT003`
  - `backend/controllers/adminDocController.js` → `reviewT003`
- **ใครรับ:** นักศึกษา (`student.userId`)
- **type:** `T003_REVIEWED`
- **title:** `"ผลการตรวจสอบ T003 โครงร่างรายงาน"`
- **message:** `"อาจารย์อนุมัติ T003 แล้ว"` / `"อาจารย์ขอแก้ไข T003"`
- **link:** `/student/docs-t003`
- **relatedId:** `String(studentId)`

### Event 5 — อาจารย์ confirm/reject นิเทศ
- **Controller:** `backend/controllers/supervisionController.js` → `reviewSupervision`
- **ใครรับ:** นักศึกษา (ผ่าน `supervision.student.userId`)
- **type:** `SUPERVISION_DATE_UPDATED`
- **title:** `"ผลการพิจารณาวันนิเทศ"`
- **message:** `"อาจารย์ยืนยันวันนิเทศแล้ว"` (APPROVE) / `"อาจารย์ปฏิเสธวันนิเทศ กรุณาเสนอวันใหม่"` (REJECT)
- **link:** `/student/supervision`
- **relatedId:** `String(supervision.id)`

### Event 6 — Staff upload หนังสือยืนยันนิเทศ
- **Controller:** `backend/controllers/supervisionController.js` → `uploadOfficialLetter`
- **ใครรับ:** นักศึกษา (ผ่าน `supervision.student.userId`)
- **type:** `SUPERVISION_LETTER_UPLOADED`
- **title:** `"หนังสือยืนยันการนิเทศพร้อมแล้ว"`
- **message:** `"สามารถดาวน์โหลดหนังสือยืนยันการนิเทศได้แล้ว"`
- **link:** `/student/supervision`
- **relatedId:** `String(supervision.id)`

### Event 7 — นักศึกษาเสนอวันนิเทศ
- **Controller:** `backend/controllers/supervisionController.js` → `proposeSupervisionDate`
- **ใครรับ:** อาจารย์ที่ปรึกษา (`teacher.userId` จาก `supervision.teacherId`) + staff + coopTeachers
- **type:** `SUPERVISION_PROPOSED`
- **title:** `"นักศึกษาเสนอวันนิเทศ"`
- **message:** `"${studentName} เสนอวันนิเทศใหม่ กรุณาตรวจสอบ"`
- **link:** `/teacher/review-supervision` (สำหรับอาจารย์) — เนื่องจาก type เดียวกัน ใช้ link เดียว
- **relatedId:** `String(supervision.id)`

### Event 8 — นักศึกษายื่นใบสมัครสหกิจ
- **Controller:** `backend/controllers/coopController.js` → `submitCoopApplication`
- **ใครรับ:** อาจารย์ที่ปรึกษา (`generalAdvisorId`, `coopAdvisorId` → teacher.userId) + staff + coopTeachers
- **type:** `COOP_APPLICATION_SUBMITTED`
- **title:** `"มีนักศึกษายื่นคำร้องสหกิจ"`
- **message:** `"${studentName} ยื่นคำร้องสหกิจศึกษาใหม่ กรุณาตรวจสอบ"`
- **link:** `/teacher/requests`
- **relatedId:** `String(student.id)`

---

## Frontend — Polling 60s

**File:** `Frontend/src/hooks/useNotifCounts.ts`

เพิ่ม `setInterval` ใน `useEffect`:
```ts
useEffect(() => {
  if (!token) return;
  const fetchCounts = () =>
    apiFetch("/api/notifications/counts")
      .then(r => r.json())
      .then(d => setCounts(d.counts ?? {}))
      .catch(() => {});
  fetchCounts(); // initial fetch
  const id = setInterval(fetchCounts, 60_000);
  return () => clearInterval(id);
}, [token]);
```

---

## File Map

| File | การเปลี่ยนแปลง |
|---|---|
| `backend/controllers/coopController.js` | Event 1 + Event 8 |
| `backend/controllers/adminDocController.js` | Event 2 + Event 3 (admin path) + Event 4 (admin path) |
| `backend/controllers/teacherController.js` | Event 3 (teacher path) + Event 4 (teacher path) |
| `backend/controllers/supervisionController.js` | Event 5 + Event 6 + Event 7 |
| `Frontend/src/hooks/useNotifCounts.ts` | Polling 60s |

ไม่มีไฟล์ใหม่ ไม่มี migration ไม่มี route ใหม่

---

## Constraints

- `createNotifications` เรียกหลัง `res.json(...)` (fire-and-forget, ไม่บล็อก response) — เหมือนที่ `docController.js` ทำอยู่แล้ว
- แต่ละ event ที่เกิด **inside `$transaction`** ต้องส่ง `prisma` (ไม่ใช่ `tx`) เพราะ `createNotifications` เปิด transaction ของตัวเอง — เรียกหลัง transaction สำเร็จเสมอ
- ไม่เพิ่ม test ใหม่สำหรับ notification (ทดสอบด้วย browser walkthrough หลัง implement)
- `npx tsc --noEmit` ต้องผ่านหลังแก้ `useNotifCounts.ts`
