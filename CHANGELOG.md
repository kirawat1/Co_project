# CHANGELOG — Co_project

## [2026-06-22] Student Edit + Soft-Delete (Trash/Restore) for Staff/Teacher

### Added
- Staff/teacher can now edit a student's basic info (name, studentId, major, study program, year, phone, email, advisor, job position) via a new edit modal on the admin student list (`A_Students.tsx`).
- Staff/teacher can soft-delete a student (moves to a new "ถังขยะ" trash tab), restore it, or permanently delete it. Permanent delete is gated — a student must be in the trash first, and the UI requires typing the student's ID to confirm.
- New `Student.deletedAt` field. Trashed students are hidden from every existing student listing and blocked from logging in (Google OAuth), but their data (documents, visits, coop application, etc.) is untouched until a staff/teacher explicitly permanently deletes them — no auto-purge.

### Fixed
- `CoopApplicationForm` and `Visit` were missing `onDelete: Cascade` on their `Student` relation — permanently deleting a student with a submitted coop application or a scheduled visit would have thrown a foreign-key error. Both now cascade correctly.

### Why
Staff previously had no way to correct mistaken Excel imports, duplicate enrollments, or remove withdrawn students without direct DB access. Soft-delete (rather than instant hard-delete) avoids irreversible mistakes; permanent delete is opt-in and requires the record to already be in the trash.

## [2026-06-22] Drop CoopCriteria GPA/course fields and Student.curriculum/isQualified/coreGpa columns (Task 11/11 refactor — final)

### Removed
- `backend/prisma/schema.prisma`: shrunk `CoopCriteria` model down to `id`, `major`, `updatedAt` — dropped `minGpa`, `minCoreGpa`, `minActivityUnit`, `requiredCourses`, `coreCourses`, `prepCourseCodes`, `electiveMinCount`
- `backend/prisma/schema.prisma`: removed `curriculum`, `coreGpa`, `isPassPrepCourse`, `isQualified` from `Student` model
- Ran migration `20260621210012_simplify_criteria_drop_curriculum` against the local dev MySQL DB (`coop_mysql_db`) dropping the 11 now-unused columns across `coopcriteria` and `student` tables. DB only contains test/dev data — confirmed safe to drop without backfill/preservation.
- `backend/controllers/studentController.js`: found and fixed two leftover references that earlier tasks (1-10) missed and that the migration would have broken at runtime:
  - `updateMyProfile` (`PUT /api/students/me`) still computed `calculatedQualified` from `coopCriteria.minGpa/minCoreGpa/minActivityUnit` and wrote `curriculum`/`coreGpa`/`isPassPrepCourse`/`isQualified` into the `student.upsert()` payload — removed all of it
  - `getMyProfile`'s null-student placeholder response still included `curriculum`/`coreGpa`/`isPassPrepCourse` — removed
  - Deleted the orphaned, unreachable `exports.syncKkuData` function (no route ever imported it, and it referenced an unimported `axios` — dead code superseded by `syncFromReg`) which also wrote `curriculum`/`isPassPrepCourse`
- `backend/__tests__/criteriaController.test.js`: cleaned stale `minGpa`/`minCoreGpa`/`minActivityUnit` properties out of mock fixture objects

### Fixed
- `.gitignore`: the blanket `*.sql` DB-dump-exclusion rule was silently also matching `backend/prisma/migrations/**/*.sql`, which would have made every future migration's SQL file untracked by default. Added `!backend/prisma/migrations/**/*.sql` negation so migration files stay tracked while root-level DB dumps (e.g. `coop_data_utf8.sql`) remain ignored.

### Why
Task 11 (final) of the 11-task refactor that removed the GPA/course "eligibility" feature and the "curriculum" field system-wide. This is the only task that touches `schema.prisma` and runs the actual DB migration — it ran last because every consumer of these columns had to be removed first (Tasks 1-10) so the columns were genuinely unused and safe to drop. While cross-checking with the full backend test suite, found `studentController.js` still had two live references that Tasks 1-10 missed (not covered by existing tests) — fixed them as part of this final pass since the migration would otherwise have broken `PUT /api/students/me` in production. Full backend test suite (175/175 across 17 suites) and frontend `tsc --noEmit` both pass after the migration and fixes.

## [2026-06-22] Remove curriculum type field from S_Docs, A_CoopApplications, store (Task 9/11 refactor)

### Removed
- `Frontend/src/components/S_Docs.tsx`: ลบ `curriculum?: string` จาก `LocalStudentProfile` interface (line 22)
- `Frontend/src/components/A_CoopApplications.tsx`: ลบ `curriculum?: string` จาก `Student` type definition (line 17)
- `Frontend/src/components/store.ts`: ลบ `curriculum?: string` จาก `StudentProfile` interface (line 158)

### Why
Task 9 ของแผน refactor 11 tasks ที่ลบ curriculum field ทั้งระบบ — เป็นการเอา dead type fields ที่ไม่ได้ใช้แล้วออกจากกลุ่มคอมโพเนนต์ที่เหลือ ต่อเนื่องจาก Task 8 ที่แก้ T_Requests — DB columns ที่เกี่ยวข้อง ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

## [2026-06-22] Remove qualification column/filter + curriculum field from T_Requests (Task 8/11 refactor)

### Removed
- `Frontend/src/components/T_Requests.tsx`: ลบ `curriculum?: string` และ `isQualified?: boolean` จาก `StudentProfile` interface
- ลบเงื่อนไข `s.isQualified === true` จาก filter ที่หาคนที่สถานะรอตรวจ — ตอนนี้ bulk approve ครอบคลุมคำร้อง pending ทั้งหมด ไม่กรองตามคุณสมบัติแล้ว
- เปลี่ยนชื่อตัวแปร `qualifiedPendingList` → `pendingList` (ใช้ใน `handleBulkApprove` และปุ่ม bulk-approve) เพื่อให้ตรงกับความหมายใหม่
- ลบคอลัมน์ "คุณสมบัติ" จากตาราง (table header + cell ที่แสดง badge "✅ ครบ" / "❌ ไม่ผ่าน") และปรับ `colSpan` จาก 5 → 4
- ลบแถว "คุณสมบัติ" จาก modal รายละเอียดคำร้อง (ที่อ่าน `selectedStudent.isQualified`)
- ปรับ copy ปุ่ม bulk-approve จาก "อนุมัติผู้ผ่านเกณฑ์ทั้งหมด" → "อนุมัติทั้งหมด" และข้อความยืนยัน/comment ที่ส่งไป backend ให้ไม่อ้างถึงคุณสมบัติอีกต่อไป

### Why
Task 8 ของแผน refactor 11 tasks ที่ลบ GPA/course-based eligibility calculation และ curriculum field ทั้งระบบ (ต่อจาก Task 6 ที่แก้ S_ProfilePage) — DB columns ที่เกี่ยวข้อง (`curriculum`, `isQualified`) ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

