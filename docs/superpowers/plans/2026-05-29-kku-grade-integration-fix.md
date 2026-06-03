# KKU Grade Integration Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs in the KKU REG API grade integration: broken `getGradeList` endpoint (wrong path), non-existent `gpax_core` field being read, and missing core GPA calculation from configured `coreCourses`.

**Architecture:** `getGradeList` is redesigned to use `getGradeSummary`'s semester list to fetch `enroll_list/:acadyear/:semester` for each semester in parallel. `checkEligibility` gains a `GRADE_POINTS` map and calculates `calculatedCoreGpa` as a weighted average over `coreCourses`. `syncFromReg` stops double-logging in (reuses token from `syncStudentAll`), drops the nonexistent `gpax_core` read, saves `coreGpa` from the calculated value, and gates `isQualified` on all four criteria (courses + minGpa + minCoreGpa + minActivityUnit).

**Tech Stack:** Node.js + Express, Prisma + MySQL, Jest (backend unit tests), KKU REG API v1.2

---

## API Response Reference (confirmed from docs)

```
GET /student/get_grade_summary
→ { grade_summary: [{ acadyear, semester, gpax, gpa_of_semester, credit_attempt, credit_satisfy }] }
  Note: gpax here is the CUMULATIVE gpax at end of each semester

GET /student/enroll_list/:acadyear/:semester
→ { enroll_list: [{ course_code, grade, creditattempt, creditsatisfy, course_name, course_name_eng }] }
  Note: requires BOTH params — no all-semesters endpoint exists
  Note: grade values: A, B+, B, C+, C, D+, D, F, E, S, U, W

No gpax_core field exists anywhere in the API.
```

---

## Current Bugs

| Bug | Location | Effect |
|---|---|---|
| `getGradeList` calls `/student/enroll_list` with no params | `kkuRegService.js:158` | 404 — gradeList always null |
| Reads `g.gpax_core` which doesn't exist | `studentController.js:441` | coreGpa never updated from sync |
| Double `getStudentToken` call per sync | `studentController.js:450` | 2× login requests to KKU per sync |
| `isQualified` ignores minGpa, minCoreGpa, minActivityUnit | `studentController.js:460-463` | Student marked qualified even if GPA too low |
| `checkEligibility` gradeList items have no `creditattempt` | `studentController.js:8-32` | coreGpa cannot be calculated |

---

## File Map

| Action | Path |
|---|---|
| Modify | `backend/services/kkuRegService.js` |
| Modify | `backend/controllers/studentController.js` |
| Modify | `backend/__tests__/studentController.test.js` |
| Modify | `backend/__tests__/routes/student.routes.test.js` (mock update only) |

---

## Task 1: kkuRegService — Fix getGradeList + expose token from syncStudentAll

**Files:**
- Modify: `backend/services/kkuRegService.js`

**Background:**
- `getGradeList` currently calls `${BASE_URL}/student/enroll_list` with no path params → always 404
- The correct endpoint is `${BASE_URL}/student/enroll_list/:acadyear/:semester`
- Strategy: use the `grade_summary` array from `getGradeSummary` to discover all semesters, then fetch `enroll_list` for each in parallel
- `syncStudentAll` calls `getStudentToken` internally but discards the token — `syncFromReg` then calls it again (double login). Fix: return `_token` from `syncStudentAll`.

- [ ] **Step 1: Read the current file**

Read `backend/services/kkuRegService.js` lines 150–237 to locate `getGradeList`, `syncStudentAll`, and `module.exports` exactly.

- [ ] **Step 2: Add getEnrollList private helper**

Insert after `getGradeList` (around line 172), before the `searchCourses` function:

```js
// ──────────────────────────────────────────
// 8b. ดึง enroll_list สำหรับ 1 ภาคเรียน (private helper)
// ──────────────────────────────────────────
async function getEnrollList(accessToken, acadyear, semester) {
  try {
    const res = await axios.get(
      `${BASE_URL}/student/enroll_list/${acadyear}/${semester}`,
      { headers: { "x-access-token": accessToken }, timeout: 12000 }
    );
    return res.data?.enroll_list || res.data?.data?.enroll_list || [];
  } catch (err) {
    console.error(
      `[KKU REG] getEnrollList(${acadyear}/${semester}) error:`,
      err.response?.data || err.message
    );
    return [];
  }
}
```

