# Criteria Simplification + Drop Curriculum Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the admin criteria page to a plain major list (no GPA/course eligibility calculation), and remove the `Student.curriculum` field entirely since every student belongs to the same faculty.

**Architecture:** Backend controllers/routes lose the eligibility-calculation and curriculum-field code first (DB columns still exist, so nothing breaks mid-way); frontend components lose the corresponding UI; the Prisma migration that actually drops the now-unused columns runs last, once nothing references them.

**Tech Stack:** Express + Prisma + MySQL backend, React + TypeScript frontend, Jest tests.

## Global Constraints

- No new dependencies.
- Spec: `docs/superpowers/specs/2026-06-22-criteria-simplification-design.md` (already approved).
- Do not touch `Student.major`, `Student.studyProgram`, or `A_Students.tsx`'s `CURRICULUM_TH` constant (that constant is keyed by `studyProgram`, unrelated despite the name).
- Do not touch `backend/services/kkuRegService.js`'s `searchCourses` function itself — only remove the route that calls it.
- Migration drops columns outright (no real users yet, confirmed with user) — no data-preservation step needed.
- Each task ends with running the relevant test command and a commit.

---

### Task 1: Simplify criteria backend (controller + route)

**Files:**
- Modify: `backend/controllers/criteriaController.js` (replace entire file)
- Modify: `backend/routes/criteriaRoutes.js:7-9`
- Modify: `backend/routes/adminRoutes.js:19` (remove unused import), `backend/routes/adminRoutes.js:95-111` (remove route)
- Test: `backend/__tests__/criteriaController.test.js`

**Interfaces:**
- Produces: `criteriaController.getAllCriteria`, `saveCriteria`, `deleteCriteria`, `getMajorList` (same names as before; `getCriteria` removed — confirmed unused by any frontend file).

- [ ] **Step 1: Replace `backend/controllers/criteriaController.js` entirely**

```js
const prisma = require('../config/prismaClient');

// ==================================================
// 1. ดึงข้อมูล "ทุกสาขา" สำหรับหน้า Admin (A_CriteriaPage)
// ==================================================
exports.getAllCriteria = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      orderBy: { major: 'asc' }
    });
    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ==================================================
// 2. สร้างสาขาใหม่ (major เป็น key — upsert กันสร้างซ้ำ)
// ==================================================
exports.saveCriteria = async (req, res) => {
  try {
    const { major } = req.body;
    if (!major) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อสาขา" });

    const criteria = await prisma.coopCriteria.upsert({
      where: { major },
      update: {},
      create: { major },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// ==================================================
// 3. ลบสาขา (สำหรับหน้า Admin)
// ==================================================
exports.deleteCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.coopCriteria.delete({
      where: { id: id }
    });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Delete failed" });
  }
};

exports.getMajorList = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      select: { major: true },
      orderBy: { major: 'asc' }
    });

    const majorList = criteria.map(c => c.major);

    res.json({ ok: true, majors: majorList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
```

- [ ] **Step 2: Remove the now-dead `/criteria/single` route**

In `backend/routes/criteriaRoutes.js`, change:

```js
router.get('/criteria', criteriaController.getAllCriteria);

// ดึงแยกตามสาขา (ของเดิมคุณที่ใช้ query string ?major=CS)
router.get('/criteria/single', criteriaController.getCriteria);

// สร้างใหม่ หรือ อัปเดต (ใช้ Controller แบบ Upsert ตัวเดียวกันได้เลย)
router.post('/criteria', criteriaController.saveCriteria);
```

to:

```js
router.get('/criteria', criteriaController.getAllCriteria);

// สร้างใหม่ หรือ อัปเดต (ใช้ Controller แบบ Upsert ตัวเดียวกันได้เลย)
router.post('/criteria', criteriaController.saveCriteria);
```

- [ ] **Step 3: Remove the `/api/admin/courses/search` route and its now-unused import**

In `backend/routes/adminRoutes.js`, remove this block entirely:

```js
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

Then remove the now-unused import line:

```js
const kkuReg = require('../services/kkuRegService');
```

- [ ] **Step 4: Rewrite `backend/__tests__/criteriaController.test.js`**

Change the import block from:

```js
const {
  getAllCriteria,
  getCriteria,
  saveCriteria,
  deleteCriteria,
  getMajorList,
} = require('../controllers/criteriaController');
```

to:

```js
const {
  getAllCriteria,
  saveCriteria,
  deleteCriteria,
  getMajorList,
} = require('../controllers/criteriaController');
```

Remove the entire `describe('getCriteria', ...)` block (originally lines 61-131, between the `getAllCriteria` and `saveCriteria` blocks).

Replace the entire `describe('saveCriteria', ...)` block with:

```js
describe('saveCriteria', () => {
  test('200 – creates major and returns { ok: true, criteria }', async () => {
    const upserted = { id: '1', major: 'CS' };
    prisma.coopCriteria.upsert.mockResolvedValue(upserted);

    const req = { body: { major: 'CS' } };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith({
      where: { major: 'CS' },
      update: {},
      create: { major: 'CS' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: upserted });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('400 – missing major', async () => {
    const req = { body: {} };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopCriteria.upsert).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.coopCriteria.upsert.mockRejectedValue(new Error('DB fail'));

    const req = { body: { major: 'CS' } };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Save failed' });
  });
});
```

Leave `getAllCriteria`, `deleteCriteria`, and `getMajorList` describe blocks untouched.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest __tests__/criteriaController.test.js -v`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/criteriaController.js backend/routes/criteriaRoutes.js backend/routes/adminRoutes.js backend/__tests__/criteriaController.test.js
git commit -m "refactor: simplify criteria to plain major list, drop course-search endpoint"
```

---

### Task 2: Remove eligibility calculation from studentController.js

**Files:**
- Modify: `backend/controllers/studentController.js:1-56` (remove `checkEligibility` + constants), `backend/controllers/studentController.js` `syncFromReg` function (remove curriculum line + eligibility block)
- Test: `backend/__tests__/studentController.test.js`

**Interfaces:**
- Produces: `studentController.syncFromReg` keeps its existing signature/response shape; `checkEligibility` export removed entirely (no other file imports it besides this test file).

- [ ] **Step 1: Remove `checkEligibility` and its constants from the top of the file**

Change:

```js
// backend/controllers/studentController.js
const prisma = require('../config/prismaClient');
const kkuReg = require('../services/kkuRegService');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

const PASSING_GRADES = new Set(["S", "A", "B+", "B", "C+", "C", "D+", "D"]);
const GRADE_POINTS = { "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0, "E": 0.0 };

function checkEligibility(gradeList, criteria) {
  if (!gradeList || !criteria) {
    return { isPassPrepCourse: false, passedAllRequired: false, passedElectiveCount: 0, calculatedCoreGpa: 0, isQualified: false };
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

  // 4. คำนวณ coreGpa แบบ weighted average จาก coreCourses ที่กำหนด
  //    S/U/W ไม่อยู่ใน GRADE_POINTS → ไม่นับในสูตร GPA (แต่นับว่าผ่านใน passedCodes)
  let totalPoints = 0, totalCredits = 0;
  for (const entry of gradeList) {
    if (!coreCourses.includes(entry.course_code)) continue;
    const pts = GRADE_POINTS[entry.grade];
    if (pts !== undefined) {
      const credit = entry.creditattempt || 0;
      totalPoints += pts * credit;
      totalCredits += credit;
    }
  }
  const calculatedCoreGpa = totalCredits > 0
    ? Math.round((totalPoints / totalCredits) * 100) / 100
    : 0;

  const isQualified = isPassPrepCourse && passedAllRequired && passedElective;

  return { isPassPrepCourse, passedAllRequired, passedElectiveCount, calculatedCoreGpa, isQualified };
}

exports.checkEligibility = checkEligibility;

// GET /api/students/me
```

to:

```js
// backend/controllers/studentController.js
const prisma = require('../config/prismaClient');
const kkuReg = require('../services/kkuRegService');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

// GET /api/students/me
```

- [ ] **Step 2: Remove the curriculum line and the eligibility block inside `syncFromReg`**

Change:

```js
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
      // คืนแค่ gpax รวม — ไม่มี gpax_core ใน KKU API (คำนวณเองจาก coreCourses)
      if (g.gpax != null) updateData.gpa = parseFloat(g.gpax) || 0;
    }

    if (result.advisor) {
      const adv = result.advisor;
      const name = [adv.prefix_th, adv.first_name_th, adv.last_name_th].filter(Boolean).join(" ");
      if (name) updateData.advisorName = name;
    }

    // 2. ดึงประวัติเกรดทุกวิชา (reuse token จาก syncStudentAll — ไม่ต้อง login ซ้ำ)
    const gradeList = result._token
      ? await kkuReg.getGradeList(result._token, result.grades)
      : null;

    // 3. โหลด CoopCriteria ของสาขานักศึกษา
    const major = updateData.major || student.major;
    const criteria = major
      ? await prisma.coopCriteria.findUnique({ where: { major } })
      : null;

    // 4. ตรวจสอบเงื่อนไขรายวิชา + คำนวณ coreGpa
    if (gradeList && criteria) {
      const eligibility = checkEligibility(gradeList, criteria);
      updateData.isPassPrepCourse = eligibility.isPassPrepCourse;

      // coreGpa คำนวณจาก coreCourses ที่กำหนด (แทน gpax_core ที่ไม่มีใน API)
      if (eligibility.calculatedCoreGpa > 0) {
        updateData.coreGpa = eligibility.calculatedCoreGpa;
      }

      // isQualified = ผ่านทุกเงื่อนไข: วิชา + GPA + coreGpa + กิจกรรม
      const currentGpa = updateData.gpa ?? student.gpa ?? 0;
      const currentCoreGpa = updateData.coreGpa ?? student.coreGpa ?? 0;
      const currentActivityUnit = updateData.activityUnit ?? student.activityUnit ?? 0;

      updateData.isQualified =
        eligibility.isQualified &&
        currentGpa >= (criteria.minGpa || 0) &&
        currentCoreGpa >= (criteria.minCoreGpa || 0) &&
        currentActivityUnit >= (criteria.minActivityUnit || 0);
    }

    updateData.apiSyncedAt = new Date();
```

to:

```js
      if (info.first_name_th)   updateData.firstName   = info.first_name_th;
      if (info.last_name_th)    updateData.lastName    = info.last_name_th;
      if (info.first_name_en)   updateData.firstNameEn = info.first_name_en;
      if (info.last_name_en)    updateData.lastNameEn  = info.last_name_en;
      if (info.major_name_th)   updateData.major       = info.major_name_th;
      if (info.class_year)      updateData.year        = String(info.class_year);
      if (info.prefix_th)       updateData.prefix      = info.prefix_th;
      if (info.activity_credit != null) updateData.activityUnit = parseFloat(info.activity_credit) || 0;
    }

    if (result.grades) {
      const g = result.grades;
      // คืนแค่ gpax รวมจาก KKU API
      if (g.gpax != null) updateData.gpa = parseFloat(g.gpax) || 0;
    }

    if (result.advisor) {
      const adv = result.advisor;
      const name = [adv.prefix_th, adv.first_name_th, adv.last_name_th].filter(Boolean).join(" ");
      if (name) updateData.advisorName = name;
    }

    updateData.apiSyncedAt = new Date();
```

- [ ] **Step 3: Remove the `checkEligibility` test suite from `backend/__tests__/studentController.test.js`**

Change:

```js
});

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
    minGpa: 2.0,
    minCoreGpa: 2.0,
  };

  // gradeList now includes creditattempt (from KKU enroll_list)
  const gradeList = [
    { course_code: 'CP002001', grade: 'S',  creditattempt: 0 },
    { course_code: 'CP001001', grade: 'A',  creditattempt: 3 },
    { course_code: 'CP001002', grade: 'B+', creditattempt: 3 },
    { course_code: 'SC310001', grade: 'B',  creditattempt: 3 },
    { course_code: 'SC310002', grade: 'C',  creditattempt: 3 },
  ];
  // calculatedCoreGpa: SC310001 B=3.0×3=9, SC310002 C=2.0×3=6 → (9+6)/(3+3) = 2.50

  test('qualified — all criteria met, correct coreGpa', () => {
    const result = checkEligibility(gradeList, criteria);
    expect(result.isPassPrepCourse).toBe(true);
    expect(result.passedAllRequired).toBe(true);
    expect(result.passedElectiveCount).toBe(2);
    expect(result.isQualified).toBe(true);
    expect(result.calculatedCoreGpa).toBe(2.5);
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
    expect(result.calculatedCoreGpa).toBe(0);
  });

  test('null gradeList returns all false, coreGpa 0', () => {
    const result = checkEligibility(null, criteria);
    expect(result.isPassPrepCourse).toBe(false);
    expect(result.isQualified).toBe(false);
    expect(result.calculatedCoreGpa).toBe(0);
  });

  test('calculatedCoreGpa — S grade excluded from GPA but counts as passed', () => {
    const withSU = [
      { course_code: 'SC310001', grade: 'S', creditattempt: 3 },
      { course_code: 'SC310002', grade: 'A', creditattempt: 3 },
    ];
    const simpleCriteria = { ...criteria, coreCourses: ['SC310001', 'SC310002'], requiredCourses: [], prepCourseCodes: [], electiveMinCount: 1 };
    const result = checkEligibility(withSU, simpleCriteria);
    // SC310001 grade S → excluded from GPA (not in GRADE_POINTS), but S is in PASSING_GRADES
    // SC310002 grade A → 4.0 × 3 = 12
    // coreGpa = 12 / 3 = 4.0
    expect(result.calculatedCoreGpa).toBe(4.0);
    expect(result.passedElectiveCount).toBe(2); // both S and A count as passed
  });

  test('calculatedCoreGpa — F grade counts as 0.0 in GPA', () => {
    const withF = [
      { course_code: 'SC310001', grade: 'F', creditattempt: 3 },
      { course_code: 'SC310002', grade: 'B', creditattempt: 3 },
    ];
    const simpleCriteria = { ...criteria, coreCourses: ['SC310001', 'SC310002'], requiredCourses: [], prepCourseCodes: [], electiveMinCount: 1 };
    const result = checkEligibility(withF, simpleCriteria);
    // coreGpa = (0×3 + 3.0×3) / (3+3) = 9/6 = 1.5
    expect(result.calculatedCoreGpa).toBe(1.5);
  });
});

