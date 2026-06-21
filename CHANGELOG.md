# CHANGELOG — Co_project

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
