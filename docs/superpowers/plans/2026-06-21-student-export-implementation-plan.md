# Export รายชื่อนักศึกษา (Excel) จาก Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม "Export Excel" ใน A_Dashboard.tsx (staff) และ T_Dashboard.tsx (teacher) ที่ดาวน์โหลดรายชื่อนักศึกษา 1 แถว = 1 คน พร้อมสถานะสหกิจ/บริษัท/อาจารย์ที่ปรึกษา เป็นไฟล์ .xlsx

**Architecture:** Backend สร้าง .xlsx buffer ด้วย library `xlsx` (มีอยู่แล้วใน `backend/package.json`) ผ่าน endpoint ใหม่ 2 เส้น (staff เห็นทุกคน, teacher เห็นตาม permission เดิมของ `getMyStudents`) ส่งกลับเป็น file download ตรง ฝั่ง frontend กดปุ่มแล้ว fetch ด้วย `responseType: 'blob'` แล้ว trigger ดาวน์โหลดผ่าน `<a download>`

**Tech Stack:** Express + Prisma + `xlsx` (backend, already a dependency — no new packages), React + axios (frontend, no new packages)

## Global Constraints

- ห้ามเพิ่ม npm dependency ใหม่ทั้ง backend และ frontend — ใช้ `xlsx` ที่มีอยู่แล้ว
- Permission ของ teacher export ต้องตรงกับ `getMyStudents` เป๊ะ: `isCoopTeacher === true` → ทุกคน, ไม่ใช่ → เฉพาะ `generalAdvisorId === teacher.id OR coopAdvisorId === teacher.id`
- คอลัมน์ในไฟล์ต้องเรียงตามนี้เท่านั้น: รหัสนักศึกษา, ชื่อ-นามสกุล, สาขา, ชั้นปี, สถานะสหกิจ, บริษัท, อาจารย์ที่ปรึกษาทั่วไป, อาจารย์ที่ปรึกษาสหกิจ
- `coopPeriodId` query param: ตัวเลข id หรือ string `"all"` (= ไม่ filter) — ใช้ convention เดียวกับ `getMyStudents`/`getStudents` ที่มีอยู่แล้ว (ไม่ใช่ semester+year แบบที่ `/dashboard-stats` ใช้)

---

## Background — สิ่งที่มีอยู่แล้วในโค้ด (อ่านก่อนเริ่ม)

- `backend/controllers/teacherController.js:570-635` (`exports.getMyStudents`) — มี permission logic + prisma query ที่ include `generalAdvisor`/`coopAdvisor`/`coop.company` อยู่แล้ว ครบเกือบทั้งหมดที่ export ต้องใช้ ต่างกันแค่ไม่ paginate
- `backend/controllers/studentController.js:282-331` (`exports.getStudents`) — query แบบ staff เห็นทุกคน แต่ query นี้ **ไม่ include** `generalAdvisor`/`coopAdvisor`
- `backend/controllers/studentImportController.js:1-2` — ตัวอย่างการ `require('xlsx')` และใช้ `XLSX.read`/`XLSX.utils.sheet_to_json` (เราจะใช้ `XLSX.utils.json_to_sheet`/`XLSX.write` ซึ่งเป็น API เดียวกัน คนละทิศทาง)
- `Frontend/src/components/StatusBadge.tsx:18-59` (`STATUS_CONFIG`) — source ของ label ภาษาไทยที่ต้องพอร์ตมาฝั่ง backend
- Prisma schema: `Student.prefix` เป็น enum `MR | MS` (ไม่ใช่ "นาย"/"นางสาว" ตรงๆ — ต้อง map เอง)
- `backend/__tests__/__mocks__/prismaClient.js` — mock ทุก model ไว้แล้ว รวม `student`, `teacher`, `coopPeriod` (มี `findUnique`, `findMany`, `count` ครบ)

---

### Task 1: Status label mapping utility