### Removed
- `Frontend/src/components/S_ProfilePage.tsx`: ลบ `curriculum?: string` และ `isQualified?: boolean` จาก `StudentProfile` interface
- ลบกล่องแสดงสถานะ "ผ่านเกณฑ์เบื้องต้นจากการคำนวณ" (badge ที่อ่าน `profile.isQualified`) และแถว `<Info label="คณะ" .../>` ที่อ่าน `profile.curriculum`
- ลบ default `curriculum: profile.curriculum || "วิทยาลัยการคอมพิวเตอร์"` จาก initial state ของ edit-modal form
- ลบ form field "คณะ / หลักสูตร" (input ที่ผูกกับ `form.curriculum`) จาก edit modal

### Why
Task 6 ของแผน refactor 11 tasks ที่ลบ GPA/course-based eligibility calculation และ curriculum field ทั้งระบบ (ต่อจาก Task 5 ที่แก้ A_CriteriaPage) — DB columns ที่เกี่ยวข้อง (`curriculum`, `isQualified`) ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

## [2026-06-22] Simplify A_CriteriaPage to a plain major list (Task 5/11 refactor)

### Changed
- `Frontend/src/components/A_CriteriaPage.tsx`: ลบ components ทั้งหมด ที่เกี่ยวข้องกับ GPA/course eligibility calculation และแทนที่ด้วย simple "add/remove major" interface — ลบ `CourseTagInput` component, ลบ modal สำหรับแก้ไขเกณฑ์ (`editCriteriaModalOpen`, `openEditCriteriaModal`, `handleSaveCriteria`), ลบ state ทั้งหมด ที่เกี่ยวกับ `minGpa`, `minCoreGpa`, `minActivityUnit`, `requiredCourses`, `coreCourses`, `prepCourseCodes`, `electiveMinCount` — ยังคงเหลือเฉพาะการเพิ่ม/ลบสาขา (major) ตามคำขอจาก backend `POST /api/admin/criteria { major }` และ `DELETE /api/admin/criteria/:id`
- UI ปรับเป็น grid card layout ขนาดเล็กลง (`minmax(240px, 1fr)` แทน `minmax(380px, 1fr)`)

### Why
Task 5 ของแผน refactor 11 tasks ที่ลบ GPA/course-based eligibility calculation ทั้งระบบ — backend ได้แก้ไข `criteriaController` ไป เหลือเฉพาะ major list แล้ว ต่อเนื่องจาก Task 2-4

## [2026-06-22] Remove curriculum from student Excel import (Task 4/11 refactor)

### Removed
- `backend/controllers/studentImportController.js`: ลบ `const curriculum = String(row['คณะ'] || '').trim();` เนื่องจากไม่เก็บฟิลด์นี้อีกต่อไป ลบ `curriculum` จาก `prisma.student.upsert()` ทั้ง `update` และ `create` block
- `backend/__tests__/studentImportController.test.js`: ลบ `'คณะ': 'คณะวิทยาการคอมพิวเตอร์'` จากมอกแถวข้อมูล test ทำให้ 3 tests ผ่านหมด

### Why
Task 4 ของแผน refactor 11 tasks ที่ลบ curriculum field ทั้งระบบ (ต่อจาก Task 3 ที่แก้ authController) — DB columns ที่เกี่ยวข้อง (`curriculum`) ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

## [2026-06-22] Remove curriculum field + eligibility defaults from authController (Task 3/11 refactor)

### Removed
- `backend/controllers/authController.js`: ลบ `curriculum: extraInfo.program_name` จาก `prisma.student.upsert()` ทั้ง `update` และ `create` block (KKU API sync), ลบ default values `isPassPrepCourse: false`/`isQualified: false` จาก `create` block (eligibility ไม่ได้ใช้แล้ว)
- ลบ `curriculum: user.student.curriculum` จาก profile response mapping ใน `getProfile`
- ลบ `curriculum: studentInfo.faculty_name_th || null` จาก auto-registration `create` block (KKU login auto-create student)
- ลบ `if (studentInfo.faculty_name_th) updateData.curriculum = ...` จาก REG sync update block
- อัปเดต mock test data ใน `backend/__tests__/authController.test.js` ให้ตรงกับ shape ใหม่ (ลบ `curriculum: null`) — 13 tests ผ่านหมด

### Why
Task 3 ของแผน refactor 11 tasks ที่ลบ GPA/course-based eligibility calculation และ curriculum field ทั้งระบบ (ต่อจาก Task 2 ที่แก้ studentController/criteriaController) — DB columns ที่เกี่ยวข้อง (`curriculum`, `isPassPrepCourse`, `isQualified`) ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

## [2026-06-22] Remove checkEligibility + curriculum sync from studentController (Task 2/11 refactor)

### Removed
- `studentController.checkEligibility()` และ constants `PASSING_GRADES`/`GRADE_POINTS` ลบออกทั้งหมด (ส่วนของแผน "ลบ eligibility calculation + curriculum field")
- `syncFromReg`: ลบบรรทัด sync `curriculum` จาก `info.faculty_name_th`, ลบ eligibility block ทั้งหมด (`gradeList`/`criteria` lookup, การคำนวณ `isPassPrepCourse`/`coreGpa`/`isQualified`) — ตอนนี้ sync เฉพาะ firstName/lastName/major/year/prefix/activityUnit/gpa/advisorName จาก KKU API ตรงๆ
- `describe('checkEligibility', ...)` test suite ทั้งหมดใน `backend/__tests__/studentController.test.js` ลบออก (11 tests เหลือ ผ่านหมด)

### Why
Task 2 ของแผน refactor 11 tasks ที่ลบ GPA/course-based eligibility calculation และ curriculum field ทั้งระบบ — DB columns ที่เกี่ยวข้อง (`isPassPrepCourse`, `coreGpa`, `isQualified`, `curriculum`) ยังอยู่ใน schema (migration ที่ลบจะอยู่ใน task สุดท้ายของแผน)

## [2026-06-22] T008 Image Removal + Auto-Resizing Textareas

### Added
- `Frontend/src/components/AutoTextarea.tsx` — drop-in replacement for `<textarea>` ที่ปรับ `height` ตาม `scrollHeight` อัตโนมัติทุกครั้งที่ `value` เปลี่ยน (ปิด resize handle มือ) ใช้แทน `<textarea>` ทั้งระบบ (21 ที่ใน 18 ไฟล์: A_Announcements, A_CoopApplications, A_DocT000/T002Review/T003Review/T005_006/T007/T008, S_DailyPage, S_Docs, S_DocsT002Form, S_DocsT003Form, S_Gateway, T_Exams, T_Requests, T_SupervisionReview, T_T002Review, T_T003Review)
- ปุ่ม "🗑️ ลบภาพ" ใน `A_DocT008.tsx` — เคลียร์รูปที่เลือก/อัปโหลดไว้ (`imageFile`, `existingImage`, `imagePreview`) ต้องกด "บันทึกการเปลี่ยนแปลง" เพื่อให้มีผลจริงที่ server (backend เดิมรองรับ `existingImage=""` → set `imagePath = null` อยู่แล้ว ไม่ต้องแก้ backend)