// =====================
// exportStudents
```

to:

```js
});

// =====================
// exportStudents
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest __tests__/studentController.test.js -v`
Expected: all remaining tests PASS (the `checkEligibility` tests are gone, not failing).

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/studentController.js backend/__tests__/studentController.test.js
git commit -m "refactor: remove checkEligibility and curriculum sync from studentController"
```

---

### Task 3: Remove eligibility defaults + curriculum from authController.js

**Files:**
- Modify: `backend/controllers/authController.js` (4 locations: student upsert ~line 182, profile mapping ~line 311, registration create ~line 451, REG sync update ~line 475)
- Test: `backend/__tests__/authController.test.js`

- [ ] **Step 1: Remove `curriculum` + `isPassPrepCourse`/`isQualified` defaults from the student upsert block**

Change:

```js
      await prisma.student.upsert({
        where: { userId: user.id },
        update: {
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลจาก API Info
           curriculum: extraInfo.program_name,
           year: extraInfo.student_year ? extraInfo.student_year.toString() : undefined,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : undefined,
           major: majorEnum || undefined,
           
           apiSyncedAt: new Date()
        },
        create: {
           userId: user.id,
           studentId: kkuUser.student_id,
           
           prefix: prefixEnum,
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลการศึกษา
           curriculum: extraInfo.program_name,
           year: extraInfo.student_year ? extraInfo.student_year.toString() : null,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : 0.00,
           major: majorEnum,
           
           // Default Values
           coreGpa: 0.00,
           activityUnit: 0,
           isPassPrepCourse: false,
           isQualified: false,
           
           apiSyncedAt: new Date()
        }
      });
```

to:

```js
      await prisma.student.upsert({
        where: { userId: user.id },
        update: {
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลจาก API Info
           year: extraInfo.student_year ? extraInfo.student_year.toString() : undefined,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : undefined,
           major: majorEnum || undefined,
           
           apiSyncedAt: new Date()
        },
        create: {
           userId: user.id,
           studentId: kkuUser.student_id,
           
           prefix: prefixEnum,
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลการศึกษา
           year: extraInfo.student_year ? extraInfo.student_year.toString() : null,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : 0.00,
           major: majorEnum,
           
           // Default Values
           activityUnit: 0,
           
           apiSyncedAt: new Date()
        }
      });
```

- [ ] **Step 2: Remove `curriculum` from the profile response mapping**

Change:

```js
        year: user.student.year,            // 4
        gpa: user.student.gpa,              // 4
        major: user.student.major,          // CS
        curriculum: user.student.curriculum,// CS
        studyProgram: user.student.studyProgram // normal
      };
```

to:

```js
        year: user.student.year,            // 4
        gpa: user.student.gpa,              // 4
        major: user.student.major,          // CS
        studyProgram: user.student.studyProgram // normal
      };
```

- [ ] **Step 3: Remove `curriculum` from the auto-registration create block**

Change:

```js
            create: {
              studentId:   studentIdRaw.toString(),
              firstName:   studentInfo.first_name_th  || "นักศึกษา",
              lastName:    studentInfo.last_name_th   || "ใหม่",
              firstNameEn: studentInfo.first_name_en  || null,
              lastNameEn:  studentInfo.last_name_en   || null,
              curriculum:  studentInfo.faculty_name_th || null,
              major:       studentInfo.major_name_th   || null,
              year:        studentInfo.class_year ? String(studentInfo.class_year) : null,
              advisorName: advName,
              ...(prefix ? { prefix } : {}),
            },
```

to:

```js
            create: {
              studentId:   studentIdRaw.toString(),
              firstName:   studentInfo.first_name_th  || "นักศึกษา",
              lastName:    studentInfo.last_name_th   || "ใหม่",
              firstNameEn: studentInfo.first_name_en  || null,
              lastNameEn:  studentInfo.last_name_en   || null,
              major:       studentInfo.major_name_th   || null,
              year:        studentInfo.class_year ? String(studentInfo.class_year) : null,
              advisorName: advName,
              ...(prefix ? { prefix } : {}),
            },
```