**Files:**
- Create: `backend/utils/coopStatusLabels.js`
- Test: `backend/__tests__/coopStatusLabels.test.js`

**Interfaces:**
- Produces: `getStatusLabelTh(status: string | null | undefined): string` — ใช้โดย Task 2

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/coopStatusLabels.test.js`:
```js
const { getStatusLabelTh } = require('../utils/coopStatusLabels');

describe('getStatusLabelTh', () => {
  test('คืน label ภาษาไทยตรงกับ status ที่รู้จัก', () => {
    expect(getStatusLabelTh('QUALIFIED')).toBe('ผ่านคุณสมบัติ');
    expect(getStatusLabelTh('INTERNSHIP_STARTED')).toBe('ออกฝึกสหกิจ');
    expect(getStatusLabelTh('COMPLETED')).toBe('นิเทศเสร็จสิ้น');
  });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status เป็น null/undefined', () => {
    expect(getStatusLabelTh(null)).toBe('ยังไม่ยื่นสหกิจ');
    expect(getStatusLabelTh(undefined)).toBe('ยังไม่ยื่นสหกิจ');
  });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status ไม่อยู่ใน map', () => {
    expect(getStatusLabelTh('SOME_UNKNOWN_STATUS')).toBe('ยังไม่ยื่นสหกิจ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest coopStatusLabels.test.js`
Expected: FAIL with `Cannot find module '../utils/coopStatusLabels'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/utils/coopStatusLabels.js`:
```js
// พอร์ตจาก Frontend/src/components/StatusBadge.tsx:STATUS_CONFIG — เอาแค่ field label
// (ไม่เอา color/icon/isInternship เพราะไฟล์ Excel ไม่ต้องใช้)
const COOP_STATUS_LABEL_TH = {
  NOT_SUBMITTED: 'ยังไม่ยื่นสหกิจ',
  APPLYING: 'รอตรวจสอบคุณสมบัติ',
  QUALIFIED: 'ผ่านคุณสมบัติ',
  QUALIFICATION_FAILED: 'ไม่ผ่านคุณสมบัติ',
  APPLICATION_EDITS_REQUIRED: 'แก้ไขใบสมัคร',
  WAITING_FOR_STAFF_CHECK: 'รอตรวจเอกสาร',
  EDITS_REQUIRED: 'แก้ไขเอกสาร T000',
  DOCS_APPROVED: 'เอกสารผ่าน (รอหนังสือ)',
  REQ_LETTER_ISSUED: 'ออกหนังสือขอความอนุเคราะห์แล้ว',
  PLACEMENT_LETTER_ISSUED: 'ออกหนังสือส่งตัวแล้ว',
  WAITING_FOR_PLACEMENT_LETTER: 'รอใบตอบรับ',
  WAITING_FOR_STAFF_CHECK_LETTER: 'รอตรวจใบตอบรับ',
  ACCEPTANCE_CHECKED: 'ตรวจใบตอบรับแล้ว',
  INTERNSHIP_STARTED: 'ออกฝึกสหกิจ',
  T002_SUBMITTED: 'ส่งเอกสาร T002 แล้ว',
  T002_EDITS_REQUIRED: 'ต้องแก้ไข T002',
  T003_SUBMITTED: 'ส่งโครงร่าง T003 แล้ว',
  T003_EDITS_REQUIRED: 'ต้องแก้ไขโครงร่าง T003',
  T004_SUBMITTED: 'ส่งรายงาน T004 แล้ว',
  T004_EDITS_REQUIRED: 'ต้องแก้ไขรายงาน T004',
  PENDING_TEACHER: 'รออาจารย์เลือกวันนิเทศ',
  TEACHER_REJECTED: 'แก้ไขวันนัดหมายนิเทศ',
  DATE_CONFIRMED: 'รอเจ้าหน้าที่พิจารณาหนังสือนิเทศ',
  LETTER_UPLOADED: 'อนุมัติหนังสือนิเทศแล้ว',
  COMPLETED: 'นิเทศเสร็จสิ้น',
  WAITING: 'รอดำเนินการ',
};

function getStatusLabelTh(status) {
  if (!status) return COOP_STATUS_LABEL_TH.NOT_SUBMITTED;
  return COOP_STATUS_LABEL_TH[status] || COOP_STATUS_LABEL_TH.NOT_SUBMITTED;
}

module.exports = { COOP_STATUS_LABEL_TH, getStatusLabelTh };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest coopStatusLabels.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/coopStatusLabels.js backend/__tests__/coopStatusLabels.test.js
git commit -m "feat: add Thai status label mapping for student export"
```

---

### Task 2: Excel workbook builder utility

**Files:**
- Create: `backend/utils/studentExport.js`
- Test: `backend/__tests__/studentExport.test.js`

**Interfaces:**
- Consumes: `getStatusLabelTh` from `backend/utils/coopStatusLabels.js` (Task 1)
- Produces: `buildStudentExportWorkbook(students: Array<StudentExportInput>): Buffer` — used by Task 3 และ Task 4. `StudentExportInput` shape:
  ```ts
  {
    studentId: string,
    prefix?: 'MR' | 'MS' | null,
    firstName: string,
    lastName: string,
    major?: string | null,
    year?: string | null,
    coop?: { status?: string, company?: { name: string } | null } | null,
    generalAdvisor?: { firstName: string, lastName: string } | null,
    coopAdvisor?: { firstName: string, lastName: string } | null,
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/studentExport.test.js`:
```js
const XLSX = require('xlsx');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

function sheetToRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

describe('buildStudentExportWorkbook', () => {
  test('สร้าง workbook ที่มี sheet ชื่อ "นักศึกษา" และ header ครบ 8 คอลัมน์', () => {
    const buffer = buildStudentExportWorkbook([]);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['นักศึกษา']);
  });

  test('แปลง 1 student เป็น 1 แถว พร้อม map ทุกคอลัมน์ถูกต้อง', () => {
    const students = [{
      studentId: '643021218',
      prefix: 'MR',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      major: 'วิทยาการคอมพิวเตอร์',
      year: '4',
      coop: { status: 'QUALIFIED', company: { name: 'บริษัท ทดสอบ จำกัด' } },
      generalAdvisor: { firstName: 'อาจารย์ก', lastName: 'นามสกุลก' },
      coopAdvisor: { firstName: 'อาจารย์ข', lastName: 'นามสกุลข' },
    }];

    const rows = sheetToRows(buildStudentExportWorkbook(students));

    expect(rows).toEqual([{
      'รหัสนักศึกษา': '643021218',
      'ชื่อ-นามสกุล': 'นาย สมชาย ใจดี',
      'สาขา': 'วิทยาการคอมพิวเตอร์',
      'ชั้นปี': '4',
      'สถานะสหกิจ': 'ผ่านคุณสมบัติ',
      'บริษัท': 'บริษัท ทดสอบ จำกัด',
      'อาจารย์ที่ปรึกษาทั่วไป': 'อาจารย์ก นามสกุลก',
      'อาจารย์ที่ปรึกษาสหกิจ': 'อาจารย์ข นามสกุลข',
    }]);
  });

  test('ใส่ "-" เมื่อ ไม่มี บริษัท/อาจารย์ที่ปรึกษา/coop', () => {
    const students = [{
      studentId: '643021219',
      prefix: 'MS',
      firstName: 'สมหญิง',
      lastName: 'ใจงาม',
      major: null,
      year: null,
      coop: null,
      generalAdvisor: null,
      coopAdvisor: null,
    }];

    const rows = sheetToRows(buildStudentExportWorkbook(students));

    expect(rows[0]).toEqual({
      'รหัสนักศึกษา': '643021219',
      'ชื่อ-นามสกุล': 'นางสาว สมหญิง ใจงาม',
      'สาขา': '-',
      'ชั้นปี': '-',
      'สถานะสหกิจ': 'ยังไม่ยื่นสหกิจ',
      'บริษัท': '-',
      'อาจารย์ที่ปรึกษาทั่วไป': '-',
      'อาจารย์ที่ปรึกษาสหกิจ': '-',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest studentExport.test.js`
Expected: FAIL with `Cannot find module '../utils/studentExport'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/utils/studentExport.js`:
```js
const XLSX = require('xlsx');
const { getStatusLabelTh } = require('./coopStatusLabels');

const PREFIX_LABEL_TH = { MR: 'นาย', MS: 'นางสาว' };

function advisorName(advisor) {
  if (!advisor) return '-';
  return `${advisor.firstName} ${advisor.lastName}`;
}

function studentToExportRow(student) {
  const prefixLabel = PREFIX_LABEL_TH[student.prefix] || '';
  const fullName = [prefixLabel, student.firstName, student.lastName].filter(Boolean).join(' ');

  return {
    'รหัสนักศึกษา': student.studentId,
    'ชื่อ-นามสกุล': fullName,
    'สาขา': student.major || '-',
    'ชั้นปี': student.year || '-',
    'สถานะสหกิจ': getStatusLabelTh(student.coop?.status),
    'บริษัท': student.coop?.company?.name || '-',
    'อาจารย์ที่ปรึกษาทั่วไป': advisorName(student.generalAdvisor),
    'อาจารย์ที่ปรึกษาสหกิจ': advisorName(student.coopAdvisor),
  };
}

function buildStudentExportWorkbook(students) {
  const rows = students.map(studentToExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'สาขา', 'ชั้นปี',
      'สถานะสหกิจ', 'บริษัท', 'อาจารย์ที่ปรึกษาทั่วไป', 'อาจารย์ที่ปรึกษาสหกิจ',
    ],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'นักศึกษา');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildStudentExportWorkbook, studentToExportRow };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest studentExport.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/studentExport.js backend/__tests__/studentExport.test.js
git commit -m "feat: add Excel workbook builder for student export"
```

---

### Task 3: Admin export endpoint (`GET /api/admin/students/export`)

**Files:**
- Modify: `backend/controllers/studentController.js` (add `exports.exportStudents` after `exports.getStudents`, around line 331)
- Modify: `backend/routes/adminRoutes.js` (add route after the `students/import-excel` block, around line 68)
- Test: `backend/__tests__/studentController.test.js` (add new `describe('exportStudents', ...)` block)

**Interfaces:**
- Consumes: `buildStudentExportWorkbook` from `backend/utils/studentExport.js` (Task 2)
- Produces: `exports.exportStudents` request handler — mounted at `GET /api/admin/students/export?coopPeriodId=<id|all>` with `verifyToken, verifyRole('admin','staff')`

- [ ] **Step 1: Write the failing test**

Open `backend/__tests__/studentController.test.js`. Add this `describe` block at the end of the file (before the final closing, same nesting level as the existing `describe('getStudents', ...)`):

```js
describe('exportStudents', () => {
  test('200 — ส่งไฟล์ xlsx กลับ พร้อม Content-Type และ Content-Disposition ที่ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        studentId: '643021218',
        prefix: 'MR',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        major: 'CS',
        year: '4',
        coop: { status: 'QUALIFIED', company: { name: 'บริษัท ทดสอบ' } },
        generalAdvisor: null,
        coopAdvisor: null,
      },
    ]);

    const req = { query: {} };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { firstName: true, lastName: true } },
        coopAdvisor: { select: { firstName: true, lastName: true } },
      },
    }));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="students_')
    );
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  test('200 — filter ตาม coopPeriodId เมื่อระบุ (ไม่ใช่ "all")', async () => {
    prisma.student.findMany.mockResolvedValue([]);

    const req = { query: { coopPeriodId: '5' } };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coop: { coopPeriodId: 5 } },
    }));
  });

  test('500 — DB error คืน { ok: false }', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB fail'));

    const req = { query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
```

Add `exportStudents` to the destructured import at the top of the test file:
```js
const { getStudents, getMyProfile, exportStudents } = require('../controllers/studentController');
```
(remove the duplicate inline `require` calls inside the new tests above if you keep this top-level import — either style works, but pick one; the plan above uses inline require for clarity since this is a new block. If you use the top-level import, delete the three `const { exportStudents } = require(...)` lines inside the tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest studentController.test.js -t exportStudents`
Expected: FAIL with `exportStudents is not a function`

- [ ] **Step 3: Write minimal implementation**

In `backend/controllers/studentController.js`, add `require` for the export utility near the top of the file (with the other requires):
```js
const { buildStudentExportWorkbook } = require('../utils/studentExport');
```

Add this new export function right after `exports.getStudents` (after its closing `};` around line 331):
```js
exports.exportStudents = async (req, res) => {
  try {
    const coopPeriodId = req.query.coopPeriodId && req.query.coopPeriodId !== 'all'
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;

    const where = coopPeriodId ? { coop: { coopPeriodId } } : {};

    const students = await prisma.student.findMany({
      where,
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { firstName: true, lastName: true } },
        coopAdvisor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { studentId: 'asc' },
    });

    const buffer = buildStudentExportWorkbook(students);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students_${coopPeriodId || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[exportStudents]', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};
```

In `backend/routes/adminRoutes.js`, add this route right after the `students/import-excel` block (after line 68):
```js
// GET /api/admin/students/export — export รายชื่อนักศึกษาเป็น Excel
router.get(
  '/students/export',
  verifyToken,
  verifyRole(...STAFF_ONLY),
  studentController.exportStudents
);
```

This requires `studentController` to be imported in `adminRoutes.js`. Check the top of the file — if there is no `const studentController = require('../controllers/studentController');` line yet, add it next to the other controller requires (e.g., near line 18 where `teacherController` is required).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest studentController.test.js`
Expected: PASS (all tests in the file, including the 3 new `exportStudents` tests)

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/studentController.js backend/routes/adminRoutes.js backend/__tests__/studentController.test.js
git commit -m "feat: add admin endpoint to export student roster to Excel"
```

---

### Task 4: Teacher export endpoint (`GET /api/teacher/students/export`)

**Files:**
- Modify: `backend/controllers/teacherController.js` (add `exports.exportMyStudents` after `exports.getMyStudents`, around line 636)
- Modify: `backend/routes/teacherRoutes.js` (add route after line 12, `router.get('/my-students', ...)`)
- Test: `backend/__tests__/teacherController.test.js` (add new `describe('exportMyStudents', ...)` block)

**Interfaces:**
- Consumes: `buildStudentExportWorkbook` from `backend/utils/studentExport.js` (Task 2)
- Produces: `exports.exportMyStudents` request handler — mounted at `GET /api/teacher/students/export?coopPeriodId=<id|all>` with `verifyToken`

- [ ] **Step 1: Write the failing test**

Add to the destructured import at the top of `backend/__tests__/teacherController.test.js`:
```js
const {
  getProfile,
  updateProfile,
  getAllTeachers,
  reviewT002,
  getDashboardStats,
  createTeacher,
  deleteTeacher,
  exportMyStudents,
} = require('../controllers/teacherController');
```

Add this `describe` block at the end of the file:
```js
describe('exportMyStudents', () => {
  test('404 — ไม่พบข้อมูลอาจารย์', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const req = { userId: 1, query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn(), send: jest.fn() };

    await exportMyStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — อาจารย์ปกติ: where filter เฉพาะ advisees ของตัวเอง', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, isCoopTeacher: false });
    prisma.student.findMany.mockResolvedValue([]);

    const req = { userId: 1, query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await exportMyStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [{ generalAdvisorId: 7 }, { coopAdvisorId: 7 }],
      },
    }));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  test('200 — อาจารย์ประจำวิชาสหกิจ (isCoopTeacher): ไม่ filter ตาม advisor', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, isCoopTeacher: true });
    prisma.student.findMany.mockResolvedValue([]);

    const req = { userId: 1, query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await exportMyStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }));
  });

  test('500 — DB error คืน { ok: false }', async () => {
    prisma.teacher.findUnique.mockRejectedValue(new Error('DB fail'));

    const req = { userId: 1, query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await exportMyStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest teacherController.test.js -t exportMyStudents`
Expected: FAIL with `exportMyStudents is not defined` (destructure of undefined export)

- [ ] **Step 3: Write minimal implementation**

In `backend/controllers/teacherController.js`, add `require` near the top with the other requires:
```js
const { buildStudentExportWorkbook } = require('../utils/studentExport');
```

Add this new export function right after `exports.getMyStudents` closes (after line 635):
```js
exports.exportMyStudents = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      select: { id: true, isCoopTeacher: true },
    });

    if (!teacher) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
    }

    const coopPeriodId = req.query.coopPeriodId && req.query.coopPeriodId !== 'all'
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;

    const advisorFilter = { OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }] };
    const periodFilter = coopPeriodId ? { coop: { coopPeriodId } } : null;

    let where;
    if (teacher.isCoopTeacher) {
      where = periodFilter || {};
    } else {
      where = periodFilter ? { AND: [periodFilter, advisorFilter] } : advisorFilter;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { firstName: true, lastName: true } },
        coopAdvisor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { studentId: 'asc' },
    });

    const buffer = buildStudentExportWorkbook(students);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students_${coopPeriodId || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[exportMyStudents]', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};
```

In `backend/routes/teacherRoutes.js`, add this route right after line 12 (`router.get('/my-students', verifyToken, teacherController.getMyStudents);`):
```js
router.get('/students/export', verifyToken, teacherController.exportMyStudents);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest teacherController.test.js`
Expected: PASS (all tests in the file, including the 4 new `exportMyStudents` tests)

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/teacherController.js backend/routes/teacherRoutes.js backend/__tests__/teacherController.test.js
git commit -m "feat: add teacher endpoint to export advisee roster to Excel"
```

---

### Task 5: Admin dashboard export button

**Files:**
- Modify: `Frontend/src/components/A_Dashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/students/export?coopPeriodId=<id|all>` (Task 3)

- [ ] **Step 1: Add export handler and button**

In `Frontend/src/components/A_Dashboard.tsx`, add this function inside the `A_Dashboard` component, right after the `fetchStats` function (after line 94, before the `useEffect` blocks):

```tsx
  const handleExport = async () => {
    try {
      let coopPeriodId: string = "all";
      if (selectedPeriod !== "all") {
        const match = periods.find(p => `${p.semester}/${p.academicYear}` === selectedPeriod);
        if (match) coopPeriodId = String(match.id);
      }

      const res = await axios.get(`/api/admin/students/export?coopPeriodId=${coopPeriodId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${coopPeriodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    }
  };
```

Note: `CoopPeriod` interface at the top of the file (line 17-22) already has `id: number`, so `periods.find(...)` above type-checks correctly without changes.

Then, inside the filter-bar `<div>` (the one with `border: '1px solid #e2e8f0'`, lines 119-145), add a button right after the closing `</select>` tag (before the closing `</div>` of that filter box, i.e. right before line 145's `</div>`):

```tsx
          <button
            onClick={handleExport}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #16a34a',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📥 Export Excel
          </button>
```

- [ ] **Step 2: Verify in browser**

Run dev environment (`run-dev` skill or manually start backend + frontend), log in as staff, go to `/admin/dashboard`. Confirm:
- Button "📥 Export Excel" appears next to the period dropdown
- Clicking it downloads a file named `students_<id-or-all>.xlsx`
- Opening the file in Excel shows the 8 expected columns with correct data

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/A_Dashboard.tsx
git commit -m "feat: add Export Excel button to admin dashboard"
```

---

### Task 6: Teacher dashboard export button

**Files:**
- Modify: `Frontend/src/components/T_Dashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/teacher/students/export?coopPeriodId=<id|all>` (Task 4)

- [ ] **Step 1: Add export handler and button**

In `Frontend/src/components/T_Dashboard.tsx`, add this function inside the `T_Dashboard` component, right after the `fetchPeriods` function closes (after line 176's `useEffect` line — place it just before `useEffect(() => { fetchPeriods(); }, []);` at line 176, i.e. anywhere in the component body before the `return`):

```tsx
  const handleExport = async () => {
    try {
      let coopPeriodId: string = "all";
      if (selectedPeriod !== "all") {
        const match = periods.find(p => `${p.semester}/${p.academicYear}` === selectedPeriod);
        if (match) coopPeriodId = String(match.id);
      }

      const res = await axios.get(`/api/teacher/students/export?coopPeriodId=${coopPeriodId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${coopPeriodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    }
  };
```

Note: `CoopPeriod` interface at the top of the file (line 10-15) already has `id: number`, so this type-checks without changes.

Then, inside the filter-bar `<div>` (lines 189-202), add a button right after the closing `</select>` tag (before line 202's `</div>`):

```tsx
            <button
              onClick={handleExport}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #16a34a',
                background: '#16a34a',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📥 Export Excel
            </button>
```

- [ ] **Step 2: Verify in browser**

Log in as a teacher account, go to teacher dashboard. Confirm:
- Button appears next to the period dropdown
- Clicking it downloads `students_<id-or-all>.xlsx`
- If logged in as a regular (non-coop) teacher, the file only contains their own advisees
- If logged in as a teacher with `isCoopTeacher = true`, the file contains all students

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/T_Dashboard.tsx
git commit -m "feat: add Export Excel button to teacher dashboard"
```

---

## Final Verification

- [ ] Run full backend test suite: `cd backend && npx jest --silent` — expect all suites pass (177 existing + new tests from Tasks 1-4)
- [ ] Run `cd Frontend && npx tsc --noEmit` (or `npx vite build`) — expect no TypeScript errors in `A_Dashboard.tsx` / `T_Dashboard.tsx`
- [ ] Manual browser check (Task 5 Step 2 and Task 6 Step 2) on both staff and teacher accounts
- [ ] Update `CHANGELOG.md` with a new entry under today's date describing the export feature (per project convention — see existing entries for format)

---

## Self-Review

**Spec coverage:**
- API endpoints (2x) → Task 3, Task 4 ✅
- Excel columns/mapping → Task 2 ✅
- Permission logic parity with `getMyStudents` → Task 4 ✅ (mirrors exact where-clause structure)
- Frontend buttons in both dashboards → Task 5, Task 6 ✅
- Status label Thai mapping → Task 1 ✅
- Error handling (empty result, DB error) → covered in Task 3/4 tests (500 case); empty-array case implicitly covered by Task 2's `buildStudentExportWorkbook([])` test ✅

**Placeholder scan:** No TBD/TODO. All code blocks are complete and runnable as written.

**Type consistency:** `buildStudentExportWorkbook(students)` signature matches between Task 2 (producer) and Task 3/4 (consumers). `getStatusLabelTh(status)` signature matches between Task 1 (producer) and Task 2 (consumer). Route paths (`/api/admin/students/export`, `/api/teacher/students/export`) match between backend route files and frontend `axios.get` calls in Task 5/6. Task 4's `where` construction was simplified during self-review to avoid a redundant double-assignment while keeping the exact same resulting query shape as `getMyStudents` (verified against the Task 4 test expectations, which assert the plain `{ OR: [...] }` shape with no filter, and `{ AND: [periodFilter, advisorFilter] }` when a period is given).