## [2026-06-21] KKU Network Keep-Alive Task (every 2h)

### Added
- `docs/network-keepalive.ps1` — รัน `network-login.js` ซ้ำ log ผลลง `docs/network-keepalive.log` (gitignored)
- Task Scheduler `CoopNetworkKeepAlive` บน VM — รัน `network-keepalive.ps1` ทุก 2 ชม. รันเป็น user `project` (ไม่ใช่ SYSTEM)

### Why
KKU-Net captive-portal session หลุดได้ระหว่างที่ VM เปิดอยู่ปกติ (ไม่ใช่แค่ตอน reboot) ทำให้ ngrok ขึ้น `ERR_NGROK_3200` แม้ PM2 process ยัง online ปกติ — เดิมมีแค่ auto-login ตอนบูตเครื่อง (`startup.ps1`) ไม่ครอบคลุมกรณีนี้

## [2026-06-21] Export Student Roster to Excel — Full Feature (6 commits)

### Added
- `backend/utils/coopStatusLabels.js` — `getStatusLabelTh()` function แปลง CoopStatus enum เป็นป้ายกำกับภาษาไทย (25+ statuses)
- `backend/utils/studentExport.js` — `buildStudentExportWorkbook()` สร้างไฟล์ workbook (.xlsx) buffer จาก array นักศึกษา (header row เดียว ไม่มี styling/border)
- `GET /api/admin/students/export?coopPeriodId=<id|all>` — admin/staff endpoint (ทุกนักศึกษา) คืนไฟล์ .xlsx รายชื่อนักศึกษาพร้อม status ที่แปลเป็นไทยแล้ว
- `GET /api/teacher/students/export?coopPeriodId=<id|all>` — teacher endpoint (อาจารย์ปกติ=advisees เท่านั้น, isCoopTeacher=ทุกคน) คืนไฟล์ .xlsx เช่นเดียวกัน
- `exports.exportStudents` ใน `backend/controllers/studentController.js` — handle logic export admin
- `exports.exportMyStudents` ใน `backend/controllers/teacherController.js` — handle logic export teacher (permission check advisee/all students เหมือน `getMyStudents`)
- "📥 Export Excel" button ใน `Frontend/src/components/A_Dashboard.tsx` — เรียก admin export endpoint
- "📥 Export Excel" button ใน `Frontend/src/components/T_Dashboard.tsx` — เรียก teacher export endpoint
- Tests: `describe('exportStudents', ...)` ใน `backend/__tests__/studentController.test.js` (200 ส่งไฟล์, 200 filter coopPeriodId, 500 DB error) และ `describe('exportMyStudents', ...)` ใน `backend/__tests__/teacherController.test.js` (404 ไม่พบอาจารย์, 200 advisee filter, 200 isCoopTeacher ไม่ filter, 500 DB error)

### Changed
- `backend/routes/adminRoutes.js` — เพิ่ม `GET /students/export` route ที่เรียก `studentController.exportStudents`
- `backend/routes/teacherRoutes.js` — เพิ่ม `GET /students/export` route ที่เรียก `teacherController.exportMyStudents`

## [2026-06-03] Notification System

### Added
- `Notification` Prisma model — userId, type, title, message, link, isRead, relatedId (dedup key)
- `backend/utils/notificationHelper.js` — createNotifications (with dedup), getStaffAndCoopTeacherIds
- `GET /api/notifications/unread-count` — คืน unread count ของ user
- `POST /api/notifications/mark-all-read` — mark ทั้งหมดของ user เป็น read
- `NotificationBell.tsx` — badge ตัวเลขสีแดงใน sidebar กดแล้ว navigate + mark all read

### Changed
- `coopController.js` — notify staff+isCoopTeacher เมื่อนักศึกษายื่นคำร้อง
- `supervisionController.js` — notify staff+isCoopTeacher เมื่อเสนอวัน; notify student เมื่อยืนยัน/ปฏิเสธ/อัปโหลดหนังสือ
- `adminDocController.js` — notify student เมื่อ review T002/T003/status
- `A_Sidebar.tsx`, `T_Sidebar.tsx`, `S_Sidebar.tsx` — เพิ่ม NotificationBell

## [2026-06-03] Status Display Redesign

### Added
- `S_StatusTracker.tsx` — horizontal 4-phase stepper (ยื่นคำร้อง → เอกสาร T000 → ฝึกสหกิจ → รายงาน T008) พร้อม sub-steps ของเฟสปัจจุบัน และ action card "ต้องทำอะไรตอนนี้" พร้อมลิงก์
- `StatusFilterChips.tsx` — chips แสดงจำนวนนักศึกษาต่อกลุ่มสถานะ (รอตรวจสอบ / ต้องแก้ไข / กำลังดำเนินการ / ฝึกสหกิจ / เสร็จสิ้น) กดกรองตาราง

### Changed
- `S_Dashboard.tsx` — แทนที่ status-banner เดิมด้วย `S_StatusTracker`
- `S_Gateway.tsx` — เพิ่ม `S_StatusTracker` ด้านบน section สถานะ (แสดงเมื่อยื่นคำร้องแล้ว)
- `A_Students.tsx` — เพิ่ม `StatusFilterChips` ด้านบนตาราง
- `T_Students.tsx` — เพิ่ม `StatusFilterChips` ด้านบนตาราง + filter logic

## [2026-06-02] Teacher Types

### Added
- `Teacher.isCoopTeacher Boolean @default(false)` — เจ้าหน้าที่ toggle ได้จาก A_Teacher
- `GET /api/teacher/my-students` — อาจารย์ประจำวิชาสหกิจคืนนักศึกษาทั้งหมด; อาจารย์ปกติคืนเฉพาะ advisees (generalAdvisor/coopAdvisor)
- badge "ประจำวิชาสหกิจ" ใน A_Teacher teacher list + toggle switch ในฟอร์มแก้ไข
- `AdvisorRow` component ใน S_ProfilePage — แสดงชื่อ + email + ปุ่ม mailto ติดต่อ

### Changed
- `getMyProfile` (students): include `generalAdvisor` และ `coopAdvisor` details
- `T_Students.tsx`: ใช้ `/api/teacher/my-students` สำหรับอาจารย์ปกติ, `/api/students` สำหรับอาจารย์ประจำวิชาสหกิจ
- `S_ProfilePage.tsx`: แสดงอาจารย์ที่ปรึกษาทั้งสองคนพร้อม email ติดต่อ

---

## [2026-05-31] Google OAuth + Excel Student Import

### Added
- `POST /api/auth/login/google` — Google OAuth login สำหรับนักศึกษา (ต้องเป็น @kkumail.com หรือ @kku.ac.th)
- `POST /api/admin/students/import-excel` — นำเข้าข้อมูลนักศึกษาจาก Excel (.xlsx/.xls)
- `Student.generalAdvisorId` → FK to Teacher (set ตอน Excel import โดย match email อาจารย์)
- `Student.coopAdvisorId` → FK to Teacher (นักศึกษาเลือกเองผ่าน profile page)
- `GoogleLogin` button บนหน้า login สำหรับ role นักศึกษา (แทน KKU REG tab)
- Excel import UI ใน `A_Students.tsx` — เลือกไฟล์ + summary ผลการนำเข้า
- CoopAdvisor dropdown ใน `S_ProfilePage.tsx`