- [ ] **Step 4: Remove `curriculum` from the REG sync update block**

Change:

```js
      if (studentInfo.first_name_th)  updateData.firstName   = studentInfo.first_name_th;
      if (studentInfo.last_name_th)   updateData.lastName    = studentInfo.last_name_th;
      if (studentInfo.first_name_en)  updateData.firstNameEn = studentInfo.first_name_en;
      if (studentInfo.last_name_en)   updateData.lastNameEn  = studentInfo.last_name_en;
      if (studentInfo.faculty_name_th) updateData.curriculum = studentInfo.faculty_name_th;
      if (studentInfo.major_name_th)  updateData.major       = studentInfo.major_name_th;
      if (studentInfo.class_year)     updateData.year        = String(studentInfo.class_year);
```

to:

```js
      if (studentInfo.first_name_th)  updateData.firstName   = studentInfo.first_name_th;
      if (studentInfo.last_name_th)   updateData.lastName    = studentInfo.last_name_th;
      if (studentInfo.first_name_en)  updateData.firstNameEn = studentInfo.first_name_en;
      if (studentInfo.last_name_en)   updateData.lastNameEn  = studentInfo.last_name_en;
      if (studentInfo.major_name_th)  updateData.major       = studentInfo.major_name_th;
      if (studentInfo.class_year)     updateData.year        = String(studentInfo.class_year);
```

- [ ] **Step 5: Update the test mock**

In `backend/__tests__/authController.test.js`, change:

```js
        year: '4', gpa: 3.5, major: 'CS', curriculum: null, studyProgram: null,
```

to:

```js
        year: '4', gpa: 3.5, major: 'CS', studyProgram: null,
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest __tests__/authController.test.js -v`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/authController.js backend/__tests__/authController.test.js
git commit -m "refactor: remove curriculum field and eligibility defaults from authController"
```

---

### Task 4: Remove curriculum from Excel import

**Files:**
- Modify: `backend/controllers/studentImportController.js:52-106`
- Test: `backend/__tests__/studentImportController.test.js`

- [ ] **Step 1: Stop reading the 'คณะ' column and stop writing `curriculum`**

Change:

```js
        const firstName = String(row['ชื่อ'] || '').trim();
        const lastName = String(row['สกุล'] || '').trim();
        const year = String(row['ปี'] || '').trim();
        const curriculum = String(row['คณะ'] || '').trim();
        const major = String(row['สาขาวิชา'] || '').trim() || null;
```

to:

```js
        const firstName = String(row['ชื่อ'] || '').trim();
        const lastName = String(row['สกุล'] || '').trim();
        const year = String(row['ปี'] || '').trim();
        const major = String(row['สาขาวิชา'] || '').trim() || null;
```

Change:

```js
        await prisma.student.upsert({
          where: { studentId },
          update: {
            firstName, lastName, year, curriculum, major, advisorName, studyProgram,
            generalAdvisorId,  // null = clear advisor; non-null = set advisor
          },
          create: {
            studentId, firstName, lastName, year, curriculum, major,
            advisorName, generalAdvisorId, studyProgram,
            userId: user.id,
          },
        });
```

to:

```js
        await prisma.student.upsert({
          where: { studentId },
          update: {
            firstName, lastName, year, major, advisorName, studyProgram,
            generalAdvisorId,  // null = clear advisor; non-null = set advisor
          },
          create: {
            studentId, firstName, lastName, year, major,
            advisorName, generalAdvisorId, studyProgram,
            userId: user.id,
          },
        });
```

- [ ] **Step 2: Update the test mock row**

In `backend/__tests__/studentImportController.test.js`, remove this line from the mocked Excel row object:

```js
      'คณะ': 'คณะวิทยาการคอมพิวเตอร์',
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npx jest __tests__/studentImportController.test.js -v`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/studentImportController.js backend/__tests__/studentImportController.test.js
git commit -m "refactor: stop importing curriculum column from student Excel import"
```

---

### Task 5: Simplify A_CriteriaPage.tsx to a plain major list

**Files:**
- Modify: `Frontend/src/components/A_CriteriaPage.tsx` (replace entire file)

**Interfaces:**
- Consumes: `POST /api/admin/criteria` body `{ major }` (from Task 1), `DELETE /api/admin/criteria/:id`, `GET /api/admin/criteria` → `{ ok, criteria: [{ id, major }] }`.

- [ ] **Step 1: Replace `Frontend/src/components/A_CriteriaPage.tsx` entirely**

```tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

type Criteria = {
    id: string;
    major: string;
};

export default function A_CriteriaPage() {
    const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
    const [addMajorModalOpen, setAddMajorModalOpen] = useState(false);
    const [newMajorName, setNewMajorName] = useState("");

    const fetchCriteria = async () => {
        try {
            const res = await axios.get("/api/admin/criteria");
            if (res.data.ok) setCriteriaList(res.data.criteria);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchCriteria(); }, []);

    const handleAddMajor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMajorName.trim()) return alert("กรุณากรอกชื่อสาขา");

        if (criteriaList.some(c => c.major.toLowerCase() === newMajorName.trim().toLowerCase())) {
            return alert("สาขานี้มีอยู่ในระบบแล้ว!");
        }

        try {
            await axios.post("/api/admin/criteria", {
                major: newMajorName.trim().toUpperCase(), // แนะนำให้เก็บเป็นตัวพิมพ์ใหญ่ (เช่น CS, IT)
            });
            setAddMajorModalOpen(false);
            setNewMajorName("");
            fetchCriteria();
        } catch (err: any) { alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการเพิ่มสาขา"); }
    };

    const handleRemoveMajor = async (id: string, majorName: string) => {
        if (!confirm(`⚠️ ยืนยันการลบสาขา ${majorName}?`)) return;
        try {
            await axios.delete(`/api/admin/criteria/${id}`);
            fetchCriteria();
        } catch (err) { alert("ลบไม่สำเร็จ"); }
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการสาขาวิชาสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อสาขาวิชาที่นักศึกษาสามารถยื่นสมัครสหกิจศึกษาได้</div>
                </div>
                <button className="btn" onClick={() => setAddMajorModalOpen(true)}>+ เพิ่มสาขาวิชาใหม่</button>
            </section>

            {/* MAJOR LIST */}
            {criteriaList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#fff', borderRadius: 16 }}>
                    ยังไม่มีข้อมูลสาขาวิชา กรุณากดปุ่ม "+ เพิ่มสาขาวิชาใหม่"
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                    {criteriaList.map(c => (
                        <div key={c.id} style={majorCard}>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: 1 }}>สาขาวิชา</span>
                                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{c.major}</div>
                            </div>
                            <button style={delBtn} onClick={() => handleRemoveMajor(c.id, c.major)}>🗑️ ลบสาขา</button>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL: เพิ่มสาขาใหม่ */}
            {addMajorModalOpen && (
                <div style={modalOverlay}>
                    <div style={{ ...modalContent, width: 400 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 8, color: '#0f172a' }}>✨ เพิ่มสาขาวิชาใหม่</h3>

                        <form onSubmit={handleAddMajor}>
                            <div style={field}>
                                <label style={label}>ตัวย่อสาขาวิชา (เช่น CS, IT, AI, GIS)</label>
                                <input
                                    required
                                    autoFocus
                                    className="input"
                                    value={newMajorName}
                                    onChange={e => setNewMajorName(e.target.value)}
                                    placeholder="กรอกชื่อย่อสาขา..."
                                />
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setAddMajorModalOpen(false)}>ยกเลิก</button>
                                <button type="submit" className="btn" style={{ flex: 1 }}>เพิ่มสาขา</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSS STYLES */}
            <style>{`
        .btn { padding: 10px 18px; border-radius: 8px; border: none; font-weight: 700; font-size: 14px; color: white; background: #0074B7; cursor: pointer; transition: 0.2s; }
        .btn:hover { background: #005f96; }
        .btn-ghost { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 700; font-size: 14px; color: #64748b; background: #f1f5f9; cursor: pointer; transition: 0.2s; }
        .btn-ghost:hover { background: #e2e8f0; color: #334155; }
        .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      `}</style>
        </div>
    );
}

/* UI Variables */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const majorCard: CSSProperties = { background: "#fff", borderRadius: 18, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const delBtn: CSSProperties = { background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 650, maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, flex: 1 };
const label: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#334155' };
```

- [ ] **Step 2: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/A_CriteriaPage.tsx
git commit -m "refactor: simplify A_CriteriaPage to a plain add/remove major list"
```

---

### Task 6: Remove eligibility badge + curriculum from S_ProfilePage.tsx

**Files:**
- Modify: `Frontend/src/components/S_ProfilePage.tsx` (type at line 38, 50; badge block ~line 394-405; display row ~line 411; form default ~line 539; form input ~line 632-635)

- [ ] **Step 1: Remove `curriculum` and `isQualified` from the profile type**

Change:

```ts
  year?: string;
  major?: string;
  curriculum?: string;
  advisorName?: string;
```

to:

```ts
  year?: string;
  major?: string;
  advisorName?: string;
```

Change:

```ts
  docs: any[];
  isQualified?: boolean; // ✅ เอาไว้โชว์เฉยๆ ว่าเกรดถึงไหม
  coopAdvisorId?: number | null;
```

to:

```ts
  docs: any[];
  coopAdvisorId?: number | null;
```

- [ ] **Step 2: Remove the qualification badge block**

Change:

```tsx
          {/* ✅ แก้ไขกล่องแสดงสถานะการผ่านเกณฑ์ */}
          <div style={{
            padding: "12px 16px", marginBottom: "20px", borderRadius: "8px",
            background: profile.isQualified ? "#f0fdf4" : "#fee2e2",
            border: `1px solid ${profile.isQualified ? "#bbf7d0" : "#fecaca"}`,
            color: profile.isQualified ? "#166534" : "#991b1b",
            fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px"
          }}>
            {profile.isQualified
              ? "✅ ผ่านเกณฑ์เบื้องต้นจากการคำนวณ (เกรด/หน่วยกิต ถึงเกณฑ์ที่กำหนด)"
              : "⚠️ คุณสมบัติยังไม่ผ่านเกณฑ์การยื่นสหกิจศึกษา"}
          </div>

          <Info label="รหัสนักศึกษา" value={profile.studentId} />
          <Info label="ชื่อ–นามสกุล (TH)" value={`${prefixMapToUI[profile.prefix as keyof typeof prefixMapToUI] || ""} ${profile.firstName ?? ""} ${profile.lastName ?? ""}`} />
          <Info label="ชื่อ–นามสกุล (EN)" value={`${profile.firstNameEn ?? "-"} ${profile.lastNameEn ?? "-"}`} />
          <Info label="ชั้นปี" value={profile.year || "-"} />
          <Info label="คณะ" value={profile.curriculum || "-"} />
          <Info label="สาขาวิชา" value={profile.major || "-"} />
```

to:

```tsx
          <Info label="รหัสนักศึกษา" value={profile.studentId} />
          <Info label="ชื่อ–นามสกุล (TH)" value={`${prefixMapToUI[profile.prefix as keyof typeof prefixMapToUI] || ""} ${profile.firstName ?? ""} ${profile.lastName ?? ""}`} />
          <Info label="ชื่อ–นามสกุล (EN)" value={`${profile.firstNameEn ?? "-"} ${profile.lastNameEn ?? "-"}`} />
          <Info label="ชั้นปี" value={profile.year || "-"} />
          <Info label="สาขาวิชา" value={profile.major || "-"} />
```

- [ ] **Step 3: Remove the `curriculum` default in the edit-modal form state**

Change:

```tsx
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...profile,
    // normalize studentId: เก็บเฉพาะตัวเลข ≤ 10 หลัก ตั้งแต่โหลดครั้งแรก
    studentId: (profile.studentId ?? "").replace(/\D/g, "").slice(0, 10),
    prefix: prefixMapToUI[profile.prefix] || profile.prefix || "",
    studyProgram: studyProgramMapToUI[profile.studyProgram] || profile.studyProgram || "",
    curriculum: profile.curriculum || "วิทยาลัยการคอมพิวเตอร์"
  }));
```

to:

```tsx
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...profile,
    // normalize studentId: เก็บเฉพาะตัวเลข ≤ 10 หลัก ตั้งแต่โหลดครั้งแรก
    studentId: (profile.studentId ?? "").replace(/\D/g, "").slice(0, 10),
    prefix: prefixMapToUI[profile.prefix] || profile.prefix || "",
    studyProgram: studyProgramMapToUI[profile.studyProgram] || profile.studyProgram || "",
  }));
