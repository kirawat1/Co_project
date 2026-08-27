# Group Supervision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** อาจารย์สามารถยืนยันนัดนิเทศนักศึกษาหลายคนในบริษัทเดียวกันพร้อมกันได้ใน 1 action

**Architecture:** เพิ่ม `groupId String?` บน `SupervisionAppointment` เพื่อเชื่อม appointment ที่นัดพร้อมกัน; อาจารย์เห็น view ใหม่จัดนักศึกษาตามบริษัทพร้อม intersection ของวันที่; confirm-group endpoint update appointment หลายตัวด้วย groupId UUID เดียวกัน; ปฏิทินแสดง grouped events รวม label

**Tech Stack:** Prisma + MySQL, Express, React 19 + TypeScript + Tailwind, Jest (backend tests)

**Spec:** `docs/superpowers/specs/2026-08-27-group-supervision-design.md`

## Global Constraints

- Role middleware: `verifyToken` ก่อน `verifyRole` เสมอ
- Teacher endpoints: `verifyRole('teacher', 'staff')`
- API response: `{ ok: true, ... }` / `{ ok: false, message: "..." }`
- `studentId @unique` คงอยู่ — ไม่เปลี่ยน
- `proposedDates`: JSON array of strings, format `"ISODATE|HH:MM|TYPE"` เช่น `"2026-04-10T00:00:00.000Z|10:00|ONSITE"` → ต้อง `JSON.parse()` ก่อนใช้, date key = `entry.split("|")[0].slice(0, 10)`
- Frontend: relative path `/api/...` เสมอ (ไม่มี hostname), token: `localStorage.getItem("coop.token")`
- Test mock: `jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'))`

---

## File Map

| File | Action | หน้าที่ |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | เพิ่ม `groupId String?` |
| `backend/controllers/supervisionController.js` | Modify | เพิ่ม `getSupervisionsByCompany` + `confirmGroupSupervision` |
| `backend/routes/teacherRoutes.js` | Modify | เพิ่ม 2 routes |
| `backend/__tests__/supervisionController.test.js` | Modify | เพิ่ม tests |
| `Frontend/src/components/T_GroupSupervision.tsx` | Create | Teacher view — บริษัท/นักศึกษา/overlap/modal |
| `Frontend/src/components/T_SupervisionReview.tsx` | Modify | เพิ่ม tab "นิเทศตามบริษัท" |
| `Frontend/src/components/SupervisionCalendar.tsx` | Modify | CalendarEvent + groupId, group rendering |

---

## Task 1: Schema — เพิ่ม groupId

**Files:**
- Modify: `backend/prisma/schema.prisma` (บล็อก `SupervisionAppointment`)

**Interfaces:**
- Produces: `SupervisionAppointment.groupId: String?` — Task 2, 3, 6 ใช้ field นี้

- [ ] **Step 1: เพิ่ม field ใน schema**

เปิด `backend/prisma/schema.prisma` หา `model SupervisionAppointment` (บรรทัด ~501) เพิ่มบรรทัดก่อน `createdAt`:

```prisma
  groupId String? // UUID เชื่อม appointment ที่นัดพร้อมกัน (null = นัดเดี่ยว)
```

- [ ] **Step 2: สร้าง migration**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx prisma migrate dev --name add_group_supervision
```

Expected: `✔ Your database is now in sync with your schema.`

- [ ] **Step 3: ตรวจ DB**

```powershell
npx prisma studio
```

เปิด table `SupervisionAppointment` → ต้องเห็น column `groupId` (nullable string)

- [ ] **Step 4: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add backend/prisma/schema.prisma backend/prisma/migrations/
git -C C:\xampp\htdocs\Co_project commit -m "feat: add groupId to SupervisionAppointment"
```

---

## Task 2: Backend — getSupervisionsByCompany

**Files:**
- Modify: `backend/controllers/supervisionController.js` (append ที่ท้ายไฟล์)
- Modify: `backend/routes/teacherRoutes.js`
- Test: `backend/__tests__/supervisionController.test.js`

**Interfaces:**
- Consumes: `prisma.teacher.findUnique`, `prisma.supervisionAppointment.findMany` (พร้อม include student→coop→company)
- Produces: `exports.getSupervisionsByCompany` — GET `/api/teacher/supervisions/by-company`