### Changed
- `POST /api/auth/login/kku` — ปิดแล้ว (route commented out)
- `Frontend/src/main.tsx` — wrapped ด้วย `GoogleOAuthProvider`

### Notes
- ต้องตั้งค่า `GOOGLE_CLIENT_ID` ใน `backend/.env` และ `VITE_GOOGLE_CLIENT_ID` ใน `Frontend/.env` ก่อนใช้งาน

---

## [2026-05-30] Announcement Major Targeting

### Added
- `Announcement` schema: `targetMajors Json @default("[]")` — `[]` หมายถึงทุกสาขา, `["CS","IT"]` หมายถึงเฉพาะสาขาที่ระบุ
- `GET /api/admin/students/majors` — distinct majors จาก Student table สำหรับ dropdown ในฟอร์มประกาศ
- `S_Announcements.tsx` — หน้าประกาศแยก สำหรับนักศึกษา แสดง stream แบบ Classroom (filter ตาม major อัตโนมัติ)
- เมนู "ประกาศ" ใน Student Sidebar → `/student/announcements`

### Changed
- `GET /api/announcements?major=<major>` — กรองประกาศตาม major ฝั่ง server ([] = ทุกสาขา)
- `POST /api/announcements` — รับ `targetMajors` (JSON array) และบันทึกลง DB
- `A_Announcements.tsx` — modal เพิ่ม targeting section (ทุกสาขา / เลือกสาขา + checkbox), การ์ดแสดง badge สาขา
- `S_Dashboard.tsx` — ดึงประกาศ filter ตาม `student.major`, แสดง 3 ล่าสุด + ลิงก์ "ดูทั้งหมด →"

---

## [2026-05-30] Announcements Feature - Routing and Sidebar (Task 6)

### Added
- `S_Announcements` route in `S_App.tsx` at path `/student/announcements`
- "ประกาศ" (Announcements) NavLink in `S_Sidebar.tsx` between "ข้อมูลบริษัท" (Company) and "ยื่นคำร้องสหกิจ" (Apply for Co-op) with bell icon

### Changed
- Student sidebar now displays announcements navigation link

---

## [2026-05-29] KKU Grade Integration Fix

### Fixed
- `kkuRegService.getGradeList`: เปลี่ยนจาก `/student/enroll_list` (ไม่มี params → 404) เป็นดึง `enroll_list/:acadyear/:semester` ต่อภาคเรียน โดยใช้ semester list จาก `getGradeSummary`
- `studentController.syncFromReg`: ลบการอ่าน `g.gpax_core` ซึ่งไม่มีใน KKU API — `coreGpa` ถูกคำนวณจาก `coreCourses` แทน
- `studentController.syncFromReg`: ลบ double login (`getStudentToken` 2 ครั้ง) — ใช้ `result._token` จาก `syncStudentAll` แทน
- `studentController.syncFromReg`: `isQualified` ตอนนี้ตรวจสอบครบทุกเงื่อนไข: วิชา + minGpa + minCoreGpa + minActivityUnit

### Changed
- `kkuRegService.syncStudentAll`: คืน `_token` field เพิ่มเติมเพื่อให้ caller reuse token ได้
- `studentController.checkEligibility`: เพิ่ม `calculatedCoreGpa` ใน return value (weighted average GPA จาก coreCourses เท่านั้น, S/U/W ไม่นับในสูตร)

---

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

---

## [2026-05-29] Server-side Period Filter สำหรับหน้าตรวจเอกสาร

### Added
- `GET /api/admin/students` รองรับ `?coopPeriodId=<id>` และ `?search=<text>` — กรองนักศึกษาตามปีการศึกษาและค้นหาที่ DB level
- `A_DocT002Review.tsx`: re-fetch ข้อมูลจาก server เมื่อเปลี่ยน dropdown ปีการศึกษา (`reloadStudents` + `useEffect[selectedPeriod]`)
- `A_DocT003Review.tsx`: เช่นเดียวกัน (T003 status filter)
- `T_T002Review.tsx`: เช่นเดียวกัน (T002 status filter)
- `T_T003Review.tsx`: เช่นเดียวกัน (T003 status filter)

### Changed
- ทุกหน้าตรวจเอกสาร: ลบ client-side period filter (`pId`, `matchPeriod`) ออกจาก `processedStudents` useMemo — ปีการศึกษากรองที่ server แทน
- แก้ `value={p.id}` → `value={String(p.id)}` ใน dropdown ทุกไฟล์ — ป้องกัน number/string type mismatch

---

## [2026-05-29] Server-side Search สำหรับรายชื่อนักศึกษา

### Added
- `GET /api/students` รองรับ `?search=<text>` — ค้นหาด้วย studentId / ชื่อ / นามสกุล / อีเมล ที่ DB level
- `A_Students.tsx`: ค้นหา debounce 300ms → server-side query ทุก page (เห็นผลครบทุกคน ไม่ถูกจำกัดแค่ page ปัจจุบัน)
- `T_Students.tsx`: เพิ่ม `useDebounce` + ค้นหา server-side เช่นเดียวกัน

### Changed
- `A_Students.tsx`: ลบ client-side text filter ออก (major/status/curriculum ยังคง client-side)
- `T_Students.tsx`: ลบ client-side text filter ออก (major ยังคง client-side)

---

## [2026-05-29] Code Review Fixes (9 จุด)

### Fixed
- `supervisionController.reviewSupervision`: เพิ่ม null-check สำหรับ `teacher` — ป้องกัน TypeError crash เมื่อ user มี role=teacher แต่ไม่มีแถวใน Teacher table
- `supervisionController.reviewSupervision`: เพิ่ม `LETTER_UPLOADED` ในการตรวจ conflict วันนิเทศซ้ำ (เดิมตรวจแค่ `DATE_CONFIRMED`)
- `supervisionController.proposeSupervisionDate`: กรองคำนำหน้า (ที่มีจุด เช่น ผศ., ดร.) ออกก่อน parse advisorName — ป้องกัน 2-token name เช่น "รศ.ดร. สมหญิง" ทำให้หาอาจารย์ไม่เจอ
- `supervisionController.proposeSupervisionDate`: fallback teacher lookup เปลี่ยนจาก exact match เป็น `contains` (สอดคล้องกับ primary query)
- `supervisionController.getTeacherSupervisions`: เพิ่ม guard ความยาว `firstName >= 2` ก่อนใช้ `coTeacherName: { contains: firstName }` — ป้องกัน false-positive กับชื่อสั้น
- `studentController.updateMyProfile`: เพิ่ม unique check ก่อน upsert studentId — คืน 409 แทน 500 เมื่อรหัสซ้ำ
- `adminDocController.getAllStudentsForReview`: เพิ่ม `take: 500` เป็น hard cap ป้องกัน unbounded query
- `A_Students.tsx`: เพิ่ม Pagination (หน้าละ 50 คน) พร้อม UI Prev/Next และเลขหน้า — แก้บัก Staff เห็นนักศึกษาแค่ 50 คนแรก
- `T_Students.tsx`: แก้ `value={p.id}` (number) → `value={String(p.id)}` — dropdown ปีการศึกษาแสดง selected ถูกต้อง

