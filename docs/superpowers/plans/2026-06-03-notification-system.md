# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งเตือนใน sidebar สำหรับ staff/isCoopTeacher (รับเมื่อนักศึกษาส่งเอกสาร) และนักศึกษา (รับเมื่อเจ้าหน้าที่/อาจารย์ดำเนินการ) แสดงเป็น badge ตัวเลขสีแดง กดแล้ว navigate + mark all read

**Architecture:** สร้าง `Notification` Prisma model → `notificationHelper.js` (createNotifications, dedup) → inject triggers เข้า controllers ที่มีอยู่ → 2 REST endpoints (unread-count, mark-all-read) → `NotificationBell.tsx` component ใน sidebar ทั้ง 3 role

**Tech Stack:** Prisma + MySQL, Express, React 19 + TypeScript, inline styles

---

## Current State

| File | What matters |
|---|---|
| `backend/prisma/schema.prisma` | ไม่มี Notification model |
| `backend/controllers/coopController.js` | exports: `submitCoopApplication`, `updateCoopStatus` — student actions |
| `backend/controllers/adminDocController.js` | exports: `reviewStudentStatus`, `updateCoopApplicationStatus`, `reviewT002`, `reviewT003` — staff/teacher actions |
| `backend/controllers/supervisionController.js` | exports: `proposeSupervisionDate`, `reviewSupervision`, `uploadOfficialLetter` |
| `backend/server.js` | mount `/api/coop`, `/api/admin`, `/api` (supervision) |
| `Frontend/src/components/A_Sidebar.tsx` | NavLink list — เพิ่ม NotificationBell ใน brand/header area |
| `Frontend/src/components/T_Sidebar.tsx` | เหมือน A_Sidebar |
| `Frontend/src/components/S_Sidebar.tsx` | NavLink list สำหรับนักศึกษา |

---

## Task 1: Schema — Add Notification model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Notification model**

Find the end of the schema file and add:

```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  title     String
  message   String
  link      String
  isRead    Boolean  @default(false)
  relatedId String?
  createdAt DateTime @default(now())

  @@index([userId, isRead])
}
```

Also add the inverse relation to the `User` model — find the User model and add inside it:
```prisma
  notifications Notification[]
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_notification_model
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Notification model to schema"
```

---

## Task 2: Backend — Helper, Controller, Routes

**Files:**
- Create: `backend/utils/notificationHelper.js`
- Create: `backend/controllers/notificationController.js`
- Create: `backend/routes/notificationRoutes.js`

- [ ] **Step 1: Create notificationHelper.js**

Create `backend/utils/notificationHelper.js`:

```js
const prisma = require('../config/prismaClient');

/**
 * สร้าง notification ให้ userIds หลายคนพร้อมกัน พร้อม dedup
 * ถ้ามี unread notification เดิม (same userId+type+relatedId) → ข้ามไม่สร้างซ้ำ
 */
async function createNotifications(userIds, { type, title, message, link, relatedId = null }) {
  if (!userIds || !userIds.length) return;

  const existing = await prisma.notification.findMany({
    where: { userId: { in: userIds }, type, relatedId: relatedId ?? null, isRead: false },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map(n => n.userId));
  const newIds = userIds.filter(id => !existingSet.has(id));
  if (!newIds.length) return;

  await prisma.notification.createMany({
    data: newIds.map(userId => ({ userId, type, title, message, link, relatedId: relatedId ?? null })),
  });
}

/**
 * ดึง userId ของ staff ทั้งหมด + อาจารย์ที่ isCoopTeacher=true
 */
async function getStaffAndCoopTeacherIds() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'staff' },
        { role: 'teacher', teacher: { isCoopTeacher: true } },
      ],
    },
    select: { id: true },
  });
  return users.map(u => u.id);
}

module.exports = { createNotifications, getStaffAndCoopTeacherIds };
```

- [ ] **Step 2: Create notificationController.js**

Create `backend/controllers/notificationController.js`:

```js
const prisma = require('../config/prismaClient');

// GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, isRead: false },
    });
    res.json({ ok: true, count });
  } catch (err) {
    console.error('[getUnreadCount]', err);
    res.status(500).json({ ok: false, count: 0 });
  }
};

// POST /api/notifications/mark-all-read
exports.markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[markAllRead]', err);
    res.status(500).json({ ok: false });
  }
};
```

- [ ] **Step 3: Create notificationRoutes.js**

Create `backend/routes/notificationRoutes.js`:

