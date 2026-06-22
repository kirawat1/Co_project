# Student Edit/Delete (Staff/Teacher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff/teacher edit a student's basic info and remove a student record with a recovery path (soft-delete trash + restore + permanent purge), per `docs/superpowers/specs/2026-06-22-student-edit-delete-design.md`.

**Architecture:** One additive Prisma migration (`Student.deletedAt` + two missing `onDelete: Cascade` fixes), five new backend endpoints under `/api/admin/students/*` reusing the existing `studentController.js`/`adminRoutes.js` conventions, and two new frontend components (edit modal, trash tab) wired into the existing `A_Students.tsx` list.

**Tech Stack:** Express + Prisma + MySQL (backend), React + TypeScript + Vite (frontend), Jest (backend tests).

## Global Constraints

- No new dependencies.
- Editable fields are basic info only: `prefix`, `firstName`, `lastName`, `firstNameEn`, `lastNameEn`, `studentId`, `major`, `studyProgram`, `year`, `phone`, `email`, `advisorName`, `jobPosition`. Do not add company/coop fields to the edit form.
- New routes are gated `verifyToken, verifyRole(...ADMIN_ROLES)` (staff + teacher + admin) — matches the user's explicit choice, not the narrower `STAFF_ONLY` used by `teacherRoutes`.
- No auto-purge of trashed students — recovery is unlimited until a staff/teacher explicitly hits permanent delete.
- Do not touch `Student.major`/`studyProgram` as *display* values elsewhere, or `A_Students.tsx`'s existing `CURRICULUM_TH`/`LEGACY_MAJOR_TH` maps.
- `email` lives on `User`, not `Student` — any edit to it must update both tables in one transaction.
- `prisma.$transaction` test mock (`backend/__tests__/__mocks__/prismaClient.js:144`) only supports the **callback-style** API (`jest.fn((fn) => fn(prismaMock))`), not the array-style API. All new code must use `prisma.$transaction(async (tx) => { ... })`, never `prisma.$transaction([...])`, or tests will throw "fn is not a function".

---

### Task 1: Schema migration — add `deletedAt`, fix two missing cascades

**Files:**
- Modify: `backend/prisma/schema.prisma` (Student model, CoopApplicationForm model, Visit model)
- Modify: `backend/__tests__/__mocks__/prismaClient.js:11-18` (add `delete` to the `student` mock)

**Interfaces:**
- Produces: `Student.deletedAt: DateTime | null` — every later task's queries and the `student.delete` mock depend on this existing.

- [ ] **Step 1: Add `deletedAt` to `Student` and fix the two missing cascades**

In `backend/prisma/schema.prisma`, find the `Student` model (starts at line 42) and add one field at the end of its scalar fields (right after `jobPosition`):

```prisma
  advisorName  String? // ชื่ออาจารย์ที่ปรึกษา
  jobPosition  String? // ตำแหน่งงานที่สนใจ/สมัคร
  deletedAt    DateTime? // null = active, set = soft-deleted (in trash)
```

Find the `CoopApplicationForm` model (around line 156-159) and change:

```prisma
model CoopApplicationForm {
  id        Int     @id @default(autoincrement())
  studentId Int     @unique
  student   Student @relation(fields: [studentId], references: [id])
```

to:

```prisma
model CoopApplicationForm {
  id        Int     @id @default(autoincrement())
  studentId Int     @unique
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
```

Find the `Visit` model (around line 272-280) and change:

```prisma
model Visit {
  id        Int      @id @default(autoincrement())
  date      DateTime
  time      String?
  location  String?
  note      String?
  status    String   @default("scheduled")
  studentId Int
  student   Student  @relation(fields: [studentId], references: [id])
```

to:

```prisma
model Visit {
  id        Int      @id @default(autoincrement())
  date      DateTime
  time      String?
  location  String?
  note      String?
  status    String   @default("scheduled")
  studentId Int
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && npx prisma migrate dev --name add_student_deleted_at_and_cascades`