---

## [2026-05-29] แก้ปัญหาระบบเก็บไฟล์ (File Storage Fixes)

### Fixed
- `backend/.gitignore`: เพิ่ม `uploads/` — ป้องกันไฟล์อัปโหลดของนักศึกษา (85+ ไฟล์) เข้า git โดยไม่ตั้งใจ
- `supervisionController.uploadOfficialLetter`: เพิ่ม cleanup ไฟล์เมื่อ DB update ล้มเหลว ป้องกัน orphaned files
- `docController.deleteDocumentByType`: ครอบ `fs.unlinkSync` ด้วย try/catch เพื่อป้องกัน 500 เมื่อไฟล์ถูกลบไปก่อนแล้ว
- `uploadMiddleware.js`: ลบ dead code `fileFilter` ที่ไม่เคยถูกใช้งาน (multer ใช้ inline filter แทน)
- `supervisionController.js`: ย้าย `require('fs')` และ `require('path')` ขึ้น top-level

---

## [2026-05-29] ดูข้อมูลย้อนหลังตาม CoopPeriod

### Added
- `GET /api/students` รองรับ `?coopPeriodId=<id>` — กรองนักศึกษาตามรอบสหกิจที่ DB level (pagination ถูกต้อง)
- `GET /api/admin/students` รองรับ `?coopPeriodId=<id>` — กรองนักศึกษาตามรอบสหกิจที่ DB level
- `A_Students` (Staff): เพิ่ม dropdown "ปีการศึกษา" ด้านบน filter — เลือกดูนักศึกษาตามรอบสหกิจย้อนหลัง
- `backend/__tests__/adminDocController.test.js` — 3 unit tests สำหรับ `getAllStudentsForReview`
- `backend/__tests__/studentController.test.js` — เพิ่ม 2 test cases สำหรับ period filter

### Fixed
- `T_Students` (Teacher): แก้ period filter ที่ไม่ทำงาน — เปลี่ยนจาก client-side (ใช้ `s.coopPeriodId` ผิด field) เป็น server-side query param `?coopPeriodId=<id>` พร้อม re-fetch อัตโนมัติเมื่อเปลี่ยน period

---

## [2026-05-28] เพิ่ม Test Coverage ระดับ System

### Backend Unit Tests (เพิ่มใหม่ 7 ไฟล์)
- `supervisionController.test.js` — 16 tests (getSupervisionPeriods, getAllSupervisions, reviewSupervision, calendar ฯลฯ)
- `teacherController.test.js` — 18 tests (getProfile, updateProfile, reviewT002, createTeacher, deleteTeacher ฯลฯ)
- `announcementController.test.js` — 20 tests (getAnnouncements, addOrUpdate, delete; รวม fs mock)
- `companyController.test.js` — 13 tests (CRUD + permission check 403)
- `criteriaController.test.js` — 13 tests (getAllCriteria, getCriteria, saveCriteria, deleteCriteria)
- `coopPeriodController.test.js` — 15 tests (getPeriods, createPeriod, togglePeriod, getActivePeriod ฯลฯ)
- `adminDashboardController.test.js` — 5 tests (getDashboardStats กับ/ไม่มี year filter)
- ขยาย `__mocks__/prismaClient.js` ครอบ 17 models ทั้งหมด

### Backend Integration Tests (ใหม่)
- `routes/auth.routes.test.js` — 9 tests (supertest: POST /signin, GET /me)
- `routes/student.routes.test.js` — 5 tests (supertest: GET /students middleware chain)

### Frontend Interaction Tests (ใหม่)
- `admin.interaction.spec.ts` — 5 tests (TC-AI-01 ถึง TC-AI-05: JS error detection)
- `student.interaction.spec.ts` — 5 tests (TC-SI-01 ถึง TC-SI-05: JS error detection)

### Coverage Summary
| Layer | ก่อน | หลัง |
|-------|------|------|
| Backend controllers | 4/16 (25%) | 11/16 (69%) |
| Backend route integration | 0 | 2 routes |
| Frontend smoke tests | 64 | 64 (คงเดิม) |
| Frontend interaction tests | 0 | 10 |
| รวม tests | ~64 | 223 |

---

## [2026-05-28] จัดระเบียบไฟล์โปรเจกต์

### ✅ .gitignore
- สร้าง root `.gitignore` (ครอบ `planning.md`, `.claude/`, OS files)
- เพิ่ม Playwright artifacts ใน `Frontend/.gitignore`: `test-results/`, `playwright-report/`, `TESTCASES.pdf`
- ลบ root `package-lock.json` (ไม่มี root `package.json`)

### ✅ จัดระเบียบ Backend
- ย้าย `backend/hash_password.js` → `backend/scripts/hash_password.js`
- ลบ `backend/models/` (ว่างเปล่า)
- อัปเดต `CLAUDE.md`: แก้ path `node backend/hash_password.js` → `node backend/scripts/hash_password.js`

### ✅ อัปเดต README.md
- แก้ "4 บทบาท" → "3 บทบาท"
- ลบ `M_*` components reference
- แก้ `node hash_password.js` → `node scripts/hash_password.js`
- ลบ row `mentor` ออกจากตาราง Roles
- เพิ่ม Playwright testing section (64 tests)
- แยกหัวข้อ Backend (Jest) และ Frontend (Playwright)

### ✅ ลบไฟล์ล้าสมัย
- ลบ `Frontend/README.md` (ซ้ำซ้อนกับ root README.md)

---

## [2026-05-28] ลบ Mentor Portal ออกจากระบบ

### 🗑️ ลบ Frontend Portal `/mentor/*` (เก็บ Mentor ไว้ใน DB และ Admin UI)

**ไฟล์ที่ลบ (7 ไฟล์):**
- `Frontend/src/components/M_App.tsx` — Mentor app shell + routing
- `Frontend/src/components/M_Sidebar.tsx` — sidebar navigation
- `Frontend/src/components/M_Dashboard.tsx` — dashboard (localStorage-based)
- `Frontend/src/components/M_Students.tsx` — รายชื่อนักศึกษาในดูแล
- `Frontend/src/components/M_Daily.tsx` — บันทึกประจำวัน
- `Frontend/src/components/M_Profile.tsx` — โปรไฟล์พี่เลี้ยง
- `Frontend/tests/mentor.spec.ts` — Playwright tests 11 กรณี

