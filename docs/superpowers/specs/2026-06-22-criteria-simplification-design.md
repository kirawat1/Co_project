# Criteria Simplification + Drop Student Curriculum Field — Design

## Goal

1. Simplify the admin "เงื่อนไขออกสหกิจศึกษา" (criteria) page to be just a list of valid majors (สาขา) — remove all GPA/course-based eligibility calculation.
2. Remove the `Student.curriculum` (คณะ/หลักสูตร) field entirely — the faculty is always คณะ/วิทยาลัยการคอมพิวเตอร์, so it doesn't need to be a per-student configurable field.

## Context

The system currently lets staff configure, per major, a set of eligibility rules (`CoopCriteria`: min GPA, min core GPA, min activity units, required courses, core courses, prep courses, elective minimum count). `checkEligibility()` in `studentController.js` evaluates a student's REG grade history against these rules during `syncFromReg`, writing `Student.isQualified`, `isPassPrepCourse`, and `coreGpa`. This is purely informational today (no submission flow is gated on `isQualified`) — it's shown as a badge on the student's own profile and as a column/filter for teachers reviewing requests.

Decision (confirmed with user): remove this eligibility calculation entirely. Students can apply for coop as long as their major exists in the major list — no grade/course checks at all.

Separately, `Student.curriculum` stores the student's faculty name (e.g. "วิทยาลัยการคอมพิวเตอร์"), populated from REG's `faculty_name_th`. Since every student in this system belongs to the same faculty, this field carries no real information. Decision (confirmed with user): drop the column from the DB, not just hide it in the UI.

## Part 1: Criteria simplification

### Schema (`backend/prisma/schema.prisma`)

`CoopCriteria` shrinks to:

```prisma
model CoopCriteria {
  id    String @id @default(uuid())
  major String @unique
}
```

Drop: `minGpa`, `minCoreGpa`, `minActivityUnit`, `requiredCourses`, `coreCourses`, `prepCourseCodes`, `electiveMinCount`.

`Student` model drops: `isQualified`, `isPassPrepCourse`, `coreGpa` (these only ever held the result of the calculation being removed).

`Student.gpa` and `Student.activityUnit` are kept — they're raw REG data, not derived from `CoopCriteria`, and remain useful as reference info for advisors.

### Backend

- `backend/controllers/criteriaController.js` — simplify to plain CRUD on `major` only: `getAllCriteria`, `saveCriteria` (create-only, no GPA/course fields), `deleteCriteria`, `getMajorList` keep working as today (just less data per record).
- `backend/controllers/studentController.js` — delete `checkEligibility()` (lines ~9-54) and its call site + related fields in `syncFromReg` (the `isPassPrepCourse`, `coreGpa`, `isQualified` computation block, ~lines 511-536). Keep the REG grade/info/advisor sync untouched otherwise.
- `backend/routes/adminRoutes.js` — remove the `GET /courses/search` route (only consumer is the criteria page's course-tag input, which is being removed).
- Remove the course-search controller function backing that route.

### Frontend

- `Frontend/src/components/A_CriteriaPage.tsx` — replace the whole form (GPA inputs + `CourseTagInput` for required/core/prep courses) with a simple list: existing majors with a delete button each, plus an "เพิ่มสาขา" input+button. Delete the `CourseTagInput` component (only used here).
- `Frontend/src/components/S_ProfilePage.tsx` — remove the "✅ ผ่านเกณฑ์เบื้องต้น / ⚠️ ไม่ผ่านเกณฑ์" badge block and the `isQualified` field from the profile type.
- `Frontend/src/components/T_Requests.tsx` — remove the `isQualified` column/badge ("คุณสมบัติ: ✅ ผ่าน / ❌ ไม่ผ่าน") and the `isPending && isQualified` filter (teacher just sees all pending requests for the major, unfiltered by qualification).
- `backend/controllers/authController.js` — remove `isPassPrepCourse: false, isQualified: false` default-value lines on student creation.

### Tests

Existing tests referencing `checkEligibility`, `isQualified`, `isPassPrepCourse`, `coreGpa` in `backend/__tests__/studentController.test.js` and `backend/__tests__/authController.test.js` are removed/updated to match.

## Part 2: Drop `Student.curriculum`

### Schema

Remove `curriculum String?` from the `Student` model. Prisma migration drops the column (acceptable — system has no real users yet, per earlier confirmation in this project).

### Backend (remove all reads/writes of `curriculum`)

- `backend/controllers/studentController.js` — remove `if (info.faculty_name_th) updateData.curriculum = info.faculty_name_th;` in `syncFromReg`.
- `backend/controllers/authController.js` — remove the 4 `curriculum: ...` assignments (registration defaults ×2, profile response mapping, REG sync update block ×1 more).
- `backend/controllers/studentImportController.js` — stop reading the `'คณะ'` Excel column; remove `curriculum` from both the `update` and `create` Prisma calls (lines ~55, 98, 102).

### Frontend

- `Frontend/src/components/S_ProfilePage.tsx` — remove the "คณะ" info row (read-only view), remove the "คณะ / หลักสูตร" form input + its `curriculum` state field, remove `curriculum` from the `StudentProfile`-like local type.
- `Frontend/src/components/S_Gateway.tsx` — remove the "คณะ:" info row and `curriculum` from its local profile type.
- `Frontend/src/components/S_Docs.tsx`, `A_CoopApplications.tsx`, `T_Requests.tsx`, `Frontend/src/components/store.ts` — remove the now-dead `curriculum?: string` field from each local type (declared but unused beyond the type itself).

### PDF generators (faculty name becomes a hardcoded constant)

`Frontend/src/utils/pdfGeneratorT000.ts`, `pdfGeneratorParentalConsent.ts`, `pdfGenerator.ts` currently print `profile.curriculum || "วิทยาลัยการคอมพิวเตอร์"` (or a blank-line fallback). Since the field is gone, each becomes a hardcoded `doc.text("วิทยาลัยการคอมพิวเตอร์", ...)` call, and `curriculum` is removed from each file's local `ProfileData`-like interface.

## Out of scope

- No change to `Student.major`, `Student.studyProgram`, or the `CURRICULUM_TH` constant in `A_Students.tsx` (that constant is actually keyed by `studyProgram`, unrelated to the field being removed despite the similar name — verified by reading its usage).
- No change to how majors are displayed elsewhere (`LEGACY_MAJOR_TH` mapping, `/api/admin/majors` endpoint) — only the criteria record's shape shrinks, not the major-list consumption pattern.
- No new feature for managing per-major Thai display labels — out of scope, matches today's behavior (admin still enters the same abbreviation string as today, e.g. "CS").

## Testing

- Backend: update/remove Jest tests referencing removed fields/functions (`checkEligibility`, `isQualified`, `isPassPrepCourse`, `coreGpa`, `curriculum`) across `studentController.test.js`, `authController.test.js`, `criteriaController.test.js`, `studentImportController.test.js` (all four exist today).
- Manual: verify the simplified criteria page can add/list/delete majors; verify student registration/profile no longer shows คณะ; verify a PDF (e.g. T000) still prints "วิทยาลัยการคอมพิวเตอร์" correctly.