```

- [ ] **Step 4: Remove the "คณะ / หลักสูตร" form field**

Change:

```tsx
          <div><label className="label">ชั้นปี</label><input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>

          <div style={{ gridColumn: 'span 2' }}>
            <label className="label">คณะ / หลักสูตร</label>
            <input className="input" value={form.curriculum ?? ""} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} />
          </div>
          <div><label className="label">เบอร์โทรศัพท์</label><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
```

to:

```tsx
          <div><label className="label">ชั้นปี</label><input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>

          <div><label className="label">เบอร์โทรศัพท์</label><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
```

- [ ] **Step 5: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/S_ProfilePage.tsx
git commit -m "refactor: remove qualification badge and curriculum field from S_ProfilePage"
```

---

### Task 7: Remove curriculum from S_Gateway.tsx

**Files:**
- Modify: `Frontend/src/components/S_Gateway.tsx:59` (type), `:418` (display row)

- [ ] **Step 1: Remove `curriculum` from the profile type**

Change:

```ts
  major?: string;
  curriculum?: string;
  studyProgram?: string;
```

to:

```ts
  major?: string;
  studyProgram?: string;
```

- [ ] **Step 2: Remove the "คณะ:" display row**

Change:

```tsx
          <div className="info-row"><span className="label">สาขาวิชา:</span><span className="value">{profile.major || "-"} (ปี {profile.year || "-"})</span></div>
          <div className="info-row"><span className="label">คณะ:</span><span className="value">{profile.curriculum || "-"}</span></div>
          <div className="info-row"><span className="label">ที่ปรึกษา:</span><span className="value">{profile.advisorName || "-"}</span></div>
```

to:

```tsx
          <div className="info-row"><span className="label">สาขาวิชา:</span><span className="value">{profile.major || "-"} (ปี {profile.year || "-"})</span></div>
          <div className="info-row"><span className="label">ที่ปรึกษา:</span><span className="value">{profile.advisorName || "-"}</span></div>
```

- [ ] **Step 3: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/S_Gateway.tsx
git commit -m "refactor: remove curriculum display from S_Gateway"
```

---

### Task 8: Remove isQualified + curriculum from T_Requests.tsx

**Files:**
- Modify: `Frontend/src/components/T_Requests.tsx:15` (type), `:90-100` (filter, rename), `:103,115,210,212,213,217` (rename usages), `:217` (button copy), `:249-258` (table header/colspan), `:266-269` (column cell), `:335` (detail badge)

**Interfaces:**
- Produces: `pendingList` replaces `qualifiedPendingList` (renamed since it's no longer qualification-filtered) — used by `handleBulkApprove` and the bulk-approve button.

- [ ] **Step 1: Remove `curriculum` and `isQualified` from the local type**

Change:

```ts
  major?: string; year?: string; curriculum?: string; phone?: string; email?: string;
  gpa: number; isQualified?: boolean;
```

to:

```ts
  major?: string; year?: string; phone?: string; email?: string;
  gpa: number;
```

- [ ] **Step 2: Drop the qualification filter and rename `qualifiedPendingList` to `pendingList`**

Change:

```tsx
  const qualifiedPendingList = useMemo(() => {
    return students.filter(s => {
      const isPending = ["APPLYING", "WAITING_FOR_STAFF_CHECK", "SUBMITTED"].includes(s.coop?.status?.toUpperCase() || "");

      // 🟢 เช็ค Period ID ให้ครอบคลุมทุกจุดที่ Backend อาจจะส่งมา
      const appPeriodId = String(s.coopPeriodId || s.coop?.coopPeriodId || "");
      const matchPeriod = filterPeriodId === "all" || appPeriodId === filterPeriodId;

      return isPending && s.isQualified === true && matchPeriod;
    });
  }, [students, filterPeriodId]);

  const handleBulkApprove = () => {
    const count = qualifiedPendingList.length;
    if (count === 0) return;
    openConfirm({
      title: "ยืนยันอนุมัติกลุ่ม",
      message: `ระบบจะอนุมัติคำร้องของนักศึกษาที่ผ่านคุณสมบัติ จำนวน ${count} รายการ`,
      icon: "⚡",
      confirmLabel: `อนุมัติ ${count} ราย`,
      confirmColor: "#10b981",
      onConfirm: async () => {
        closeConfirm();
        setLoading(true);
        try {
          await Promise.all(qualifiedPendingList.map(s =>
            axios.put("/api/coop/status", {
              studentId: s.id, status: "APPROVED",
              comment: "อนุมัติโดยระบบ (ผ่านคุณสมบัติครบถ้วน)"
            }, { headers: { Authorization: `Bearer ${token}` } })
          ));
          toast.success("อนุมัติสำเร็จทั้งหมด!");
          fetchData();
        } catch { toast.error("เกิดข้อผิดพลาดในการอนุมัติกลุ่ม"); }
        finally { setLoading(false); }
      },
    });
  };
```

to:

```tsx
  const pendingList = useMemo(() => {
    return students.filter(s => {
      const isPending = ["APPLYING", "WAITING_FOR_STAFF_CHECK", "SUBMITTED"].includes(s.coop?.status?.toUpperCase() || "");

      // 🟢 เช็ค Period ID ให้ครอบคลุมทุกจุดที่ Backend อาจจะส่งมา
      const appPeriodId = String(s.coopPeriodId || s.coop?.coopPeriodId || "");
      const matchPeriod = filterPeriodId === "all" || appPeriodId === filterPeriodId;

      return isPending && matchPeriod;
    });
  }, [students, filterPeriodId]);

  const handleBulkApprove = () => {
    const count = pendingList.length;
    if (count === 0) return;
    openConfirm({
      title: "ยืนยันอนุมัติกลุ่ม",
      message: `ระบบจะอนุมัติคำร้องที่รอดำเนินการ จำนวน ${count} รายการ`,
      icon: "⚡",
      confirmLabel: `อนุมัติ ${count} ราย`,
      confirmColor: "#10b981",
      onConfirm: async () => {
        closeConfirm();
        setLoading(true);
        try {
          await Promise.all(pendingList.map(s =>
            axios.put("/api/coop/status", {
              studentId: s.id, status: "APPROVED",
              comment: "อนุมัติโดยระบบ"
            }, { headers: { Authorization: `Bearer ${token}` } })
          ));
          toast.success("อนุมัติสำเร็จทั้งหมด!");
          fetchData();
        } catch { toast.error("เกิดข้อผิดพลาดในการอนุมัติกลุ่ม"); }
        finally { setLoading(false); }
      },
    });
  };