**ไฟล์ที่แก้:**
- `Frontend/src/App.tsx` — ลบ MentorApp import และ `<Route path="/mentor/*">` ออก
- `Frontend/tests/helpers/mockApi.ts` — ลบ `setupMentorMocks` function
- `Frontend/TESTCASES.md` — ลบ Mentor section, แก้ยอดรวม 75 → 64
- `Frontend/tests/generate-testcase-pdf.js` — ลบ Mentor section + แก้ totals
- `Frontend/TESTCASES.pdf` — re-generated

**ไม่แตะ:** Prisma Mentor model, StudentCoop.mentorId, companyRoutes mentor API, A_Mentors.tsx, A_Sidebar.tsx  
**Tests:** 64/64 ✅ (ลด 11 test cases จาก Mentor portal)

---

## [2026-05-28] Playwright UI Tests — ทุก Role ผ่าน 75/75 ✅

### ✅ เพิ่มชุด Playwright UI Tests สำหรับ 4 roles (Student, Admin, Teacher, Mentor)

- **`Frontend/playwright.config.ts`** (ใหม่) — config Playwright: `baseURL=http://localhost:5173`, webServer auto-start Vite, 1 worker, Chromium only
- **`Frontend/tests/helpers/mockApi.ts`** (ใหม่) — helper: inject `coop.token` ผ่าน `addInitScript`, mock API ทั้งหมดด้วย `page.route()`, strategy LIFO-aware (catch-all ก่อน → specific ทีหลัง)
  - เพิ่ม `ZEROED_STATS` constant แยกสำหรับ stats endpoints เพื่อป้องกัน `stats.totalStudents.toLocaleString()` crash
  - `SAFE_EMPTY.data = []` (array) สำหรับ list components เพื่อป้องกัน `items.filter is not a function` crash
- **`Frontend/tests/student.spec.ts`** (ใหม่) — 19 test cases TC-S-00 ถึง TC-S-18
- **`Frontend/tests/admin.spec.ts`** (ใหม่) — 27 test cases TC-A-00 ถึง TC-A-26
- **`Frontend/tests/teacher.spec.ts`** (ใหม่) — 18 test cases TC-T-00 ถึง TC-T-17
- **`Frontend/tests/mentor.spec.ts`** (ใหม่) — 11 test cases TC-M-00 ถึง TC-M-10
- **`Frontend/TESTCASES.md`** (ใหม่) — เอกสาร 75 test cases แบบ table format

### 🐛 Bug Fix พบจากการทำ test

- **`Frontend/src/components/M_App.tsx:79`** — แก้ wildcard route: `<Navigate to="dashboard">` (relative) → `<Navigate to="/mentor/dashboard">` (absolute)
  - สาเหตุ: relative path จาก `/mentor/nonexistent` → `/mentor/nonexistent/dashboard` → วนซ้ำ infinite redirect loop
- **`Frontend/src/components/T_App.tsx:133`** — แก้เช่นเดียวกัน: `<Navigate to="dashboard">` → `<Navigate to="/teacher/dashboard">`
  - A_App.tsx ใช้ absolute path อยู่แล้ว (`to="/admin/dashboard"`) จึงไม่มีปัญหา

---

## [2026-05-28] Security & Bug Fix — Code Review Findings (10 items)

### 🔴 Critical

- **authController.js:120** — แก้ `loginWithSSO`: role ถูก set เป็น `"STUDENT"`/`"TEACHER"` (uppercase) แต่ branch ตรวจสอบ lowercase และ Prisma enum ต้องการ lowercase → เปลี่ยนเป็น `"student"`/`"teacher"` ทำให้ SSO login สร้าง Student/Teacher record ได้ถูกต้อง

### 🔴 High (Security)

- **supervisionRoutes.js:24** — เพิ่ม `verifyRole(...ADMIN_ROLES)` ใน admin routes ทั้ง 5 เส้นทาง (supervision-periods, supervisions, confirmed-date, upload-letter) ที่เคยมีแค่ `verifyToken` → ป้องกันนักศึกษาหรืออาจารย์เข้าถึง admin endpoint
- **authController.js:400** — แก้ `loginWithKKU` year guard: เปลี่ยน `if (classYear > 0 && classYear < 3)` → แยก 2 กรณี: `classYear === 0` (ไม่ทราบชั้นปี) return 403 พร้อมข้อความให้ติดต่อเจ้าหน้าที่; `classYear < 3` return 403 ปี 1-2 ผ่านไม่ได้ → ป้องกัน bypass เมื่อ KKU REG ไม่ส่ง `class_year`

### 🟠 High

- **teacherController.js:504** — แก้ `adminUpdateTeacher`: เพิ่ม duplicate email check ก่อน update; เปลี่ยนใช้ `prisma.$transaction([...])` อัปเดต Teacher+User พร้อมกัน → ป้องกัน inconsistent state เมื่อ User.email update ล้มเหลวหลัง Teacher.email สำเร็จ
- **authController.js:424** — แก้ `loginWithKKU` auto-create: เพิ่มตรวจ `Student.studentId` ซ้ำก่อน `prisma.user.create()` → คืน 409 พร้อมข้อความชัดเจน แทน generic 500 P2002

### 🟠 Medium

- **supervisionController.js:1 + teacherController.js:1** — เปลี่ยน `new PrismaClient()` → `require('../config/prismaClient')` ทั้ง 2 ไฟล์ → ใช้ shared singleton ป้องกัน connection pool exhaustion
- **authController.js:390** — แก้ faculty allowlist ใน `loginWithKKU`: เปลี่ยน `.some(f => facultyFromReg.includes(f))` → `.some(f => facultyFromReg === f.toLowerCase())` (exact match) → ป้องกัน "Cloud Computing" หรือ faculty อื่นที่มีคำ "computing" ในชื่อผ่านได้
- **server.js** — เพิ่ม `registerLimiter` (10 req/hr ต่อ IP) บน `POST /api/auth/register` → ป้องกัน spam สร้าง account ไม่จำกัด

### 🟡 Medium

- **supervisionController.js:114** — แก้ `proposeSupervisionDate` advisor lookup: เพิ่ม trim + ตรวจ whitespace-only advisorName; เปลี่ยนจากค้นหาด้วย surname อย่างเดียว (`contains: lastName`) → ค้นหา firstName+lastName พร้อมกัน (AND) + fallback exact lastName → ป้องกัน whitespace `" "` จับอาจารย์คนแรก random

### 🟡 Low

- **authController.js:502** — แก้ `registerStudent` password validation: เพิ่ม `.trim()` ก่อน regex test (`/^\d{13}$/`) → ป้องกัน trailing space จาก mobile paste ทำให้ validation fail ทั้งที่รหัสถูกต้อง

---

## [2026-05-14] Security & Code Quality Overhaul

### Security (Critical)

