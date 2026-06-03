# Historical Data Viewing (ดูข้อมูลย้อนหลังตาม CoopPeriod) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้อาจารย์และเจ้าหน้าที่เลือกดูข้อมูลนักศึกษาตามรอบปีการศึกษา (CoopPeriod) เพื่อค้นหาข้อมูลย้อนหลัง

**Architecture:** เพิ่ม query param `?coopPeriodId=<id>` ใน 2 endpoints ของ backend เพื่อ DB-level filter, แก้ T_Students (Teacher) ที่มี period dropdown แต่ filter ไม่ทำงาน ให้เป็น server-side, เพิ่ม period dropdown ใน A_Students (Staff) ที่ยังไม่มี

**Tech Stack:** Express + Prisma (backend filter), React 19 + TypeScript (frontend dropdowns), Jest (backend tests)

---

## ปัญหาที่พบในระบบปัจจุบัน

1. **`T_Students` period filter พัง** — client-side filter ใช้ `s.coopPeriodId` แต่ API ไม่มี field นี้ที่ root level (มีแค่ `s.coop?.coopPeriodId`) → filter ไม่กรองเลย
2. **Pagination + client-side filter = ข้อมูลหาย** — ถ้ามีนักศึกษา 200 คน API ส่ง 50 คนแรก client-side filter กรองจาก 50 → ไม่ครบ
3. **`A_Students` ไม่มี period selector** — staff มองเห็นแต่ข้อมูลปัจจุบัน, ไม่สามารถดูข้อมูลย้อนหลังได้
4. **`getAllStudentsForReview`** ไม่รองรับ period filter เลย

---

## File Structure

**Backend (modify only):**
- `backend/controllers/studentController.js:221-249` — add `coopPeriodId` filter to `getStudents`
- `backend/controllers/adminDocController.js:270-288` — add `coopPeriodId` filter to `getAllStudentsForReview`
- `backend/__tests__/studentController.test.js` — 2 new test cases
- Create: `backend/__tests__/adminDocController.test.js` — 3 new test cases

**Frontend (modify only):**
- `Frontend/src/components/T_Students.tsx` — fix broken period filter → server-side
- `Frontend/src/components/A_Students.tsx` — add period dropdown + server-side filter

**Docs:**
- `CHANGELOG.md` — บันทึกการเปลี่ยนแปลง

---

## Task 1: Backend — `getStudents` รองรับ `?coopPeriodId` filter

**Files:**
- Modify: `backend/controllers/studentController.js:221-249`
- Test: `backend/__tests__/studentController.test.js`

- [ ] **Step 1: เพิ่ม failing tests ใน `backend/__tests__/studentController.test.js`**

เปิดไฟล์ เพิ่มใน describe block `getStudents` ต่อจาก test สุดท้าย (หลังบรรทัด ~85):

```js
  test('200 — กรองตาม coopPeriodId ส่ง where ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 1, studentId: 'u640001', firstName: 'ก', lastName: 'ข' },
    ]);
    prisma.student.count.mockResolvedValue(1);

    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { coop: { coopPeriodId: 3 } },
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
  });

  test('200 — ไม่มี coopPeriodId ส่ง where เป็น {}', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
```

- [ ] **Step 2: รันเพื่อยืนยัน fail**

```bash
cd backend && npx jest studentController --no-coverage
```

Expected: FAIL — `expect.objectContaining({ where: { coop: ... } })` ไม่ match เพราะยังไม่มี `where`

- [ ] **Step 3: แก้ `getStudents` ใน `backend/controllers/studentController.js`**

แทนที่ function ทั้งหมด (บรรทัด 221-249):

```js
exports.getStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const coopPeriodId = req.query.coopPeriodId
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;
    const where = coopPeriodId ? { coop: { coopPeriodId } } : {};

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { email: true, username: true } },
          coop: { include: { company: true, mentor: true } },
          documents: true,
        },
        orderBy: { studentId: "asc" },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      data: students,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
```

- [ ] **Step 4: รันเพื่อยืนยัน pass**

```bash
cd backend && npx jest studentController --no-coverage
```