**Response shape:**
```json
{
  "ok": true,
  "companies": [
    {
      "companyId": "uuid-string",
      "companyName": "บริษัท ABC",
      "students": [
        {
          "appointmentId": 1,
          "studentId": 10,
          "studentName": "สมชาย ใจดี",
          "studentCode": "651234567",
          "proposedDates": ["2026-04-10T00:00:00.000Z|10:00|ONSITE"],
          "status": "PENDING_TEACHER",
          "groupId": null
        }
      ],
      "commonDates": ["2026-04-10T00:00:00.000Z|10:00|ONSITE"]
    }
  ]
}
```

`commonDates` = date entries ที่ date key (`entry.split("|")[0].slice(0,10)`) ปรากฏใน proposedDates ของนักศึกษา **≥ 2 คน** ในบริษัทเดียวกัน; เลือก representative entry จากนักศึกษาคนแรกที่เสนอวันนั้น

- [ ] **Step 1: เขียน test ที่ล้มเหลว**

เปิด `backend/__tests__/supervisionController.test.js` เพิ่มที่ท้ายไฟล์:

```js
// ===========================
// getSupervisionsByCompany
// ===========================
describe('getSupervisionsByCompany', () => {
  const { getSupervisionsByCompany } = require('../controllers/supervisionController');

  test('404 — teacher not found', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    const req = { user: { id: 99 } };
    const res = makeRes();
    await getSupervisionsByCompany(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — groups students by company with commonDates', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    // student A: บริษัท X เสนอวัน 2026-04-10
    // student B: บริษัท X เสนอวัน 2026-04-10 และ 2026-04-11
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      {
        id: 1, groupId: null, status: 'PENDING_TEACHER',
        proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']),
        student: {
          id: 10, studentId: '651111111', firstName: 'ก', lastName: 'ข',
          coop: { company: { id: 'cid1', name: 'บริษัท X' } }
        }
      },
      {
        id: 2, groupId: null, status: 'PENDING_TEACHER',
        proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE','2026-04-11T00:00:00.000Z|13:00|ONLINE']),
        student: {
          id: 11, studentId: '651111112', firstName: 'ค', lastName: 'ง',
          coop: { company: { id: 'cid1', name: 'บริษัท X' } }
        }
      }
    ]);
    const req = { user: { id: 1 } };
    const res = makeRes();
    await getSupervisionsByCompany(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    const { companies } = res.json.mock.calls[0][0];
    expect(companies).toHaveLength(1);
    expect(companies[0].companyId).toBe('cid1');
    expect(companies[0].students).toHaveLength(2);
    // 2026-04-10 ปรากฏใน 2 คน → commonDates มี 1 entry
    expect(companies[0].commonDates).toHaveLength(1);
    expect(companies[0].commonDates[0]).toContain('2026-04-10');
  });

  test('500 — DB error', async () => {
    prisma.teacher.findUnique.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await getSupervisionsByCompany({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx jest supervisionController --no-coverage 2>&1 | Select-String -Pattern "getSupervisionsByCompany|PASS|FAIL"
```

Expected: FAIL — `getSupervisionsByCompany is not a function`

- [ ] **Step 3: implement controller**

เปิด `backend/controllers/supervisionController.js` append ที่ท้ายสุด:

```js
// ==========================================
// getSupervisionsByCompany — Teacher group view
// ==========================================
exports.getSupervisionsByCompany = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: parseInt(req.user.id) } });
    if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });

    const appts = await prisma.supervisionAppointment.findMany({
      where: {
        teacherId: teacher.id,
        status: { notIn: ['COMPLETED'] },
        student: { deletedAt: null },
      },
      include: {
        student: { include: { coop: { include: { company: true } } } },
      },
      orderBy: { id: 'asc' },
    });

    // จัดกลุ่มตาม companyId
    const companyMap = new Map();
    for (const appt of appts) {
      const company = appt.student?.coop?.company;
      if (!company) continue;
      if (!companyMap.has(company.id)) {
        companyMap.set(company.id, { companyId: company.id, companyName: company.name, students: [] });
      }
      let proposedDates = [];
      try { proposedDates = JSON.parse(appt.proposedDates || '[]'); } catch {}
      companyMap.get(company.id).students.push({
        appointmentId: appt.id,
        studentId: appt.student.id,
        studentName: `${appt.student.firstName} ${appt.student.lastName}`,
        studentCode: appt.student.studentId,
        proposedDates,
        status: appt.status,
        groupId: appt.groupId,
      });
    }

    // คำนวณ commonDates ต่อบริษัท
    const companies = [];
    for (const group of companyMap.values()) {
      const dateCount = new Map(); // dateKey → [entries]
      for (const stu of group.students) {
        const seen = new Set();
        for (const entry of stu.proposedDates) {
          const key = entry.split('|')[0].slice(0, 10);
          if (!seen.has(key)) {
            seen.add(key);
            if (!dateCount.has(key)) dateCount.set(key, { count: 0, entry });
            dateCount.get(key).count += 1;
          }
        }
      }
      const commonDates = [];
      for (const { count, entry } of dateCount.values()) {
        if (count >= 2) commonDates.push(entry);
      }
      companies.push({ ...group, commonDates });
    }

    res.json({ ok: true, companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงข้อมูลได้' });
  }
};
```

- [ ] **Step 4: เพิ่ม route**

เปิด `backend/routes/teacherRoutes.js` เพิ่มก่อน `module.exports`:

```js
router.get('/supervisions/by-company', verifyToken, verifyRole('teacher', 'staff'), supervisionController.getSupervisionsByCompany);
```

⚠️ route นี้ต้องอยู่ **ก่อน** `router.get('/supervisions', ...)` และก่อน `router.put('/supervisions/:id/review', ...)` เพื่อป้องกัน Express จับ `:id` ก่อน — ตรวจบรรทัดที่ 33 แล้ว insert ก่อน

- [ ] **Step 5: รัน test ให้ผ่าน**

```powershell
npx jest supervisionController --no-coverage 2>&1 | tail -20
```

Expected: `getSupervisionsByCompany` ทุก test → PASS

- [ ] **Step 6: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add backend/controllers/supervisionController.js backend/routes/teacherRoutes.js backend/__tests__/supervisionController.test.js
git -C C:\xampp\htdocs\Co_project commit -m "feat: add getSupervisionsByCompany endpoint"
```

---

## Task 3: Backend — confirmGroupSupervision

**Files:**
- Modify: `backend/controllers/supervisionController.js` (append)
- Modify: `backend/routes/teacherRoutes.js`
- Test: `backend/__tests__/supervisionController.test.js`

**Interfaces:**
- Consumes: `prisma.supervisionAppointment.findMany`, `prisma.supervisionAppointment.update`
- Produces: `exports.confirmGroupSupervision` — POST `/api/teacher/supervisions/confirm-group`

**Request:** `{ appointmentIds: number[], confirmedDate: string }`
**Response:** `{ ok: true, groupId: string|null, updatedCount: number }`

- [ ] **Step 1: เขียน test ที่ล้มเหลว**

เพิ่มที่ท้าย `supervisionController.test.js`:

```js
// ===========================
// confirmGroupSupervision
// ===========================
describe('confirmGroupSupervision', () => {
  const { confirmGroupSupervision } = require('../controllers/supervisionController');

  const makeReq = (body) => ({ user: { id: 1 }, body });

  test('400 — missing appointmentIds', async () => {
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ confirmedDate: '2026-04-10T10:00:00.000Z' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — missing confirmedDate', async () => {
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('403 — appointment belongs to another teacher', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5 });
    // teacherId = 99 ≠ 5
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 99, proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) }
    ]);
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1], confirmedDate: '2026-04-10T10:00:00.000Z' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('200 — confirms group, returns groupId', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 1, proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) },
      { id: 2, teacherId: 1, proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) },
    ]);
    prisma.supervisionAppointment.update = jest.fn().mockResolvedValue({});
    const res = makeRes();
    await confirmGroupSupervision(
      makeReq({ appointmentIds: [1, 2], confirmedDate: '2026-04-10T10:00:00.000Z' }),
      res
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, updatedCount: 2 }));
    // groupId ต้องเป็น UUID string
    const { groupId } = res.json.mock.calls[0][0];
    expect(typeof groupId).toBe('string');
    expect(groupId).toMatch(/^[0-9a-f-]{36}$/);
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