- **authController.js** — เปลี่ยน `password === user.password` เป็น `bcrypt.compare()` ป้องกัน plaintext comparison
- **authController.js** — ลบ `console.log` ที่ print password ออก log
- **authMiddleware.js** — ลบ hardcoded fallback secret `|| 'MySecretKey123'`; throw error ถ้าไม่มี `JWT_SECRET`
- **hash_password.js** — รับ password จาก CLI argument (`node hash_password.js <pw>`) แทน hardcode
- **backend/.env** — ลบ key ซ้ำ (`JWT_SECRET` มีสองบรรทัด); ใส่ placeholder ที่ชัดเจน
- **backend/.env.example** — เขียนใหม่ให้ตรงกับ MySQL stack (ของเดิมยังเป็น MongoDB)
- **scripts/migrate_passwords.js** (ใหม่) — Hash plaintext passwords ทั้งหมดใน DB (13 users)

### Middleware Consolidation

- **middlewares/auth.js** — ลบทิ้ง (ซ้ำกับ `authMiddleware.js`)
- **routes/coopRoutes.js** — เปลี่ยนมาใช้ `verifyToken` จาก `authMiddleware.js`
- **routes/companyRoutes.js** — เปลี่ยนจาก `auth.js` → `authMiddleware.js`
- **routes/visitRoutes.js** — เปลี่ยนจาก `auth.js` → `authMiddleware.js`

### API Security

- **server.js** — เพิ่ม startup validation (exit ถ้าไม่มี `JWT_SECRET` หรือ `DATABASE_URL`)
- **server.js** — เพิ่ม CORS whitelist (origin-based, ไม่ accept ทุก domain)
- **server.js** — เพิ่ม Rate Limiting บน `/api/auth` (20 req / 15 นาที) ด้วย `express-rate-limit`
- **routes/adminRoutes.js** — เพิ่ม `verifyToken` + `verifyRole` ทุก route ที่ sensitive (เดิมหลายตัวไม่มี guard)

### Input Validation & Pagination

- **coopController.js** — validate `studentId` (NaN, ≤0, null) และ `status` enum ก่อน update
- **studentController.js** — เพิ่ม pagination `?page=&limit=` (default 50, max 100) ใน `getStudents`
- **studentController.js** — ลบ debug `console.log` ใน `getMyProfile`

### Frontend

- **44 frontend files** — ลบ `http://localhost:5000` ออกทั้งหมด → ใช้ relative path กับ Vite proxy
- **vite.config.ts** — เพิ่ม proxy `/uploads` → backend (เดิมมีแค่ `/api`)
- **Frontend/.env** + **Frontend/.env.example** (ใหม่) — template สำหรับ `VITE_API_URL`

### Dependencies

- **backend/package.json** — ลบ `react-pdf`, `framer-motion`, `react-swipeable` (ของ frontend ไม่ใช่ backend)
- **backend/package.json** — เพิ่ม `express-rate-limit`, `jest`, `supertest`, `@types/jest`, `@types/supertest`

### Tests (ใหม่)

- **`__tests__/setup.js`** — ตั้งค่า env สำหรับ test environment
- **`__tests__/__mocks__/prismaClient.js`** — Mock Prisma ทั้งหมด (ไม่ต้อง connect DB จริง)
- **`__tests__/authMiddleware.test.js`** — 8 tests: verifyToken (valid/expired/wrong-secret/format), verifyRole
- **`__tests__/authController.test.js`** — 10 tests: signIn (missing fields, bad role, not found, wrong pw, success), getProfile
- **`__tests__/coopController.test.js`** — 10 tests: submit (no period, closed, no student, success), updateStatus (validation, mapping), deleteDocument
- **`__tests__/studentController.test.js`** — 7 tests: getStudents pagination, getMyProfile
- **ผล**: 35/35 tests ผ่าน

---

## [2026-05-14] Supervision Feature — Teacher View

### Bug Fix

- **T_Requests.tsx** — แก้ `TypeError: students.filter is not a function`
  - สาเหตุ: `getStudents` API คืน `{ data: [...], meta: {...} }` หลังเพิ่ม pagination แต่ component ยัง `setStudents(res.data)` ทั้งก้อน
  - แก้ไข: `const studentArray = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])`

### Supervision — Teacher Review (T_SupervisionReview.tsx)

- **แสดงวันที่ถูกจองแล้ว**: แถบ summary ด้านบน แสดงวัน + ชื่อนักศึกษาที่ยืนยันไปแล้ว
- **คอลัมน์ "วันนิเทศ (d/m/y)"** ใหม่ในตาราง — แสดงวันที่ยืนยันของแต่ละคน
- **ป้องกันวันซ้ำใน Modal**: วันที่ถูกจองแล้วจะแสดง 🔒 + ชื่อผู้จอง, ปุ่ม "เลือกวันนี้" ถูก disable
- **รูปแบบวันที่**: เปลี่ยนเป็น `d/m/yyyy` (เช่น `25/12/2024 09:00 น.`) ทุกจุด
- **Helper functions** ใหม่: `formatDMY`, `formatDMYTime`, `parseProposed`
- **Sort เพิ่ม**: เรียงตาม "วันนิเทศ" ได้

### Supervision — Backend (supervisionController.js)

- **Date conflict check** ใน `reviewSupervision`: ก่อน confirm วัน ตรวจสอบว่าอาจารย์คนเดียวกันมีนัดวันเดียวกันกับนักศึกษาคนอื่นไหม → ถ้ามี คืน 409 พร้อมชื่อผู้จอง
- **getTeacherSupervisions**: เปิด `where` clause จริง (เดิม comment ไว้เพื่อ debug) + เพิ่ม co-teacher OR condition + เพิ่ม `isPrimaryAdvisor` mapping
- **ลบ unused imports**: `fs`, `path` ใน supervisionController.js
- **แก้ unused `req`**: ใช้ `_req` ใน `getSupervisionPeriods` และ `getAllSupervisions`

---

## [2026-05-28] UX/UI Overhaul, KKU REG Integration, Teacher CRUD, Security Fix

### UX Components ใหม่

- **Toast.tsx** (ใหม่) — ระบบ Toast notification 4 ประเภท (success/error/info/warning), auto-dismiss 4 วินาที, dark mode aware; export `ToastProvider` + `useToast`
- **Spinner.tsx** (ใหม่) — SVG spinning animation inline component สำหรับ loading state บน button
- **ConfirmDialog.tsx** (ใหม่) — Modal dialog แทน `window.confirm()`, รองรับ Escape key, icon/color ปรับได้
- **hooks/useDebounce.ts** (ใหม่) — Debounce hook 300ms สำหรับ search input
- **main.tsx** — Wrap `<ToastProvider>` รอบ app ทั้งหมด
- **App.tsx** — เพิ่ม `<StudentTheme />` ที่ root เพื่อให้ LoginPage ได้ dark mode CSS ด้วย

### Dark Mode (S_Theme.tsx)