```

- [ ] **Step 3: Update the bulk-approve button to use `pendingList` and drop the "ผ่านเกณฑ์" copy**

Change:

```tsx
          <button
            className="btn"
            onClick={handleBulkApprove}
            disabled={qualifiedPendingList.length === 0 || loading}
            style={{
              background: qualifiedPendingList.length > 0 ? '#10b981' : '#e5e7eb',
              color: qualifiedPendingList.length > 0 ? 'white' : '#9ca3af',
              padding: '10px 20px'
            }}
          >
            ⚡ อนุมัติผู้ผ่านเกณฑ์ทั้งหมด ({qualifiedPendingList.length})
          </button>
```

to:

```tsx
          <button
            className="btn"
            onClick={handleBulkApprove}
            disabled={pendingList.length === 0 || loading}
            style={{
              background: pendingList.length > 0 ? '#10b981' : '#e5e7eb',
              color: pendingList.length > 0 ? 'white' : '#9ca3af',
              padding: '10px 20px'
            }}
          >
            ⚡ อนุมัติทั้งหมด ({pendingList.length})
          </button>
```

- [ ] **Step 4: Remove the "คุณสมบัติ" table column header and adjust colspan**

Change:

```tsx
            <tr style={thRow}>
              <th style={th}>รหัสนักศึกษา / ชื่อ-สกุล</th>
              <th style={th}>คุณสมบัติ</th>
              <th style={th}>หน่วยงาน / ตำแหน่ง</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>ไม่มีคำร้องในระบบ</td></tr>
```

to:

```tsx
            <tr style={thRow}>
              <th style={th}>รหัสนักศึกษา / ชื่อ-สกุล</th>
              <th style={th}>หน่วยงาน / ตำแหน่ง</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>ไม่มีคำร้องในระบบ</td></tr>
```

- [ ] **Step 5: Remove the "คุณสมบัติ" column cell**

Change:

```tsx
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#0ea5e9' }}>{s.studentId}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{s.firstName} {s.lastName}</div>
                </td>
                <td style={td}>
                  {s.isQualified ?
                    <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>✅ ครบ</span> :
                    <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>❌ ไม่ผ่าน</span>
                  }
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{s.coop?.company?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: '#0ea5e9' }}>{s.coop?.jobPosition || "-"}</div>
                </td>
```

to:

```tsx
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#0ea5e9' }}>{s.studentId}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{s.firstName} {s.lastName}</div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{s.coop?.company?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: '#0ea5e9' }}>{s.coop?.jobPosition || "-"}</div>
                </td>