If it refuses with "non-interactive environment" (a known limitation of this Prisma version in this environment — confirmed during the previous refactor's Task 11), use this workaround instead:

```bash
cd backend
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql
```

Then create the migration folder manually (timestamp = current UTC time in `YYYYMMDDHHmmss` format, must sort after the most recent existing migration folder under `backend/prisma/migrations/`):

```bash
mkdir -p backend/prisma/migrations/<TIMESTAMP>_add_student_deleted_at_and_cascades
cp /tmp/migration.sql backend/prisma/migrations/<TIMESTAMP>_add_student_deleted_at_and_cascades/migration.sql
cd backend && npx prisma migrate deploy
```

Expected: migration applies with no errors, output ends with "All migrations have been successfully applied." (or "already in sync" if `migrate dev` succeeded directly).

- [ ] **Step 3: Regenerate Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: `Generated Prisma Client (...)`. If it fails with `EPERM ... query_engine-windows.dll.node`, a running `node.exe` (nodemon's backend process) is holding the file open — stop it first, then retry.

- [ ] **Step 4: Add `delete` to the `student` mock**

In `backend/__tests__/__mocks__/prismaClient.js`, find:

```js
  student: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
```

Change to:

```js
  student: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
```

- [ ] **Step 5: Run the existing full backend suite to confirm nothing broke**

Run: `cd backend && npm test`
Expected: `17 passed, 17 total` / `175 passed, 175 total` (same counts as before — this task adds no new tests, it's schema + mock plumbing only).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/__tests__/__mocks__/prismaClient.js
git commit -m "feat: add Student.deletedAt and fix missing cascades for student delete/restore"
```

---

### Task 2: Hide trashed students from every existing read path + block their login

**Files:**
- Modify: `backend/controllers/studentController.js` (`getStudents`, ~line 202-251)
- Modify: `backend/controllers/adminDocController.js` (`getStudentsForT000` ~line 36-56, `getAllStudentsForReview` ~line 301-319)
- Modify: `backend/routes/adminRoutes.js` (majors query, ~line 79-92)
- Modify: `backend/controllers/authController.js` (`loginWithGoogle`, ~line 608-611)
- Test: `backend/__tests__/studentController.test.js`, `backend/__tests__/authController.test.js`

**Interfaces:**
- Consumes: `Student.deletedAt` from Task 1.

- [ ] **Step 1: Update the two existing `getStudents` where-shape tests, and add the login test**

`backend/__tests__/studentController.test.js` already has two tests in `describe('getStudents', ...)` that assert the *old* `where` shape — they will need updating, not duplicating. Find:

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
        where: { AND: [{ coop: { coopPeriodId: 3 } }] },
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

Change to (both tests gain the `deletedAt: null` condition that will always be present once Step 3 below lands; the second test is renamed since `where` is no longer `{}` when there's no filter):

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
        where: { AND: [{ deletedAt: null }, { coop: { coopPeriodId: 3 } }] },
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
  });

  test('200 — ไม่มี coopPeriodId ก็ยังกรอง deletedAt: null เสมอ', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
  });
```

In `backend/__tests__/authController.test.js`, inside `describe('loginWithGoogle', ...)`, add:

```js
  test('401 – student is soft-deleted (in trash)', async () => {
    const mockVerify = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'trashed@kkumail.com', email_verified: true }),
    });
    OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerify }));

    prisma.user.findFirst.mockResolvedValue({
      id: 1, email: 'trashed@kkumail.com', role: 'student',
      student: { deletedAt: new Date('2026-01-01') },
    });

    const req = { body: { id_token: 'valid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest __tests__/studentController.test.js __tests__/authController.test.js -v`
Expected: the two updated `getStudents` tests FAIL (current code doesn't add `deletedAt: null`), and the new `loginWithGoogle` test FAILS (the trashed student still gets a 200, not a 401).

- [ ] **Step 3: Fix `studentController.getStudents`**

In `backend/controllers/studentController.js`, find:

```js
    const conditions = [];
    if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
    if (search) {
      conditions.push({
        OR: [
          { studentId: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { user: { email: { contains: search } } },
        ],
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};
```

Change to:

```js
    const conditions = [{ deletedAt: null }];
    if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
    if (search) {
      conditions.push({
        OR: [
          { studentId: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { user: { email: { contains: search } } },
        ],
      });
    }
    const where = { AND: conditions };
```

- [ ] **Step 4: Fix `authController.loginWithGoogle`**

In `backend/controllers/authController.js`, find:

```js
    const user = await prisma.user.findFirst({ where: { email, role: 'student' } });
    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }
```

Change to:

```js
    const user = await prisma.user.findFirst({
      where: { email, role: 'student' },
      include: { student: true },
    });
    if (!user || user.student?.deletedAt) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }
```

- [ ] **Step 5: Run the two test files again to verify they pass**

Run: `cd backend && npx jest __tests__/studentController.test.js __tests__/authController.test.js -v`
Expected: all tests PASS, including the two new ones.

- [ ] **Step 6: Fix `adminDocController.getStudentsForT000`**

In `backend/controllers/adminDocController.js`, find:

```js
    const students = await prisma.student.findMany({
      where: {
        OR: [
            { coop: { isNot: null } },
            { documents: { some: { type: 'T000_SIGNED' } } }
        ]
      },
```

Change to:

```js
    const students = await prisma.student.findMany({
      where: {
        AND: [
          { OR: [
              { coop: { isNot: null } },
              { documents: { some: { type: 'T000_SIGNED' } } }
          ] },
          { deletedAt: null },
        ],
      },
```

- [ ] **Step 7: Fix `adminDocController.getAllStudentsForReview`**

In `backend/controllers/adminDocController.js`, find:

```js
        const conditions = [];
        if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
        if (search) {
            conditions.push({
                OR: [
                    { studentId: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                ],
            });
        }
        const where = conditions.length > 0 ? { AND: conditions } : {};
```

Change to:

```js
        const conditions = [{ deletedAt: null }];
        if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
        if (search) {
            conditions.push({
                OR: [
                    { studentId: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                ],
            });
        }
        const where = { AND: conditions };
```

- [ ] **Step 8: Fix the majors query in `adminRoutes.js`**

In `backend/routes/adminRoutes.js`, find:

```js
    const rows = await prisma.student.findMany({
      where: { major: { not: null } },
      select: { major: true },
      distinct: ['major'],
      orderBy: { major: 'asc' },
    });
```

Change to:

```js
    const rows = await prisma.student.findMany({
      where: { major: { not: null }, deletedAt: null },
      select: { major: true },
      distinct: ['major'],
      orderBy: { major: 'asc' },
    });
```

- [ ] **Step 9: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, total test count is 175 + 1 new = 176 (the two `getStudents` tests were updated in place, not added; only the `loginWithGoogle` trashed-student test is net new).

- [ ] **Step 10: Commit**

```bash
git add backend/controllers/studentController.js backend/controllers/adminDocController.js backend/routes/adminRoutes.js backend/controllers/authController.js backend/__tests__/studentController.test.js backend/__tests__/authController.test.js
git commit -m "fix: hide soft-deleted students from all listings and block their login"
```

---

### Task 3: Trash CRUD — soft delete, list trash, restore, permanent delete

**Files:**
- Modify: `backend/controllers/studentController.js` (append 4 new exports)
- Modify: `backend/routes/adminRoutes.js` (wire 4 new routes)
- Test: `backend/__tests__/studentController.test.js`

**Interfaces:**
- Consumes: `Student.deletedAt` (Task 1), `prisma.student.delete` mock (Task 1 Step 4).
- Produces: `studentController.softDeleteStudent`, `getTrashedStudents`, `restoreStudent`, `permanentlyDeleteStudent` — Task 5/6 (frontend) call these via their routes, not directly.

- [ ] **Step 1: Write the failing tests**

Append to `backend/__tests__/studentController.test.js` (after the existing `describe('getStudents', ...)` block, before any trailing code):

```js
const {
  softDeleteStudent,
  getTrashedStudents,
  restoreStudent,
  permanentlyDeleteStudent,
} = require('../controllers/studentController');

describe('softDeleteStudent', () => {
  test('200 — ตั้ง deletedAt ให้นักศึกษาที่มีอยู่', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
    prisma.student.update.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('404 — อยู่ในถังขยะอยู่แล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('getTrashedStudents', () => {
  test('200 — คืนรายชื่อที่ deletedAt ไม่เป็น null', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 1, deletedAt: new Date() }]);

    const req = {};
    const res = makeRes();

    await getTrashedStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: { not: null } },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: expect.any(Array) }));
  });
});

describe('restoreStudent', () => {
  test('200 — ล้าง deletedAt', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    prisma.student.update.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: null },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('404 — ไม่ได้อยู่ในถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('permanentlyDeleteStudent', () => {
  test('200 — ลบจริงเมื่ออยู่ในถังขยะแล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    prisma.student.delete.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('400 — ปฏิเสธถ้ายังไม่ได้ย้ายไปถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest __tests__/studentController.test.js -v`
Expected: FAIL — `softDeleteStudent`, `getTrashedStudents`, `restoreStudent`, `permanentlyDeleteStudent` are not exported yet (`TypeError: ... is not a function`).

- [ ] **Step 3: Implement the four controller functions**

Append to `backend/controllers/studentController.js` (end of file):

```js
// DELETE /api/admin/students/:id — ย้ายนักศึกษาไปถังขยะ (soft delete)
exports.softDeleteStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (student.deletedAt) return res.status(404).json({ ok: false, message: "นักศึกษาอยู่ในถังขยะแล้ว" });

    await prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ ok: true, message: "ย้ายไปถังขยะเรียบร้อย" });
  } catch (err) {
    console.error("SOFT DELETE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// GET /api/admin/students/trash — รายชื่อนักศึกษาในถังขยะ
exports.getTrashedStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { deletedAt: { not: null } },
      include: { user: { select: { email: true } } },
      orderBy: { deletedAt: 'desc' },
    });
    res.json({ ok: true, data: students });
  } catch (err) {
    console.error("GET TRASHED STUDENTS ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// POST /api/admin/students/:id/restore — กู้คืนนักศึกษาจากถังขยะ
exports.restoreStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (!student.deletedAt) return res.status(404).json({ ok: false, message: "นักศึกษาไม่ได้อยู่ในถังขยะ" });

    await prisma.student.update({ where: { id }, data: { deletedAt: null } });
    res.json({ ok: true, message: "กู้คืนเรียบร้อย" });
  } catch (err) {
    console.error("RESTORE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// DELETE /api/admin/students/:id/permanent — ลบนักศึกษาถาวร (ต้องอยู่ในถังขยะก่อน)
exports.permanentlyDeleteStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (!student.deletedAt) {
      return res.status(400).json({ ok: false, message: "ต้องย้ายไปถังขยะก่อนจึงจะลบถาวรได้" });
    }

    await prisma.student.delete({ where: { id } });
    res.json({ ok: true, message: "ลบถาวรเรียบร้อย" });
  } catch (err) {
    console.error("PERMANENTLY DELETE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest __tests__/studentController.test.js -v`
Expected: all tests PASS (9 new tests added).

- [ ] **Step 5: Wire the 4 routes**

In `backend/routes/adminRoutes.js`, find the `GET /api/admin/students/majors` block (ends around line 92, right before the `// Coop Applications` comment) and insert immediately after it:

```js
// Students: Trash (soft delete / restore / permanent delete)
router.delete('/students/:id', verifyToken, verifyRole(...ADMIN_ROLES), studentController.softDeleteStudent);
router.get('/students/trash', verifyToken, verifyRole(...ADMIN_ROLES), studentController.getTrashedStudents);
router.post('/students/:id/restore', verifyToken, verifyRole(...ADMIN_ROLES), studentController.restoreStudent);
router.delete('/students/:id/permanent', verifyToken, verifyRole(...ADMIN_ROLES), studentController.permanentlyDeleteStudent);
```

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, total test count is 176 + 9 = 185.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/studentController.js backend/routes/adminRoutes.js backend/__tests__/studentController.test.js
git commit -m "feat: add trash CRUD endpoints (soft delete, list trash, restore, permanent delete)"
```

---

### Task 4: Edit basic info endpoint

**Files:**
- Modify: `backend/controllers/studentController.js` (append 1 new export)
- Modify: `backend/routes/adminRoutes.js` (wire 1 new route)
- Test: `backend/__tests__/studentController.test.js`

**Interfaces:**
- Produces: `studentController.updateStudentBasicInfo` — Task 5 (frontend edit modal) calls this via its route.

- [ ] **Step 1: Write the failing tests**

Append to `backend/__tests__/studentController.test.js`:

```js
const { updateStudentBasicInfo } = require('../controllers/studentController');

describe('updateStudentBasicInfo', () => {
  test('200 — แก้ไขข้อมูลพื้นฐาน ไม่แก้ email', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1, firstName: 'ใหม่' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' }),
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 — แก้ email ด้วย → อัปเดต User.email ด้วย', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.user.findFirst.mockResolvedValue(null); // ไม่ชนกับใคร
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1 });
    prisma.user.update.mockResolvedValue({ id: 10, email: 'new@kkumail.com' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'new@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { email: 'new@kkumail.com' },
    });
  });

  test('409 — email ใหม่ชนกับ user อื่น', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 99 });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'taken@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' }, body: { firstName: 'ก' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400 — studentId ซ้ำ (P2002)', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002', meta: { target: 'studentId' } });
    prisma.$transaction.mockRejectedValue(p2002);

    const req = { params: { id: '1' }, body: { firstName: 'ก', studentId: 'u640001' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest __tests__/studentController.test.js -v`
Expected: FAIL — `updateStudentBasicInfo is not a function`.

- [ ] **Step 3: Implement `updateStudentBasicInfo`**

Append to `backend/controllers/studentController.js`:

```js
// PUT /api/admin/students/:id — แก้ไขข้อมูลพื้นฐานนักศึกษา (staff/teacher)
exports.updateStudentBasicInfo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      prefix, firstName, lastName, firstNameEn, lastNameEn,
      studentId, major, studyProgram, year, phone, email,
      advisorName, jobPosition,
    } = req.body;

    const student = await prisma.student.findUnique({ where: { id }, include: { user: true } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });

    if (email && email !== student.user.email) {
      const conflict = await prisma.user.findFirst({
        where: { email, NOT: { id: student.userId } },
      });
      if (conflict) {
        return res.status(409).json({ ok: false, message: `อีเมล ${email} มีในระบบแล้ว` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          prefix, firstName, lastName, firstNameEn, lastNameEn,
          studentId, major, studyProgram, year, phone,
          advisorName, jobPosition,
        },
      });
      if (email && email !== student.user.email) {
        await tx.user.update({ where: { id: student.userId }, data: { email } });
      }
      return updatedStudent;
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('studentId')) {
        return res.status(400).json({ ok: false, message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" });
      }
      return res.status(400).json({ ok: false, message: "ข้อมูลบางอย่างซ้ำกับในระบบ" });
    }
    console.error("UPDATE STUDENT BASIC INFO ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest __tests__/studentController.test.js -v`
Expected: all tests PASS (5 new tests added).

- [ ] **Step 5: Wire the route**

In `backend/routes/adminRoutes.js`, add this line right before the 4 trash routes added in Task 3:

```js
router.put('/students/:id', verifyToken, verifyRole(...ADMIN_ROLES), studentController.updateStudentBasicInfo);
```

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, total test count is 185 + 5 = 190.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/studentController.js backend/routes/adminRoutes.js backend/__tests__/studentController.test.js
git commit -m "feat: add PUT /api/admin/students/:id to edit basic info"
```

---

### Task 5: Frontend — edit modal + row actions in the active list

**Files:**
- Create: `Frontend/src/components/A_StudentEditModal.tsx`
- Modify: `Frontend/src/components/A_Students.tsx` (export `StudentProfile`, add row actions, add `editStudent`/`handleDelete` state and handlers)

**Interfaces:**
- Consumes: `PUT /api/admin/students/:id` (Task 4), `DELETE /api/admin/students/:id` (Task 3).
- Produces: `A_StudentEditModal` component — `{ student: StudentProfile; majors: Record<string, string>; onClose: () => void; onSaved: () => void }`. Task 6 does not depend on this component, but follows the same file-split pattern.

- [ ] **Step 1: Export `StudentProfile` from `A_Students.tsx` and add the edit-only fields**

The backend already returns `firstNameEn`, `lastNameEn`, `advisorName`, `jobPosition` as plain scalar fields on `Student` (no `select` is used in `getStudents`, so Prisma returns every scalar column) — they're just not declared on this frontend type yet. The edit modal needs them, so add them now instead of reaching for `as any`.

In `Frontend/src/components/A_Students.tsx`, find:

```ts
interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  year?: string;
  faculty?: string;
  major?: string;
  studyProgram?: string;
  gpa?: number;
  phone?: string;
  user?: { email: string };
```

Change to:

```ts
export interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  prefix?: string;
  year?: string;
  faculty?: string;
  major?: string;
  studyProgram?: string;
  gpa?: number;
  phone?: string;
  advisorName?: string;
  jobPosition?: string;
  user?: { email: string };
```

- [ ] **Step 2: Create the edit modal component**

Create `Frontend/src/components/A_StudentEditModal.tsx`:

```tsx
import { useState } from "react";
import type { StudentProfile } from "./A_Students";

const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};

interface Props {
  student: StudentProfile;
  majors: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

export default function A_StudentEditModal({ student, majors, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    prefix: student.prefix ?? "",
    firstName: student.firstName ?? "",
    lastName: student.lastName ?? "",
    firstNameEn: student.firstNameEn ?? "",
    lastNameEn: student.lastNameEn ?? "",
    studentId: student.studentId ?? "",
    major: student.major ?? "",
    studyProgram: student.studyProgram ?? "",
    year: student.year ?? "",
    phone: student.phone ?? "",
    email: student.user?.email ?? "",
    advisorName: student.advisorName ?? "",
    jobPosition: student.jobPosition ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay}>
      <form style={modal} onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>แก้ไขข้อมูลนักศึกษา</h2>

        {error && <div style={{ color: "#dc2626", marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={grid}>
          <Field label="คำนำหน้า">
            <select style={input} value={form.prefix} onChange={e => update("prefix", e.target.value)} required>
              <option value="">เลือก</option>
              <option value="MR">นาย</option>
              <option value="MS">นางสาว</option>
            </select>
          </Field>
          <Field label="รหัสนักศึกษา">
            <input style={input} value={form.studentId} onChange={e => update("studentId", e.target.value)} required />
          </Field>
          <Field label="ชื่อ">
            <input style={input} value={form.firstName} onChange={e => update("firstName", e.target.value)} required />
          </Field>
          <Field label="นามสกุล">
            <input style={input} value={form.lastName} onChange={e => update("lastName", e.target.value)} required />
          </Field>
          <Field label="ชื่อ (English)">
            <input style={input} value={form.firstNameEn} onChange={e => update("firstNameEn", e.target.value)} />
          </Field>
          <Field label="นามสกุล (English)">
            <input style={input} value={form.lastNameEn} onChange={e => update("lastNameEn", e.target.value)} />
          </Field>
          <Field label="สาขาวิชา">
            <select style={input} value={form.major} onChange={e => update("major", e.target.value)}>
              <option value="">-</option>
              {Object.keys(majors).map(m => <option key={m} value={m}>{majors[m]}</option>)}
            </select>
          </Field>
          <Field label="หลักสูตร">
            <select style={input} value={form.studyProgram} onChange={e => update("studyProgram", e.target.value)}>
              <option value="">-</option>
              {Object.entries(CURRICULUM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="ชั้นปี">
            <input style={input} value={form.year} onChange={e => update("year", e.target.value)} />
          </Field>
          <Field label="เบอร์โทร">
            <input style={input} value={form.phone} onChange={e => update("phone", e.target.value)} />
          </Field>
          <Field label="อีเมล">
            <input style={input} type="email" value={form.email} onChange={e => update("email", e.target.value)} />
          </Field>
          <Field label="อาจารย์ที่ปรึกษา">
            <input style={input} value={form.advisorName} onChange={e => update("advisorName", e.target.value)} />
          </Field>
          <Field label="ตำแหน่งงานที่สนใจ">
            <input style={input} value={form.jobPosition} onChange={e => update("jobPosition", e.target.value)} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button type="button" style={ghostBtn} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="submit" style={saveBtn} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 700, border: "1px solid #e5e7eb", maxHeight: "85vh", overflowY: "auto" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: "0 16px", cursor: "pointer" };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: "0 16px", cursor: "pointer" };
```

- [ ] **Step 3: Add row actions and wiring in `A_Students.tsx`**

In `Frontend/src/components/A_Students.tsx`, add the import near the top (after the other component imports):

```tsx
import A_StudentEditModal from "./A_StudentEditModal";
```

Find the state declarations block (around `const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);`) and add right after it:

```tsx
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
```

Find `resetFilters` and add a new handler right after it:

```tsx
  const handleDeleteStudent = async (s: StudentProfile) => {
    const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
    if (!window.confirm(`ย้าย "${fullName || s.studentId}" ไปถังขยะ?`)) return;
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${s.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "ลบไม่สำเร็จ");
        return;
      }
      fetchStudents(selectedPeriodId, currentPage, debouncedQ);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };
```

Find the row actions cell (the `<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>` containing the "ดูข้อมูล" button) and add two buttons right after the "ดูข้อมูล" button, before the `gradeSheetUrl` conditional:

```tsx
                      <button
                        className="btn"
                        style={ghostBtn}
                        onClick={() => setEditStudent(s)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn"
                        style={{ ...ghostBtn, color: "#dc2626", borderColor: "#fecaca" }}
                        onClick={() => handleDeleteStudent(s)}
                      >
                        ลบ
                      </button>
```

Find the existing modal render block near the end of the component:

```tsx
      {/* ================= Modal ================= */}
      {modalStudent && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
        />
      )}
```

Change to:

```tsx
      {/* ================= Modal ================= */}
      {modalStudent && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
        />
      )}
      {editStudent && (
        <A_StudentEditModal
          student={editStudent}
          majors={Object.keys(dynamicMajors).length > 0 ? dynamicMajors : LEGACY_MAJOR_TH}
          onClose={() => setEditStudent(null)}
          onSaved={() => fetchStudents(selectedPeriodId, currentPage, debouncedQ)}
        />
      )}
```

- [ ] **Step 4: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/A_StudentEditModal.tsx Frontend/src/components/A_Students.tsx
git commit -m "feat: add student edit modal and delete (soft) button to admin student list"
```

---

### Task 6: Frontend — ถังขยะ tab (restore / permanent delete) + CHANGELOG

**Files:**
- Create: `Frontend/src/components/A_StudentTrash.tsx`
- Modify: `Frontend/src/components/A_Students.tsx` (add `pageTab` state, tab toggle, render `A_StudentTrash` when active)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `GET /api/admin/students/trash`, `POST /api/admin/students/:id/restore`, `DELETE /api/admin/students/:id/permanent` (Task 3).

- [ ] **Step 1: Create the trash tab component**

Create `Frontend/src/components/A_StudentTrash.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { StudentProfile } from "./A_Students";

export default function A_StudentTrash() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch("/api/admin/students/trash", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setItems(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (s: StudentProfile) => {
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${s.id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "กู้คืนไม่สำเร็จ");
        return;
      }
      fetchTrash();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const handlePermanentDelete = async (s: StudentProfile) => {
    if (confirmText.trim() !== s.studentId) {
      alert("กรุณาพิมพ์รหัสนักศึกษาให้ตรงกันก่อนยืนยัน");
      return;
    }
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${s.id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "ลบถาวรไม่สำเร็จ");
        return;
      }
      setConfirmId(null);
      setConfirmText("");
      fetchTrash();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลด...</div>;

  return (
    <section style={card}>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>ถังขยะ</h2>
      {items.length === 0 ? (
        <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>ถังขยะว่าง</div>
      ) : (
        <table width="100%" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["รหัส", "ชื่อ–นามสกุล", "อีเมล", "การจัดการ"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}>{s.studentId}</td>
                <td style={td}>{s.firstName} {s.lastName}</td>
                <td style={td}>{s.user?.email || "-"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={ghostBtn} onClick={() => handleRestore(s)}>กู้คืน</button>
                    {confirmId === s.id ? (
                      <>
                        <input
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #fecaca", fontSize: 12, width: 120 }}
                          placeholder={`พิมพ์ "${s.studentId}"`}
                          value={confirmText}
                          onChange={e => setConfirmText(e.target.value)}
                        />
                        <button style={dangerBtn} onClick={() => handlePermanentDelete(s)}>ยืนยันลบถาวร</button>
                        <button style={ghostBtn} onClick={() => { setConfirmId(null); setConfirmText(""); }}>ยกเลิก</button>
                      </>
                    ) : (
                      <button style={dangerBtn} onClick={() => setConfirmId(s.id)}>ลบถาวร</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" };
const th: React.CSSProperties = { textAlign: "left", paddingBottom: 8, fontSize: 14, padding: "12px 10px", color: "#475569" };
const td: React.CSSProperties = { padding: "12px 10px", fontSize: 14, color: "#1e293b" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13 };
const dangerBtn: React.CSSProperties = { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 };
```

- [ ] **Step 2: Add the tab toggle to `A_Students.tsx`**

In `Frontend/src/components/A_Students.tsx`, add the import near the top:

```tsx
import A_StudentTrash from "./A_StudentTrash";
```

Add state right after the `editStudent` state added in Task 5:

```tsx
  const [pageTab, setPageTab] = useState<"list" | "trash">("list");
```

Two separate, non-overlapping insertions are needed — **not** a wrap-the-middle-of-a-tag edit, since the filters `<section>` and the table `<section>` are two separate sibling elements, not one shared container (verify this against the live file before editing: the filters section closes well before the table section opens). The cleanest approach is to gate the whole filters+table+pagination block as one fragment, leaving the Excel-import block above it untouched and always visible.

**Insertion A** — find:

```tsx
      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>ข้อมูลนักศึกษา</h2>
```

Change to:

```tsx
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          style={pageTab === "list" ? saveBtn : ghostBtn}
          onClick={() => setPageTab("list")}
        >
          รายชื่อนักศึกษา
        </button>
        <button
          style={pageTab === "trash" ? saveBtn : ghostBtn}
          onClick={() => setPageTab("trash")}
        >
          ถังขยะ
        </button>
      </div>

      {pageTab === "list" && (
        <>
      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>ข้อมูลนักศึกษา</h2>
```

**Insertion B** — find the end of the pagination block, right before the Modal comment (this text is unchanged from the original file — only confirming the anchor):

```tsx
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* ================= Modal ================= */}
```

Change to:

```tsx
              ถัดไป →
            </button>
          </div>
        </div>
      )}
        </>
      )}
      {pageTab === "trash" && <A_StudentTrash />}

      {/* ================= Modal ================= */}
```

The `{modalStudent && <StudentModal .../>}` and `{editStudent && <A_StudentEditModal .../>}` blocks that follow stay exactly where they are, outside both branches — they're global overlays driven by their own state, harmless (render nothing) when `pageTab === "trash"` since neither state can be set from the trash view.
    </div>
  );
}
```

(This closes the `<section style={card}>` that was opened conditionally above, matching the new `{pageTab === "trash" ? (...) : (<section>...` ternary.)

- [ ] **Step 3: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If there's a mismatched-tag error, double check the ternary's parens/braces from Step 2 line up — the `<section style={card}>` opened in the `: (` branch must close with `</section>` immediately before the ternary's closing `)`.

- [ ] **Step 4: Add the CHANGELOG entry**

In `CHANGELOG.md`, add at the top of the file:

```markdown
## [2026-06-22] Student Edit + Soft-Delete (Trash/Restore) for Staff/Teacher

### Added
- Staff/teacher can now edit a student's basic info (name, studentId, major, study program, year, phone, email, advisor, job position) via a new edit modal on the admin student list (`A_Students.tsx`).
- Staff/teacher can soft-delete a student (moves to a new "ถังขยะ" trash tab), restore it, or permanently delete it. Permanent delete is gated — a student must be in the trash first, and the UI requires typing the student's ID to confirm.
- New `Student.deletedAt` field. Trashed students are hidden from every existing student listing and blocked from logging in (Google OAuth), but their data (documents, visits, coop application, etc.) is untouched until a staff/teacher explicitly permanently deletes them — no auto-purge.

### Fixed
- `CoopApplicationForm` and `Visit` were missing `onDelete: Cascade` on their `Student` relation — permanently deleting a student with a submitted coop application or a scheduled visit would have thrown a foreign-key error. Both now cascade correctly.

### Why
Staff previously had no way to correct mistaken Excel imports, duplicate enrollments, or remove withdrawn students without direct DB access. Soft-delete (rather than instant hard-delete) avoids irreversible mistakes; permanent delete is opt-in and requires the record to already be in the trash.
```

- [ ] **Step 5: Run the full verification suite**

Run: `cd backend && npm test`
Expected: 190 tests pass (no change from Task 4 — this task is frontend + docs only).

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/A_StudentTrash.tsx Frontend/src/components/A_Students.tsx CHANGELOG.md
git commit -m "feat: add trash tab UI (restore/permanent delete) for admin student list"
```