- [ ] **Step 3: Replace getGradeList implementation**

Replace the entire `getGradeList` function (lines 155–172) with:

```js
// ──────────────────────────────────────────
// 8. ดึงประวัติเกรดทุกวิชา (ใช้ตรวจ requiredCourses / coreCourses)
//    ต้องส่ง gradeSummary (จาก getGradeSummary) เพื่อรู้ list ของ semester
//    คืน array ของ { course_code, grade, creditattempt, creditsatisfy, ... }
// ──────────────────────────────────────────
async function getGradeList(accessToken, gradeSummary) {
  if (!accessToken) return null;

  // ดึง list ของ (acadyear, semester) ที่นักศึกษาเคยลงทะเบียน
  const summaryList = gradeSummary?.grade_summary || gradeSummary?.data?.grade_summary || [];
  if (!summaryList.length) return [];

  // deduplicate (academic year + semester)
  const seen = new Set();
  const semesters = summaryList.filter(s => {
    const key = `${s.acadyear}-${s.semester}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ดึงพร้อมกันทุกภาคเรียน
  const results = await Promise.all(
    semesters.map(s => getEnrollList(accessToken, s.acadyear, s.semester))
  );

  return results.flat();
}
```

- [ ] **Step 4: Update syncStudentAll to return _token**

Find `syncStudentAll` function. Change the `return { ok: true, ... }` block to also include `_token`:

```js
async function syncStudentAll(username, password) {
  const token = await getStudentToken(username, password);
  if (!token) return { ok: false, message: "ไม่สามารถเชื่อมต่อ KKU REG ได้ — ตรวจสอบ username/password" };

  const [info, grades, advisor, image] = await Promise.allSettled([
    getStudentInfo(token),
    getGradeSummary(token),
    getAdvisor(token),
    getStudentImage(token),
  ]);

  return {
    ok: true,
    _token:  token,                                                          // NEW — reuse in caller
    info:    info.status    === "fulfilled" ? info.value    : null,
    grades:  grades.status  === "fulfilled" ? grades.value  : null,
    advisor: advisor.status === "fulfilled" ? advisor.value : null,
    image:   image.status   === "fulfilled" ? image.value   : null,
  };
}
```

- [ ] **Step 5: Update module.exports**

`getEnrollList` is private (not exported). No changes to `module.exports` needed — `getGradeList` is already exported.

- [ ] **Step 6: Update mock in student.routes.test.js**

In `backend/__tests__/routes/student.routes.test.js`, find the `jest.mock('../../services/kkuRegService', ...)` block. `getGradeList` is already mocked (line 21) — no change needed. Verify `syncStudentAll` mock doesn't break (the `_token` field in the return is ignored by the mock since it's `jest.fn()`).

- [ ] **Step 7: Run all tests — expect no regressions**

```bash
cd backend && npm test
```

Expected: 162 passing, 1 pre-existing failure (adminDocController).

- [ ] **Step 8: Commit**

```bash
git add backend/services/kkuRegService.js
git commit -m "fix: getGradeList fetches enroll_list per-semester; syncStudentAll exposes _token"
```

---

## Task 2: checkEligibility — Add calculatedCoreGpa

**Files:**
- Modify: `backend/controllers/studentController.js` (lines 6–32)
- Test: `backend/__tests__/studentController.test.js` (lines 179–241)

**Background:**
- `coreCourses` in criteria is a list of course codes used to calculate `coreGpa`
- KKU uses weighted average: `sum(grade_point × creditattempt) / sum(creditattempt)`
- Grade point scale: A=4.0, B+=3.5, B=3.0, C+=2.5, C=2.0, D+=1.5, D=1.0, F/E=0.0
- S/U/W are satisfactory/unsatisfactory marks — excluded from GPA calculation
- `checkEligibility` return gains `calculatedCoreGpa: number`

- [ ] **Step 1: Write failing tests**

In `backend/__tests__/studentController.test.js`, update the `gradeList` fixture inside `describe('checkEligibility', ...)` and add new assertions. Replace the entire `describe('checkEligibility', ...)` block (lines 174–241) with:

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
    minGpa: 2.0,
    minCoreGpa: 2.0,
  };

  // gradeList now includes creditattempt (from KKU enroll_list)
  const gradeList = [
    { course_code: 'CP002001', grade: 'S',  creditattempt: 0 },  // prep ✓ (S = satisfactory)
    { course_code: 'CP001001', grade: 'A',  creditattempt: 3 },  // required ✓
    { course_code: 'CP001002', grade: 'B+', creditattempt: 3 },  // required ✓
    { course_code: 'SC310001', grade: 'B',  creditattempt: 3 },  // core (3.0 × 3 = 9)
    { course_code: 'SC310002', grade: 'C',  creditattempt: 3 },  // core (2.0 × 3 = 6)
    // SC310003 not in list → not passed
  ];
  // calculatedCoreGpa = (9 + 6) / (3 + 3) = 2.50

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

  test('calculatedCoreGpa — S/U grades excluded from GPA calculation', () => {
    const withSU = [
      { course_code: 'SC310001', grade: 'S', creditattempt: 3 },  // excluded
      { course_code: 'SC310002', grade: 'A', creditattempt: 3 },  // 4.0
    ];
    const simpleCriteria = { ...criteria, coreCourses: ['SC310001', 'SC310002'], requiredCourses: [], prepCourseCodes: [], electiveMinCount: 1 };
    const result = checkEligibility(withSU, simpleCriteria);
    // SC310001 grade S → excluded from GPA, but still counted as "passed" for elective
    // SC310002 grade A → 4.0
    // coreGpa = (4.0 × 3) / 3 = 4.0
    expect(result.calculatedCoreGpa).toBe(4.0);
  });

  test('calculatedCoreGpa — F grade counts as 0.0 in GPA', () => {
    const withF = [
      { course_code: 'SC310001', grade: 'F', creditattempt: 3 },  // 0.0, not passed
      { course_code: 'SC310002', grade: 'B', creditattempt: 3 },  // 3.0
    ];
    const simpleCriteria = { ...criteria, coreCourses: ['SC310001', 'SC310002'], requiredCourses: [], prepCourseCodes: [], electiveMinCount: 1 };
    const result = checkEligibility(withF, simpleCriteria);
    // coreGpa = (0 × 3 + 3.0 × 3) / (3 + 3) = 1.5
    expect(result.calculatedCoreGpa).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=studentController
```