```

- [ ] **Step 6: Remove the "คุณสมบัติ" row in the detail modal**

Change:

```tsx
                    <span style={{ fontWeight: 700, color: '#64748b' }}>ชื่อ-สกุล:</span> <span>{selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>GPA:</span> <span style={{ fontWeight: 700 }}>{selectedStudent.gpa?.toFixed(2) ?? "-"}</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>คุณสมบัติ:</span> <span>{selectedStudent.isQualified ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}</span>
```

to:

```tsx
                    <span style={{ fontWeight: 700, color: '#64748b' }}>ชื่อ-สกุล:</span> <span>{selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>GPA:</span> <span style={{ fontWeight: 700 }}>{selectedStudent.gpa?.toFixed(2) ?? "-"}</span>
```

- [ ] **Step 7: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors (confirms no other reference to `qualifiedPendingList` or `isQualified` was missed in this file).

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/components/T_Requests.tsx
git commit -m "refactor: remove qualification column/filter and curriculum from T_Requests"
```

---

### Task 9: Remove dead `curriculum` type fields

**Files:**
- Modify: `Frontend/src/components/S_Docs.tsx:22`, `Frontend/src/components/A_CoopApplications.tsx:17`, `Frontend/src/components/store.ts:158`

- [ ] **Step 1: `S_Docs.tsx`**

Change:

```ts
  year?: string;
  major?: string;
  curriculum?: string;
  advisorName?: string;
```

to:

```ts
  year?: string;
  major?: string;
  advisorName?: string;
```

- [ ] **Step 2: `A_CoopApplications.tsx`**

Change:

```ts
    id: number; studentId: string; prefix?: string; firstName: string; lastName: string;
    firstNameEn?: string; lastNameEn?: string; year?: string; major: string; curriculum?: string;
    advisorName?: string; phone?: string; email?: string; gpa: number;
```

to:

```ts
    id: number; studentId: string; prefix?: string; firstName: string; lastName: string;
    firstNameEn?: string; lastNameEn?: string; year?: string; major: string;
    advisorName?: string; phone?: string; email?: string; gpa: number;
```

- [ ] **Step 3: `store.ts`**

Change:

```ts
  year?: string;
  major?: string;
  curriculum?: string;
  studyProgram?: "normal" | "special";
```

to:

```ts
  year?: string;
  major?: string;
  studyProgram?: "normal" | "special";
```

- [ ] **Step 4: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/S_Docs.tsx Frontend/src/components/A_CoopApplications.tsx Frontend/src/components/store.ts
git commit -m "refactor: remove unused curriculum type field from remaining components"
```

---

### Task 10: Hardcode faculty name in PDF generators

**Files:**
- Modify: `Frontend/src/utils/pdfGeneratorT000.ts:65` (type), `:305` (print)
- Modify: `Frontend/src/utils/pdfGeneratorParentalConsent.ts:70-71` (local var)
- Modify: `Frontend/src/utils/pdfGenerator.ts:12` (type), `:136` (print)

- [ ] **Step 1: `pdfGeneratorT000.ts` — remove `curriculum` from `ProfileData` and hardcode the printed value**

Change:

```ts
  major?: string;
  curriculum?: string;

  // ✅ เพิ่ม jobPosition ใน ProfileData ด้วย
  jobPosition?: string;
```

to:

```ts
  major?: string;

  // ✅ เพิ่ม jobPosition ใน ProfileData ด้วย
  jobPosition?: string;
```

Change:

```ts
  drawText("คณะ", leftX + 95, y);
  drawText("Faculty", leftX + 95, y + 3.5, "left", false, 9);
  doc.line(leftX + 105, y + 1, 185, y + 1);
  doc.text(profile.curriculum || "วิทยาลัยการคอมพิวเตอร์", leftX + 110, y);
```

to:

```ts
  drawText("คณะ", leftX + 95, y);
  drawText("Faculty", leftX + 95, y + 3.5, "left", false, 9);
  doc.line(leftX + 105, y + 1, 185, y + 1);
  doc.text("วิทยาลัยการคอมพิวเตอร์", leftX + 110, y);
```

- [ ] **Step 2: `pdfGeneratorParentalConsent.ts` — hardcode the local `curriculum` variable**

Change:

```ts
  const major = profile.major || "...................................";
  const curriculum =
    profile.curriculum || "...................................";
```

to:

```ts
  const major = profile.major || "...................................";
  const curriculum = "วิทยาลัยการคอมพิวเตอร์";
```

- [ ] **Step 3: `pdfGenerator.ts` — remove `curriculum` from `ProfileData` and hardcode the printed value**

Change:

```ts
  year?: string;
  curriculum?: string;
  studyProgram?: string;
```

to:

```ts
  year?: string;
  studyProgram?: string;
```

Change:

```ts
  doc.setFont("THSarabun", "bold");
  doc.text(profile.curriculum || "", leftMargin + 100, y);
  doc.setFont("THSarabun", "normal");
```

to:

```ts
  doc.setFont("THSarabun", "bold");
  doc.text("วิทยาลัยการคอมพิวเตอร์", leftMargin + 100, y);
  doc.setFont("THSarabun", "normal");
```

- [ ] **Step 4: Type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/utils/pdfGeneratorT000.ts Frontend/src/utils/pdfGeneratorParentalConsent.ts Frontend/src/utils/pdfGenerator.ts
git commit -m "refactor: hardcode faculty name in PDF generators instead of reading curriculum field"
```

---

### Task 11: Drop the now-unused DB columns (final migration)

**Files:**
- Modify: `backend/prisma/schema.prisma` (`CoopCriteria` model, `Student` model)

This task runs last because every consumer of these fields was already removed in Tasks 1-10 — the columns are now genuinely unused, so dropping them is safe and won't break running code mid-refactor.

- [ ] **Step 1: Shrink the `CoopCriteria` model**

Change:

```prisma
model CoopCriteria {
  id              String   @id @default(uuid())
  major           String   @unique
  minGpa          Float    @default(2.00)
  minCoreGpa      Float    @default(2.00)
  minActivityUnit Int      @default(0)
  requiredCourses  Json
  coreCourses      Json
  prepCourseCodes  Json     @default("[]") // วิชาเตรียมความพร้อม เช่น ["CP002001","SC002001"]
  electiveMinCount Int      @default(1)    // จำนวนวิชาบังคับเลือกขั้นต่ำ
  updatedAt        DateTime @updatedAt
}
```

to:

```prisma
model CoopCriteria {
  id        String   @id @default(uuid())
  major     String   @unique
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Remove `curriculum`, `coreGpa`, `isPassPrepCourse`, `isQualified` from `Student`**

Change:

```prisma
  major        String?
  curriculum   String?
  year         String?
  phone        String?
  email        String?
  studyProgram StudyProgram?
  gpa          Float?        @default(0.00)
  coreGpa      Float?        @default(0.00)
  activityUnit Int           @default(0)
  apiSyncedAt  DateTime?
  advisorName  String? // ชื่ออาจารย์ที่ปรึกษา
  jobPosition  String? // ตำแหน่งงานที่สนใจ/สมัคร

  generalAdvisorId  Int?
  coopAdvisorId     Int?
  generalAdvisor    Teacher? @relation("GeneralAdvisor", fields: [generalAdvisorId], references: [id])
  coopAdvisor       Teacher? @relation("CoopAdvisor", fields: [coopAdvisorId], references: [id])

  isPassPrepCourse Boolean @default(false)
  isQualified      Boolean @default(false)

  userId Int  @unique
```

to:

```prisma
  major        String?
  year         String?
  phone        String?
  email        String?
  studyProgram StudyProgram?
  gpa          Float?        @default(0.00)
  activityUnit Int           @default(0)
  apiSyncedAt  DateTime?
  advisorName  String? // ชื่ออาจารย์ที่ปรึกษา
  jobPosition  String? // ตำแหน่งงานที่สนใจ/สมัคร

  generalAdvisorId  Int?
  coopAdvisorId     Int?
  generalAdvisor    Teacher? @relation("GeneralAdvisor", fields: [generalAdvisorId], references: [id])
  coopAdvisor       Teacher? @relation("CoopAdvisor", fields: [coopAdvisorId], references: [id])

  userId Int  @unique
```

- [ ] **Step 3: Run the migration**

Run: `cd backend && npx prisma migrate dev --name simplify_criteria_drop_curriculum`
Expected: migration created and applied successfully, Prisma Client regenerated.

- [ ] **Step 4: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all tests PASS (this is the cross-check that no code anywhere still references a dropped field).

- [ ] **Step 5: Run the full frontend type-check**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: drop CoopCriteria GPA/course fields and Student.curriculum/isQualified/coreGpa columns"
```

---

## Final Step: Update CHANGELOG.md

Per project convention (CLAUDE.md), add an entry to `CHANGELOG.md` summarizing this whole change (admin criteria simplified to major-only list; eligibility calculation removed; `Student.curriculum` dropped) before considering the branch done.