```js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const notifController = require('../controllers/notificationController');

router.get('/unread-count', verifyToken, notifController.getUnreadCount);
router.post('/mark-all-read', verifyToken, notifController.markAllRead);

module.exports = router;
```

- [ ] **Step 4: Mount in server.js**

Read `backend/server.js` around line 83. Add after the other route mounts:

```js
const notificationRoutes = require('./routes/notificationRoutes');
// ...
app.use('/api/notifications', notificationRoutes);
```

- [ ] **Step 5: Run backend tests**

```bash
cd backend && npm test
```

Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add backend/utils/notificationHelper.js backend/controllers/notificationController.js backend/routes/notificationRoutes.js backend/server.js
git commit -m "feat: notification helper, controller, routes"
```

---

## Task 3: Notification triggers — Student actions → Staff/isCoopTeacher

**Files:**
- Modify: `backend/controllers/coopController.js`
- Modify: `backend/controllers/supervisionController.js` (proposeSupervisionDate)

**Background:** เมื่อนักศึกษา submit → สร้าง notification ให้ staff + isCoopTeacher ทุกคน

- [ ] **Step 1: Read coopController.js**

Read `backend/controllers/coopController.js` lines 1–30 (top + requires) and find the `submitCoopApplication` function to understand its structure.

- [ ] **Step 2: Add import + triggers in coopController.js**

At the top of `coopController.js` (after existing requires), add:
```js
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
```

Find the **`submitCoopApplication`** function. At the end of the `try` block (after the successful response), **before** `res.json(...)`, add:

```js
// Notify staff + isCoopTeacher
const recipientIds = await getStaffAndCoopTeacherIds();
await createNotifications(recipientIds, {
  type: 'COOP_APPLICATION_SUBMITTED',
  title: 'นักศึกษายื่นคำร้องสหกิจ',
  message: `${req.user?.role === 'student' ? 'นักศึกษา' : 'ผู้ใช้'} ยื่น/แก้ไขคำร้องสหกิจศึกษา`,
  link: '/admin/students',
  relatedId: String(student.id ?? req.userId),
});
```

**Note:** ถ้า `submitCoopApplication` ไม่มี `student` variable ให้ใช้ข้อมูลที่หาได้จาก req (เช่น `String(req.userId)`)

- [ ] **Step 3: Add trigger in supervisionController.js — proposeSupervisionDate**

Read `backend/controllers/supervisionController.js` around `exports.proposeSupervisionDate`. Add at the top:
```js
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
```

In `proposeSupervisionDate`, after successful save, add:
```js
const recipientIds = await getStaffAndCoopTeacherIds();
await createNotifications(recipientIds, {
  type: 'SUPERVISION_PROPOSED',
  title: 'นักศึกษาเสนอวันนิเทศ',
  message: 'นักศึกษาเสนอวันนิเทศสหกิจศึกษา กรุณาตรวจสอบและยืนยัน',
  link: '/admin/students',
  relatedId: String(req.userId),
});
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test
```

Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/coopController.js backend/controllers/supervisionController.js
git commit -m "feat: notify staff+isCoopTeacher on student coop actions"
```

---

## Task 4: Notification triggers — T002/T003 + Staff actions → Student

**Files:**
- Modify: `backend/controllers/adminDocController.js`
- Modify: `backend/controllers/supervisionController.js` (reviewSupervision, uploadOfficialLetter)

**Background:**
- เมื่อนักศึกษาส่ง T002/T003 → notify staff+isCoopTeacher
- เมื่อ staff/isCoopTeacher review → notify นักศึกษา

- [ ] **Step 1: Read adminDocController.js**

Read `backend/controllers/adminDocController.js` lines 1–10 (requires) and the `reviewStudentStatus` function (~line 104) and `reviewT002` (~line 310), `reviewT003` (~line 359).

- [ ] **Step 2: Add import + triggers in adminDocController.js**

Add at top:
```js
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
```

**In `reviewT002`** (staff/teacher reviews T002 they submitted):

Wait — T002 is SUBMITTED by student via a separate route. Find where T002 is submitted. Check `backend/routes/coopRoutes.js` or `docRoutes.js` for the T002 submit endpoint.

Actually `reviewT002` is called when **staff/teacher reviews** T002. We need to:
1. Find where student SUBMITS T002 → notify staff+isCoopTeacher  
2. In `reviewT002` → notify student