Expected: PASS ทั้ง 6 tests

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/studentController.js backend/__tests__/studentController.test.js
git commit -m "feat: add coopPeriodId filter to getStudents endpoint"
```

---

## Task 2: Backend — `getAllStudentsForReview` รองรับ `?coopPeriodId` filter

**Files:**
- Modify: `backend/controllers/adminDocController.js:270-288`
- Create: `backend/__tests__/adminDocController.test.js`

หมายเหตุ: adminDocController ใช้ `require('../config/prismaClient')` (ไม่ใช่ `new PrismaClient()`) ดังนั้น mock pattern ต่างจาก studentController

- [ ] **Step 1: สร้าง `backend/__tests__/adminDocController.test.js`**

```js
// __tests__/adminDocController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getAllStudentsForReview } = require('../controllers/adminDocController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getAllStudentsForReview', () => {
  const mockStudents = [
    { id: 1, studentId: 'u640001', firstName: 'ก', coop: { coopPeriodId: 2, company: null }, documents: [] },
    { id: 2, studentId: 'u640002', firstName: 'ข', coop: { coopPeriodId: 3, company: null }, documents: [] },
  ];

  test('200 — คืนนักศึกษาทั้งหมดเมื่อไม่มี coopPeriodId', async () => {
    prisma.student.findMany.mockResolvedValue(mockStudents);
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].data).toHaveLength(2);
  });

  test('200 — กรองตาม coopPeriodId=3', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[1]]);
    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { coop: { coopPeriodId: 3 } } })
    );
    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB error'));
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].ok).toBe(false);
  });
});
```

- [ ] **Step 2: รันเพื่อยืนยัน fail**

```bash
cd backend && npx jest adminDocController --no-coverage
```

Expected: FAIL — `where: { coop: ... }` ไม่ match

- [ ] **Step 3: แก้ `getAllStudentsForReview` ใน `backend/controllers/adminDocController.js`**

แทนที่ function `getAllStudentsForReview` (บรรทัด 270-288):

```js
exports.getAllStudentsForReview = async (req, res) => {
    try {
        const coopPeriodId = req.query.coopPeriodId
            ? parseInt(req.query.coopPeriodId, 10)
            : undefined;
        const where = coopPeriodId ? { coop: { coopPeriodId } } : {};

        const students = await prisma.student.findMany({
            where,
            include: {
                coop: {
                    include: {
                        company: true
                    }
                },
                documents: true
            }
        });

        res.json({ ok: true, data: students });
    } catch (err) {
        console.error("Get All Students Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลนักศึกษาได้" });
    }
};
```

- [ ] **Step 4: รันเพื่อยืนยัน pass**

```bash
cd backend && npx jest adminDocController --no-coverage
```

Expected: PASS ทั้ง 3 tests

- [ ] **Step 5: รัน full test suite ตรวจ regression**

```bash
cd backend && npm test
```

Expected: PASS ทั้งหมด (ไม่มี regression)

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/adminDocController.js backend/__tests__/adminDocController.test.js
git commit -m "feat: add coopPeriodId filter to getAllStudentsForReview"
```

---

## Task 3: Frontend — แก้ T_Students ให้ใช้ server-side period filter

**Files:**
- Modify: `Frontend/src/components/T_Students.tsx`

**ปัญหา:** line 173 ใช้ `s.coopPeriodId` (ไม่มีที่ root level ของ API response) ควรเป็น `s.coop?.coopPeriodId` แต่ยังติดปัญหา pagination อยู่ — แก้ถูกต้องด้วยการทำ server-side

- [ ] **Step 1: เพิ่ม `useRef` ใน import**

แทนที่บรรทัด 1:

```tsx
import { useMemo, useState, useEffect, useRef } from "react";
```

- [ ] **Step 2: เพิ่ม `fetchStudents` helper และแก้ `fetchData`**

แทนที่ `fetchData` ทั้งหมด (บรรทัด ~121-162) ด้วย:

```tsx
  const fetchStudents = async (periodId: string) => {
    const token = localStorage.getItem("coop.token");
    const params = periodId !== "all" ? `?coopPeriodId=${periodId}` : "";
    try {
      const resStd = await fetch(`/api/students${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStd.ok) {
        const data = await resStd.json();
        setAllStudents(Array.isArray(data) ? data : (data?.data ?? []));
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("coop.token");
    try {
      const resPeriods = await axios.get("/api/admin/coop-periods/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resPeriods.data?.periods) {
        setCoopPeriods(resPeriods.data.periods);
      }

      const resMajors = await fetch("/api/admin/majors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resMajors.ok) {
        const dataMajors = await resMajors.json();
        if (dataMajors.ok) {
          const majorDict: Record<string, string> = { ...LEGACY_MAJOR_TH };
          dataMajors.majors.forEach((m: string) => {
            majorDict[m] = m;
          });
          setDynamicMajors(majorDict);
        }
      }

      await fetchStudents(selectedPeriod);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: เพิ่ม useEffect สำหรับ selectedPeriod (re-fetch เมื่อเปลี่ยน period)**

เพิ่มหลัง `useEffect(() => { fetchData(); }, [])` (บรรทัด ~165):

```tsx
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    fetchStudents(selectedPeriod);
  }, [selectedPeriod]);
```

- [ ] **Step 4: แก้ `filteredStudents` useMemo — ลบ period filter (server-side แล้ว)**

แทนที่ `filteredStudents` useMemo (บรรทัด ~169-178):

```tsx
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const t = `${s.studentId} ${s.firstName || ""} ${s.lastName || ""} ${s.company?.name || s.coop?.status || ""}`.toLowerCase();
      const matchQ = t.includes(q.toLowerCase());
      const matchMajor = filterMajor === "all" || s.major === filterMajor;
      return matchQ && matchMajor;
    });
  }, [allStudents, q, filterMajor]);
```

- [ ] **Step 5: ตรวจ TypeScript**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/T_Students.tsx
git commit -m "fix: T_Students period filter now uses server-side API query param"
```

---

## Task 4: Frontend — เพิ่ม Period Dropdown ใน A_Students

**Files:**
- Modify: `Frontend/src/components/A_Students.tsx`

A_Students ปัจจุบันมีแค่ filter: ค้นหา + major + curriculum + status — ยังไม่มี period selector

- [ ] **Step 1: เพิ่ม `useRef` ใน import**

แทนที่บรรทัด 1:

```tsx
import { useState, useEffect, useMemo, useRef } from "react";
```

- [ ] **Step 2: เพิ่ม CoopPeriod interface ก่อน StudentDocument interface**

เพิ่มหลัง `/* ========================= Types ========================= */`:

```tsx
interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
}
```

- [ ] **Step 3: เพิ่ม state สำหรับ period ใน component**

ใน `A_Students()` component เพิ่มหลัง `const [modalStudent, ...]` (บรรทัด ~134):

```tsx
  const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
```

- [ ] **Step 4: เพิ่ม `fetchStudents` helper และแก้ `fetchData`**

แทนที่ `fetchData` ทั้งหมด (บรรทัด ~137-171):

```tsx
  const fetchStudents = async (periodId: string) => {
    try {
      const token = localStorage.getItem("coop.token");
      const params = periodId !== "all" ? `?coopPeriodId=${periodId}` : "";
      const res = await fetch(`/api/students${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : (data?.data ?? []));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("coop.token");

      const resPeriods = await fetch("/api/admin/coop-periods/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resPeriods.ok) {
        const data = await resPeriods.json();
        if (data?.periods) setCoopPeriods(data.periods);
      }

      const resMajors = await fetch("/api/admin/majors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resMajors.ok) {
        const dataMajors = await resMajors.json();
        if (dataMajors.ok) {
          const majorDict: Record<string, string> = { ...LEGACY_MAJOR_TH };
          dataMajors.majors.forEach((m: string) => {
            majorDict[m] = m;
          });
          setDynamicMajors(majorDict);
        }
      }

      await fetchStudents(selectedPeriodId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 5: เพิ่ม useEffect สำหรับ selectedPeriodId**

เพิ่มหลัง `useEffect(() => { fetchData(); }, [])` (บรรทัด ~173):

```tsx
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    fetchStudents(selectedPeriodId);
  }, [selectedPeriodId]);
```

- [ ] **Step 6: เพิ่ม Period dropdown ใน filter section ของ UI**

ในส่วน render (ค้นหา `{/* Filters */}` หรือ block ที่มี search input), เพิ่ม select dropdown สำหรับ period **เป็นตัวแรก** ในแถว filter:

```tsx
          <select
            className="input soft"
            style={{ width: 'auto' }}
            value={selectedPeriodId}
            onChange={e => setSelectedPeriodId(e.target.value)}
          >
            <option value="all">📚 ทุกปีการศึกษา</option>
            {coopPeriods.map(p => (
              <option key={p.id} value={String(p.id)}>
                เทอม {p.semester} / {p.academicYear}
              </option>
            ))}
          </select>
```

- [ ] **Step 7: ตรวจ TypeScript**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/components/A_Students.tsx
git commit -m "feat: add CoopPeriod filter dropdown to A_Students for historical data viewing"
```

---

## Task 5: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: เพิ่ม entry ที่ด้านบนสุดของ CHANGELOG.md (หลัง header)**

```markdown
## [Unreleased] — 2026-05-29

### Added
- `GET /api/students` รองรับ `?coopPeriodId=<id>` — กรองนักศึกษาตามรอบสหกิจที่ DB level (พร้อม pagination)
- `GET /api/admin/students` รองรับ `?coopPeriodId=<id>` — กรองนักศึกษาตามรอบสหกิจที่ DB level
- `A_Students` (Staff): เพิ่ม dropdown "ปีการศึกษา" — เลือกดูนักศึกษาตามรอบสหกิจย้อนหลัง
- `backend/__tests__/adminDocController.test.js` — unit tests สำหรับ `getAllStudentsForReview`

### Fixed
- `T_Students` (Teacher): แก้ period filter ที่ไม่ทำงาน — เปลี่ยนจาก client-side (ใช้ `s.coopPeriodId` ผิด field) เป็น server-side query param `?coopPeriodId=<id>`
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for historical data viewing feature"
```

---

## Verification

หลังทำครบทุก task ทดสอบว่าทุกอย่างทำงานถูก:

```bash
# 1. Backend tests ผ่านทั้งหมด
cd backend && npm test

# 2. Frontend TypeScript ไม่มี error
cd Frontend && npx tsc --noEmit

# 3. Frontend build ผ่าน
cd Frontend && npm run build
```
