# Co-op Criteria Grade Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make co-op eligibility criteria (prep course, credits, required courses, elective courses) admin-configurable and automatically verified against KKU REG API grade data during student sync.

**Architecture:** Add `prepCourseCodes` and `electiveMinCount` to the `CoopCriteria` DB model so staff can configure them; update the student sync path (`POST /api/students/sync-from-reg`) to call a new `getGradeList` KKU API function and run all eligibility checks; replace the plain-text course code inputs in `A_CriteriaPage` with a tag-based picker backed by a KKU course-search proxy endpoint.

**Tech Stack:** Prisma + MySQL (schema migration), Express backend, React 19 + TypeScript frontend, KKU REG API v1.2 (`reg2.kku.ac.th/api/v1.2`), Jest (backend tests)

---

## Current State (read before coding)

| File | What matters |
|---|---|
| `backend/prisma/schema.prisma` | `CoopCriteria` already has `requiredCourses Json` and `coreCourses Json` — but they are **never checked against grades** |
| `backend/controllers/criteriaController.js` | `saveCriteria` does not handle `prepCourseCodes` or `electiveMinCount` |
| `backend/services/kkuRegService.js` | Has `getGradeSummary` (aggregate GPA only) — **no per-course grade list function** |
| `backend/routes/studentRoutes.js` | `POST /sync-from-reg` syncs name/GPA/advisor but **does not run course eligibility check** |
| `backend/controllers/studentController.js` | `syncKkuData` (legacy, likely dead code) has hardcoded `["CP002001","SC002001","CP123001"]`; `updateMyProfile` recalculates `isQualified` only from GPA/isPassPrepCourse (no course check) |
| `Frontend/src/components/A_CriteriaPage.tsx` | Course codes entered as comma-separated text — no KKU API search |

---