For student submitting T002 — read `backend/routes/coopRoutes.js` to find the submit endpoint, then find the handler.

**In `reviewT002`** — at the end of try block (after `res.json(...)`):
Find the studentId from the reviewed document. Add:
```js
// Notify student
if (studentUserId) {
  await createNotifications([studentUserId], {
    type: 'T002_REVIEWED',
    title: 'T002 ได้รับการตรวจสอบ',
    message: `เอกสาร T002 ของคุณได้รับการตรวจสอบแล้ว กรุณาตรวจสอบสถานะ`,
    link: '/student/docs-t002',
    relatedId: String(req.userId),
  });
}
```

**In `reviewT003`** — same pattern but type `T003_REVIEWED`, link `/student/docs-t003`

**In `reviewStudentStatus`** (อนุมัติ/ปฏิเสธ T000 + เปลี่ยน status ต่างๆ):

This handles many status changes. Add after res.json:
```js
// Notify student when status changes
if (studentUserId) {
  const statusMessages = {
    QUALIFIED: 'คำร้องของคุณผ่านการพิจารณา ✅',
    QUALIFICATION_FAILED: 'คำร้องของคุณไม่ผ่านการพิจารณา',
    DOCS_APPROVED: 'เอกสาร T000 ผ่านการตรวจสอบ ✅',
    EDITS_REQUIRED: 'เอกสาร T000 ต้องแก้ไข กรุณาตรวจสอบความคิดเห็น',
    REQ_LETTER_ISSUED: 'ออกหนังสือขอความอนุเคราะห์แล้ว',
    ACCEPTANCE_CHECKED: 'ตรวจสอบใบตอบรับแล้ว',
    PLACEMENT_LETTER_ISSUED: 'ออกหนังสือส่งตัวแล้ว 🎉',
    APPLICATION_EDITS_REQUIRED: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ',
  };
  const msg = statusMessages[newStatus];
  if (msg) {
    await createNotifications([studentUserId], {
      type: 'STATUS_UPDATED',
      title: 'สถานะสหกิจศึกษาอัปเดต',
      message: msg,
      link: '/student/status-tracker',
      relatedId: String(newStatus),
    });
  }
}
```

**Important:** You need to find `studentUserId` (the User.id of the student) from the student record in each function. Read the function to see what data is available. The pattern is: find student via studentId/docId → `student.user.id` or `student.userId`.

- [ ] **Step 3: Add triggers in supervisionController.js**

**In `reviewSupervision`** (อาจารย์ยืนยัน/ปฏิเสธวัน):

After successful update, find the student's userId and add:
```js
if (studentUserId) {
  const isConfirmed = /* check if approved or rejected */;
  await createNotifications([studentUserId], {
    type: 'SUPERVISION_DATE_UPDATED',
    title: isConfirmed ? 'วันนิเทศได้รับการยืนยัน' : 'วันนิเทศถูกปฏิเสธ',
    message: isConfirmed ? 'อาจารย์ยืนยันวันนิเทศแล้ว' : 'อาจารย์ปฏิเสธวันที่เสนอ กรุณาเสนอวันใหม่',
    link: '/student/supervision',
    relatedId: String(req.userId),
  });
}
```

**In `uploadOfficialLetter`** (เจ้าหน้าที่อัปโหลดหนังสือนิเทศ):

Add after success:
```js
if (studentUserId) {
  await createNotifications([studentUserId], {
    type: 'SUPERVISION_LETTER_UPLOADED',
    title: 'หนังสือนิเทศอนุมัติแล้ว',
    message: 'หนังสือนิเทศได้รับการอนุมัติ เตรียมพร้อมรับการนิเทศ',
    link: '/student/supervision',
    relatedId: String(req.userId),
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test
```

Expected: no new failures (1 pre-existing failure in adminDocController is OK).

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminDocController.js backend/controllers/supervisionController.js
git commit -m "feat: notify student on T002/T003 review and status changes"
```

---

## Task 5: Frontend — NotificationBell component

**Files:**
- Create: `Frontend/src/components/NotificationBell.tsx`

- [ ] **Step 1: Create NotificationBell.tsx**

Create `Frontend/src/components/NotificationBell.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  targetPath: string;
}

