# Announcement Major Targeting — Design Spec

## Goal

Allow staff to create announcements targeted at specific majors or all majors. Students automatically see only announcements relevant to their own major. Both staff management and student-facing UIs are redesigned in a Google Classroom-style card/stream layout.

## Architecture

Add `targetMajors Json` to the `Announcement` model. `[]` means all majors; `["CS","IT"]` means only those majors. The API accepts a `?major=` query param and filters server-side — students pass their own major automatically, staff see everything. A new `/api/admin/students/majors` endpoint returns distinct majors from the Student table for the staff form dropdown.

**Tech Stack:** Prisma + MySQL (migration), Express backend, React 19 + TypeScript + Tailwind frontend

---

## Data Model

### Schema change

```prisma
model Announcement {
  id           String    @id @default(uuid())
  title        String
  body         String?   @db.Text
  date         DateTime
  year         String
  linkUrl      String?
  targetMajors Json      @default("[]")   // [] = ทุกสาขา, ["CS","IT"] = เฉพาะสาขา
  files        AnnFile[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @default(now()) @updatedAt
}
```

Migration name: `add_announcement_target_majors`

---

## Backend

### 1. `GET /api/announcements?major=<major>&year=<year>`

Filter logic (raw SQL equivalent):
```
WHERE (targetMajors = '[]' OR JSON_CONTAINS(targetMajors, '"<major>"'))
  AND (year = '<year>' OR year param omitted)
ORDER BY date DESC
```

If `?major` is omitted (staff call) → return all announcements regardless of targetMajors.

### 2. `GET /api/admin/students/majors`

Returns distinct non-null majors from the Student table:
```js
const rows = await prisma.student.findMany({
  where: { major: { not: null } },
  select: { major: true },
  distinct: ['major'],
  orderBy: { major: 'asc' },
});
res.json({ ok: true, majors: rows.map(r => r.major) });
```

Auth: `verifyToken` + `verifyRole('staff', 'teacher')`

### 3. `POST /api/announcements` (addOrUpdateAnnouncement)

Accept `targetMajors` in request body (JSON array, default `[]`). Save to DB.

---

## Staff UI — A_Announcements.tsx (rewrite)

### Layout

- Header: "ประกาศสหกิจศึกษา" + `[+ สร้างประกาศ]` button (top-right)
- Period selector dropdown (เลือกรอบปีการศึกษา) — same as current
- Stream of announcement cards (reverse-chronological)

### Announcement Card

```
┌──────────────────────────────────────────────────┐
│ 📢 ชื่อประกาศ                    [CS] [IT]       │
│ เนื้อหาย่อ 2 บรรทัด (truncated)                  │
│ 12 พฤษภาคม 2569   📎 ไฟล์.pdf                   │
│                                    [✏️แก้ไข] [🗑️] │
└──────────────────────────────────────────────────┘
```

- Badge ทุกสาขา = chip สีเทา "ทุกสาขา"
- Badge เฉพาะสาขา = chip สีน้ำเงินต่อ major
- คลิกการ์ด → เปิด modal อ่านเนื้อหาเต็ม
- ✏️ → เปิด modal แก้ไข, 🗑️ → confirm delete

### Create/Edit Modal

Fields (same as current + new):
- ชื่อประกาศ (required)
- เนื้อหา (textarea)
- วันที่ (date picker)
- รอบปีการศึกษา (auto-filled from selectedPeriod)
- ไฟล์แนบ / ลิงก์ (same as current)
- **ส่งถึง:**
  ```
  ● ทุกสาขา
  ○ เลือกสาขา: [✓CS] [✓IT] [ ]EE ...
  ```
  (major list จาก `/api/admin/students/majors`)

---

## Student UI

### S_Dashboard.tsx — ปรับส่วนประกาศ

- API call เพิ่ม `?major=${student.major}` เพื่อ auto-filter
- แสดง 3 รายการล่าสุด
- ปุ่ม "ดูทั้งหมด →" ลิงก์ไปยัง `/student/announcements`
- คลิกการ์ดเปิด modal แสดงรายละเอียด (เหมือนเดิม)

### S_Announcements.tsx — หน้าใหม่

Route: `/student/announcements`

- Header: "ประกาศสหกิจศึกษา"
- API: `GET /api/announcements?major=${student.major}` — ทุกรายการ (ไม่จำกัด)
- Stream of cards แบบ Classroom:
  ```
  ┌──────────────────────────────────────────┐
  │ 📢 ชื่อประกาศ            12 พ.ค. 2569   │
  │ เนื้อหาย่อ 2 บรรทัด...                   │
  │ 📎 เอกสาร.pdf   🔗 ลิงก์                │
  └──────────────────────────────────────────┘
  ```
- คลิกการ์ด → modal แสดง title, body เต็ม, ไฟล์แนบ, ลิงก์

### S_Sidebar.tsx — เพิ่มเมนู

เพิ่ม menu item "ประกาศ" (icon: 📢) → `/student/announcements`

### S_App.tsx — เพิ่ม Route

```tsx
<Route path="/student/announcements" element={<S_Announcements />} />
```

---

## Student Data Access

Student's `major` field comes from `localStorage` decoded token claims หรือ `/api/students/me` response ที่โหลดไว้แล้วใน Dashboard context. ส่วน S_Announcements.tsx ดึง profile จาก `/api/students/me` เพื่อได้ major ก่อนดึงประกาศ

---

## Files to Create / Modify

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/controllers/announcementController.js` |
| Modify | `backend/routes/announcementRoutes.js` |
| Modify | `backend/routes/adminRoutes.js` (เพิ่ม `/students/majors`) |
| Modify | `Frontend/src/components/A_Announcements.tsx` |
| Modify | `Frontend/src/components/S_Dashboard.tsx` |
| Create | `Frontend/src/components/S_Announcements.tsx` |
| Modify | `Frontend/src/components/S_Sidebar.tsx` |
| Modify | `Frontend/src/App.tsx` (หรือ S_App.tsx) |

---

## Out of Scope

- Teacher role ดูประกาศ — ไม่เปลี่ยน (ใช้ staff UI เดิม หรือ dashboard)
- Push notification
- ประกาศแบบ "assignment" (มี due date / submission)
- Read receipt / tracking ว่าใครอ่านแล้ว