```powershell
npx jest supervisionController --no-coverage 2>&1 | Select-String "confirmGroupSupervision|PASS|FAIL"
```

Expected: FAIL

- [ ] **Step 3: implement controller**

Append ต่อจาก `getSupervisionsByCompany` ใน `supervisionController.js`:

```js
// ==========================================
// confirmGroupSupervision — ยืนยันกลุ่ม
// ==========================================
exports.confirmGroupSupervision = async (req, res) => {
  try {
    const { appointmentIds, confirmedDate } = req.body;
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'appointmentIds ต้องมีอย่างน้อย 1 รายการ' });
    }
    if (!confirmedDate) {
      return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่ยืนยัน' });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: parseInt(req.user.id) } });
    if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });

    const appts = await prisma.supervisionAppointment.findMany({
      where: { id: { in: appointmentIds.map(Number) } },
    });

    // ตรวจสิทธิ์ — ทุก appointment ต้องเป็นของ teacher นี้
    const unauthorized = appts.find(a => a.teacherId !== teacher.id);
    if (unauthorized) {
      return res.status(403).json({ ok: false, message: 'ไม่มีสิทธิ์ยืนยันการนัดหมายนี้' });
    }

    // ตรวจว่า confirmedDate อยู่ใน proposedDates ของแต่ละคน
    const confirmKey = new Date(confirmedDate).toISOString().slice(0, 10);
    for (const appt of appts) {
      let dates = [];
      try { dates = JSON.parse(appt.proposedDates || '[]'); } catch {}
      const hasDate = dates.some(e => e.split('|')[0].slice(0, 10) === confirmKey);
      if (!hasDate) {
        return res.status(400).json({
          ok: false,
          message: `วันที่เลือกไม่อยู่ในวันที่นักศึกษา appointment ${appt.id} เสนอมา`,
        });
      }
    }

    const groupId = appts.length > 1 ? require('crypto').randomUUID() : null;
    const confirmedDateObj = new Date(confirmedDate);

    for (const appt of appts) {
      await prisma.supervisionAppointment.update({
        where: { id: appt.id },
        data: { confirmedDate: confirmedDateObj, status: 'DATE_CONFIRMED', groupId },
      });
    }

    res.json({ ok: true, groupId, updatedCount: appts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถยืนยันการนัดหมายได้' });
  }
};
```

- [ ] **Step 4: เพิ่ม route**

ใน `backend/routes/teacherRoutes.js` เพิ่มต่อจาก by-company route:

```js
router.post('/supervisions/confirm-group', verifyToken, verifyRole('teacher', 'staff'), supervisionController.confirmGroupSupervision);
```

- [ ] **Step 5: รัน test ทั้งหมด**

```powershell
npx jest supervisionController --no-coverage 2>&1 | tail -20
```

Expected: ทุก test → PASS

- [ ] **Step 6: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add backend/controllers/supervisionController.js backend/routes/teacherRoutes.js backend/__tests__/supervisionController.test.js
git -C C:\xampp\htdocs\Co_project commit -m "feat: add confirmGroupSupervision endpoint"
```

---

## Task 4: Frontend — T_GroupSupervision.tsx

**Files:**
- Create: `Frontend/src/components/T_GroupSupervision.tsx`

**Interfaces:**
- Consumes: `GET /api/teacher/supervisions/by-company` → `{ ok, companies: CompanyGroup[] }`
- Consumes: `POST /api/teacher/supervisions/confirm-group` → `{ appointmentIds, confirmedDate }`
- Produces: component `T_GroupSupervision` (no props needed — ดึง token เอง)

**Types:**
```ts
interface StudentAppointment {
  appointmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  proposedDates: string[];   // entries: "ISODATE|HH:MM|TYPE"
  status: string;
  groupId: string | null;
}
interface CompanyGroup {
  companyId: string;
  companyName: string;
  students: StudentAppointment[];
  commonDates: string[];     // entries ที่ date key ซ้ำ ≥ 2 คน
}
```

**UI structure:**
```
[Spinner while loading]
[ถ้าไม่มีบริษัทเลย: "ยังไม่มีการนัดหมายที่รอยืนยัน"]
[บริษัท card]
  ชื่อบริษัท  (จำนวนนักศึกษา)  [ปุ่ม "นัดพร้อมกัน" — เฉพาะถ้า commonDates.length > 0]
  [toggle expand] → ตารางนักศึกษา: ชื่อ | รหัส | วันที่เสนอ | สถานะ