## File Map

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/controllers/criteriaController.js` |
| Modify | `backend/services/kkuRegService.js` |
| Modify | `backend/controllers/studentController.js` (add `syncFromReg` export) |
| Modify | `backend/routes/studentRoutes.js` (wire new controller export) |
| Modify | `backend/routes/adminRoutes.js` (add course search endpoint) |
| Modify | `Frontend/src/components/A_CriteriaPage.tsx` |
| Modify | `backend/__tests__/criteriaController.test.js` |

---

## Task 1: Schema — Add prepCourseCodes and electiveMinCount

**Files:**
- Modify: `backend/prisma/schema.prisma` (CoopCriteria model, ~line 189)

- [ ] **Step 1: Edit schema.prisma**

Find the `CoopCriteria` model and add two fields after `coreCourses`:

```prisma
model CoopCriteria {
  id              String   @id @default(uuid())
  major           String   @unique
  minGpa          Float    @default(2.00)
  minCoreGpa      Float    @default(2.00)
  minActivityUnit Int      @default(0)
  requiredCourses Json     // รายวิชาบังคับ ต้องผ่านทุกตัว
  coreCourses     Json     // หมวดวิชาบังคับเลือก
  prepCourseCodes Json     @default("[]") // วิชาเตรียมความพร้อม เช่น ["CP002001","SC002001"]
  electiveMinCount Int     @default(1)    // จำนวนวิชาบังคับเลือกขั้นต่ำ
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_criteria_prep_elective_count
```

Expected: `✔ Generated Prisma Client` and migration file created in `backend/prisma/migrations/`.

- [ ] **Step 3: Verify Prisma Client regenerated**

```bash
cd backend
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log(typeof p.coopCriteria.findMany)"
```

Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add prepCourseCodes and electiveMinCount to CoopCriteria"
```

---

## Task 2: criteriaController — Handle new fields

**Files:**
- Modify: `backend/controllers/criteriaController.js`
- Test: `backend/__tests__/criteriaController.test.js`

- [ ] **Step 1: Add failing test for saveCriteria with new fields**

In `backend/__tests__/criteriaController.test.js`, inside the `saveCriteria` describe block, add after the existing tests:

```js
test('200 – saves prepCourseCodes and electiveMinCount', async () => {
  const upserted = {
    id: '1', major: 'CS', minGpa: 2.5, minCoreGpa: 2.5, minActivityUnit: 60,
    requiredCourses: ['CP001001'],
    coreCourses: ['SC310001', 'SC310002'],
    prepCourseCodes: ['CP002001', 'SC002001'],
    electiveMinCount: 2,
  };
  prisma.coopCriteria.upsert.mockResolvedValue(upserted);

  const req = {
    body: {
      major: 'CS', minGpa: '2.5', minCoreGpa: '2.5', minActivityUnit: '60',
      requiredCourses: ['CP001001'],
      coreCourses: ['SC310001', 'SC310002'],
      prepCourseCodes: ['CP002001', 'SC002001'],
      electiveMinCount: '2',
    },
  };
  const res = makeRes();

  await saveCriteria(req, res);

  expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      update: expect.objectContaining({
        prepCourseCodes: ['CP002001', 'SC002001'],
        electiveMinCount: 2,
      }),
    })
  );
  expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: upserted });
});

test('200 – defaults prepCourseCodes to [] and electiveMinCount to 1 when not provided', async () => {
  prisma.coopCriteria.upsert.mockResolvedValue({ id: '2', major: 'IT' });

  const req = {
    body: { major: 'IT', minGpa: '2.0', minCoreGpa: '2.0', minActivityUnit: '60' },
  };
  const res = makeRes();

  await saveCriteria(req, res);

  expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      update: expect.objectContaining({
        prepCourseCodes: [],
        electiveMinCount: 1,
      }),
    })
  );
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=criteriaController
```

Expected: FAIL — `prepCourseCodes` and `electiveMinCount` not in upsert call.

- [ ] **Step 3: Update criteriaController.js — saveCriteria**

Replace the entire `saveCriteria` export:

```js
exports.saveCriteria = async (req, res) => {
  try {
    const {
      major, minGpa, minCoreGpa, minActivityUnit,
      requiredCourses, coreCourses,
      prepCourseCodes, electiveMinCount
    } = req.body;

    const criteria = await prisma.coopCriteria.upsert({
      where: { major },
      update: {
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses || [],
        coreCourses: coreCourses || [],
        prepCourseCodes: prepCourseCodes || [],
        electiveMinCount: parseInt(electiveMinCount) || 1,
      },
      create: {
        major,
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses || [],
        coreCourses: coreCourses || [],
        prepCourseCodes: prepCourseCodes || [],
        electiveMinCount: parseInt(electiveMinCount) || 1,
      },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};
```

Also update `getCriteria` default response (around line 36) to include new fields:

```js
return res.json({
  major,
  minGpa: 2.00,
  minCoreGpa: 2.00,
  minActivityUnit: 60,
  requiredCourses: [],
  coreCourses: [],
  prepCourseCodes: [],
  electiveMinCount: 1,
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=criteriaController
```

Expected: All tests pass including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/criteriaController.js backend/__tests__/criteriaController.test.js
git commit -m "feat: criteriaController handles prepCourseCodes and electiveMinCount"
```

---

## Task 3: kkuRegService — Add getGradeList and searchCourses

**Files:**
- Modify: `backend/services/kkuRegService.js`

> **KKU API endpoint note:** `student/enroll_list` (no year/semester params) is assumed to return full grade history. If not, try `student/grade_list`. Confirm with KKU REG API docs at `reg2.kku.ac.th`. For `searchCourses`, the endpoint `course/search?keyword=<q>` is assumed. If either endpoint 404s, the functions return `null`/`[]` and the feature gracefully degrades.

- [ ] **Step 1: Add getGradeList to kkuRegService.js**

After the `getCreditCondition` function (around line 132), add:

```js
// ──────────────────────────────────────────
// 8. ดึงประวัติเกรดทุกวิชา (ใช้ตรวจ requiredCourses / coreCourses)
//    NOTE: ยืนยัน endpoint กับ KKU REG API docs ก่อน deploy
//    ลองใช้ student/enroll_list (ไม่มี year/sem = ทุก semester)
// ──────────────────────────────────────────
async function getGradeList(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/enroll_list`, {
      headers: { "x-access-token": accessToken },
      timeout: 12000,
    });
    // คืน array ของ { course_code, grade, course_name, ... }
    return (
      res.data?.data?.enroll_list ||
      res.data?.enroll_list ||
      res.data?.data ||
      null
    );
  } catch (err) {
    console.error("[KKU REG] getGradeList error:", err.response?.status, err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 9. ค้นหาวิชาจาก KKU course catalog (สำหรับ Admin เลือกวิชาในเกณฑ์)
//    NOTE: ยืนยัน endpoint กับ KKU REG API docs ก่อน deploy
// ──────────────────────────────────────────
async function searchCourses(query) {
  if (!query || query.length < 2) return [];
  if (!isConfigured()) return [];
  try {
    // ลอง client-credentials token ก่อน (ไม่ต้องใช้ user account)
    const tokenRes = await axios.post(
      `${BASE_URL}/auth/token`,
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" },
      { timeout: 8000 }
    );
    const serviceToken = tokenRes.data?.access_token || null;

    const res = await axios.get(`${BASE_URL}/course/search`, {
      params: { keyword: query },
      headers: serviceToken ? { "x-access-token": serviceToken } : {},
      timeout: 8000,
    });
    return res.data?.data || res.data?.courses || res.data || [];
  } catch (err) {
    console.error("[KKU REG] searchCourses error:", err.response?.status, err.message);
    return [];
  }
}
```

- [ ] **Step 2: Export new functions**

Update the `module.exports` at the bottom of `kkuRegService.js`:

```js
module.exports = {
  isConfigured,
  getStudentToken,
  getStudentInfo,
  getGradeSummary,
  getAdvisor,
  getStudentImage,
  getCreditCondition,
  getCurrentSemester,
  syncStudentAll,
  getGradeList,    // NEW
  searchCourses,   // NEW
};
```

- [ ] **Step 3: Update existing test mocks**

In `backend/__tests__/routes/student.routes.test.js` and `backend/__tests__/routes/auth.routes.test.js`, add the new functions to the existing `jest.mock('../../services/kkuRegService', ...)` calls:

```js
jest.mock('../../services/kkuRegService', () => ({
  isConfigured: jest.fn().mockReturnValue(false),
  authenticate: jest.fn(),
  getStudentToken: jest.fn(),
  getStudentInfo: jest.fn(),
  getAdvisor: jest.fn(),
  syncStudentAll: jest.fn(),
  getCurrentSemester: jest.fn(),
  getGradeList: jest.fn(),    // ADD THIS
  searchCourses: jest.fn(),   // ADD THIS
}));
```

- [ ] **Step 4: Run all tests — expect no regressions**

```bash
cd backend && npm test
```

Expected: All existing tests pass (154 total).

- [ ] **Step 5: Commit**

```bash
git add backend/services/kkuRegService.js backend/__tests__/routes/student.routes.test.js backend/__tests__/routes/auth.routes.test.js
git commit -m "feat: kkuRegService adds getGradeList and searchCourses"
```

---

## Task 4: Move sync logic to studentController + add course eligibility check

**Files:**
- Modify: `backend/controllers/studentController.js` (add `syncFromReg` and `checkEligibility` helper)
- Modify: `backend/routes/studentRoutes.js` (wire new export, replace inline handler)
- Test: `backend/__tests__/studentController.test.js`

> **Design note:** The `POST /sync-from-reg` route currently has its logic inline in `studentRoutes.js`. We move it to `studentController.js` as `exports.syncFromReg` so it's testable. The eligibility check helper `checkEligibility(gradeList, criteria)` is a pure function — add it at the top of studentController.js.

- [ ] **Step 1: Add failing tests**

Add to `backend/__tests__/studentController.test.js` (after the existing `getMyProfile` describe block):

```js
// =====================
// checkEligibility helper (exported for testing)
// =====================
const { checkEligibility } = require('../controllers/studentController');

describe('checkEligibility', () => {
  const criteria = {
    prepCourseCodes: ['CP002001', 'SC002001'],
    requiredCourses: ['CP001001', 'CP001002'],
    coreCourses: ['SC310001', 'SC310002', 'SC310003'],
    electiveMinCount: 2,
  };

  const gradeList = [
    { course_code: 'CP002001', grade: 'S' },   // prep ✓
    { course_code: 'CP001001', grade: 'A' },   // required ✓
    { course_code: 'CP001002', grade: 'B+' },  // required ✓
    { course_code: 'SC310001', grade: 'B' },   // elective ✓
    { course_code: 'SC310002', grade: 'C' },   // elective ✓
  ];

  test('qualified — all criteria met', () => {
    const result = checkEligibility(gradeList, criteria);
    expect(result.isPassPrepCourse).toBe(true);
    expect(result.passedAllRequired).toBe(true);
    expect(result.passedElectiveCount).toBe(2);
    expect(result.isQualified).toBe(true);
  });

  test('not qualified — missing one required course', () => {
    const partialGrades = gradeList.filter(g => g.course_code !== 'CP001002');
    const result = checkEligibility(partialGrades, criteria);
    expect(result.passedAllRequired).toBe(false);
    expect(result.isQualified).toBe(false);
  });

  test('not qualified — prep course not passed', () => {
    const noPrepGrades = gradeList.filter(g => g.course_code !== 'CP002001');
    const result = checkEligibility(noPrepGrades, criteria);
    expect(result.isPassPrepCourse).toBe(false);
    expect(result.isQualified).toBe(false);
  });

  test('not qualified — only 1 elective passed (needs 2)', () => {
    const oneElective = gradeList.filter(g => g.course_code !== 'SC310002');
    const result = checkEligibility(oneElective, criteria);
    expect(result.passedElectiveCount).toBe(1);
    expect(result.isQualified).toBe(false);
  });

  test('qualified — no required courses configured (empty array)', () => {
    const emptyCriteria = { ...criteria, requiredCourses: [] };
    const result = checkEligibility(gradeList, emptyCriteria);
    expect(result.passedAllRequired).toBe(true);
  });

  test('qualified — no elective courses configured (empty array)', () => {
    const emptyCriteria = { ...criteria, coreCourses: [] };
    const result = checkEligibility(gradeList, emptyCriteria);
    expect(result.isQualified).toBe(true);
  });

  test('null gradeList returns all false', () => {
    const result = checkEligibility(null, criteria);
    expect(result.isPassPrepCourse).toBe(false);
    expect(result.isQualified).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd backend && npm test -- --testPathPattern=studentController
```

Expected: FAIL — `checkEligibility` not exported.

- [ ] **Step 3: Add checkEligibility and syncFromReg to studentController.js**

Add this helper near the **top** of `studentController.js` (after the `const prisma = ...` line):

```js
const kkuReg = require('../services/kkuRegService');
const PASSING_GRADES = new Set(["S", "A", "B+", "B", "C+", "C", "D+", "D"]);

/**
 * ตรวจสอบว่านักศึกษาผ่านเงื่อนไขสหกิจหรือไม่
 * @param {Array|null} gradeList - array ของ { course_code, grade } จาก KKU API
 * @param {Object} criteria - CoopCriteria record จาก DB
 * @returns {{ isPassPrepCourse, passedAllRequired, passedElectiveCount, isQualified }}
 */
function checkEligibility(gradeList, criteria) {
  if (!gradeList || !criteria) {
    return { isPassPrepCourse: false, passedAllRequired: false, passedElectiveCount: 0, isQualified: false };
  }

  const passedCodes = new Set(
    gradeList.filter(c => PASSING_GRADES.has(c.grade)).map(c => c.course_code)
  );

  // 1. วิชาเตรียมความพร้อม (ผ่านอย่างน้อย 1 วิชาจากรายการ)
  const prepCodes = criteria.prepCourseCodes || [];
  const isPassPrepCourse = prepCodes.length === 0 || prepCodes.some(code => passedCodes.has(code));

  // 2. วิชาบังคับ (ต้องผ่านทุกตัว)
  const requiredCourses = criteria.requiredCourses || [];
  const passedAllRequired = requiredCourses.length === 0 ||
    requiredCourses.every(code => passedCodes.has(code));

  // 3. หมวดวิชาบังคับเลือก (ผ่านอย่างน้อย electiveMinCount)
  const coreCourses = criteria.coreCourses || [];
  const electiveMinCount = criteria.electiveMinCount ?? 1;
  const passedElectiveCount = coreCourses.filter(code => passedCodes.has(code)).length;
  const passedElective = coreCourses.length === 0 || passedElectiveCount >= electiveMinCount;

  const isQualified = isPassPrepCourse && passedAllRequired && passedElective;

  return { isPassPrepCourse, passedAllRequired, passedElectiveCount, isQualified };
}

exports.checkEligibility = checkEligibility;
```

Then add `syncFromReg` at the **bottom** of `studentController.js` (before the final empty line):

```js
// POST /api/students/sync-from-reg
exports.syncFromReg = async (req, res) => {
  const { kkuUsername, kkuPassword } = req.body;

  if (!kkuUsername || !kkuPassword) {
    return res.status(400).json({ ok: false, message: "กรุณาระบุ KKU Username และ Password" });
  }

  if (!kkuReg.isConfigured()) {
    return res.status(503).json({
      ok: false,
      message: "ฟีเจอร์นี้ยังไม่พร้อมใช้ — รอการตั้งค่า API credentials จาก KKU",
    });
  }

  try {
    const student = await prisma.student.findUnique({ where: { userId: req.userId } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });

    // 1. ดึงข้อมูลพื้นฐาน + grade summary พร้อมกัน
    const result = await kkuReg.syncStudentAll(kkuUsername, kkuPassword);
    if (!result.ok) return res.status(401).json(result);

    const updateData = {};

    if (result.info) {
      const info = result.info;
      if (info.first_name_th)   updateData.firstName   = info.first_name_th;
      if (info.last_name_th)    updateData.lastName    = info.last_name_th;
      if (info.first_name_en)   updateData.firstNameEn = info.first_name_en;
      if (info.last_name_en)    updateData.lastNameEn  = info.last_name_en;
      if (info.faculty_name_th) updateData.curriculum  = info.faculty_name_th;
      if (info.major_name_th)   updateData.major       = info.major_name_th;
      if (info.class_year)      updateData.year        = String(info.class_year);
      if (info.prefix_th)       updateData.prefix      = info.prefix_th;
      if (info.activity_credit != null) updateData.activityUnit = parseFloat(info.activity_credit) || 0;
    }

    if (result.grades) {
      const g = result.grades;
      if (g.gpax != null)      updateData.gpa     = parseFloat(g.gpax) || 0;
      if (g.gpax_core != null) updateData.coreGpa = parseFloat(g.gpax_core) || 0;
    }

    if (result.advisor) {
      const adv = result.advisor;
      const name = [adv.prefix_th, adv.first_name_th, adv.last_name_th].filter(Boolean).join(" ");
      if (name) updateData.advisorName = name;
    }

    // 2. ดึงประวัติเกรดทุกวิชา (ใช้ตรวจเงื่อนไขรายวิชา)
    //    syncStudentAll ไม่ได้ดึงให้ ต้องดึงเพิ่ม — ต้องมี token จาก login ก่อน
    const kkuToken = await kkuReg.getStudentToken(kkuUsername, kkuPassword);
    const gradeList = (kkuToken && !kkuToken.error)
      ? await kkuReg.getGradeList(kkuToken)
      : null;

    // 3. โหลด CoopCriteria ของสาขานักศึกษา
    const major = updateData.major || student.major;
    const criteria = major
      ? await prisma.coopCriteria.findUnique({ where: { major } })
      : null;

    // 4. ตรวจสอบเงื่อนไขรายวิชา
    if (gradeList && criteria) {
      const eligibility = checkEligibility(gradeList, criteria);
      updateData.isPassPrepCourse = eligibility.isPassPrepCourse;
      updateData.isQualified = eligibility.isQualified;
    }

    updateData.apiSyncedAt = new Date();

    if (Object.keys(updateData).length > 0) {
      await prisma.student.update({ where: { id: student.id }, data: updateData });
    }

    res.json({
      ok: true,
      message: `ซิงค์ข้อมูลจาก KKU สำเร็จ (อัปเดต ${Object.keys(updateData).length} ฟิลด์)`,
      updated: Object.keys(updateData),
      image: result.image || null,
    });
  } catch (err) {
    console.error("[syncFromReg]", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};
```

- [ ] **Step 4: Wire new export in studentRoutes.js**

In `backend/routes/studentRoutes.js`, replace the inline `router.post('/sync-from-reg', ...)` handler (lines 51–126) with:

```js
// POST /api/students/sync-from-reg — sync ข้อมูลทั้งหมด + ตรวจสอบเงื่อนไขรายวิชาจาก KKU REG
router.post('/sync-from-reg', verifyToken, studentController.syncFromReg);
```

Remove the old inline `if (!kkuUsername || !kkuPassword)... try { ... } catch` block entirely. The kkuReg `require` at line 38 can also be removed from studentRoutes.js since it's now only used in studentController.js (check no other usage first — the `reg-status` and `reg-semester` routes still use it, so keep the require).

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=studentController
```

Expected: All `checkEligibility` tests pass. Run full suite: `npm test` → all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/studentController.js backend/routes/studentRoutes.js
git commit -m "feat: syncFromReg checks course eligibility against CoopCriteria"
```

---

## Task 5: Admin course search proxy endpoint

**Files:**
- Modify: `backend/routes/adminRoutes.js`

- [ ] **Step 1: Add the route**

In `backend/routes/adminRoutes.js`, after the existing criteria routes (around line 55), add:

```js
const kkuReg = require('../services/kkuRegService');

// GET /api/admin/courses/search?q=<text> — ค้นหาวิชาจาก KKU course catalog สำหรับ admin เลือกใส่เกณฑ์
router.get('/courses/search', verifyToken, verifyRole(...ADMIN_ROLES), async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ ok: true, courses: [] });

  if (!kkuReg.isConfigured()) {
    return res.json({ ok: false, courses: [], message: "KKU REG API ยังไม่ได้ตั้งค่า — กรอกรหัสวิชาด้วยตนเอง" });
  }

  try {
    const courses = await kkuReg.searchCourses(q);
    res.json({ ok: true, courses });
  } catch (err) {
    console.error("[admin course search]", err);
    res.json({ ok: false, courses: [], message: "ค้นหาไม่สำเร็จ" });
  }
});
```

> **Note:** If `kkuReg` is already required elsewhere in `adminRoutes.js`, skip the duplicate `require`. Check the top of the file first.

- [ ] **Step 2: Run all tests to check no regression**

```bash
cd backend && npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/adminRoutes.js
git commit -m "feat: admin course search proxy endpoint for KKU course catalog"
```

---

## Task 6: Frontend — Update A_CriteriaPage with tag-based course picker

**Files:**
- Modify: `Frontend/src/components/A_CriteriaPage.tsx`

> **Design:** Add a `CourseTagInput` component (inline, local to the file) that shows an input with debounced search. Calls `GET /api/admin/courses/search?q=...`. If API not configured or search fails, degrades to manual code entry (Enter key to add). Renders each added code as a removable tag.

- [ ] **Step 1: Update the `Criteria` type at the top of A_CriteriaPage.tsx**

Replace the existing type:

```ts
type Criteria = {
  id: string;
  major: string;
  minGpa: number;
  minCoreGpa: number;
  minActivityUnit: number;
  requiredCourses: string[];
  coreCourses: string[];
  prepCourseCodes: string[];
  electiveMinCount: number;
};
```

- [ ] **Step 2: Add imports and CourseTagInput component**

Add `useCallback, useRef` to the React import line:
```ts
import React, { useState, useEffect, useCallback, useRef } from "react";
```

Add this `CourseTagInput` component just **above** the `export default function A_CriteriaPage()` line:

```tsx
type CourseOption = { course_code: string; course_name?: string };

function CourseTagInput({
  label,
  codes,
  onChange,
}: {
  label: string;
  codes: string[];
  onChange: (codes: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const token = localStorage.getItem("coop.token");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    try {
      const res = await axios.get(`/api/admin/courses/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok && res.data.courses.length > 0) {
        setResults(res.data.courses);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    } catch {
      setResults([]);
    }
  }, [token]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const addCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed && !codes.includes(trimmed)) {
      onChange([...codes, trimmed]);
    }
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  };

  const removeCode = (code: string) => onChange(codes.filter(c => c !== code));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 38, padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
        {codes.map(code => (
          <span key={code} style={{ background: "#e0f2fe", color: "#0369a1", fontSize: 13, fontWeight: 700, padding: "3px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
            {code}
            <button type="button" onClick={() => removeCode(code)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0369a1", fontWeight: 900, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          placeholder="พิมพ์รหัสวิชา หรือกด Enter เพื่อเพิ่ม"
          value={query}
          onChange={handleInput}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCode(query); } }}
          autoComplete="off"
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        {showDropdown && results.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 8px 16px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
            {results.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addCode(c.course_code)}
                style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <b>{c.course_code}</b>{c.course_name ? ` — ${c.course_name}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: "#94a3b8" }}>* พิมพ์แล้วกด Enter เพื่อเพิ่ม หรือเลือกจากรายการ (ถ้า KKU API พร้อมใช้)</span>
    </div>
  );
}
```

- [ ] **Step 3: Update the edit-criteria modal state**

Inside `A_CriteriaPage`, replace/update these state declarations:

```ts
// เดิม:
const [reqCourses, setReqCourses] = useState("");
const [coreCourses, setCoreCourses] = useState("");

// ใหม่:
const [reqCourses, setReqCourses] = useState<string[]>([]);
const [coreCourses, setCoreCourses] = useState<string[]>([]);
const [prepCourseCodes, setPrepCourseCodes] = useState<string[]>([]);
const [electiveMinCount, setElectiveMinCount] = useState("1");
```

- [ ] **Step 4: Update openEditCriteriaModal to populate new state**

Replace `openEditCriteriaModal`:

```ts
const openEditCriteriaModal = (c: Criteria) => {
  setEditingMajor(c.major);
  setMinGpa(c.minGpa.toString());
  setMinCoreGpa(c.minCoreGpa.toString());
  setMinActivityUnit(c.minActivityUnit.toString());
  setReqCourses(c.requiredCourses || []);
  setCoreCourses(c.coreCourses || []);
  setPrepCourseCodes(c.prepCourseCodes || []);
  setElectiveMinCount((c.electiveMinCount ?? 1).toString());
  setEditCriteriaModalOpen(true);
};
```

- [ ] **Step 5: Update handleSaveCriteria**

Replace `handleSaveCriteria`:

```ts
const handleSaveCriteria = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await axios.post("/api/admin/criteria", {
      major: editingMajor,
      minGpa: parseFloat(minGpa),
      minCoreGpa: parseFloat(minCoreGpa),
      minActivityUnit: parseInt(minActivityUnit),
      requiredCourses: reqCourses,
      coreCourses: coreCourses,
      prepCourseCodes: prepCourseCodes,
      electiveMinCount: parseInt(electiveMinCount) || 1,
    }, { headers: { Authorization: `Bearer ${localStorage.getItem("coop.token")}` } });
    setEditCriteriaModalOpen(false);
    fetchCriteria();
  } catch (err: any) { alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกเกณฑ์"); }
};
```

- [ ] **Step 6: Update the criteria editor modal JSX**

Replace the two `<div style={field}>` blocks for `reqCourses` and `coreCourses` with:

```tsx
{/* วิชาเตรียมความพร้อม */}
<div style={field}>
  <CourseTagInput
    label="📋 รหัสวิชาเตรียมความพร้อมสหกิจ (ผ่านอย่างน้อย 1 วิชา)"
    codes={prepCourseCodes}
    onChange={setPrepCourseCodes}
  />
  <span style={{ fontSize: 12, color: "#94a3b8" }}>เช่น CP002001, SC002001 — ผ่านวิชาใดวิชาหนึ่งก็นับว่าผ่าน</span>
</div>

{/* วิชาบังคับ */}
<div style={field}>
  <CourseTagInput
    label="📚 รหัสวิชาบังคับ (ต้องผ่านทุกตัว)"
    codes={reqCourses}
    onChange={setReqCourses}
  />
</div>

{/* วิชาบังคับเลือก */}
<div style={field}>
  <CourseTagInput
    label="🎯 รหัสหมวดวิชาบังคับเลือก"
    codes={coreCourses}
    onChange={setCoreCourses}
  />
  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>ต้องผ่านอย่างน้อย</span>
    <input
      type="number"
      min="0"
      className="input"
      value={electiveMinCount}
      onChange={e => setElectiveMinCount(e.target.value)}
      style={{ width: 80 }}
    />
    <span style={{ fontSize: 13, color: "#64748b" }}>วิชา</span>
  </div>
</div>
```

- [ ] **Step 7: Update the criteria display card**

In the major card body, replace the two "วิชาบังคับ" and "หมวดวิชาบังคับเลือก" sections with an updated version that also shows prepCourseCodes and electiveMinCount:

```tsx
{/* วิชาเตรียมความพร้อม */}
<div style={{ marginBottom: 12 }}>
  <div style={statLabel}>📋 วิชาเตรียมความพร้อม (ผ่านอย่างน้อย 1)</div>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
    {(c.prepCourseCodes || []).length
      ? (c.prepCourseCodes || []).map(rc => <span key={rc} style={badgePrep}>{rc}</span>)
      : <span style={emptyText}>ไม่มีกำหนด</span>}
  </div>
</div>

{/* วิชาบังคับ */}
<div style={{ marginBottom: 12 }}>
  <div style={statLabel}>📚 รายวิชาบังคับ (ต้องผ่านทุกตัว)</div>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
    {c.requiredCourses.length ? c.requiredCourses.map(rc => <span key={rc} style={badgeObj}>{rc}</span>) : <span style={emptyText}>ไม่มีกำหนด</span>}
  </div>
</div>

{/* วิชาบังคับเลือก */}
<div style={{ marginBottom: 20 }}>
  <div style={statLabel}>🎯 หมวดวิชาบังคับเลือก (ผ่านอย่างน้อย {c.electiveMinCount ?? 1} วิชา)</div>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
    {c.coreCourses.length ? c.coreCourses.map(cc => <span key={cc} style={badgeCore}>{cc}</span>) : <span style={emptyText}>ไม่มีกำหนด</span>}
  </div>
</div>
```

Also add `badgePrep` to the style constants at the bottom of the file:
```ts
const badgePrep: CSSProperties = { background: '#f0fdf4', color: '#15803d', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid #86efac' };
```

- [ ] **Step 8: TypeScript compile check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add Frontend/src/components/A_CriteriaPage.tsx
git commit -m "feat: criteria editor uses tag-based course picker with KKU API search"
```

---

## Task 7: Final tests and CHANGELOG

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: All tests pass (should now be 154+ including the new `checkEligibility` tests).

- [ ] **Step 2: Run frontend type check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at the top of `CHANGELOG.md`:

```markdown
## [2026-05-29] Co-op Criteria Grade Verification

### Added
- `CoopCriteria` schema: `prepCourseCodes` (JSON) — รหัสวิชาเตรียมความพร้อมที่เจ้าหน้าที่กำหนดได้ (แทนที่ hardcode)
- `CoopCriteria` schema: `electiveMinCount` (Int, default 1) — จำนวนวิชาบังคับเลือกขั้นต่ำที่ต้องผ่าน
- `studentController.checkEligibility()` — pure function ตรวจสอบ prepCourse / requiredCourses / coreCourses กับ grade list จาก KKU API
- `studentController.syncFromReg` export — ย้าย sync logic ออกจาก inline route handler เพื่อ testability
- `kkuRegService.getGradeList()` — ดึงประวัติเกรดทุกวิชา (full transcript) จาก KKU REG API
- `kkuRegService.searchCourses()` — ค้นหาวิชาจาก KKU course catalog (ใช้ service account)
- `GET /api/admin/courses/search?q=<text>` — proxy endpoint สำหรับ admin ค้นหารหัสวิชา
- `A_CriteriaPage.tsx`: เพิ่ม tag-based course picker พร้อม KKU API search สำหรับทุก course criteria field

### Changed
- `POST /api/students/sync-from-reg`: ตอนนี้ตรวจสอบ `prepCourseCodes`, `requiredCourses`, `coreCourses` กับ KKU grade data และอัปเดต `isPassPrepCourse` + `isQualified`
- `criteriaController.saveCriteria`: รับและบันทึก `prepCourseCodes`, `electiveMinCount`
- `A_CriteriaPage.tsx`: แสดง `prepCourseCodes` และ `electiveMinCount` ในการ์ด + modal แก้ไข
```

- [ ] **Step 4: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for criteria grade verification feature"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] ผ่านรายวิชาเตรียมความพร้อม (CP002001/SC002001) — configurable via `prepCourseCodes` in DB (Task 1, 2)
- [x] หน่วยกิต เจ้าหน้าที่แก้ได้ — already existed as `minActivityUnit`, UI already editable. No change needed.
- [x] รหัสวิชาบังคับ (ต้องผ่านทุกตัว) — `requiredCourses` now actually checked in `checkEligibility` (Task 4)
- [x] รหัสหมวดวิชาบังคับเลือก (เลือกเรียนบางตัว) — `coreCourses` + `electiveMinCount` now checked (Task 1, 2, 4)
- [x] เลือกจาก KKU API — `CourseTagInput` + course search proxy (Task 5, 6)
- [x] เจ้าหน้าที่แก้ได้ — Admin criteria editor updated (Task 6)

**Known assumptions (need confirmation before deploy):**
1. `GET /student/enroll_list` (no year/sem params) returns full grade history — confirm with KKU REG API docs
2. `GET /course/search?keyword=...` is a valid KKU REG API endpoint — confirm with KKU REG API docs
3. `POST /auth/token` with client_credentials grant exists in KKU REG API — confirm with KKU REG API docs. If not, `searchCourses` will always return `[]` (graceful degradation)