Expected: FAIL — `calculatedCoreGpa` not in return value.

- [ ] **Step 3: Update studentController.js — add GRADE_POINTS and fix checkEligibility**

Replace lines 6–32 (the `PASSING_GRADES` constant and `checkEligibility` function) with:

```js
const PASSING_GRADES = new Set(["S", "A", "B+", "B", "C+", "C", "D+", "D"]);

// เกรดที่นับในการคำนวณ GPA (S/U/W ไม่นับ)
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
  //    S/U/W ไม่นับในสูตร GPA แต่นับว่าผ่านใน passedCodes
  let totalPoints = 0, totalCredits = 0;
  for (const entry of gradeList) {
    if (!coreCourses.includes(entry.course_code)) continue;
    const pts = GRADE_POINTS[entry.grade];
    if (pts !== undefined) {  // S/U/W ไม่อยู่ใน GRADE_POINTS → ข้าม
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=studentController
```

Expected: All tests in `describe('checkEligibility', ...)` pass.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/studentController.js backend/__tests__/studentController.test.js
git commit -m "feat: checkEligibility calculates weighted coreGpa from coreCourses"
```

---

## Task 3: syncFromReg — Fix gpax_core + integrate calculatedCoreGpa + full isQualified

**Files:**
- Modify: `backend/controllers/studentController.js` (lines 402–482)

**Background:**
- Line 441: `g.gpax_core` doesn't exist in KKU API → `coreGpa` never updated
- Lines 450–453: second `getStudentToken` call → double login → potential 429
- Lines 460–463: `isQualified` only checks course eligibility, ignores `minGpa`, `minCoreGpa`, `minActivityUnit`
- Fix: use `result._token` (from syncStudentAll), pass `result.grades` (gradeSummary) to `getGradeList`, save `calculatedCoreGpa`, gate `isQualified` on all criteria

- [ ] **Step 1: Replace the syncFromReg function**

Replace the entire `exports.syncFromReg = async (req, res) => { ... }` block (lines 402–482) with:

```js
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

    // 1. ดึงข้อมูลพื้นฐาน (syncStudentAll ทำ login 1 ครั้ง แล้วดึงทุกอย่างพร้อมกัน)
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