- เพิ่ม Section 13: Class-based dark mode overrides ด้วย `!important` สำหรับ `.card`, `.dash-card`, `.profile-card`, `.modal-card`, `.modal-card-split`, `.modal-content`, `.pdf-modal-card`, `.popup-content`, `.dash-item`, `td`, `.row-even`, `.row-odd`, `.btn-ghost`, `.btn-secondary`, `.btn-outline`, `.action-btn`, `.btn-delete`, `.modal-header`, `.topbar`, `.btn-ico`, `.panel-right`, `.seg.active`, `.tab-btn`, `.teacher-checkbox-grid`, `.teacher-checkbox-label`, `.attachment-link`
- เพิ่ม Section 14–16: overrides สำหรับ `background: #ffffff` (hex/RGB variants) และ doc page classes (`.bg-green`, `.bg-blue`, `.bg-yellow`, `.bg-purple`, `.url-container`, `.btn-copy`, `.email-pill`, `.link-box`)

### หน้า Login (loginpage.tsx)

- เพิ่มปุ่ม `ThemeToggleBtn` บน topbar เพื่อสลับ dark/light mode
- เพิ่ม KKU login section (สำหรับนักศึกษา) — ใช้ username/password ของ KKU REG
- เพิ่ม self-registration modal — form เต็ม (studentId, prefix, firstName, lastName, email, password, major, year)
- เพิ่ม `kkuMode`, `kkuUser`, `kkuPass`, `kkuLoading`, `registerMode`, `regForm`, `regLoading` state

### Dashboard & Navigation

- **S_Dashboard.tsx** — เพิ่ม status banner แสดง CoopStatus ปัจจุบัน พร้อม icon, hint text (25+ statuses), action button, countdown timer ถึง deadline
- **S_Gateway.tsx** — เพิ่ม 4-step indicator; Toast แทน alert(); ConfirmDialog สำหรับลบไฟล์; Spinner บน submit button
- **S_Sidebar.tsx** — เพิ่ม NavLink `/student/gateway`; แก้ `showDocsMenu` ให้รวม `T003_APPROVED`, `PENDING_TEACHER`, `TEACHER_REJECTED`, `DATE_CONFIRMED`, `LETTER_UPLOADED`, `COMPLETED`
- **T_Dashboard.tsx** — เพิ่ม "Action Required" section แสดง badge count สำหรับ T002/T003 pending และ supervision pending; helper `actionChip()`

### Bug Fix

- **T_Requests.tsx (CRITICAL)** — แก้ status ผิด: เปลี่ยน `EDITS_REQUIRED` → `APPLICATION_EDITS_REQUIRED` ในการรีวิว initial application ของอาจารย์ (ค่าเดิมใช้ status ของ T000 docs ผิด)
- **server.js** — แก้ Rate Limiting 429: `loginLimiter` เดิม apply บน `/api/auth` ทั้งหมด ทำให้ `/me` (เรียกทุก page load) ถูก rate limit → ย้ายไป apply เฉพาะ `/api/auth/signin` และ `/api/auth/login`; เพิ่ม max เป็น 30

### Supervision Management (A_SupervisionManage.tsx)

- เพิ่ม company filter dropdown (กรองตามบริษัท)
- เพิ่มปุ่ม "✏️ แก้ไขวัน" เมื่อ `status === DATE_CONFIRMED && !officialLetterPath` (ยังไม่ออก PDF)
- เพิ่ม edit date modal พร้อม date+time input
- แทน alert/confirm ด้วย Toast/ConfirmDialog ทั้งหมด

- **supervisionController.js** — เพิ่ม `updateConfirmedDate`: ตรวจ `officialLetterPath === null` ก่อน, ตรวจ date conflict, update `confirmedDate`
- **supervisionRoutes.js** — เพิ่ม `PUT /admin/supervisions/:id/confirmed-date`

### Teacher Management (A_Teacher.tsx + Backend)

- **A_Teacher.tsx** — Rewrite เต็ม: เพิ่ม CRUD ครบ (เพิ่ม/แก้/ลบ/reset password); sub-components `TeacherFormModal`, `TeacherFields`; Toast feedback ทุก action; ConfirmDialog ก่อนลบ
- **teacherController.js** — เพิ่ม `createTeacher` (สร้าง User+Teacher, default password 1111111111111), `deleteTeacher`, `resetTeacherPassword`, `adminUpdateTeacher` (sync email/username ใน User ด้วย)
- **adminRoutes.js** — เพิ่ม teacher CRUD routes: `POST/PUT/DELETE /admin/teachers/:id`, `PUT /admin/teachers/:id/password` (STAFF_ONLY)
- **scripts/seed_teachers.js** (ใหม่) — Seed อาจารย์วิทยาลัยการคอมพิวเตอร์ KKU 42 คน พร้อม logic upsert (create-or-update)

### Mentor Mobile Menu (M_App.tsx + M_Sidebar.tsx)

- **M_App.tsx** — เพิ่ม hamburger button (`btn-hamburger`), sidebar overlay, `HamburgerIcon` component, `sidebarOpen` state
- **M_Sidebar.tsx** — รับ `isOpen`/`onClose` props; sidebar เปิด/ปิดด้วย class `.open`; ปิด sidebar เมื่อ navigate

### Search Debounce

- **A_Students.tsx** — เพิ่ม `useDebounce` hook บน search input
- **A_CoopApplications.tsx** — เพิ่ม `useDebounce` + Toast/ConfirmDialog + Spinner บน bulk approve

### KKU REG API Integration

- **services/kkuRegService.js** (ใหม่) — Proxy service สำหรับ KKU REG API v1.2 (`reg2.kku.ac.th`): `getStudentToken`, `getStudentInfo`, `getGradeSummary`, `getAdvisor`, `getStudentImage`, `getCreditCondition`, `getCurrentSemester`, `syncStudentAll`; graceful null return เมื่อไม่มี credentials
- **authController.js** — เพิ่ม `loginWithKKU`: login ด้วย KKU REG account, auto-create student หากไม่มีในระบบ (พร้อม security checks), คืน JWT
- **authController.js** — เพิ่ม `registerStudent`: self-registration พร้อม validation (studentId ซ้ำ, email ซ้ำ, year ≥ 3)
- **authRoutes.js** — เพิ่ม `POST /login/kku` และ `POST /register`
- **studentRoutes.js** — เพิ่ม `GET /reg-status`, `POST /sync-from-reg`, `GET /reg-semester`
- **S_ProfilePage.tsx** — เพิ่มปุ่ม "🏫 ดึงข้อมูลจาก KKU"; modal ใส่ username/password KKU; `handleSyncFromKKU`

### Security Fix (KKU Auto-Create)

- **authController.js `loginWithKKU`** — เพิ่ม 2 validation layers ก่อน auto-create:
  1. ตรวจคณะ: ต้องเป็น "วิทยาลัยการคอมพิวเตอร์" เท่านั้น (ตรวจ `faculty_name_th/en/faculty_name`, case-insensitive) → 403 ถ้าไม่ใช่
  2. ตรวจชั้นปี: `class_year` ต้อง ≥ 3 → 403 พร้อมข้อความชั้นปีถ้าน้อยกว่า
- ผล: นักศึกษาคณะอื่น หรือปี 1-2 ไม่สามารถสร้างบัญชีในระบบได้