[Modal "นัดพร้อมกัน"]
  dropdown วันที่ (จาก commonDates)
  checkbox นักศึกษา (pre-checked คนที่มีวันนั้น)
  ปุ่ม Confirm
```

- [ ] **Step 1: สร้างไฟล์และ types**

สร้าง `Frontend/src/components/T_GroupSupervision.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "./Spinner";

interface StudentAppointment {
  appointmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  proposedDates: string[];
  status: string;
  groupId: string | null;
}
interface CompanyGroup {
  companyId: string;
  companyName: string;
  students: StudentAppointment[];
  commonDates: string[];
}

function parseDateEntry(entry: string): { dateKey: string; displayDate: string; time: string } {
  const [dPart = "", tPart = ""] = entry.split("|");
  const d = new Date(dPart);
  const dateKey = dPart.slice(0, 10);
  const displayDate = isNaN(d.getTime())
    ? dPart
    : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  return { dateKey, displayDate, time: tPart || "" };
}

function hasDate(proposedDates: string[], targetDateKey: string): boolean {
  return proposedDates.some(e => e.split("|")[0].slice(0, 10) === targetDateKey);
}

export default function T_GroupSupervision() {
  const token = localStorage.getItem("coop.token");
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ company: CompanyGroup } | null>(null);
  const [selectedDateEntry, setSelectedDateEntry] = useState<string>("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/teacher/supervisions/by-company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setCompanies(res.data.companies);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openModal = (company: CompanyGroup) => {
    setModal({ company });
    const firstEntry = company.commonDates[0] || "";
    setSelectedDateEntry(firstEntry);
    const dateKey = firstEntry.split("|")[0].slice(0, 10);
    setCheckedIds(new Set(
      company.students
        .filter(s => hasDate(s.proposedDates, dateKey))
        .map(s => s.appointmentId)
    ));
  };

  const onDateChange = (entry: string) => {
    setSelectedDateEntry(entry);
    const dateKey = entry.split("|")[0].slice(0, 10);
    setCheckedIds(new Set(
      modal!.company.students
        .filter(s => hasDate(s.proposedDates, dateKey))
        .map(s => s.appointmentId)
    ));
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!modal || !selectedDateEntry || checkedIds.size === 0) return;
    setSubmitting(true);
    try {
      const [dPart, tPart = "00:00"] = selectedDateEntry.split("|");
      const confirmedDate = new Date(`${dPart.slice(0, 10)}T${tPart}:00`).toISOString();
      const res = await axios.post(
        "/api/teacher/supervisions/confirm-group",
        { appointmentIds: [...checkedIds], confirmedDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.ok) {
        setModal(null);
        fetchData();
      }
    } catch {}
    setSubmitting(false);
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;
  if (companies.length === 0) return (
    <div style={{ padding: 32, color: "#64748b", textAlign: "center" }}>
      ยังไม่มีการนัดหมายที่รอยืนยัน
    </div>
  );

  return (
    <div style={{ padding: "16px 0" }}>
      {companies.map(company => {
        const expanded = expandedIds.has(company.companyId);
        return (
          <div key={company.companyId} style={{
            border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16, overflow: "hidden"
          }}>
            <div
              onClick={() => toggleExpand(company.companyId)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px", cursor: "pointer", background: "#f8fafc",
                userSelect: "none",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                🏢 {company.companyName}
                <span style={{
                  marginLeft: 10, fontSize: 12, color: "#64748b", fontWeight: 400
                }}>
                  {company.students.length} คน
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {company.commonDates.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); openModal(company); }}
                    style={{
                      padding: "6px 14px", borderRadius: 7, border: "none",
                      background: "#0074B7", color: "#fff", fontWeight: 700,
                      cursor: "pointer", fontSize: 13,
                    }}
                  >
                    นัดพร้อมกัน ({company.commonDates.length} วัน)
                  </button>
                )}
                <span style={{ fontSize: 18, color: "#94a3b8" }}>{expanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={thStyle}>ชื่อ-สกุล</th>
                    <th style={thStyle}>รหัส</th>
                    <th style={thStyle}>วันที่เสนอ</th>
                    <th style={thStyle}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {company.students.map(s => (
                    <tr key={s.appointmentId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={tdStyle}>{s.studentName}</td>
                      <td style={tdStyle}>{s.studentCode}</td>
                      <td style={tdStyle}>
                        {s.proposedDates.map((e, i) => {
                          const { displayDate, time } = parseDateEntry(e);
                          return <div key={i}>{displayDate} {time}</div>;
                        })}
                      </td>
                      <td style={tdStyle}>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: 28, minWidth: 380, maxWidth: 500
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              นัดพร้อมกัน — {modal.company.companyName}
            </div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>เลือกวันที่</label>
            <select
              value={selectedDateEntry}
              onChange={e => onDateChange(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", marginBottom: 14 }}
            >
              {modal.company.commonDates.map(entry => {
                const { displayDate, time } = parseDateEntry(entry);
                return <option key={entry} value={entry}>{displayDate} {time}</option>;
              })}
            </select>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>นักศึกษา</div>
            {modal.company.students.map(s => {
              const dateKey = selectedDateEntry.split("|")[0].slice(0, 10);
              const eligible = hasDate(s.proposedDates, dateKey);
              return (
                <label key={s.appointmentId} style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                  opacity: eligible ? 1 : 0.4, cursor: eligible ? "pointer" : "default"
                }}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(s.appointmentId)}
                    disabled={!eligible}
                    onChange={() => eligible && toggleCheck(s.appointmentId)}
                  />
                  {s.studentName} ({s.studentCode})
                  {!eligible && <span style={{ fontSize: 11, color: "#ef4444" }}>ไม่ได้เสนอวันนี้</span>}
                </label>
              );
            })}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #e2e8f0", cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || checkedIds.size === 0}
                style={{
                  padding: "8px 20px", borderRadius: 7, border: "none",
                  background: "#0074B7", color: "#fff", fontWeight: 700,
                  cursor: "pointer", opacity: (submitting || checkedIds.size === 0) ? 0.5 : 1
                }}
              >
                {submitting ? "กำลังยืนยัน..." : `ยืนยัน (${checkedIds.size} คน)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "#475569"
};
const tdStyle: React.CSSProperties = {
  padding: "10px 16px", verticalAlign: "top"
};
```

- [ ] **Step 2: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: ไม่มี error เกี่ยวกับ T_GroupSupervision.tsx

- [ ] **Step 3: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/T_GroupSupervision.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: add T_GroupSupervision component"
```

---

## Task 5: Frontend — เพิ่ม tab ใน T_SupervisionReview.tsx

**Files:**
- Modify: `Frontend/src/components/T_SupervisionReview.tsx`

**Interfaces:**
- Consumes: `T_GroupSupervision` จาก Task 4
- Change: เพิ่ม tab value `'group'` ใน `activeTab` state

- [ ] **Step 1: เพิ่ม import**

เปิด `Frontend/src/components/T_SupervisionReview.tsx` บรรทัดที่ 1 เพิ่ม import:

```tsx
import T_GroupSupervision from "./T_GroupSupervision";
```

- [ ] **Step 2: ขยาย activeTab type**

หาบรรทัดที่มี:
```tsx
const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');
```

เปลี่ยนเป็น:
```tsx
const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'group'>('mine');
```

- [ ] **Step 3: เพิ่ม TabBtn สำหรับ group**

หา JSX ของ TabBtn ที่มีอยู่ (section render tabs — บรรทัดหลัง `<div style={{ display: 'flex' ...`)  
เพิ่ม TabBtn ใหม่ต่อจาก tab สุดท้ายที่มีอยู่:

```tsx
<TabBtn
  active={activeTab === 'group'}
  onClick={() => setActiveTab('group')}
  label="นิเทศตามบริษัท"
  count={0}
/>
```

- [ ] **Step 4: เพิ่ม render สำหรับ group tab**

หา JSX conditional ที่ render content ตาม activeTab เพิ่ม condition:

```tsx
{activeTab === 'group' && <T_GroupSupervision />}
```

- [ ] **Step 5: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | head -30
```

Expected: ไม่มี error

- [ ] **Step 6: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/T_SupervisionReview.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: add group supervision tab to T_SupervisionReview"
```

---

## Task 6: Frontend — Calendar group events

**Files:**
- Modify: `Frontend/src/components/SupervisionCalendar.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` (exported interface บรรทัด 4-13)
- Change: เพิ่ม `groupId?: string | null` บน `CalendarEvent`; group events ที่ groupId เดียวกันก่อน render

- [ ] **Step 1: เพิ่ม groupId บน CalendarEvent interface**

หาในไฟล์:
```tsx
export interface CalendarEvent {
    id: number;
    confirmedDate: string;
    studentName: string;
    studentId?: string;
    type: "ONLINE" | "ONSITE";
    status?: string;
    companyName?: string | null;
    onlineLink?: string | null;
}
```

เพิ่ม `groupId?: string | null;` ก่อน `}` ปิด

- [ ] **Step 2: สร้าง helper mergeGroupEvents**

เพิ่ม function ก่อน `export default function SupervisionCalendar`:

```tsx
function mergeGroupEvents(events: CalendarEvent[]): CalendarEvent[] {
  const grouped = new Map<string, CalendarEvent[]>();
  const singles: CalendarEvent[] = [];
  for (const ev of events) {
    if (ev.groupId) {
      const arr = grouped.get(ev.groupId) ?? [];
      arr.push(ev);
      grouped.set(ev.groupId, arr);
    } else {
      singles.push(ev);
    }
  }
  const merged: CalendarEvent[] = [...singles];
  for (const [, group] of grouped) {
    const representative = group[0];
    const names = group.map(e => e.studentName).join(", ");
    merged.push({
      ...representative,
      studentName: `กลุ่ม ${group.length} คน — ${names}`,
    });
  }
  return merged;
}
```

- [ ] **Step 3: ใช้ mergeGroupEvents ก่อน useMemo**

หา `export default function SupervisionCalendar` ใน body ของ component หา `useMemo` หรือจุดที่ใช้ `events` prop โดยตรง — เพิ่มก่อนการใช้งาน:

```tsx
const mergedEvents = useMemo(() => mergeGroupEvents(events), [events]);
```

แล้วเปลี่ยนจากใช้ `events` → `mergedEvents` ในทุก render (useMemo/filter ของ calendar และ agenda)

หมายเหตุ: ถ้า `SupervisionCalendar` ใช้ `events` โดยตรงใน useMemo อยู่แล้ว ให้ wrap ด้วย `mergeGroupEvents(events)` ใน useMemo นั้นเลย

- [ ] **Step 4: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | head -30
```

Expected: ไม่มี error

- [ ] **Step 5: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/SupervisionCalendar.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: group calendar events by groupId"
```

---

## Task 7: CHANGELOG + smoke test

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: เพิ่ม entry ใน CHANGELOG.md**

```markdown
## [2026-08-27] feat: batch 146 — group supervision (นัดนิเทศพร้อมกันหลายคน)

### Added
- **SupervisionAppointment.groupId** — field เชื่อม appointment กลุ่ม
- **GET /api/teacher/supervisions/by-company** — จัดนักศึกษาตามบริษัท + commonDates
- **POST /api/teacher/supervisions/confirm-group** — ยืนยันกลุ่ม + generate groupId UUID
- **T_GroupSupervision.tsx** — UI อาจารย์ดูและนัดกลุ่ม
- Tab "นิเทศตามบริษัท" ใน T_SupervisionReview.tsx
- Calendar: appointment groupId เดียวกัน merge เป็น event เดียว
```

- [ ] **Step 2: รัน test suite ทั้งหมด**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx jest --no-coverage 2>&1 | tail -20
```

Expected: ทุก test suite → PASS (ไม่มี regression)

- [ ] **Step 3: TypeScript final check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```

Expected: ไม่มี output (clean)

- [ ] **Step 4: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add CHANGELOG.md
git -C C:\xampp\htdocs\Co_project commit -m "docs: batch 146 changelog — group supervision"
```