- [ ] **Step 2: Run all tests — expect no regressions**

```bash
cd backend && npm test
```

Expected: 162 passing, 1 pre-existing failure (adminDocController).

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/studentController.js
git commit -m "fix: syncFromReg removes gpax_core, uses calculatedCoreGpa, checks all criteria for isQualified"
```

---

## Task 4: Final verification + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: 162+ passing, 1 pre-existing failure only.

- [ ] **Step 2: Run frontend type check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at the top of `CHANGELOG.md`:

```markdown
## [2026-05-29] KKU Grade Integration Fix

### Fixed
- `kkuRegService.getGradeList`: เปลี่ยนจาก `/student/enroll_list` (ไม่มี params → 404) เป็นดึง `enroll_list/:acadyear/:semester` ต่อภาคเรียน โดยใช้ semester list จาก `getGradeSummary`
- `studentController.syncFromReg`: ลบการอ่าน `g.gpax_core` ซึ่งไม่มีใน KKU API — `coreGpa` ถูกคำนวณจาก `coreCourses` แทน
- `studentController.syncFromReg`: ลบ double login (`getStudentToken` 2 ครั้ง) — ใช้ `result._token` จาก `syncStudentAll` แทน
- `studentController.syncFromReg`: `isQualified` ตอนนี้ตรวจสอบครบทุกเงื่อนไข: วิชา + minGpa + minCoreGpa + minActivityUnit

### Changed
- `kkuRegService.syncStudentAll`: คืน `_token` field เพิ่มเติมเพื่อให้ caller reuse token ได้
- `studentController.checkEligibility`: เพิ่ม `calculatedCoreGpa` ใน return value (weighted average GPA จาก coreCourses เท่านั้น)
- `checkEligibility` gradeList items ต้องมี `creditattempt` field (จาก KKU enroll_list response) เพื่อคำนวณ weighted GPA
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for KKU grade integration fix"
```

---

## Self-Review

**Spec coverage:**
- [x] Fix broken `getGradeList` endpoint → Task 1
- [x] Remove non-existent `gpax_core` read → Task 3
- [x] Calculate coreGpa from configured `coreCourses` → Task 2
- [x] `isQualified` checks all 4 criteria (courses + GPA + coreGpa + activity) → Task 3
- [x] Remove double login → Task 3 (uses `result._token`)

**Known assumptions (confirm before deploy):**
1. `getGradeSummary` returns `{ grade_summary: [{acadyear, semester, ...}] }` — the `grade_summary` key name needs verification against live API
2. `getEnrollList` response key: `enroll_list` — verified from API docs
3. `creditattempt` is the correct field name for credit hours — verified from API docs (`creditattempt`, not `credit_hours`)

**Type consistency check:**
- `getGradeList(accessToken, gradeSummary)` — called in `syncFromReg` as `getGradeList(result._token, result.grades)` ✓
- `checkEligibility` return now includes `calculatedCoreGpa` — `syncFromReg` reads `eligibility.calculatedCoreGpa` ✓
- `gradeList` items have `{ course_code, grade, creditattempt }` — test fixtures updated to match ✓