export default function NotificationBell({ targetPath }: Props) {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications/unread-count", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {});
  }, [token]);

  const handleClick = async () => {
    if (count > 0 && token) {
      try {
        await fetch("/api/notifications/mark-all-read", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setCount(0);
      } catch { /* silent */ }
    }
    navigate(targetPath);
  };

  return (
    <button
      onClick={handleClick}
      title={count > 0 ? `${count} การแจ้งเตือนใหม่` : "ไม่มีการแจ้งเตือน"}
      style={{
        position: "relative",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 8px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        color: count > 0 ? "#2563eb" : "#94a3b8",
        transition: "color .15s",
      }}
    >
      {/* Bell icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: "#ef4444",
          color: "#fff",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 10,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/NotificationBell.tsx
git commit -m "feat: NotificationBell sidebar component"
```

---

## Task 6: Add NotificationBell to all 3 sidebars

**Files:**
- Modify: `Frontend/src/components/A_Sidebar.tsx`
- Modify: `Frontend/src/components/T_Sidebar.tsx`
- Modify: `Frontend/src/components/S_Sidebar.tsx`

**Background:** เพิ่ม `<NotificationBell>` ใน brand block หรือ nav header ของแต่ละ sidebar

- [ ] **Step 1: Read each sidebar**

Read `Frontend/src/components/A_Sidebar.tsx` lines 1–50 to find brand block and nav structure. Do the same for T_Sidebar and S_Sidebar.

- [ ] **Step 2: Update A_Sidebar.tsx**

Add import:
```tsx
import NotificationBell from "./NotificationBell";
```

Find the brand block (the `<div className="brand">` section). After the brand block and before `<nav>`, add:

```tsx
{/* Notification bell */}
<div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px", marginBottom: 8 }}>
  <NotificationBell targetPath="/admin/students" />
</div>
```

- [ ] **Step 3: Update T_Sidebar.tsx**

Same pattern:
```tsx
import NotificationBell from "./NotificationBell";

// In JSX, after brand block, before nav:
<div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px", marginBottom: 8 }}>
  <NotificationBell targetPath="/teacher/students" />
</div>
```

- [ ] **Step 4: Update S_Sidebar.tsx**

Same pattern:
```tsx
import NotificationBell from "./NotificationBell";

// In JSX, after brand block, before nav:
<div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px", marginBottom: 8 }}>
  <NotificationBell targetPath="/student/status-tracker" />
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/A_Sidebar.tsx Frontend/src/components/T_Sidebar.tsx Frontend/src/components/S_Sidebar.tsx
git commit -m "feat: add NotificationBell to all sidebars"
```

---

## Task 7: Final verification + CHANGELOG

- [ ] **Step 1: Run backend tests**

```bash
cd backend && npm test
```

Expected: 174+ passing, 1 pre-existing failure only.

- [ ] **Step 2: Frontend TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at top:

```markdown
## [2026-06-03] Notification System

### Added
- `Notification` Prisma model — userId, type, title, message, link, isRead, relatedId (dedup key)
- `backend/utils/notificationHelper.js` — createNotifications (dedup), getStaffAndCoopTeacherIds
- `GET /api/notifications/unread-count` — คืน count ของ unread notifications
- `POST /api/notifications/mark-all-read` — mark ทั้งหมดของ user เป็น read
- `NotificationBell.tsx` — badge ตัวเลขสีแดง กดแล้ว navigate + mark all read

### Changed
- `coopController.js` — notify staff+isCoopTeacher เมื่อนักศึกษายื่นคำร้อง
- `supervisionController.js` — notify staff+isCoopTeacher เมื่อเสนอวันนิเทศ; notify student เมื่อยืนยัน/ปฏิเสธ/อัปโหลดหนังสือ
- `adminDocController.js` — notify student เมื่อ review T002/T003/status
- `A_Sidebar.tsx`, `T_Sidebar.tsx`, `S_Sidebar.tsx` — เพิ่ม NotificationBell
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for notification system"
```

---

## Self-Review

**Spec coverage:**
- [x] Notification model with dedup → Task 1 + Task 2
- [x] staff + isCoopTeacher routing → notificationHelper.getStaffAndCoopTeacherIds()
- [x] Student submit → notify staff+isCoopTeacher → Tasks 3, 4
- [x] Staff action → notify student → Task 4
- [x] Badge in sidebar → Tasks 5, 6
- [x] Load on app load (useEffect) → Task 5
- [x] Mark all read on navigate → Task 5

**Known implementation note:**
- Tasks 3 and 4 say "find studentUserId" — the implementer must read each controller function to locate the correct variable. Each function has different patterns for accessing student data. The key is to find `student.userId` or equivalent after the main DB operation.
