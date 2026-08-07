# CHANGELOG — Co_project

## [2026-08-08] — Fix: students could not add/delete companies or mentors despite controller supporting it

### Bug fix
- **`companyRoutes.js`**: `POST /api/companies`, `DELETE /api/companies/:id`, and all 3 mentor mutation
  routes (`POST /:companyId/mentors`, `PUT /mentors/:id`, `DELETE /mentors/:id`) had `verifyRole('staff', 'teacher')`
  — blocking students, even though all 5 controllers contain ownership checks (`company.createdById === currentUserId`)
  that explicitly allow non-staff users who created the resource
- `S_Company.tsx` shows add/delete UI to students and calls these endpoints, causing silent 403 failures
- Fix: added `'student'` to `verifyRole(...)` for all 5 routes; controller-level ownership checks remain the authority

## [2026-08-08] — Fix: announcement file deletion skips files whose ID appears as substring in keepFileIds

### Bug fix
- **`announcementController.js:126`**: `keepFileIds` ที่ frontend ส่งมาเป็น JSON string (เช่น `"[10,20]"`)
  ถูกใช้กับ `String.prototype.includes(f.id)` โดยตรง — JavaScript coerce integer ID เป็น string
  แล้วทำ substring match แทน array membership check
- ผลลัพธ์: file ที่มี ID เป็นตัวเลขที่บังเอิญอยู่ใน JSON string (เช่น ID=1 อยู่ใน `"[10,20]"`) 
  จะไม่ถูกลบออกแม้ admin ไม่ต้องการเก็บไว้ — เอกสารเก่ายังคงแสดงผลในประกาศ
- แก้ไข: `JSON.parse(keepFileIds)` ก่อน แล้วค่อยใช้ array `.includes()` เหมือนกับ `linkUrls` และ `targetMajors`

## [2026-08-08] — Fix: student dashboard never shows active doc windows

### Bug fix
- **`S_Dashboard.tsx`**: เรียก `/api/admin/config/{t000,t002,t003}` ซึ่ง require teacher/staff role
  — นักศึกษาได้ 403 ทุก key ทำให้ `configs` ว่างเสมอ และ "เอกสารที่เปิดรับอยู่ขณะนี้" บน Dashboard ไม่แสดงผลเลย
- อัปเดต URL เป็น `/api/coop/config/${key}` ซึ่งเปิดให้ทุก role อ่านได้ (routes ถูกเพิ่มใน commit ก่อนหน้า)

## [2026-08-08] — Fix: student doc config pages always show hardcoded defaults

### Bug fix
- **`S_DocT005_006.tsx`, `S_DocT007.tsx`, `S_DocT008.tsx`**: เรียก `/api/admin/config/evaluation`,
  `/api/admin/config/t007`, `/api/admin/config/t008` ซึ่ง require role teacher/staff
  — นักศึกษาได้รับ 403 ทุกครั้ง ทำให้เห็นแต่ค่า default hardcoded แทนที่จะเป็นข้อมูลที่ admin ตั้งค่าไว้
- **`coopRoutes.js`**: เพิ่ม route `GET /api/coop/config/evaluation`, `t007`, `t008`
  (read-only, verifyToken เท่านั้น) และอัปเดต frontend ทั้งสามไฟล์

## [2026-08-08] — Fix: T002/T003 system-open config inaccessible to students

### Bug fix
- **`S_DocsT002Form.tsx`, `S_DocsT003Form.tsx`**: ทั้งสองไฟล์เรียก `/api/admin/config/t002` และ `/api/admin/config/t003`
  ซึ่ง require role teacher/staff — นักศึกษาจะได้ 403 เสมอ ทำให้ `isSystemOpen` ค้างเป็น `true` ตลอด
  — ไม่มี system-closed banner, ไม่มี countdown timer, และนักศึกษาสามารถแก้ไข form ได้แม้ระบบจะปิดอยู่
- **`coopRoutes.js`**: เพิ่ม route `GET /api/coop/config/t002` และ `GET /api/coop/config/t003`
  (read-only, verifyToken เท่านั้น) ตามรูปแบบเดียวกับ `/api/coop/config/t000` ที่มีอยู่แล้ว
- อัปเดต frontend ให้เรียก `/api/coop/config/t002` และ `/api/coop/config/t003` แทน

## [2026-08-07] — Fix: dead badge counts in student sidebar

### Bug fix
- **`S_Sidebar.tsx`**: `counts.REQ_LETTER_ISSUED` และ `counts.PLACEMENT_LETTER_ISSUED` ถูกรวมใน Dashboard badge
  แต่ backend ไม่เคยสร้าง notification ด้วย type เหล่านี้ (ใช้ `STATUS_UPDATED` เสมอ)
  — ลบ term ที่ dead ออก ให้ Dashboard badge แสดงเฉพาะ `STATUS_UPDATED` อย่างถูกต้อง

## [2026-08-07] — Fix: Excel import missing major field

### Bug fix
- **`studentImportController.importStudents`**: คอลัมน์ `สาขาวิชา/แผนกการศึกษา` ถูกระบุไว้ในเทมเพลตแต่ไม่ได้อ่านค่า
  — นักศึกษาใหม่ที่ import จะได้ `major: null` เสมอ และนักศึกษาเดิมจะไม่ถูก update field นี้
  — เพิ่มการอ่าน `major` จากคอลัมน์ดังกล่าวและส่งเข้า `update` และ `create` block ของ upsert

## [2026-08-07] — Fix: T000 re-submit notification was never sent

### Bug fix
- **`docController.uploadDocument`**: `newDoc.status` (เสมอเป็น `WAITING`) ถูกเช็คแทน coop status
  — เพิ่ม flag `t000Resubmitted` ภายใน transaction; set `true` เมื่อ coop อัปเดตเป็น `WAITING_FOR_STAFF_CHECK`
  — ทำให้ notification `T000_SUBMITTED` ถูก fire เมื่อนักศึกษา re-submit T000 หลังถูกส่งกลับแก้ไข

## [2026-08-07] — Feat: notification creation + polling

### Feature
- **`coopController.submitCoopApplication`**: เพิ่ม notify ไปยัง generalAdvisor + coopAdvisor โดยตรง (นอกเหนือจาก staff+coopTeachers)
- **`coopController.updateCoopStatus`**: แก้ link notification `/student/status-tracker` → `/student/dashboard`
- **`adminDocController.reviewStudentStatus`**: แก้ link notification `/student/status-tracker` → `/student/dashboard`
- **`adminDocController.updateCoopApplicationStatus`**: เพิ่ม notify student เมื่อสถานะเปลี่ยน (5 สถานะ)
- **`supervisionController.proposeSupervisionDate`**: เพิ่ม notify อาจารย์ผู้รับผิดชอบ (teacher link → `/teacher/review-supervision`)
- **`useNotifCounts.ts`**: เพิ่ม polling 60 วินาทีให้ badge count อัปเดตอัตโนมัติ

## [2026-08-07] — Fix: admin doc-requirements endpoint now shows inactive records

### Bug fix
- **`docRequirementController`**: เพิ่ม `getAllRequirements` (ไม่ filter `isActive`) สำหรับ admin
  — route `/api/admin/doc-requirements GET` เปลี่ยนไปใช้ `getAllRequirements`
  — route นักศึกษา (`/api/coop/doc-requirements` + `/api/students/doc-requirements`) ยังใช้ `getRequirements` (filter `isActive: true`)
  — เหตุผล: `A_DocRequirements.tsx` มีปุ่ม toggle `isActive` แต่ filter เดิมซ่อน inactive rows ทำให้ admin toggle กลับไม่ได้
- **Test**: เพิ่ม 2 test สำหรับ `getAllRequirements` — รวม 253/253 green

## [2026-08-07] — Test suite fully green (251/251)

### Tests
- **Synced all 8 test files** to match controller reality after Plan B + TOCTOU fixes
- `authController`: password policy updated, loginWithGoogle mock fixed, clearAllMocks → explicit resets
- `visitController/teacherController/coopController`: TOCTOU re-fetch mocks added
- `adminDashboard`: `deletedAt` filter added to studentCoop.findMany expectation
- `supervisionController`: uploadOfficialLetter, calendar, getSupervisionsForTeacher all synced
- `docRequirementController`: isActive filter assertion updated
- `studentImportController`: collision check mock + stale major assertion removed
- **Prisma mock**: added `student.findFirst` (was missing, caused auth test leaks)

## [2026-08-07] — Batch 1: 12 system improvements (Plan B)

### ความปลอดภัย
- **รหัสผ่าน:** นโยบายใหม่ — อย่างน้อย 8 ตัว, ต้องมีพิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ — บังคับใช้ที่ทุก endpoint และ script (`utils/validatePassword.js`)

### ฐานข้อมูล
- **Teacher.prefix:** เพิ่ม field คำนำหน้าอาจารย์ (อ., ผศ., รศ., ศ., ดร. ฯลฯ) — migration: `teacher_prefix_advisor_set_null`
- **onDelete: SetNull:** FK constraint บน Student→Teacher (generalAdvisor, coopAdvisor)

### ระบบนิเทศ
- **เลือก ONLINE/ONSITE แต่ละวัน:** นักศึกษาเลือกรูปแบบแยกต่างหากสำหรับแต่ละวันที่เสนอ (S_Supervision.tsx)
- **ล็อกหลังยืนยัน:** ไม่สามารถแก้ไขวันนิเทศได้หลังอาจารย์ยืนยัน (frontend + backend)
- **Auto-extract type:** backend ดึง ONLINE/ONSITE จาก proposedDates entry เมื่ออาจารย์ยืนยัน
- **ข้อความสถานะ:** แสดงข้อความ+ไอคอนแทนสีเพียงอย่างเดียว (SUPERVISION_STATUS_UI)

### อาจารย์
- **คำนำหน้า:** ฟอร์มสร้าง/แก้ไขอาจารย์มี dropdown คำนำหน้า (A_Teacher.tsx)
- **รหัสผ่านสร้างใหม่:** ต้องกำหนดรหัสผ่านตอนสร้าง (ลบ hardcoded "1111111111111" ออก)
- **ซ่อนคณะ:** ฟิลด์คณะถูกซ่อนจากฟอร์ม

### เอกสาร
- **วันที่เริ่มฝึก:** modal ออกเอกสารมีช่องกรอกวันที่เมื่อไม่พบในระบบ (IssueLetterModal.tsx)
- **Dark mode:** modal ออกเอกสารบังคับ light mode — ไม่ขึ้นหน้าดำ (LetterModalShared.tsx)
- **คำแนะนำเอกสาร:** S_Docs แสดงข้อความแนะนำต่อประเภทเอกสาร จาก `/api/students/doc-requirements`
- **studyProgramLabel:** ฟังก์ชัน export ใน docGeneratorUtils.ts แปลง normal/special → ภาษาไทย; ใส่ใน dispatch letter

### ผู้ดูแลระบบ
- **ตรวจชื่ออาจารย์:** A_DocT000 แสดงคำเตือนเมื่อชื่อที่นักศึกษากรอกไม่ตรงกับ Teacher record ในระบบ

---

## [2026-08-07] — หลักสูตร/ภาคการศึกษา: แทนที่สาขาวิชา (CS/IT/AI/CYB/GIS) ด้วยหลักสูตร (ภาคปกติ/ภาคพิเศษ)

- ยกเลิกการแสดง/แก้ไข field `major` (CS/IT/AI) ทั่วทั้งระบบ (ยังคงอยู่ใน DB เป็น historical data)
- เปลี่ยน label "สาขาวิชา" → "หลักสูตร" ทุกหน้า (A_Students, A_StudentEditModal, S_ProfilePage, S_Gateway, T_Students, T_StudentDetail, A_Teacher, T_Profile)
- ใช้ field `studyProgram` (enum `normal`/`special` = ภาคปกติ/ภาคพิเศษ) เป็นค่าหลักสำหรับ "หลักสูตร"
- A_Teacher และ T_Profile: เปลี่ยน options สาขาวิชาอาจารย์เป็น ภาคปกติ/ภาคพิเศษ — ลบ fetchMajors() และ majorOptions state ออก
- A_CriteriaPage: เปลี่ยนจากหน้าจัดการสาขาวิชาเป็น notice แสดงหลักสูตรที่ใช้ในระบบ
- studentImportController.js: ไม่นำเข้า field `major` จากคอลัมน์ Excel อีกต่อไป — ลบ MAJOR_NAME_TO_CODE, KNOWN_MAJOR_CODES, mapMajor()

## [2026-08-07] fix: batch 75 — TOCTOU x4 + BUG x1

- **docController.js `uploadDocument`:** เพิ่ม `student.deletedAt` re-check ภายใน `$transaction` — ป้องกัน admin soft-delete student ระหว่าง outer check กับ tx
- **docController.js `deleteDocument`:** เพิ่ม `student.deletedAt` re-check ภายใน `$transaction`; เพิ่ม `is403` ใน catch
- **coopController.js `deleteDocument`:** เพิ่ม `student.deletedAt` re-check ภายใน `$transaction`; เพิ่ม `is403` ใน catch
- **studentController.js `updateMyProfile`:** เพิ่ม `deletedAt` re-check ภายใน `$transaction` ด้วย `throw is403`; เพิ่ม `is403` ใน catch
- **studentRoutes.js:** ลบ duplicate route `/acknowledge-placement-letter` ที่ชี้ไปยัง `downloadPlacementLetter` (dead surface หลังจาก batch 70 ลบ acknowledgePlacementLetter)

## [2026-08-07] fix: batch 74 — TOCTOU x4

- **studentController.js `softDeleteStudent`:** รวม findUnique + update เข้า `$transaction` ด้วย statusErr pattern — race condition ทำให้ double-delete ผ่าน guard ได้
- **studentController.js `restoreStudent`:** เหมือนกัน — race condition กับ softDelete ทำให้ state ไม่แน่นอน
- **studentController.js `updateMyProfile`:** ย้าย `studentId` uniqueness `findFirst` เข้า `$transaction` ด้วย `throw is409` — เดิมอยู่นอก tx ทำให้ concurrent submit ผ่านได้ทั้งคู่
- **announcementController.js `deleteAnnouncement`:** รวม `findUnique` + `delete` เข้า `$transaction` เดียว และ capture `filesToClean` ภายใน tx — ป้องกัน concurrent upload เพิ่ม AnnFile ระหว่าง findUnique กับ delete ทำให้ file record ถูกลบแต่ไฟล์บนดิสก์ตกค้าง

## [2026-08-07] fix: batch 73 — TOCTOU x3 + BUG x1

- **companyController.js:** ลบ dead function `isStaffOrCompanyOwner` — callers ทั้งหมดย้าย logic inline ไป `$transaction` ตั้งแต่ batch 72 แล้ว
- **configController.js `updateT008Config`:** ย้าย `findUnique` (อ่าน oldImagePath) เข้า `$transaction` เดียวกับ `upsert` — race condition concurrent upload ทำให้ imagePath ที่ commit อาจถูกลบทิ้งเป็น orphan
- **coopController.js `submitCoopApplication`:** เพิ่ม `student.deletedAt` re-check ภายใน `$transaction` — ป้องกัน student ที่ถูกลบระหว่าง outer check กับ transaction เข้าทำ upsert ได้; เพิ่ม `is404` ใน catch
- **docController.js `uploadDocument`:** inline logic ของ `checkSystemOpen` ภายใน `$transaction` ด้วย `tx.systemConfig.findUnique` — ป้องกัน race ระหว่าง config read กับ document write; เพิ่ม `is403` handler ใน inner catch

## [2026-08-06] fix: batch 72 — TOCTOU x3 + P2025 x2

- **companyController.js `addMentor`:** รวม ownership check + create เข้า `$transaction` — ก่อนหน้านี้ race condition บน `createdById` ทำให้ user ที่ไม่ใช่เจ้าของเพิ่มพี่เลี้ยงได้
- **companyController.js `updateMentor`:** รวม ownership check + update เข้า `$transaction` — เหมือนกัน
- **companyController.js `deleteMentor`:** รวม ownership check + delete เข้า `$transaction` — เหมือนกัน
- **visitController.js `toggleVisitStatus`:** เพิ่ม `P2025 → 404` ใน catch — concurrent delete ทำให้ `tx.visit.update` throw P2025 → 500
- **visitController.js `deleteVisit`:** เพิ่ม `P2025 → 404` ใน catch — เหมือนกัน

## [2026-08-06] fix: batch 71 — P2025 x1 + TOCTOU x4

- **studentController.js `updateStudentBasicInfo`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ concurrent student delete ระหว่าง transaction คืน 500
- **companyController.js `updateCompany`:** รวม ownership check + update เข้า `$transaction` — ก่อนหน้านี้ race condition ทำให้ตรวจสอบ createdById แล้ว update แยกกัน
- **companyController.js `deleteCompany`:** รวม ownership check + delete เข้า `$transaction` — เหมือนกัน
- **docController.js `saveT002Form`:** รวม status check + upsert เข้า `$transaction` — ก่อนหน้านี้ status เปลี่ยนระหว่าง check กับ upsert ได้
- **docController.js `saveT003Form`:** รวม status check + upsert เข้า `$transaction` — เหมือนกัน

## [2026-08-06] fix: batch 70 — TOCTOU x1 + BUG x2

- **studentController.js `updateStudentBasicInfo`:** ย้าย advisor `teacher.findUnique` lookups เข้าไปใน `$transaction` — ก่อนหน้านี้ concurrent teacher delete ระหว่าง request จะทำให้ DB throw P2003 → 500 แทน 400
- **docController.js + studentRoutes.js:** ลบ `acknowledgePlacementLetter` ที่ duplicate logic กับ `downloadPlacementLetter` ออก; route `/acknowledge-placement-letter` ชี้ไปที่ `studentController.downloadPlacementLetter` แทน
- **teacherController.js:** ลบ dead export `getAdviseesForReview` ออก — ไม่มี route อ้างถึงและดึง `documents: true` โดยไม่มี pagination

## [2026-08-06] fix: batch 69 — TOCTOU x1 + BUG x2

- **coopController.js `submitCoopApplication`:** เพิ่ม re-read `coopPeriod.isActive` ใน transaction — ก่อนหน้านี้ race condition ทำให้นักศึกษาสมัครลง period ที่ปิดไปแล้วได้ถ้า admin ปิดพร้อมกัน
- **visitController.js:** ลบ dead helper `isOwnerOfVisit` ออก — ไม่เคยถูกเรียกจริง (ownership check ทำ inline ใน transaction แล้ว)
- **supervisionController.js:** ลบ dead export `getTeacherSupervisions` ออก — ไม่มี route อ้างถึง (ถูกแทนที่ด้วย `getSupervisionsForTeacher` ที่มี isPrimaryAdvisor mapping)

## [2026-08-06] fix: batch 68 — FILE-ORPHAN x1 + AUTHZ x3 + BUG x1 + TOCTOU x1

- **supervisionController.js `uploadOfficialLetter`:** เพิ่ม file cleanup เมื่อ isNaN(parsedId) early return — ก่อนหน้านี้ไฟล์ที่ upload มาค้างบน disk
- **adminDocController.js `updateCoopApplicationStatus`:** เพิ่ม advisor ownership check ใน transaction สำหรับ teacher caller — ก่อนหน้านี้ teacher ใดก็ได้ approve/reject คำร้องของนักศึกษาคนใดก็ได้
- **visitController.js `getVisitsByStudent`:** เพิ่ม advisor ownership check สำหรับ teacher caller — ก่อนหน้านี้ teacher อ่าน visit notes ของนักศึกษาที่ไม่ใช่ลูกศิษย์ได้
- **teacherRoutes.js:** เพิ่ม `PUT /supervisions/:id/complete` route — ก่อนหน้านี้ `completeSupervision` ขาด teacher-facing route ทำให้ teacher เรียกไม่ได้ (dead code)
- **studentController.js `updateStudentBasicInfo`:** ย้าย email uniqueness check เข้าไปใน `$transaction` แบบ atomic — ก่อนหน้านี้ TOCTOU ทำให้ race condition bypass application-level check (DB constraint ยังป้องกันอยู่แต่ intent ไม่ชัด)

## [2026-08-06] fix: batch 67 — FILE-ORPHAN x1 + AUTHZ x2 + BUG x2

- **adminDocController.js `reviewStudentStatus`:** เพิ่ม `req.file` cleanup ใน 2 early returns (invalid studentId, invalid status) — ก่อนหน้านี้ไฟล์ที่ upload มาค้างบน disk โดยไม่มี DB record
- **adminRoutes.js `PUT /supervisions/:id/co-teachers`:** เปลี่ยนจาก `verifyRole(...ADMIN_ROLES)` เป็น `verifyRole(...STAFF_ONLY)` — ก่อนหน้านี้ teacher ใดก็ได้แก้ไข co-teacher ของนัดหมายนิเทศของ teacher คนอื่นได้
- **visitController.js `createVisit`:** เพิ่ม advisor ownership check ใน transaction — ก่อนหน้านี้ teacher ใดก็ได้สร้างบันทึกนิเทศให้นักศึกษาคนใดก็ได้
- **supervisionRoutes.js:** ลบ dead routes (`GET/PUT /teacher/supervisions*`) ที่ shadow โดย teacherRoutes.js ออก — `getTeacherSupervisions` ไม่เคยถูกเรียกจริง
- **adminDocController.js `reviewT002` + `reviewT003`:** เพิ่ม `student.deletedAt` check ใน transaction — ก่อนหน้านี้ staff สามารถ review เอกสารของนักศึกษาที่ soft-delete แล้วได้

## [2026-08-06] fix: batch 66 — TOCTOU x1 + FILE x1 + BUG x1 + P2025 x1

- **teacherController.js `deleteTeacher`:** ย้าย apptCount/visitCount check เข้าไปใน interactive `$transaction` — ก่อนหน้านี้ race condition ทำให้ลบอาจารย์ที่มีนัดหมายได้ถ้า insert เกิดขึ้น concurrent; เพิ่ม `is409` ใน catch
- **announcementController.js `addOrUpdateAnnouncement`:** ครอบแต่ละ `fs.unlinkSync` ด้วย try/catch ใน `toDelete.forEach` — ก่อนหน้านี้ถ้า unlink โยน error หลัง transaction commit, outer catch จะลบไฟล์ใหม่ที่ commit แล้วออกด้วย
- **studentController.js `downloadPlacementLetter`:** ลบ `const coop = await prisma.studentCoop.findUnique(...)` ที่ซ้ำซ้อนและไม่ได้ใช้ออก (query ที่ใช้จริงอยู่ใน transaction แล้ว)
- **teacherController.js `resetTeacherPassword`:** เพิ่ม `P2025 → 404` ใน catch

## [2026-08-06] fix: batch 65 — authz x3 + advisor ownership + BUG (unhandled async)

- **studentRoutes.js GET /coop-periods/active:** เพิ่ม `verifyToken` — ก่อนหน้านี้ endpoint ไม่มี auth ทำให้ public เข้าถึงได้
- **studentRoutes.js GET /reg-semester:** ครอบ try/catch — ก่อนหน้านี้ถ้า KKU REG API timeout ทำให้เกิด unhandled rejection → process crash (Node ≥ 15)
- **adminRoutes.js POST /t000/approve-all + PUT /t000/review:** เปลี่ยนจาก `verifyRole(...ADMIN_ROLES)` เป็น `verifyRole(...STAFF_ONLY)` — ก่อนหน้านี้ teacher ออกหนังสือ/อนุมัติเอกสารให้นักศึกษาคนใดก็ได้โดยไม่ต้องเป็นอาจารย์ที่ปรึกษา
- **coopController.js `updateCoopStatus`:** เพิ่ม advisor ownership check ใน transaction สำหรับ teacher caller — staff ผ่านได้ทุกนักศึกษา; teacher ต้องเป็น generalAdvisor/coopAdvisor เท่านั้น; เพิ่ม `is403` ใน catch

## [2026-08-06] fix: batch 64 — authz x2 + file orphan x3 + P2025 x3 + BUG + TOCTOU x2

- **adminRoutes.js GET /majors + GET /criteria:** เพิ่ม `verifyRole(...ADMIN_ROLES)` — ก่อนหน้านี้ student สามารถดึง criteria ทั้งหมดได้
- **announcementController.js `addOrUpdateAnnouncement`:** เพิ่ม file cleanup ใน 2 early returns (missing title/date/year และ announcement not found) — ก่อนหน้านี้ไฟล์ที่ upload มาค้างบน disk
- **configController.js `updateT008Config`:** อ่าน old imagePath ก่อน upsert แล้วลบหลัง commit — ก่อนหน้านี้ทุก upload ทิ้งรูปเก่าไว้บน disk
- **supervisionController.js `assignCoTeachers`:** เพิ่ม `P2025 → 404` ใน catch
- **studentController.js `softDeleteStudent` + `restoreStudent`:** เพิ่ม `P2025 → 404` ใน catch
- **visitRoutes.js POST/PUT/DELETE:** เปลี่ยนจาก `verifyRole('teacher','staff')` เป็น `verifyRole('teacher')` — staff ไม่มี Teacher record ทำให้ controller return 403/404 เสมอ
- **docController.js `deleteDocument`:** รวม status lock check + delete เข้า `$transaction` + เพิ่ม `is409` ใน catch — ก่อนหน้านี้ TOCTOU ทำให้ลบ T002/T003 ที่กำลัง review ได้
- **coopController.js `deleteDocument`:** เช่นเดียวกัน — TOCTOU fix เดียวกัน

## [2026-08-06] fix: batch 63 — wrong upload path + authz gap + NaN x2 + TOCTOU x2

- **supervisionController.js `uploadSupervisionLetter`:** แก้ path ใน cleanup จาก `uploads/` เป็น `uploads/supervision/` — ก่อนหน้านี้ไฟล์ที่ upload มาลงที่ `uploads/supervision/` แต่ cleanup ไป unlink จาก `uploads/` ทำให้ไฟล์ค้าง
- **studentRoutes.js POST /sync-from-reg:** เพิ่ม `verifyRole('student')` — ก่อนหน้านี้ teacher/staff สามารถเรียก KKU REG API ด้วย credentials ที่ส่งมาได้
- **docRequirementController.js `updateRequirement` + `deleteRequirement`:** เพิ่ม `parseInt(id, 10)` + `isNaN` guard — ก่อนหน้านี้ `Number(id)` บน string ที่ไม่ใช่ตัวเลขได้ NaN → Prisma throw 500
- **visitController.js `toggleVisitStatus` + `deleteVisit`:** ย้าย ownership check เข้าใน `$transaction` — ก่อนหน้านี้ TOCTOU ทำให้ re-assign ระหว่าง check กับ mutate ผ่านได้; ใช้ is403/is404 throws

## [2026-08-06] fix: batch 62 — file-before-DB x3 + authz gap + TOCTOU letter file + P2025

- **docController.js `deleteDocument` (by id):** ย้ายการลบไฟล์มาหลัง DB delete — ก่อนหน้านี้ถ้า DB throw ไฟล์หายไปแล้วแต่ record ยังอยู่
- **coopController.js `deleteDocument`:** ย้ายการลบไฟล์มาหลัง DB delete + เพิ่ม try/catch รอบ unlinkSync — ก่อนหน้านี้เหมือนกัน
- **systemAssetController.js `deleteAsset`:** ย้ายการลบไฟล์มาหลัง DB delete + เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ทั้งไฟล์และ DB อาจ inconsistent
- **studentRoutes.js GET /students/me:** เพิ่ม `verifyRole('student')` — ก่อนหน้านี้ teacher/staff สามารถเรียก student profile endpoint ได้
- **adminDocController.js `reviewStudentStatus`:** ย้าย `prevCoop` findUnique เข้าไปใน transaction — ก่อนหน้านี้ TOCTOU ทำให้ไฟล์หนังสือเก่าอาจไม่ถูกลบเมื่อ 2 request ทำงานพร้อมกัน

## [2026-08-06] fix: batch 61 — authz gap + file-before-DB x4 + file orphan x4 + P2025 x6 + TOCTOU null/is404 x2 + NaN guards x2

- **adminRoutes.js GET /coop-periods, /coop-periods/active, /coop-periods/all:** เพิ่ม `verifyRole(...ADMIN_ROLES)` — ก่อนหน้านี้ authenticated user ทุก role เข้าถึงได้
- **coopController.js `submitCoopApplication`:** เพิ่ม `files.forEach(unlinkSync)` ใน 4 early return paths (parsedPeriodId, period closed, student not found, bad gradeSheetUrl) และ outer catch — ก่อนหน้านี้ไฟล์ค้างใน uploads/ เมื่อ early return
- **systemAssetController.js `updateAsset`:** ย้ายการลบไฟล์เดิมมาหลัง upsert + เพิ่ม `req.file` cleanup ใน catch — ก่อนหน้านี้ถ้า upsert fail ไฟล์เดิมหายไปแล้วแต่ DB ยังชี้ไฟล์เดิม
- **announcementController.js `deleteAnnouncement`:** ย้าย file loop มาหลัง DB delete + เพิ่ม `P2025 → 404` — ก่อนหน้านี้ถ้า delete fail ไฟล์หายไปแล้วแต่ announcement ยังอยู่ใน DB
- **announcementController.js `addOrUpdateAnnouncement`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ update ที่หา record ไม่เจอ return 500
- **companyController.js `deleteCompany` + `deleteMentor`:** เพิ่ม `P2025 → 404` ใน catch
- **teacherController.js `deleteTeacher` + `adminUpdateTeacher`:** เพิ่ม `P2025 → 404` ใน catch
- **teacherController.js `reviewT003` + `reviewT002`:** แยก combined null/advisor condition เป็น `is404` (freshStudent null/deletedAt) และ `is403` (advisor mismatch) แยกกัน + เพิ่ม `is404` ใน catch — ก่อนหน้านี้ student ที่ถูกลบระหว่าง transaction return 403 แทน 404
- **docController.js `deleteDocumentByType`:** ย้ายการลบไฟล์มาหลัง DB delete + เพิ่ม `P2025 → 404` — ก่อนหน้านี้ถ้า delete fail ไฟล์หายไปแล้วแต่ document ยังอยู่ใน DB
- **studentController.js `updateStudentBasicInfo`:** เพิ่ม `!Number.isInteger(Number(...))` guard ก่อน `findUnique` สำหรับทั้ง `generalAdvisorId` และ `coopAdvisorId` — ก่อนหน้านี้ค่า NaN ทำให้ Prisma throw 500

## [2026-08-06] fix: batch 60 — announcement file orphan + stale letter file + TOCTOU x2 + P2025 x2 + gpa NaN + authz

- **announcementController.js `addOrUpdateAnnouncement`:** เพิ่ม `req.files` cleanup ใน catch — ก่อนหน้านี้ไฟล์แนบประกาศค้างใน uploads/ เมื่อ DB throw error
- **adminDocController.js `reviewStudentStatus`:** เพิ่มการดึง `reqLetterUrl`/`placeLetterUrl` เก่าก่อน transaction และลบออกจาก disk หลัง commit — ก่อนหน้านี้ไฟล์หนังสือฉบับเก่าค้างบน disk เมื่อออกหนังสือใหม่แทน
- **supervisionController.js `reviewSupervision` (APPROVE + REJECT):** เพิ่ม `teacherId` ใน select ภายใน transaction และ re-verify ownership — ก่อนหน้านี้ TOCTOU ทำให้อาจารย์เก่า approve/reject การนิเทศที่ถูก reassign ไปแล้ว; เพิ่ม `is403`/`is404` ใน catch
- **supervisionController.js `completeSupervision`:** ย้าย `teacherRecord` ออกนอก `if (role === 'teacher')` เพื่อใช้ใน transaction; เพิ่ม `teacherId` re-verify ใน tx + `is403` ใน catch
- **companyController.js `updateCompany` + `updateMentor`:** เพิ่ม `P2025 → 404` ใน catch
- **studentController.js `updateMyProfile`:** เพิ่ม `isNaN(gpa)` guard หลัง `parseFloat` — ก่อนหน้านี้ gpa เป็น string ทำให้ Prisma throw 500
- **adminRoutes.js GET /majors + GET /criteria:** เพิ่ม `verifyToken` — ก่อนหน้านี้ข้อมูล criteria รั่วออกสู่ public

## [2026-08-06] fix: batch 59 — T008 file orphan + coTeacher full-name match + reviewT002/T003 TOCTOU + P2025 x4

- **configController.js `updateT008Config`:** เพิ่ม `path`/`fs` imports + cleanup `req.file` ใน catch — ก่อนหน้านี้ไฟล์รูปภาพ T008 ค้างใน `uploads/system/` เมื่อ Prisma upsert ล้มเหลว
- **supervisionController.js `getTeacherSupervisions` + `getSupervisionsForTeacher`:** เปลี่ยน `contains: teacher.firstName` → `contains: \`${teacher.firstName} ${teacher.lastName}\`` — ก่อนหน้านี้ teacher ที่มีชื่อเป็น substring ของอาจารย์คนอื่นจะเห็น supervision ที่ไม่ใช่ของตัวเอง
- **teacherController.js `reviewT003` + `reviewT002`:** เพิ่มการ re-verify `generalAdvisorId`/`coopAdvisorId` ใน `$transaction` + `is403` catch — ก่อนหน้านี้ admin เปลี่ยนอาจารย์ที่ปรึกษาระหว่าง ownership check กับ transaction ทำให้อาจารย์คนเดิม review ได้ต่อ
- **visitController.js `toggleVisitStatus` + `deleteVisit`:** เพิ่ม `P2025 → 404` — ก่อนหน้านี้ concurrent request ทำให้คืน 500
- **coopController.js `deleteDocument`:** เพิ่ม `P2025 → 404` — concurrent delete คืน 500
- **docController.js `deleteDocument`:** เพิ่ม `P2025 → 404` — concurrent delete คืน 500

## [2026-08-06] fix: batch 58 — file cleanup on 409 + P2025 → 404 x4 + startDate/endDate guard

- **coopController.js `submitCoopApplication`:** เพิ่ม `fs.unlinkSync` cleanup สำหรับทุก multer file ก่อนคืน 409 reapplyBlocked — ก่อนหน้านี้ไฟล์ค้างใน uploads/ โดยไม่มี Document row
- **coopPeriodController.js `togglePeriod`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ id ที่ไม่มีจริงทำให้คืน 500
- **supervisionController.js `saveSupervisionPeriod`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ periodId ที่ไม่มีจริงทำให้คืน 500
- **teacherController.js `updateTeacherById`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ teacher id ที่ไม่มีจริงทำให้คืน 500 "Update failed"
- **adminDocController.js `updateDocStatus`:** เพิ่ม `P2025 → 404` ใน catch — ก่อนหน้านี้ doc id ที่ไม่มีจริงทำให้คืน 500
- **coopPeriodController.js `createPeriod` + `updatePeriod`:** เพิ่ม `if (!startDate || !endDate) → 400` ก่อน `new Date()` — ก่อนหน้านี้ `new Date(undefined)` ทำให้ Prisma throw PrismaClientValidationError แล้วคืน 500

## [2026-08-06] fix: batch 57 — updatePeriod NaN + page clamp + coop-periods authz + teacher config authz + orphan file guard

- **coopPeriodController.js `updatePeriod`:** เปลี่ยน `semester: parsedSemester` → conditional spread `...(semester !== undefined && { semester: parsedSemester })` — ก่อนหน้านี้ NaN ถูกส่งไป Prisma เมื่อ semester ไม่ได้ส่งมาใน request body
- **teacherController.js `getMyStudents`:** เปลี่ยน `parseInt(page) || 1` → `Math.max(1, parseInt(page, 10) || 1)` และ `limit` เช่นกัน — ป้องกัน `page=-1` ทำให้ `skip=-100` และ Prisma throw 500
- **adminRoutes.js GET /coop-periods (3 routes):** เพิ่ม `verifyToken` ก่อน controller — ก่อนหน้านี้ข้อมูลรอบสหกิจ (ปีการศึกษา, วันเปิด-ปิดรับสมัคร) รั่วออกสู่ public
- **teacherRoutes.js GET /config/t002, /config/t003:** เพิ่ม `verifyRole('teacher', 'staff')` — ก่อนหน้านี้ student หรือ token ใดก็ดึง config ได้
- **adminDocController.js `reviewStudentStatus`:** เพิ่ม guard ตรวจไฟล์ที่อัปโหลดมาแต่ไม่มี status letter และไม่มี docType — ลบไฟล์ทันทีและคืน 400 แทนการให้ไฟล์ค้างอยู่ใน uploads/ โดยไม่ถูกอ้างถึง

## [2026-08-06] fix: batch 56 — T002/T003 delete gate + semester NaN + coopPeriodId NaN guards

- **docController.js `deleteDocument`:** เพิ่ม T002/T003 locked-state gate — ป้องกันนักศึกษาลบ T002 ขณะอาจารย์กำลัง review โดยเปลี่ยนมาเรียก `/api/docs/delete/:id` แทน `/api/coop/documents/:id`
- **teacherController.js `getDashboardStats` + `getLatestRequests`:** เพิ่ม `isNaN(semesterInt)` guard → 400 — ก่อนหน้านี้ NaN ทำให้ตัวกรอง semester หายไปเงียบๆ
- **adminDocController.js `getAllStudentsForReview`:** เพิ่ม `isNaN(coopPeriodId)` guard → 400 — ป้องกัน NaN ทำให้ filter period หายไปและคืนนักศึกษาทั้งหมด
- **studentController.js `getStudents` + `exportStudents`:** เพิ่ม `isNaN(coopPeriodId)` guard → 400 ทั้งสองฟังก์ชัน

## [2026-08-06] fix: batch 55 — semester NaN + review-t002/t003 authz + GET /teacher/me + coopPeriodId NaN + file cleanup

- **coopPeriodController.js `updatePeriod`:** เพิ่ม `parsedSemester` + `!Number.isInteger` guard — ก่อนหน้านี้ `Number(semester)` ส่ง NaN ไป Prisma ถ้า semester ไม่ใช่ตัวเลข
- **adminRoutes.js `review-t002/t003`:** เปลี่ยน `verifyRole(...ADMIN_ROLES)` → `verifyRole(...STAFF_ONLY)` — ป้องกัน teacher ทุกคน bypass advisor ownership check บน admin review endpoint
- **teacherRoutes.js `GET /me`:** เพิ่ม `verifyRole('teacher', 'staff')` — ก่อนหน้านี้นักศึกษาเรียกได้และรับ email ตัวเองในรูปแบบ teacher profile
- **teacherController.js `getMyStudents` + `exportMyStudents`:** เพิ่ม `isNaN(coopPeriodId)` guard → 400 — ก่อนหน้านี้ NaN ทำให้ตัวกรอง period หายไปเงียบๆ และคืนนักศึกษาทั้งหมดแทน
- **adminDocController.js `reviewStudentStatus`:** เพิ่ม `req.file` cleanup ใน catch block + import `path`/`fs` — ป้องกัน orphan file เมื่อ transaction throw

## [2026-08-05] fix: batch 54 — null guard + NaN guards + status gate + student route authz

- **supervisionController.js `completeSupervision`:** เพิ่ม `if (!fresh)` null check ก่อน `fresh.status` ใน `$transaction` + เพิ่ม `is404` catch — ป้องกัน TypeError เมื่อ row ถูกลบระหว่าง outer guard กับ transaction
- **coopPeriodController.js `createPeriod`:** เพิ่ม `!Number.isInteger(parsedSemester)` guard + แปลง `Number(semester)` → `parsedSemester`
- **studentController.js `updateMyProfile`:** เพิ่ม `isNaN(activityUnit)` และ `isNaN(Number(coopAdvisorId))` guards → 400 ก่อน transaction
- **studentController.js `downloadPlacementLetter`:** แคบ `PRE_INTERNSHIP_STATUSES` เหลือ `['PLACEMENT_LETTER_ISSUED']` — ตรงกับ `acknowledgePlacementLetter` และป้องกัน skip acceptance-letter step
- **coopRoutes.js:** เพิ่ม `verifyRole('student')` ใน POST /apply, DELETE /documents/:id, GET /supervision/me
- **docRoutes.js:** เพิ่ม `verifyRole('student')` ใน 5 routes (save-form, my-application, upload, delete/:id, document/type/:docType)

## [2026-08-05] fix: batch 53 — action guard + coopPeriodId NaN + assignCoTeachers 404 + mentor authz

- **supervisionController.js `reviewSupervision`:** เพิ่ม early-return guard `if (!['APPROVE','REJECT'].includes(action))` → 400 — ป้องกัน unknown action คืน 200 + ส่ง false "rejected" notification ให้นักศึกษา
- **supervisionController.js `assignCoTeachers`:** เพิ่ม `findUnique` ก่อน `update` — ป้องกัน P2025 (record not found) คืน 500 แทน 404
- **coopController.js `submitCoopApplication`:** แปลง `!coopPeriodId` falsy check → `!Number.isInteger(parsedPeriodId) || parsedPeriodId <= 0` + แปลง `Number(coopPeriodId)` → `parsedPeriodId` ทุกจุด
- **companyRoutes.js:** ลบ `'student'` ออกจาก `verifyRole` ของ POST/PUT/DELETE mentor endpoints — นักศึกษาไม่ควรเข้าถึง handler เหล่านี้ได้

## [2026-08-05] fix: batch 52 — teacher/student route authz + isNaN guards + approveAllDocs status gate

- **teacherRoutes.js:** เพิ่ม `verifyRole('teacher', 'staff')` ใน GET /supervisions, /stats, /latest-requests — ก่อนหน้านี้ทุก role เรียกได้
- **studentRoutes.js:** เพิ่ม `verifyRole('student')` ใน PUT /me — ป้องกัน teacher/staff สร้าง phantom Student row ผ่าน upsert
- **teacherController.js `updateTeacherById` + `deleteTeacher` + `resetTeacherPassword` + `adminUpdateTeacher`:** เพิ่ม `isNaN` guard บน `parseInt(id)` → 400 แทน 500 ทุกฟังก์ชัน
- **supervisionController.js `reviewSupervision` + `completeSupervision` + `uploadOfficialLetter` + `updateConfirmedDate`:** เพิ่ม `parsedId` + `isNaN` guard ทุกฟังก์ชัน + แปลง `parseInt(id)` → `parsedId` ทุกจุดในแต่ละฟังก์ชัน
- **coopPeriodController.js `togglePeriod`:** เพิ่ม `!Number.isInteger / <= 0` guard + แปลง `Number(id)` → `parsedId` ให้ตรงกับ sibling functions
- **adminDocController.js `approveAllDocs`:** เพิ่ม status gate ใน `$transaction` — ป้องกัน staff override สถานะ T003_APPROVED/INTERNSHIP_STARTED กลับไปเป็น DOCS_APPROVED

## [2026-08-05] fix: batch 51 — config route authz + NaN bypass + isNaN guards

- **adminRoutes.js `/config/t002|t003|evaluation|t007|t008` GET:** เพิ่ม `verifyRole(...ADMIN_ROLES)` — ก่อนหน้านี้ผู้ใช้ที่ login แล้ว (ทุก role) ดึง config ได้โดยไม่ต้องเป็น admin/staff
- **authController.js `loginWithKKU`:** เพิ่ม `isNaN(classYear) ||` ในเงื่อนไข block classYear=0 — ป้องกัน `parseInt("x") → NaN` ผ่านด่านตรวจ class_year
- **visitController.js `toggleVisitStatus` + `deleteVisit`:** เพิ่ม `isNaN` guard บน `parseInt(id, 10)` → 400 + แปลงทุก `parseInt(id)` → `numId`
- **docController.js `deleteDocument` (student):** เพิ่ม `isNaN` guard บน `parseInt(id, 10)` → 400 + แปลง `parseInt(id)` → `numId`
- **studentController.js `softDeleteStudent` + `restoreStudent` + `permanentlyDeleteStudent` + `updateStudentBasicInfo`:** เพิ่ม `isNaN` guard บน `parseInt(req.params.id, 10)` → 400 ทั้ง 4 ฟังก์ชัน

## [2026-08-05] fix: batch 50 — auth gap on PUT /teacher/me + isNaN guards

- **teacherRoutes.js `PUT /me`:** เพิ่ม `verifyRole('teacher', 'staff')` — ก่อนหน้านี้นักศึกษา (role=student) เรียก endpoint นี้ได้และสร้าง Teacher row ใน DB ได้ ทำให้เกิด ghost teacher entries
- **teacherController.js `reviewT003` + `reviewT002`:** เพิ่ม `isNaN(parsedStudentId)` guard + แปลง `parseInt(studentId)` → `parsedStudentId` ทุกจุดในแต่ละฟังก์ชัน
- **adminDocController.js `updateDocStatus`:** เพิ่ม `isNaN` guard บน `parseInt(id)` → 400 แทน 500
- **supervisionController.js `saveSupervisionPeriod`:** เพิ่ม `isNaN` guard บน `parseInt(periodId)` → 400 แทน 500
- **supervisionController.js `assignCoTeachers`:** เพิ่ม `isNaN` guard บน `parseInt(id)` → 400 แทน 500

## [2026-08-05] fix: batch 49 — advisorName/FK consistency + deleteDocument NaN guard

- **studentImportController.js:** เมื่อ `generalAdvisorId === undefined` (หาอาจารย์ไม่เจอ/ชื่อซ้ำ) ให้ suppress `advisorName` update ด้วย — ก่อนหน้านี้ FK เก่าถูกรักษาไว้แต่ `advisorName` ถูก overwrite ด้วยชื่อที่ resolve ไม่ได้ ทำให้ FK/display name ไม่ตรงกัน
- **coopController.js `deleteDocument`:** เพิ่ม `isNaN` guard บน `parseInt(id)` + ใช้ `parsedDocId` ทั้งฟังก์ชัน — non-integer id ทำ Prisma error 500 แทน 400

## [2026-08-05] fix: batch 48 — NaN guards + status gates + TOCTOU + apiFetch cleanup

- **adminDocController.js `reviewStudentStatus`:** เพิ่ม `isNaN` guard หลัง `parseInt(studentId)`
- **adminDocController.js `approveAllDocs`:** เพิ่ม `isNaN` guard + แก้ตัวแปร `parsedId` ให้ consistent ทั้งฟังก์ชัน
- **adminDocController.js `reviewT002` + `reviewT003`:** เพิ่ม `isNaN` guard + แก้ `parseInt(studentId)` → `parsedStudentId` ทุกจุดใน transaction
- **adminDocController.js `updateCoopApplicationStatus`:** เพิ่ม `Number.isInteger` guard + wrap ใน `$transaction` + soft-delete guard + status gate `{APPLYING, WAITING_FOR_STAFF_CHECK, APPLICATION_EDITS_REQUIRED, EDITS_REQUIRED, QUALIFIED, QUALIFICATION_FAILED}` + is404/is400 catch
- **supervisionController.js `updateConfirmedDate`:** ย้าย `officialLetterPath` + `status !== DATE_CONFIRMED` check เข้าใน `$transaction` — TOCTOU window ระหว่าง check/write; เพิ่ม is404/is400/is409 catch
- **coopPeriodController.js `updatePeriod` + `deletePeriod`:** เพิ่ม `Number.isInteger` guard + P2025 catch → 404 แทน 500
- **coopController.js `deleteDocument`:** เพิ่ม status gate — T002_FORM ลบไม่ได้เมื่อ T002 อยู่ระหว่าง review; T003_FORM เช่นกัน
- **A_DocT003Review.tsx:** แปลง axios.get (line 104, 138) + axios.put (line 233) → `apiFetch`; ลบ unused `axios` import

## [2026-08-05] fix: batch 47 — T002/T003 re-upload gates + admin status gates + soft-delete + apiFetch

- **docController.js `uploadDocument` T002 gate:** เพิ่ม `T002_EDITS_REQUIRED` ใน valid statuses — นักศึกษา re-upload หลังถูก reject ไม่ได้ (ติด 400)
- **docController.js `uploadDocument` T003 gate:** เพิ่ม `T003_EDITS_REQUIRED` ใน valid statuses — เหมือนกัน
- **adminDocController.js `reviewStudentStatus`:** เพิ่ม soft-delete guard ใน `$transaction` — staff เปลี่ยนสถานะของ soft-deleted student ได้; เพิ่ม `is404/is400` catch
- **adminDocController.js `approveAllDocs`:** เพิ่ม soft-delete guard ใน `$transaction` — เหมือนกัน; เพิ่ม `is404` catch
- **adminDocController.js `reviewT002`:** เพิ่ม `coop.status === 'T002_SUBMITTED'` check ใน `$transaction` + เปลี่ยน `upsert` → `update` — admin reverse status ของ student ที่อยู่ใน T003 ขั้นตอนได้; เพิ่ม `is400` catch
- **adminDocController.js `reviewT003`:** เหมือนกัน — `T003_SUBMITTED` gate + `upsert` → `update`
- **IssueSupervisionLetterModal.tsx:** เปลี่ยน raw `axios.post` + manual token → `apiFetch` — ไม่มี unified 401-auto-logout; ลบ unused `axios` import

## [2026-08-05] fix: batch 46 — status gates in updateCoopStatus/reviewSupervision/reviewT002/T003 + FK advisor lookup

- **coopController.js `updateCoopStatus`:** wrap soft-delete check + update ใน `$transaction` + ตรวจ `coop.status ∈ {APPLYING, WAITING_FOR_STAFF_CHECK}` ก่อน update — staff/teacher เปลี่ยน status ได้ทุก status ทำให้ถอยสถานะกลับได้; เพิ่ม `is404/is400` catch
- **supervisionController.js `reviewSupervision` APPROVE:** เพิ่ม re-read `current.status !== 'PENDING_TEACHER'` ภายใน `$transaction` เดิม — อาจารย์ APPROVE appointment ที่ COMPLETED/DATE_CONFIRMED ได้ทำให้ status ถดถอย
- **supervisionController.js `reviewSupervision` REJECT:** wrap ใน `$transaction` + ตรวจ `status ∈ {PENDING_TEACHER, TEACHER_REJECTED}` — อาจารย์ REJECT appointment ที่ COMPLETED ได้ทำให้ `confirmedDate` ถูก null; เพิ่ม `is400` catch
- **teacherController.js `reviewT003`:** เพิ่ม `coop.status === 'T003_SUBMITTED'` check ใน `$transaction` เดิม — อาจารย์ review T003 ซ้ำหรือ backward ได้; เปลี่ยน `upsert` → `update`; เพิ่ม `is400` catch
- **teacherController.js `reviewT002`:** เหมือนกัน — `coop.status === 'T002_SUBMITTED'` check + `upsert` → `update` + `is400` catch
- **supervisionController.js `proposeSupervisionDate`:** เปลี่ยนจาก name-substring lookup → `prisma.teacher.findUnique({ where: { id: student.generalAdvisorId } })` — substring match บนชื่อสั้นทำให้ routing ผิดอาจารย์ และ data leakage ข้ามอาจารย์

## [2026-08-05] fix: batch 45 — status gate + TOCTOU in acknowledge/letter upload + advisor filter

- **docController.js `acknowledgeDispatchDownload`:** wrap ใน `$transaction` + ตรวจ `coop.status === 'REQ_LETTER_ISSUED'` ก่อน update — student ส่ง request ได้ในทุก status ทำให้ถอยสถานะกลับได้
- **supervisionController.js `uploadOfficialLetter`:** wrap ใน `$transaction` + ตรวจ `status === 'DATE_CONFIRMED'` ก่อน update — admin อัปโหลดหนังสือนิเทศกับ appointment ที่ COMPLETED/REJECTED ได้ ทำให้ status ถอยกลับ; ลบไฟล์ที่ upload แล้วถ้า transaction fail
- **teacherController.js `getLatestRequests`:** เปลี่ยน `advisorName: { contains: teacher.firstName }` → `OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }]` — ชื่อสั้นทำให้เห็นนักศึกษาของอาจารย์ท่านอื่น (data leakage)

## [2026-08-05] fix: batch 44 — TOCTOU in status transitions + soft-delete in deleteDocument

- **studentController.js `downloadPlacementLetter`:** wrap status check + `studentCoop.update` ใน `$transaction` — concurrent status change ระหว่าง check/write ทำให้ coop เป็น INTERNSHIP_STARTED จากสถานะผิด; เพิ่ม `is400` catch
- **docController.js `acknowledgePlacementLetter`:** เหมือนกัน — re-check status ใน `$transaction` ก่อน update; เพิ่ม `is400` catch
- **supervisionController.js `completeSupervision`:** wrap `supervision.status` check + `update` ใน `$transaction` — concurrent reject ทำให้ supervision ถูก mark COMPLETED จากสถานะ TEACHER_REJECTED; เพิ่ม `is400` catch
- **docController.js `deleteDocument`:** เพิ่ม `doc.student.deletedAt` guard — soft-deleted student ลบเอกสารตัวเองได้ใน 24h window
- **coopController.js `deleteDocument`:** เหมือนกัน

## [2026-08-05] fix: batch 43 — soft-delete guards + TOCTOU in auth/student/doc/supervision

- **authController.js `getProfile`:** เพิ่ม `deletedAt` guard — soft-deleted student ดูข้อมูล profile ผ่าน JWT ยังไม่หมดอายุ
- **studentController.js `getMyProfile`:** เพิ่ม `deletedAt` guard ก่อน `if (!student)` — soft-deleted student ดูข้อมูลทั้งหมดรวมเอกสาร/coop
- **studentController.js `syncFromReg`:** `if (!student)` → `if (!student || student.deletedAt)` — soft-deleted student sync KKU ข้อมูลกลับได้
- **docController.js `getMyApplication`:** เพิ่ม `|| student.deletedAt`
- **docController.js `saveT002Form`:** เพิ่ม `|| student.deletedAt`
- **docController.js `saveT003Form`:** เพิ่ม `|| student.deletedAt`
- **supervisionController.js `getStudentSupervision`:** เพิ่ม `|| student.deletedAt`
- **authController.js `registerStudent`:** ย้าย email+studentId duplicate `findFirst` + `user.create` ใน `$transaction` — TOCTOU: concurrent requests ผ่าน check พร้อมกัน; ใช้ `throw { is409: true }` + `is409` catch
- **authController.js `loginWithKKU`:** เพิ่ม inner transaction guard (re-check studentId conflict + `user.create` ใน `$transaction`); เพิ่ม `is409` และ `P2002` ใน catch — concurrent first-time login คืน 500 แทน 409

## [2026-08-05] fix: batch 42 — soft-delete guards + TOCTOU in doc/coop/supervision/student

- **coopController.js `submitCoopApplication`:** เพิ่ม `|| student.deletedAt` — soft-deleted student ยื่นคำร้องได้
- **docController.js `getStudentIdFromUser` helper:** เพิ่ม `|| student.deletedAt` — helper ที่ใช้ใน `saveApplicationForm` คืน student ที่ถูกลบ
- **docController.js `uploadDocument`:** เพิ่ม `|| student.deletedAt`; ย้าย `oldDoc = findFirst(...)` เข้าใน `$transaction` — TOCTOU: 2 concurrent requests เกิด P2025 บน document.delete (deleted by first tx)
- **docController.js `acknowledgeDispatchDownload`:** เพิ่ม `|| student.deletedAt`
- **docController.js `acknowledgePlacementLetter`:** เพิ่ม `|| student.deletedAt`
- **docController.js `deleteDocumentByType`:** เพิ่ม `|| student.deletedAt`
- **supervisionController.js `proposeSupervisionDate`:** เพิ่ม `|| student.deletedAt` — soft-deleted student นัดนิเทศได้
- **studentController.js `updateMyProfile`:** เพิ่ม `deletedAt` guard หลัง currentStudent lookup — soft-deleted student แก้ profile ได้
- **studentController.js `downloadPlacementLetter`:** เพิ่ม `|| student.deletedAt` — soft-deleted student เปลี่ยนสถานะ coop ได้

## [2026-08-05] fix: batch 41 — soft-delete guards in visit/coop/teacher/student controllers

- **visitController.js `getVisitsByStudent`:** เพิ่ม `|| student.deletedAt` — soft-deleted student ให้ visit history แก่ผู้เรียกได้
- **visitController.js `createVisit`:** เพิ่ม `|| student.deletedAt` — สร้าง Visit record ให้ soft-deleted student ได้
- **studentController.js `updateMyProfile` (studentId dup check):** เพิ่ม `deletedAt: null` ใน `findFirst` — soft-deleted student บล็อก studentId ของ account ใหม่แบบผิดๆ
- **teacherController.js `reviewT003`:** เพิ่ม `|| student.deletedAt` — อาจารย์เปลี่ยน coop status ของ soft-deleted student ได้
- **teacherController.js `reviewT002`:** เหมือนกัน
- **coopController.js `updateCoopStatus`:** เพิ่ม student soft-delete guard ก่อน `studentCoop.update` — staff เปลี่ยน coop status ของ soft-deleted student ได้

## [2026-08-05] fix: batch 40 — soft-delete + TOCTOU (auth/teacher) + apiFetch (3 modals)

- **authController.js `loginWithKKU` (studentId conflict check):** เปลี่ยน `findUnique` → `findFirst` + เพิ่ม `deletedAt: null` — soft-deleted student ทำให้ login KKU ล้มเหลวด้วย 409 แบบผิดๆ
- **authController.js `registerStudent` (studentId conflict check):** เหมือนกัน — soft-deleted student block การลงทะเบียนใหม่
- **teacherController.js `createTeacher`:** ย้าย email conflict `findFirst` เข้าใน `$transaction` + ใช้ `throw { is409: true }` — concurrent requests ผ่าน check พร้อมกันแล้ว P2002 คืน 500 ผิด; เพิ่ม `if (err.is409)` ใน catch
- **teacherController.js `adminUpdateTeacher`:** แปลง array-form `$transaction` → callback form; ย้าย email conflict check เข้าใน callback — same TOCTOU bug; เพิ่ม `if (err.is409)` ใน catch
- **A_DocT003Review.tsx `fetchAllData`:** `fetch("/api/admin/coop-periods/all", { headers: ... })` → `apiFetch(...)` — expired token ไม่ auto-logout
- **IssueLetterModal.tsx `loadCommonData`:** `fetch("/api/admin/config/dean-info", { headers: ... })` → `apiFetch(...)` — expired token คืนข้อมูลคณบดีผิดใน PDF ออกหนังสือ
- **IssuePlacementLetterModal.tsx `loadCommonData`:** เหมือนกัน — modal ออกจดหมายตอบรับสถานประกอบการ

## [2026-08-05] fix: batch 39 — soft-delete filters (supervisions + dashboard + teacher advisor)

- **adminDashboardController.js `getDashboardStats` `coopFilter`:** เพิ่ม `student: { deletedAt: null }` ทั้ง year-specific และ all-years branch — `studentCoop.findMany` คืน records ของ soft-deleted students
- **teacherController.js `getDashboardStats` `advisorFilter`:** เพิ่ม `deletedAt: null` ทั้ง `isCoopTeacher` branch และ OR branch — teacher dashboard นับ/แสดง soft-deleted students
- **supervisionController.js `getAllSupervisions`:** เพิ่ม `where: { student: { deletedAt: null } }` — admin supervision list แสดงนัดหมายของ soft-deleted students
- **supervisionController.js `getTeacherSupervisions`:** เพิ่ม `student: { deletedAt: null }` ใน where ควบคู่กับ `OR: [...]` — teacher supervision list แสดงนัดหมายของ soft-deleted students
- **supervisionController.js `getSupervisionsForTeacher`:** เหมือนกัน — `/api/teacher/supervisions` endpoint
- **supervisionController.js `getSupervisionCalendar`:** เพิ่ม `student: { deletedAt: null }` ใน where clause ปฏิทิน — soft-deleted students ปรากฏบนปฏิทินนิเทศ

## [2026-08-05] fix: batch 38 — TOCTOU $transaction + soft-delete filters

- **visitController.js `createVisit`:** wrap duplicate-visit `findFirst` + `create` ใน `$transaction` — concurrent requests ผ่าน findFirst check พร้อมกันได้ ทำให้เกิดนัดหมายซ้ำ
- **supervisionController.js `reviewSupervision` (APPROVE path):** wrap conflict `findFirst` + `update` ใน `$transaction` — concurrent APPROVE requests ผ่าน conflict check พร้อมกันได้ ทำให้อาจารย์มีนิเทศ 2 นัดในวันเดียวกัน
- **supervisionController.js `updateConfirmedDate`:** เหมือนกัน — wrap ใน `$transaction`; 409 ทั้งสอง function ใช้ `throw { is409: true }` แทน early return เพื่อให้ transaction roll back ก่อน
- **teacherController.js `getAdviseesForReview`:** เพิ่ม `deletedAt: null` ใน where clause — นักศึกษาที่ถูก soft-delete ปรากฏใน review list
- **adminDashboardController.js `getDashboardStats`:** เพิ่ม `{ where: { deletedAt: null } }` ใน `student.count()` — สถิติ "นักศึกษาทั้งหมด" นับรวม soft-deleted students
- **teacherController.js `getLatestRequests`:** เพิ่ม `deletedAt: null` ใน student relation filter

---

## [2026-08-05] fix: batch 37 — teacherController getAdviseesForReview invalid Prisma field

- **teacherController.js `getAdviseesForReview`:** แก้ `where: { advisorId: teacher.id }` → `where: { OR: [{ generalAdvisorId }, { coopAdvisorId }] }` — field `advisorId` ไม่มีใน Prisma schema จะ throw PrismaClientValidationError ทันทีถ้า route นี้ถูก mount; ยังเป็น dead code (ยังไม่ถูก mount ใน routes)

---

## [2026-08-05] fix: batch 36 — coopPeriodController togglePeriod $transaction

- **coopPeriodController.js `togglePeriod`:** wrap `coopPeriod.updateMany` (deactivate others) + `coopPeriod.update` (activate target) ใน `prisma.$transaction` — เดิมถ้า update ตัวที่ 2 ล้มเหลวจะเกิดสถานะที่ทุกรอบถูกปิดหมด (zero active periods)

---

## [2026-08-05] fix: batch 35 — authController loginWithSSO $transaction + S_Dashboard wrong enum

- **authController.js `loginWithSSO`:** ย้าย external KKU API call มาก่อน transaction แล้ว wrap `user.upsert` + `student.upsert`/`teacher.upsert` ใน `prisma.$transaction` — เดิมถ้า profile write ล้มเหลวจะเกิด User row โดยไม่มี profile row
- **S_Dashboard.tsx status icon logic:** ลบ `TEACHER_REJECTED` ออกจาก ⚠️ list และ `COMPLETED` ออกจาก ✅ list — ทั้งสองค่าเป็น `SupervisionStatus` enum ไม่ใช่ `CoopStatus` ทำให้ comparison เป็น false เสมอ

---

## [2026-08-05] fix: batch 34 — PlacementLetterCard raw fetch → apiFetch

- **PlacementLetterCard.tsx `handleDownloadAndAck`:** เปลี่ยน multi-line raw `fetch("/api/students/acknowledge-placement-letter")` ด้วย manual Authorization header เป็น `apiFetch` — ถูก grep พลาดเพราะ URL อยู่คนละบรรทัดกับ `fetch(`

---

## [2026-08-05] fix: batch 33 — $transaction wrap (announcementController + studentController) + apiFetch migration (6 components)

- **announcementController.js `addOrUpdateAnnouncement` UPDATE branch:** wrap `annFile.deleteMany` + `announcement.update` ใน `prisma.$transaction`; ย้าย `fs.unlinkSync` มาหลัง transaction commit
- **studentController.js `updateMyProfile`:** รวม `student.upsert` + `studentEmail` operations + `studentCoop.upsert` ใน `prisma.$transaction` เดียว — เดิมทั้ง 3 writes แยกกัน ถ้า write หลังล้มเหลวจะเกิด partial update
- **A_App.tsx:** เปลี่ยน raw `fetch("/api/auth/me")` ด้วย manual auth header เป็น `apiFetch`
- **A_DocT002Review.tsx:** เปลี่ยน raw fetch 3 จุด (fetchAllData coop-periods, loadConfig, handleSaveConfig) เป็น `apiFetch`
- **T_T002Review.tsx:** เปลี่ยน raw fetch (fetchStudents coop-periods) เป็น `apiFetch`
- **T_T003Review.tsx:** เปลี่ยน raw fetch (fetchStudents coop-periods) เป็น `apiFetch`
- **T_SupervisionReview.tsx:** เปลี่ยน raw fetch (fetchData coop-periods) เป็น `apiFetch`
- **IssueSupervisionLetterModal.tsx:** เปลี่ยน raw fetch (loadCommonData dean-info) เป็น `apiFetch`

---

## [2026-08-05] fix: batch 32 — $transaction wrap (teacherController + docController) + raw fetch apiFetch (T_Profile, S_ProfilePage)

- **teacherController.js `reviewT003`:** wrap `studentCoop.upsert` + `document.findFirst/update` ใน `prisma.$transaction` — เดิม 2 writes แยกกัน ถ้า `document.update` fail จะ studentCoop อัปเดตแต่ document ไม่อัปเดต
- **teacherController.js `reviewT002`:** เหมือนกัน — wrap ใน `prisma.$transaction`
- **docController.js `uploadDocument`:** wrap `document.delete` + `document.create` + `studentCoop.update` ทุก branch ใน `prisma.$transaction` — ย้าย `fs.unlinkSync(oldPath)` มาหลัง transaction commit เพื่อไม่ให้ orphaned file; 400 errors ใน transaction ใช้ throw + `err.is400` flag แทน early return
- **T_Profile.tsx `fetchMajors`:** เปลี่ยน `fetch("/api/admin/majors")` เป็น `apiFetch` เพื่อ consistency กับ apiFetch pattern ทั้งระบบ
- **S_ProfilePage.tsx StudentModal:** เปลี่ยน `fetch("/api/admin/majors")` เป็น `apiFetch` (apiFetch import มีอยู่แล้ว)

---

## [2026-08-05] fix: batch 31 — adminDocController updateDocStatus whitelist + raw fetch apiFetch migration (7 components)

- **adminDocController.js `updateDocStatus`:** เพิ่ม `ALLOWED_DOC_STATUS` whitelist (5 statuses) ก่อน `prisma.document.update` — เดิมไม่มีการ validate ทำให้ teacher/staff ส่ง status ใดก็ได้
- **A_DocT000.tsx:** แทน `fetch()` + manual token ด้วย `apiFetch` ทุก endpoint (config/t000 GET/POST, doc-requirements, t000/students, coop-periods/all, doc/:id/status PUT, t000/approve-all POST, t000/review PUT)
- **A_DocT003Review.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน loadConfig (config/t003 GET) และ handleSaveConfig (config/t003 POST)
- **S_DocsT003Form.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน loadConfig (config/t003 GET) และ upload (docs/upload POST)
- **IssueLetterModal.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน handleSubmit (t000/review PUT)
- **IssuePlacementLetterModal.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน handleSubmit (t000/review PUT)
- **A_Company.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน useEffect (companies GET, coop-periods/all GET), saveAdd, saveEdit, remove, saveMentor (ADD+EDIT), removeMentor
- **S_Company.tsx:** แทน `fetch()` ด้วย `apiFetch` ใน useEffect (companies GET, coop-periods GET), saveAdd, saveEdit, removeCompany, saveMentor (ADD+EDIT), removeMentor

---

## [2026-08-05] fix: batch 30 — A_Mentors / A_Settings / T_Profile raw fetch auto-logout bypass

- **A_Mentors.tsx:** แทน `fetch()` + manual token ด้วย `apiFetch` ใน fetchData, handleUpdate, handleDelete
- **A_Settings.tsx:** แทน `fetch()` + manual token ด้วย `apiFetch` ใน loadData (dean-info GET), handleUpload (assets POST), handleDeleteAsset (assets DELETE), handleSaveDeanInfo (dean-info POST) — เดิม 401 ไม่ trigger auto-logout
- **T_Profile.tsx:** แทน `fetch()` + manual token ด้วย `apiFetch` ใน fetchProfile (teacher/me GET) และ handleSave (teacher/me PUT); ลบ manual `Authorization` header ที่ซ้ำซ้อนออกจาก fetchPrefixes ที่ใช้ apiFetch อยู่แล้ว

---

## [2026-08-05] fix: batch 29 — loginWithSSO soft-delete bypass + dashboard apiFetch migration

- **authController.js `loginWithSSO`:** เพิ่ม soft-delete check (`student.deletedAt`) ก่อน sign JWT — เดิม login ผ่าน SSO (KKU) ข้ามการตรวจสอบนี้ ทำให้นักศึกษาที่ถูก soft-delete (deletedAt non-null) ยังได้รับ JWT ที่ valid ได้ ต่างจาก `signIn`, `loginWithKKU`, `loginWithGoogle` ที่ตรวจสอบแล้ว
- **T_Dashboard.tsx:** แทน `axios` (manual token) ด้วย `apiFetch` ทุก endpoint (fetchPeriods, fetchData stats/requests/supervisions/T002T003 counts, handleExport blob)
- **A_Dashboard.tsx:** แทน `axios` ด้วย `apiFetch` (fetchPeriods, fetchStats, handleExport blob)
- **S_Dashboard.tsx:** แทน `axios` ด้วย `apiFetch` (profile, announcements, supervision/me, config keys)
- **A_Announcements.tsx:** แทน `axios` ด้วย `apiFetch` (fetchMajors, fetchPeriods, fetchAnnouncements, save POST, remove DELETE)

---

## [2026-08-05] fix: batch 28 — adminDocController status whitelists + $transaction wrapping

- **adminDocController.js `reviewStudentStatus`:** เพิ่ม `REVIEW_STATUS_ALLOWED` whitelist (12 statuses) — เดิม admin ส่ง status ใด ๆ ก็ได้รวมถึงค่าที่ไม่มีใน CoopStatus enum
- **adminDocController.js `updateCoopApplicationStatus`:** เพิ่ม `APP_STATUS_ALLOWED` whitelist (5 statuses) — เดิมไม่มีการ validate status ก่อน upsert
- **adminDocController.js `reviewStudentStatus`:** ห่อ `document.findFirst/create/update` + `studentCoop.upsert` ด้วย `prisma.$transaction` — เดิม DB ไม่สอดคล้องกันได้หาก upsert สำเร็จแต่ document update ล้มเหลว
- **adminDocController.js `approveAllDocs`:** ห่อ `document.updateMany` + `studentCoop.upsert` ด้วย `prisma.$transaction`
- **adminDocController.js `reviewT002`:** ห่อ `studentCoop.upsert` + `document.findFirst/update` ด้วย `prisma.$transaction`
- **adminDocController.js `reviewT003`:** ห่อ `studentCoop.upsert` + `document.findFirst/update` ด้วย `prisma.$transaction`

---

## [2026-08-04] fix: batch 27 — test suite fixes (coopPeriod 409, teacherController reviewT002 + exportMyStudents)

- **coopPeriodController.test.js:** แก้ label และ `expect(res.status).toHaveBeenCalledWith(400)` → `409` สำหรับ test duplicate period — controller คืน 409 มาตั้งแต่ต้นแต่ test ยังเขียน 400 ไว้
- **teacherController.test.js `reviewT002`:** เพิ่ม `req.user = { id: 99 }`, mock `teacher.findUnique` + `student.findUnique` สำหรับ ownership check ที่ controller เพิ่มมา; แก้ status จาก `T002_APPROVED` (ไม่มีใน allowlist) เป็น `T002_SUBMITTED`
- **teacherController.test.js `exportMyStudents`:** อัปเดต `where` expectation ให้ตรงกับ controller ที่เพิ่ม `deletedAt: null`: อาจารย์ปกติ → `{ AND: [{ deletedAt: null }, { OR: [...] }] }`, isCoopTeacher → `{ deletedAt: null }`

---

## [2026-08-04] fix: batch 26 — T_Students apiFetch coop-periods + supervisionController updateConfirmedDate status guard

- **T_Students.tsx `fetchData`:** แทน `axios.get("/api/admin/coop-periods/all", { headers: { Authorization } })` ด้วย `apiFetch` + ลบ `const token` + ลบ unused `import axios` — เดิม 401 จาก token หมดอายุไม่ trigger auto-logout
- **supervisionController.js `updateConfirmedDate`:** เพิ่ม guard `if (supervision.status !== 'DATE_CONFIRMED')` หลัง officialLetterPath check — เดิม admin สามารถตั้ง `confirmedDate` บน appointment ที่ยังเป็น PENDING_TEACHER หรือ TEACHER_REJECTED ได้ ทำให้ status กับ confirmedDate ไม่สอดคล้องกัน และ conflict-check บน same-day ก็จะไม่นับ slot นั้น เปิดช่องให้ double-book

---

## [2026-08-04] fix: batch 25 — kkuRegService syncStudentAll silently succeeds on wrong creds + A_CriteriaPage apiFetch

- **kkuRegService.js `syncStudentAll`:** แก้ guard จาก `if (!token)` เป็น `if (!token || typeof token !== 'string')` — เดิม `getStudentToken` คืน `{ error: "..." }` (truthy object) เมื่อ login ผิด ทำให้ object นี้ถูกส่งเป็น token ต่อ; sub-functions กลืน error ไว้ใน try/catch แล้ว return null; `syncStudentAll` จึงคืน `{ ok: true }` พร้อม info/grades null ทั้งหมด — นักศึกษา type password ผิดแต่ได้รับ "ซิงค์สำเร็จ (อัปเดต 1 ฟิลด์)"
- **A_CriteriaPage.tsx:** แทน `axios.post` และ `axios.delete` ด้วย `apiFetch` + ลบ `const token` — เดิม 401 (token หมดอายุ) ไม่ trigger auto-logout

---

## [2026-08-04] fix: batch 24 — announcementController linkUrl + XSS URL validation + dead SupervisionStatus values

- **announcementController.js `addOrUpdateAnnouncement`:** (F2) เปลี่ยน `linkUrl: ... : undefined` เป็น `null` — เดิม Prisma UPDATE ไม่ลบ linkUrl เก่าเมื่อ admin ลบลิงก์ทั้งหมด; (F3) ย้าย `JSON.parse(linkUrls)` ออกจาก `sharedData` object literal มาเป็น early-return พร้อม try/catch ก่อน file I/O — เดิม parse error ทำให้ multer files ที่ upload มาแล้วค้างบน disk (orphaned); (F6 backend) เพิ่มตรวจ URL protocol: ปฏิเสธทุก URL ที่ไม่ขึ้นต้นด้วย `http://` หรือ `https://` ก่อนบันทึก DB
- **A_Announcements.tsx:** (F1) แก้ endpoint `fetchMajors` จาก `/api/admin/majors` (CoopCriteria) เป็น `/api/admin/students/majors` (distinct student majors) — เดิม dropdown targeting ประกาศแสดง major ผิด; (F6 admin) `addLink()` validate protocol ก่อน add URL — เดิม admin สามารถ add `javascript:` URL เข้า announcement
- **S_Announcements.tsx:** (F6 student) เพิ่ม `safeUrl()` helper ที่กรองเหลือเฉพาะ `http[s]://` แล้วใช้กับ `window.open` (บัตรประกาศ) และ `href` (modal) — เดิม stored `javascript:` URL ถูก execute ได้เมื่อนักศึกษากดลิงก์
- **S_Sidebar.tsx:** (F4) ลบ 5 ค่า SupervisionStatus ออกจาก `showDocsMenu` (PENDING_TEACHER, TEACHER_REJECTED, DATE_CONFIRMED, LETTER_UPLOADED, COMPLETED) — ค่าเหล่านี้ไม่ใช่ CoopStatus ทำให้ comparison เป็น always-false
- **S_Dashboard.tsx:** (F5) ลบ PENDING_TEACHER, DATE_CONFIRMED, LETTER_UPLOADED ออกจาก icon ternary — เหตุผลเดียวกัน

---

## [2026-08-04] fix: batch 23 — S_ProfilePage apiFetch + loginWithGoogle null student guard + import $transaction

- **S_ProfilePage.tsx:** แทน 5x raw `fetch` ด้วย `apiFetch` (reg-status, sync-from-reg, me x3) + ลบ manual Authorization header ออกจาก apiFetch calls ที่มีอยู่แล้ว — เดิม 401 ถูกกลืน นักศึกษา stuck ไม่ถูก redirect logout
- **authController.loginWithGoogle:** เปลี่ยน guard จาก `!user || user.student?.deletedAt` เป็น `!user || !user.student || user.student.deletedAt` — เดิม User ที่ไม่มี Student row (orphan) ผ่านการ login ได้และได้รับ JWT แต่ใช้งานหน้าต่างๆ ไม่ได้
- **studentImportController.importStudents:** ห่อ `user.upsert` + `student.upsert` ใน `$transaction` — เดิมถ้า student.upsert fail หลัง user.upsert commit จะเกิด orphaned User row ซึ่งเป็น precondition ของ bug loginWithGoogle ด้านบน

---

## [2026-08-04] fix: batch 22 — teacherRoutes verifyRole + getMyStudents deletedAt + createTeacher $transaction + A_Teacher apiFetch

- **teacherRoutes.js:** เพิ่ม `verifyRole('teacher')` ที่ `GET /my-students` และ `GET /students/export` — เดิมนักศึกษา/staff ที่มี token valid เรียกได้
- **teacherController.getMyStudents:** เพิ่ม `deletedAt: null` ใน `baseWhere` — เดิม soft-deleted students ปรากฏในรายชื่อ teacher ทั้งที่ exportMyStudents กรองถูกต้องแล้ว (inconsistency)
- **teacherController.createTeacher:** ห่อ `user.create` + `teacher.create` ใน `$transaction` — เดิมถ้า teacher.create fail หลัง user.create สำเร็จ จะเกิด orphaned User row ที่ login ได้แต่ไม่มี profile
- **A_Teacher.tsx:** แทน 7x raw `fetch` ด้วย `apiFetch` — เดิม 401 ถูกกลืน staff ไม่ถูก redirect logout เมื่อ session หมดอายุ

---

## [2026-08-04] fix: batch 21 — S_Gateway + T_App + T_Students raw fetch → apiFetch

- **S_Gateway.tsx:** แทน 4x raw `fetch` ด้วย `apiFetch` (GET /api/students/me, GET /api/students/coop-periods/active, DELETE /api/coop/documents/:id, POST /api/coop/apply) — เดิม 401 ถูกกลืนโดยไม่ auto-logout; ยังลบ manual Authorization header ออกเพราะ apiFetch inject ให้เอง
- **T_App.tsx:** แทน raw `fetch("/api/teacher/me")` ด้วย `apiFetch` — เดิม token หมดอายุจะ fallback เป็น localStorage silently ทำให้ `isCoopTeacher` ผิด (ค้างเป็น false) ส่งผลให้ T_Students routing ไปผิด endpoint
- **T_Students.tsx:** แทน raw `fetch(endpoint)` (students) และ raw `fetch("/api/admin/majors")` ด้วย `apiFetch` — เดิม 401 ถูกกลืน ตารางนักศึกษาเงียบๆ ไม่โหลด

---

## [2026-08-04] fix: batch 20 — useNotifCounts raw fetch + TOCTOU in coop submit + notif dedup

- **useNotifCounts.ts:** แทน 2x raw `fetch` ด้วย `apiFetch` — เดิม 401 ถูกกลืนหาย ทำให้ sidebar ทั้ง 3 ไม่ auto-logout เมื่อ token หมดอายุ
- **NotificationBell.tsx:** ลบออก — dead code (ไม่มี import ไหนใช้), มีปัญหา raw fetch เหมือนกัน
- **notificationHelper.createNotifications:** ห่อ findMany+createMany ใน `$transaction` เพื่อ serialize dedup check และ insert (ลด TOCTOU race ที่ทำให้ notification ซ้ำ)
- **coopController.submitApplication:** ย้าย REAPPLY_ALLOWED guard เข้าไปใน `$transaction` — เดิมอยู่นอก transaction ทำให้ double-submit race ผ่าน guard ได้ แล้ว insert document ซ้ำกัน

---

## [2026-08-04] fix: batch 19 — gradeSheetUrl XSS + transaction + visitRoutes IDOR

- **coopController.submitApplication:** เพิ่ม URL validation สำหรับ `gradeSheetUrl` — รับเฉพาะ http/https เพื่อป้องกัน `javascript:` URI injection ที่ render เป็น `<a href>` ในหน้า admin/teacher
- **coopController.submitApplication:** ย้าย `gradeSheetUrl` upsert เข้าไปใน `$transaction` เดิม — เดิมอยู่นอก transaction ทำให้ถ้า upsert fail หลัง transaction commit นักศึกษาจะ stuck (ยื่นซ้ำไม่ได้เพราะสถานะเปลี่ยนแล้ว)
- **visitRoutes.js:** เพิ่ม `verifyRole('teacher', 'staff')` ทุก route — เดิม GET `/student/:studentId` เป็น IDOR (นักศึกษาดูข้อมูลนิเทศของคนอื่นได้); write routes ก็ขาด role guard ที่ชัดเจน

---

## [2026-08-04] fix: batch 18 — deploy.ps1 unchecked git pull exit code

- **docs/deploy.ps1:** เพิ่มตรวจ `$LASTEXITCODE` หลัง `git pull` — เดิม deploy ดำเนินต่อแม้ pull จะ fail (merge conflict, auth error, network timeout) ทำให้ deploy สำเร็จโดย restart บน codebase เก่า

---

## [2026-08-04] fix: batch 17 — supervisionRoutes missing verifyRole + 4 cleanups

- **supervisionRoutes GET /teacher/supervisions:** เพิ่ม `verifyRole('teacher', 'staff')` — เดิมมีแค่ `verifyToken` ทำให้ authenticated user ทุก role เข้าถึงได้
- **coopStatusLabels.test.js:** แก้ stale assertion `COMPLETED` (ถูกลบออกจาก map แล้ว) → เปลี่ยนเป็น `T003_APPROVED`
- **server.js:** เปลี่ยน rate-limit skip จาก `/api/status` (ปัจจุบันต้องการ auth) → `/api/internal-status` (VM-local health check)
- **coopPeriodController.createPeriod:** เปลี่ยน 400 → 409 สำหรับ duplicate period; เพิ่ม P2002 catch ใน catch block เพื่อป้องกัน race condition

---

## [2026-08-04] fix: batch 16 — coopStatusLabels T003_APPROVED + exportMyStudents soft-delete filter

- **coopStatusLabels.js:** เพิ่ม `T003_APPROVED` ที่หายไป — ก่อนหน้านี้สถานะนี้แสดงเป็น "ยังไม่ยื่นสหกิจ" ใน Excel export อย่างผิดพลาด
- **coopStatusLabels.js:** ลบ 8 dead keys ที่ไม่มีในเนม CoopStatus enum (T004_SUBMITTED, T004_EDITS_REQUIRED, PENDING_TEACHER, TEACHER_REJECTED, DATE_CONFIRMED, LETTER_UPLOADED, COMPLETED, WAITING)
- **teacherController.exportMyStudents:** เพิ่ม `deletedAt: null` filter ในทุก where branch — นักศึกษาในถังขยะไม่ควรปรากฏใน Excel export ของอาจารย์ (admin export มีอยู่แล้ว)

---

## [2026-08-04] fix: batch 15 — criteriaController deleteCriteria P2025 → 404

- **criteriaController.deleteCriteria:** P2025 catch เพื่อคืน 404 แทน 500 เมื่อ delete record ที่ไม่มีอยู่; แก้ error key จาก `error:` → `message:` ให้ตรงกับ response format ที่ใช้ทั้งระบบ

---

## [2026-08-04] fix: batch 14 — apiFetch auto-inject token + remaining raw fetch + P2002→409 + err.message in criteriaController

- **apiFetch.ts:** auto-inject Authorization header from localStorage — ป้องกัน call site ลืมส่ง token
- **A_Students.tsx:** แทน 3x raw `fetch` (fetchStudents, fetchData, handleImport) ด้วย `apiFetch`; ลบ `const token` ที่ไม่จำเป็น
- **studentController updateMyProfile + updateStudentBasicInfo:** เปลี่ยน P2002 catch จาก 400 → 409 (Conflict)
- **criteriaController getAllCriteria + getMajorList:** ลบ `err.message` ออกจาก 500 response; เพิ่ม `console.error` ใน getMajorList
- **studentController.test.js:** อัปเดต assertion P2002 → 409 และแก้ stale mock ของ `exportStudents` (ขาด `prefix` ใน select)

---

## [2026-08-04] fix: batch 13 — raw fetch in admin trash/student pages + 409 status for conflict states

- **A_StudentTrash.tsx:** แทน 3x raw `fetch` ด้วย `apiFetch`; เพิ่ม `res.ok` guard ใน `fetchTrash`
- **A_StudentEditModal.tsx handleSubmit:** แทน raw `fetch` ด้วย `apiFetch` (เดิมซ่อม teacher-list แล้วแต่ handleSubmit ยังไม่ได้แก้)
- **A_Students.tsx handleDeleteStudent:** แทน raw `fetch` ด้วย `apiFetch`
- **studentController.softDeleteStudent:** เปลี่ยน status 404 → 409 เมื่อนักศึกษาอยู่ในถังขยะแล้ว (conflict ≠ not found)
- **studentController.restoreStudent:** เปลี่ยน status 404 → 409 เมื่อนักศึกษาไม่ได้อยู่ในถังขยะ (conflict ≠ not found)
- **studentController.test.js:** อัปเดต assertion 404 → 409 สำหรับทั้ง 2 กรณีข้างต้น

---

## [2026-08-04] fix: batch 12 — calendar privacy + info leaks + dead admin role

- **supervisionController.getSupervisionCalendar:** ลบ `onlineLink` ออกจาก student-facing calendar response — private meeting links ไม่ควรส่งให้นักศึกษาคนอื่น
- **companyController.updateMentor:** ลบ `err.message` ออกจาก 500 response (information leak)
- **announcementRoutes:** เปลี่ยน `verifyRole('admin','staff')` → `verifyRole('staff')` ('admin' ไม่มีใน Prisma enum)
- **companyController isStaffOrCompanyOwner:** ลบ `|| role === "admin"` ออก (dead code)
- **studentImportController:** Prisma errors (มี .code) ไม่ forward internal message ออกไปใน errorRows

---

## [2026-08-04] fix: batch 11 — raw fetch in admin modal + missing verifyRole on doc form routes

- **A_StudentEditModal.tsx:** แทน raw `fetch` ด้วย `apiFetch` + `res.ok` guard ในการโหลด teacher list
- **docRoutes.js POST /t002-form, /t003-form:** เพิ่ม `verifyRole('student')` — เดิมอนุญาตทุก authenticated role เข้าถึง student-only endpoint ได้

---

## [2026-08-04] fix: supervisionRoutes — ลบ dead 'admin' role จาก verifyRole

- `PUT /teacher/supervisions/:id/review` และ `/:id/complete` เปลี่ยนจาก `verifyRole('teacher','admin','staff')` เป็น `verifyRole('teacher','staff')` ('admin' ไม่มีใน Prisma Role enum)

---

## [2026-08-04] fix: S_StatusTracker — Phase 4 unreachable + dead SupervisionStatus keys

- **Phase 3 entryStatuses:** ลบ `T003_APPROVED` ออก ทำให้ Phase 4 (นิเทศและรายงาน) ถูก reach ได้จริง
- **Phase 4:** ลบ `COMPLETED` (เป็น SupervisionStatus ไม่ใช่ CoopStatus) ออกจาก entryStatuses/doneStatuses
- **Phase 3 substeps:** ลบ substep 3.3–3.5 ที่มี `statuses:[]` ว่างเปล่า; ย้าย supervision ไป Phase 4
- **ACTION_CONFIG:** ลบ keys PENDING_TEACHER/TEACHER_REJECTED/DATE_CONFIRMED/LETTER_UPLOADED/COMPLETED ซึ่งเป็น SupervisionStatus ที่ไม่มีวันตรงกับ CoopStatus

---

## [2026-08-04] fix: security batch 10 — gateway fetch + admin route guard

- **S_Gateway.tsx:** แทน raw `fetch` ด้วย `apiFetch` ให้ 401 trigger auto-logout ได้
- **adminRoutes.js GET /config/gateway:** เพิ่ม `verifyRole(...ADMIN_ROLES)` — เดิม student ที่มี token เรียกได้

---

## [2026-08-04] fix: correctness batch 9 — Prisma error code handling

- **authController.registerStudent:** จับ P2002 unique constraint → คืน 409 แทน 500 (เพื่อกันกรณี race condition ที่ TOCTOU ผ่าน check แต่ write ชนกัน)
- **docRequirementController.updateRequirement/deleteRequirement:** จับ P2025 not-found → คืน 404 แทน 500

---

## [2026-08-04] fix: security batch 8 — teacher controller info leak + route hardening

- **teacherController.js createTeacher/adminUpdateTeacher:** ลบ `err.message` ออกจาก 500 response (information leak)
- **T_Profile.tsx fetchPrefixes:** แทน raw `fetch` ด้วย `apiFetch` + `res.ok` guard — 401 ไม่ถูก swallow อีกต่อไป
- **teacherRoutes.js GET /prefixes:** เพิ่ม `verifyRole('teacher', 'staff')` — ก่อนหน้านี้ทุก role เรียกได้
- **teacherRoutes.js PUT /:id และ config/review routes:** ลบ `'admin'` ออกจาก `verifyRole` ทั้งหมด (ไม่มีใน Prisma Role enum)

---

## [2026-08-04] fix: security batch 7 — raw fetch bypass + open register endpoint

- **S_ProfilePage.tsx:** แทน raw `fetch` ด้วย `apiFetch` + เพิ่ม `r.ok` check — ป้องกัน 401 ถูก swallow แทนที่จะ auto-logout
- **authRoutes.js POST /register:** เพิ่ม `verifyToken + verifyRole('staff')` — ปิดกั้น endpoint ที่ UI ถูกลบไปแล้วแต่ route ยังเปิดอยู่

---

## [2026-08-04] fix: security batch 6 — soft-delete bypass + TOCTOU

- **authController.signIn:** เพิ่ม `deletedAt` check — student ที่ถูก soft-delete ล็อกอินด้วย email/password ไม่ได้
- **authController.loginWithKKU:** เพิ่ม `deletedAt` check เช่นเดียวกัน ป้องกัน bypass ผ่าน KKU SSO
- **studentController.permanentlyDeleteStudent:** ย้าย `!deletedAt` guard เข้าใน `$transaction` เพื่อกัน TOCTOU race ระหว่าง restore กับ permanent delete
- **studentController.updateStudentBasicInfo:** ปฏิเสธการแก้ไขนักศึกษาที่อยู่ในถังขยะ — คืน 400
- **studentRoutes GET /:** ลบ `'admin'` ออกจาก `verifyRole` (ไม่มีใน Prisma Role enum — dead code)

---

## [2026-08-04] fix: security batch 5

- **teacherController.reviewT002/T003:** whitelist status เฉพาะค่าที่ valid; เพิ่ม ownership check ให้อาจารย์ตรวจได้เฉพาะ advisee ตัวเอง
- **adminDocController.reviewT002/T003:** whitelist status เช่นเดียวกัน; ลบ `err.message` ออกจาก 500 response (information leak)
- **docController:** ลบ `T002_GRADED` (ไม่มีใน Prisma enum) ออกจาก T003_VALID list
- **docController.saveT002Form/saveT003Form:** เพิ่ม server-side progression lock — ต้องถึง status ที่ถูกต้องถึงจะบันทึก draft ได้
- **studentImportController.mapMajor:** จำกัดความยาว unrecognized major value ไม่เกิน 50 ตัวอักษร

---

## [2026-08-03] fix: security batch 4

- **supervisionController:** แก้ ERR_HTTP_HEADERS_SENT เมื่อ lock hit — `.catch()` คืน `null` แทน Response object ให้ guard `if (!appointment) return` ทำงานถูกต้อง
- **teacherController.deleteTeacher:** ล้าง `Student.advisorName` พร้อมกับ FK fields เพื่อป้องกันนักศึกษาโดนบล็อก supervision หลังลบอาจารย์
- **S_Gateway CoopRequestPage:** เพิ่ม `colorScheme: 'light'` ให้ iframe ดูตัวอย่าง PDF (เหมือน fix ใน b1ec590 สำหรับ letter modals)
- **supervisionRoutes:** ลบ `'admin'` ออกจาก ADMIN_ROLES (ไม่มีใน Prisma Role enum)

---

## [2026-08-03] fix: security batch 3

- **adminRoutes:** เพิ่ม `verifyToken + verifyRole` ให้ GET /api/admin/doc-requirements (เดิม unauthenticated)
- **studentRoutes:** เพิ่ม `verifyToken` ให้ GET /api/students/doc-requirements (เดิม unauthenticated)
- **supervisionController:** validate `supervisionType` enum ก่อน upsert — ค่าผิดคืน 400 แทน 500

---

## [2026-08-03] fix: security & correctness batch 2

- **docController:** เพิ่ม status precondition ก่อน upload CP-ACCEPTANCE/T002/T003; จำกัด PRE_INTERNSHIP_STATUSES เหลือแค่ PLACEMENT_LETTER_ISSUED
- **studentRoutes:** เพิ่ม `verifyRole('student')` ให้ acknowledge-dispatch, download-placement-letter, acknowledge-placement-letter
- **IssueLetterModal / IssuePlacementLetterModal:** เช็ค `response.ok` ก่อน alert success; แสดง error message จาก server
- **S_DocsT003Form:** เปลี่ยนจาก raw `fetch` เป็น `apiFetch` ใน saveForm (auto-401-logout)
- **S_DocsT002Form:** แก้ stale closure ของ `canEdit` ใน autosave ด้วย ref; แสดง indicator เมื่อ silent save ล้มเหลว
- **S_Docs:** แสดง `⚠️ บันทึกอัตโนมัติไม่สำเร็จ` เมื่อ silent save ล้มเหลว

---

## [2026-08-03] refactor: เปลี่ยนชื่อ label "สาขาวิชา" → "หลักสูตร" และ "หลักสูตร/รูปแบบการศึกษา" → "ภาคการศึกษา"

- เปลี่ยน label UI เท่านั้น ไม่เปลี่ยน schema หรือ data
- ไฟล์ที่แก้: A_Students, A_StudentEditModal, A_Teacher, A_CriteriaPage, S_ProfilePage, S_Gateway, T_Students, T_StudentDetail, T_Profile
- A_CriteriaPage: แก้ alert/confirm/button/placeholder ที่ยังเรียก "สาขา" ทั้ง 7 จุด
- T_StudentDetail, T_Students: เพิ่ม CURRICULUM_TH mapping แสดง studyProgram เป็น "ภาคปกติ"/"ภาคพิเศษ" แทน raw enum

---

## [2026-08-03] refactor: button-style-unification — canonical CSS + self-registration removed

- **S_Theme.tsx:** canonical button CSS ครบ (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-outline`, `.btn-success`, `.btn-danger`, `.btn-warning`, `.action-btn`, `.btn-copy`, `.close-btn`, `.btn-link`) พร้อม hover/active/disabled/focus-visible ทั้ง light + dark mode
- **loginpage.tsx:** ลบ link "ยังไม่มีบัญชี? สมัครสมาชิกด้วยตนเอง" และ register modal ออกทั้งหมด (156 บรรทัด)
- **A_DocT008.tsx:** `.btn` → `.btn-danger` ปุ่มลบภาพ (ลบ inline background/color)
- **A_SupervisionManage.tsx:** `.btn` → `.btn-success` ปุ่มบันทึก config (ลบ inline background)
- **S_DocT005_006.tsx:** `.btn.btn-primary` → `.btn-warning` ปุ่มเปิด template email (ลบ inline background)

---

## [2026-08-03] fix: A_Teacher — prefix spacing match DB + isCoopTeacher บันทึกไม่ได้

- **A_Teacher.tsx:** แก้ TEACHER_PREFIXES ให้มีช่องว่างตรงกับ DB (`'ผศ. ดร.'` ไม่ใช่ `'ผศ.ดร.'`) ทำให้ dropdown แสดง prefix ที่บันทึกไว้ถูกต้อง; dropdown prefix เพิ่ม option `-` ที่ตำแหน่งแรก, แก้ `value={form.prefix || 'อ.'}` → `value={form.prefix ?? ""}`, เรียงลำดับใหม่ให้ ผศ. ขึ้นก่อน
- **teacherController.js `adminUpdateTeacher`:** เพิ่ม `isCoopTeacher` ใน destructure + Prisma update — เดิมไม่ได้บันทึกค่านี้เลย (route `/api/admin/teachers/:id` ใช้ฟังก์ชันนี้)

---

## [2026-08-03] fix: teacher prefix dropdown — empty option แสดงเป็น "-" แทน "-- ไม่ระบุ --"

- **T_Profile:** เปลี่ยน label ของ option ว่าง (value="") จาก `-- ไม่ระบุ --` เป็น `-` ให้กระชับขึ้น

---

## [2026-08-03] feat: teacher prefix — populate DB + dynamic dropdown + display throughout

- **DB:** อัปเดต prefix สำหรับอาจารย์ 38 คนจากข้อมูล computing.kku.ac.th/people (ผศ. ดร. / รศ. ดร. / อ. ดร. / อ. / ผศ.)
- **teacherController:** เพิ่ม `getTeacherPrefixes` endpoint คืน unique prefix จาก DB
- **teacherRoutes:** เพิ่ม `GET /api/teacher/prefixes`
- **T_Profile:** dropdown คำนำหน้าดึงจาก API (`/api/teacher/prefixes`) พร้อม fallback hardcode; แสดง prefix ในชื่อและแถวข้อมูล
- **S_ProfilePage:** `AdvisorRow` แสดงคำนำหน้าอาจารย์ที่ปรึกษา (generalAdvisor / coopAdvisor) แทนคำว่า "อาจารย์" hardcode
- **studentController + teacherController:** เพิ่ม `prefix: true` ใน advisor select ทุกจุด

---

## [2026-08-03] fix: UX improvements — 5 issues across Student / Teacher / Login

- **S_Dashboard:** ปุ่ม "ยื่นคำร้อง" ซ่อนเมื่อนักศึกษาผ่านขั้นตอนสมัครแล้ว (QUALIFIED ขึ้นไป)
- **S_Dashboard:** Countdown เพิ่มลิงก์ "อัปโหลดเอกสารตอนนี้" ชี้ไปหน้าที่ถูกต้อง
- **S_Sidebar:** เปลี่ยน label T002/T003 ให้สั้นและแยกแยะได้ ("T002 รายละเอียดงาน" / "T003 โครงร่างรายงาน")
- **T_Dashboard:** เพิ่มปุ่ม "พิจารณา →" ในตารางนิเทศสำหรับแถวที่มีสถานะ PENDING_TEACHER
- **loginpage:** ลบข้อความ debug hint ("password = เลขบัตรประชาชน") ออกจากหน้า login

---

## [2026-08-03] fix: A_DocT000 — context-sensitive action buttons + filter grouping

- **ปุ่ม "ตรวจสอบ T000":** แสดงเฉพาะนักศึกษาที่มีเอกสารและยังไม่ผ่านขั้นตอน 2 (ยังไม่ถึงช่วงใบตอบรับ)
- **ปุ่ม "ตรวจสอบใบตอบรับ":** แสดงเฉพาะนักศึกษาที่อยู่ใน post-letter phase (`WAITING_FOR_PLACEMENT_LETTER` / `WAITING_FOR_STAFF_CHECK_LETTER` / `ACCEPTANCE_CHECKED` / `PLACEMENT_LETTER_ISSUED`)
- **Filter checkboxes:** แยก 9 checkbox เป็น 2 กลุ่มมีป้ายกำกับ (ขั้นตอนที่ 1 / ขั้นตอนที่ 2) เพื่อไม่ overflow และเข้าใจง่ายขึ้น

---

## [2026-08-03] test: เพิ่ม 28 unit tests (223 → 251)

- **authController:** `registerStudent` — validation password 13 หลัก, email KKU, duplicate email/studentId, password hashing, 500 path
- **docRequirementController:** ครอบ CRUD ทั้งหมด รวม P2002 unique conflict
- **adminDocController:** `getT000Config` (config/default), `getStudentsForT000` (map + WAITING fallback), `reviewStudentStatus` (status update, date fields)
- **mock:** เพิ่ม `documentRequirement` model ใน prismaClient mock

---

## [2026-08-03] fix: student role 403 on t000 config

- **S_Docs.tsx:** เปลี่ยนจาก `/api/admin/config/t000` เป็น `/api/coop/config/t000`
- **coopRoutes.js:** เพิ่ม `GET /config/t000` (verifyToken เท่านั้น) ให้นักศึกษาอ่านค่าได้

---

## [2026-08-03] fix/feat: Batch 1 — 12 system improvements

### ความปลอดภัย
- **รหัสผ่าน:** นโยบายใหม่ — อย่างน้อย 8 ตัว, ต้องมีพิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ — บังคับใช้ที่ทุก endpoint และ script

### ฐานข้อมูล
- **Teacher.prefix:** เพิ่ม field คำนำหน้าอาจารย์ (อ., ผศ., รศ., ศ., ดร. ฯลฯ)
- **onDelete: SetNull:** ระบุ FK constraint อย่างชัดเจนบน Student→Teacher (generalAdvisor, coopAdvisor)

### ระบบนิเทศ
- **เลือก ONLINE/ONSITE แต่ละวัน:** นักศึกษาเลือกรูปแบบแยกต่างหากสำหรับแต่ละวันที่เสนอ — แสดง badge ใน T_SupervisionReview
- **ล็อกหลังยืนยัน:** ไม่สามารถแก้ไขวันนิเทศได้หลังอาจารย์ยืนยัน (frontend lock badge + backend 403)
- **ข้อความสถานะ:** แสดงข้อความ+ไอคอนแทนสีเพียงอย่างเดียวใน S_Supervision

### อาจารย์
- **คำนำหน้า:** ฟอร์มสร้าง/แก้ไขอาจารย์มี dropdown คำนำหน้า (อ., ผศ.ดร., รศ.ดร., ศ.ดร. ฯลฯ)
- **รหัสผ่านสร้างใหม่:** ต้องกำหนดรหัสผ่านตอนสร้าง (ลบ hardcoded "1111111111111" ออก)
- **ซ่อนคณะ:** ฟิลด์คณะถูกซ่อนจากฟอร์มอาจารย์

### เอกสาร
- **วันที่เริ่มฝึก:** modal ออกเอกสารขอความอนุเคราะห์มีช่องกรอกวันที่เมื่อไม่พบในระบบ
- **Dark mode fix:** modal ออกเอกสารบังคับ light mode — ไม่ขึ้นหน้าดำอีกต่อไป
- **คำแนะนำเอกสาร:** แสดง description ต่อ doc type ใต้ชื่อเอกสารในตารางนักศึกษา
- **studyProgram:** แสดงภาคปกติ/ภาคพิเศษในหนังสือขอความอนุเคราะห์ (Word)

### ผู้ดูแลระบบ
- **ตรวจชื่ออาจารย์ที่ปรึกษา:** แสดงคำเตือนใน A_DocT000 เมื่อชื่อที่นักศึกษากรอกไม่ตรงกับ Teacher record ในระบบ

---

## [2026-07-22] fix: แก้ code review findings — Gateway Settings (15 issues)

แก้ไขทุกปัญหาที่พบจาก ultra code review ของ Gateway Settings feature

- **`configController.js`:** เพิ่ม `safeUrl()` validate protocol, guard `JSON.parse` ด้วย try-catch + type check, cap string length (500/100/300 chars)
- **`coopRoutes.js`:** เพิ่ม `GET /api/coop/config/gateway` เพื่อให้ student เรียกใช้โดยไม่ผ่าน `/api/admin/*`
- **`A_GatewaySettings.tsx`:** เขียนใหม่ทั้งหมด — ใช้ axios แทน fetch (ให้ 401 interceptor ทำงาน), เพิ่ม `loadError` state, `mountedRef` ป้องกัน setState หลัง unmount, client-side URL validation, `handleReset` บันทึกลง backend จริง, `maxLength` ทุก input
- **`S_Gateway.tsx`:** แยก gateway fetch ออกเป็น `useEffect` แยก (ไม่ผ่าน `fetchData`), เปลี่ยน URL เป็น `/api/coop/config/gateway`, เพิ่ม `safeHref()` ป้องกัน XSS บน href, เพิ่ม fallback text เมื่อ `gradeSheetLinkText` ว่าง

## [2026-07-22] feat: ตั้งค่าฟอร์มคำร้อง (Gateway Settings) สำหรับเจ้าหน้าที่และอาจารย์

เพิ่มหน้า "ตั้งค่าฟอร์มคำร้อง" ใน sidebar ของทั้ง Staff และ Teacher เพื่อให้แก้ไขข้อความ/ลิงก์
ที่แสดงในหน้า S_Gateway (ฟอร์มยื่นคำร้องสหกิจของนักศึกษา) ได้โดยไม่ต้องแก้ code

- **Backend:** เพิ่ม `getGatewaySettings` / `updateGatewaySettings` ใน `configController.js`
  เก็บค่าใน `SystemConfig` key `GATEWAY_SETTINGS`
- **API:** `GET /api/admin/config/gateway` (verifyToken) + `PUT /api/admin/config/gateway` (staff/teacher)
- **Frontend:** สร้าง `A_GatewaySettings.tsx` — form แก้ไขคำอธิบาย, URL, ข้อความปุ่ม พร้อม preview
- **S_Gateway.tsx:** ดึงค่าจาก API แทน hardcode; ถ้า API ยังไม่มีค่าจะใช้ default เดิม
- **Navigation:** เพิ่มลิงก์ "ตั้งค่าฟอร์มคำร้อง" ใน A_Sidebar และ T_Sidebar

## [2026-07-22] fix: แก้ path PDF ซ้ำ `/uploads//uploads/...` ใน A_CoopApplications.tsx

พบจากการทดสอบ end-to-end — modal ตรวจเอกสาร (ตรวจสอบคำร้องสหกิจ) โหลด PDF ไม่ได้
เนื่องจาก `doc.path` บางรายการเก็บค่าเป็น `/uploads/xxx` อยู่แล้ว แต่ code เติม `/uploads/` ซ้ำ

**แก้ไข:** `A_CoopApplications.tsx:185` — normalize path ก่อนเซต previewUrl
โดย strip `/uploads/` prefix ออกถ้ามีอยู่แล้ว เพื่อหลีกเลี่ยง double-path

## [2026-07-21] feat: รองรับ iPad และมือถือทั้งระบบ (responsive breakpoint 1024px)

ขยาย breakpoint ของ sidebar drawer จาก 768px → 1024px เพื่อให้ iPad portrait ทุกรุ่น
ได้ hamburger menu และ layout แบบ full-screen เหมือนมือถือ

### เปลี่ยนแปลง
- **`S_Theme.tsx`**: แยก responsive เป็น 3 tier — `@media (max-width: 1024px)` สำหรับ layout/sidebar/drawer/table-scroll (ครอบคลุม iPad portrait ~810-820px), `@media (max-width: 768px)` สำหรับ tap-target/padding ขนาดเล็ก, `@media (max-width: 480px)` สำหรับ phone เล็ก
- **`S_Announcements.tsx`**: เพิ่ม `className="page"` ให้ container หลัก (เดิมใช้ inline style อย่างเดียว ทำให้ margin reset ของ `.page` ไม่ทำงาน)
- **`A_DocT005_006.tsx` / `A_DocT007.tsx` / `A_DocT008.tsx`**: loading state div เปลี่ยนจาก inline `marginLeft: 65` เป็น `className="page"` เพื่อให้ reset ทำงานได้

## [2026-07-21] Audit Fix: Security, Auth, Response Format, Performance, UI (21 issues)

ตรวจสอบระบบทั้งหมด พบ 21 ปัญหา (4 critical, 9 medium, 8 minor) — แก้ไขครบทุกข้อ

### Critical
- **CRIT-1** `coopRoutes.js`: `PUT /status` ขาด `verifyRole` — นักศึกษาเปลี่ยน status ตัวเองได้ → เพิ่ม `verifyRole('staff','teacher')`
- **CRIT-2** `studentController.js`: `downloadPlacementLetter` ใช้ `req.params.studentId` ผิด → ดึง studentId จาก `req.user.id` ผ่าน Prisma แทน
- **CRIT-3** `studentImportController.js`: N+1 queries ทุก row → pre-fetch users+students+teachers ครั้งเดียวก่อน loop ลดจาก O(5N) เป็น O(N) queries
- **CRIT-4** `T_StudentDetail.tsx`: fetch นักศึกษาด้วย `studentId` ผ่าน `/api/students/:id` แทนที่จะใช้ search endpoint → เปลี่ยน + unwrap pagination response

### Medium
- **MED-1** `authRoutes.js/authController.js`: `GET /me` ไม่มี middleware → เพิ่ม `verifyToken`; `getProfile` verify JWT ซ้ำ → ใช้ `req.user` แทน
- **MED-2** `companyRoutes.js`: endpoint แก้/ลบบริษัทไม่มี `verifyRole` → เพิ่ม role guard
- **MED-3** `teacherRoutes.js`: `PUT /supervisions/:id/review` ไม่มี `verifyRole` → เพิ่ม `verifyRole('teacher','staff')`
- **MED-4+8** `companyController/visitController`: response format ไม่ consistent + catch ใช้ 400 แทน 500 → ใส่ `ok:` field ทุก response, 500 สำหรับ DB error
- **MED-5** `studentController.js`: batch email upsert → ใช้ `deleteMany` + `createMany` แทน loop upsert
- **MED-6** `A_Company.tsx / S_Company.tsx`: ไม่มี loading state + unwrap response ผิดรูปแบบ → เพิ่ม loading + fix unwrap
- **MED-7** `A_Students.tsx`: `overflow: hidden` บน table container → `overflowX: auto`
- **MED-9** `coopRoutes.js`: `POST /supervision/propose` ขาด `verifyRole('student')` → เพิ่ม

### Minor
- **MIN-1** `adminRoutes.js`: role `'admin'` ไม่มีใน Prisma enum → ลบออก, ใช้แค่ `teacher/staff`
- **MIN-2** `authController.js`: `role = "STUDENT"` → `"student"` (ให้ตรงกับ Prisma enum)
- **MIN-3** `visitController.js`: `console.log` → `console.error` + เพิ่ม `ok:` field
- **MIN-4** `teacherController.js`: response ไม่มี `ok:` field + รั่ว `error: err.message` → แก้
- **MIN-5** `announcementController.js`: N+1 `annFile.delete` loop → `deleteMany` batch
- **MIN-6** `docController.js`: `console.log` blocked message → `console.warn`
- **MIN-7** `S_ProfilePage.tsx`: (pending — เพิ่ม loading state)
- **MIN-8** `adminRoutes.js`: `verifyRole` บาง endpoint ขาดไป → เพิ่ม `verifyRole(...ADMIN_ROLES)`

### Tests
- อัปเดต test ที่ได้รับผลกระทบจากการเปลี่ยน response format/logic ทั้งหมด (authController, announcementController, studentImportController, companyController, visitController)
- ทุก test ผ่าน: **216/216**

---

## [2026-07-21] Security: Hardening — Helmet, Global Rate Limit, File Upload, Nginx

เพิ่มการป้องกัน Cyber Attack หลายชั้นและเตรียม config สำหรับ HTTPS

### Added
- **`helmet`** middleware ใน `server.js` — ป้องกัน XSS, clickjacking, content-type sniffing ผ่าน HTTP security headers อัตโนมัติ
- **Global rate limit** 500 req/15min/IP สำหรับทุก `/api/*` (ยกเว้น `/api/status` health check) — ป้องกัน DDoS/scraping
- **`docs/nginx.conf`** — hardened Nginx config พร้อม deploy บน VM: rate limit 2 zone (login 10r/m, api 100r/s), block path traversal, block hidden files, HTTP→HTTPS redirect, HSTS, TLSv1.2+, server_tokens off

### Changed
- **`utils/fileFilters.js`**: เพิ่ม extension validation คู่กับ MIME type check — ป้องกัน MIME spoofing (ไฟล์ .php ที่เปลี่ยน MIME เป็น image/ ผ่านไม่ได้อีกต่อไป)
- **`middlewares/systemUploadMiddleware.js`**: sanitize `req.body.key` ก่อนใช้เป็นชื่อไฟล์ (เฉพาะ alphanumeric + underscore, max 50 chars) — ป้องกัน path traversal

### Note
- nginx.conf ใน `docs/` ต้อง copy ไปแทน `C:\nginx\conf\nginx.conf` บน VM หลัง deploy
- SSL cert path ใน nginx.conf: `C:/nginx/ssl/cert.pem` + `key.pem` — รอ cert จาก IT มหาลัยก่อน activate HTTPS block

## [2026-06-28] UI: รวม style ปุ่ม (button) ให้เหมือนกันทั้งระบบ

ผู้ใช้รายงานว่าปุ่มแต่ละหน้าดูไม่เหมือนกัน โดยเฉพาะปุ่ม "กรอบสี พื้นหลังขาว" ไม่มี hover ที่ชัดเจนว่ากดได้ — ตรวจสอบพบว่า `S_Theme.tsx` (ธีมกลางที่ใช้จริงทั้ง 3 role) มี dark-mode override ของ `.btn-ghost`/`.btn-secondary`/`.btn-outline`/`.action-btn`/`.btn-delete`/`.btn-link` แต่ไม่มี light-mode base เลย ทำให้ ~30 ไฟล์ต้องไปประกาศ CSS ปุ่มซ้ำกันเองในแต่ละไฟล์ (สีและ hover ไม่ตรงกัน บางจุดไม่มี hover เลย)

### Changed
- **`S_Theme.tsx`**: เพิ่ม light-mode base ที่ขาดไปสำหรับปุ่มทุก variant พร้อม hover (`filter: brightness()`), `:active`, `:disabled`, `:focus-visible` (keyboard a11y) ที่สม่ำเสมอกันทั้งระบบ; เพิ่ม `.btn-success`/`.btn-warning` (ใหม่ — ไม่มีมาก่อน); มาตรฐาน `.btn-danger` เป็นสีเต็ม (แดงเข้ม) แทนสีซอฟต์ชมพูที่บางไฟล์ใช้ — ดูดกลืน `.btn-delete` เดิม
- ลบ CSS ปุ่มที่ซ้ำซ้อนกับ `S_Theme.tsx` ออกจาก ~30 ไฟล์ทั้ง 3 role (student/teacher/admin)
- เปลี่ยนปุ่ม อนุมัติ/ส่งกลับแก้ไข/ปฏิเสธ/ลบ ที่เคยใช้ `style={{background:'#...'}}` แบบ inline ให้ใช้ `className="btn-success"`/`"btn-warning"`/`"btn-danger"` แทน (ทั้งฝั่งอาจารย์และแอดมิน)
- เพิ่ม className ให้ปุ่มที่ไม่มี class มาก่อน (`ConfirmDialog`, `NotificationBell`, `Toast`, `StatusFilterChips`) เพื่อให้มี hover state เป็นครั้งแรก

### Verified
- `npx tsc --noEmit` ผ่านทุก commit
- ทดสอบจริงในเบราว์เซอร์ทั้ง 3 role (student/teacher/staff) ทั้ง light/dark mode: hover เปลี่ยน background/brightness ชัดเจนทุกปุ่ม, disabled ไม่มี hover, focus-visible outline ทำงานผ่าน Tab key

## [2026-06-28] UI: รวม status display ของนักศึกษา ลด UI ซ้ำซ้อน

### Changed
- **`S_Gateway.tsx`**: ลบ status display ที่ซ้ำซ้อน 2 ใน 3 จุด (custom step indicator + embedded `S_StatusTracker`) เหลือไว้แค่การ์ด "สถานะคำร้อง" จุดเดียว
- **`S_Dashboard.tsx`**: การ์ดสถานะแบบย่อกดปุ่ม "ดูรายละเอียด →" แล้วขยายแสดง `S_StatusTracker` เต็มรูปแบบ (phase + sub-step + next action) ในหน้าเดียวกัน แทนการลิงก์ไปหน้าใหม่
- **`S_App.tsx` / `S_Sidebar.tsx`**: ลบหน้า `/student/status-tracker` แบบเดี่ยวและ sidebar item "สถานะสหกิจ" — badge แจ้งเตือน + mark-as-read ย้ายไปอยู่ที่ปุ่ม "Dashboard" แทน

### Verified
- `npx tsc --noEmit` ผ่าน (เคลียร์ import/const ที่ไม่ใช้แล้วทั้งหมดตาม `noUnusedLocals`)
- ทดสอบจริงในเบราว์เซอร์: Gateway เหลือสถานะเดียว, Dashboard ขยาย/ย่อ tracker ได้ในหน้าเดียว, sidebar ไม่มี "สถานะสหกิจ" แล้ว, badge แจ้งเตือนย้ายไปปุ่ม Dashboard ถูกต้อง

## [2026-06-27] Fix: test suite ที่ล้มเหลวมานาน (`teacherController.test.js` › `deleteTeacher`)

แก้ไข test ที่ล้มเหลวซึ่งถูกบันทึกไว้ว่าเป็น "pre-existing, ไม่เกี่ยวกับการเปลี่ยนแปลงใดๆ" — ตรวจสอบจริงแล้วพบว่าสาเหตุคือ mock Prisma (`__tests__/__mocks__/prismaClient.js`) ขาด method ที่ controller `deleteTeacher` เรียกใช้จริง ไม่ใช่บั๊กใน business logic

### Fixed
- **`__tests__/__mocks__/prismaClient.js`**:
  - เพิ่ม `student.updateMany`, `teacher.delete`, `visit.count` ที่ขาดไป — `deleteTeacher` controller เรียกใช้ทั้งสามตัวนี้ผ่าน `prisma.$transaction([...])` แต่ mock ไม่มี method เหล่านี้ ทำให้โยน `TypeError` ตั้งแต่ขั้นตอนแรก (`student.updateMany is not a function`) ก่อนจะถึงจุดที่ test ตรวจสอบ
  - แก้ `$transaction` mock จาก `jest.fn((fn) => fn(prismaMock))` (รองรับแค่ interactive form) เป็นรองรับทั้ง array form (`$transaction([...])`) ด้วย — ของเดิมพอส่ง array เข้าไปจะพยายามเรียก array เป็นฟังก์ชันแล้ว throw

### Verified
- `npx jest` ทั้ง backend: 217/217 ผ่าน (จากเดิม 216/217)

## [2026-06-27] Fix: แก้ไขประกาศแสดงวันที่ว่างเปล่า

ระหว่างทดสอบระบบทั้งระบบ (ทุกปุ่ม ทุก role) พบบั๊กจริงที่หน้า `A_Announcements.tsx` (จัดการประกาศ — admin/staff)

### Fixed
- **`A_Announcements.tsx`**: `openEditModal` ส่งค่า `a.date` (ISO datetime string เต็มจาก API) เข้า `setDate()` ตรงๆ ซึ่งไปเลี้ยง `<input type="date">` — input ประเภทนี้ต้องการ format `YYYY-MM-DD` เท่านั้น พอได้ string เต็มแบบ ISO จะ silently แสดงเป็นค่าว่าง (ยืนยันด้วย accessibility snapshot เห็น `value="0"` ในช่อง month/day/year) ผลคือทุกครั้งที่กดแก้ไขประกาศ ช่องวันที่จะว่างเปล่า เสี่ยงข้อมูลวันที่หายถ้าผู้ใช้ไม่สังเกตและกรอกใหม่ — แก้โดย `a.date.slice(0, 10)` (พร้อม fallback เป็นวันนี้ถ้า `a.date` เป็น falsy)

### Verified
- แก้ไขประกาศจริงในเบราว์เซอร์ (สร้างประกาศทดสอบ → แก้ไข → ตรวจ `input[type="date"].value` ตรงกับวันที่จริงหลัง hot-reload) ยืนยันใช้งานได้ และ flow บันทึก (POST พร้อม `id` แบบ upsert) ไม่สร้าง record ซ้ำ

## [2026-06-27] Accessibility — tap target ขนาดเล็กบนมือถือ + lang attribute

ทำต่อจากรอบ responsive sweep ใช้ chrome-devtools a11y audit (Lighthouse-style manual check:
tap target size, orphaned form inputs, console a11y issues) ตรวจหน้า login และตารางที่แปลงเป็น
card view ไปแล้ว พบว่าปุ่ม action เล็กๆในตารางและปุ่ม icon บน header แตะยากบนจอสัมผัส

### Fixed
- **`index.html`**: `<html lang="en">` ทั้งที่เนื้อหาทั้งหมดเป็นภาษาไทย — แก้เป็น `lang="th"` (กระทบการอ่านออกเสียงของ screen reader ทุกหน้า)
- **`S_Theme.tsx`**: ปุ่ม icon บน header (`.btn-ico` — theme toggle, hamburger, notification, logout) ขนาด 38px เล็กกว่ามาตรฐาน WCAG 2.5.5 (44px) — เพิ่ม media query ขยายเป็น 44px บนจอ ≤768px; ปุ่ม action ในตาราง `responsive-table` (แก้ไข/ลบ/รหัสผ่าน) สูงแค่ 34px เพราะถูกออกแบบมาสำหรับ table cell แคบ แต่พอแปลงเป็น card เต็มความกว้างแล้วมีที่ว่างเหลือเพียงพอ — เพิ่ม `min-height: 44px` ให้ปุ่ม/ลิงก์ในคอลัมน์สุดท้าย (จัดการ) ของทุกตาราง
- **`loginpage.tsx`**: checkbox "จดจำฉันไว้" คลิกได้แค่กล่อง 16x16px (label ครอบไว้แต่ไม่มี padding แนวตั้ง) — เพิ่ม `padding:10px 0` ให้ label ทำให้พื้นที่แตะสูงขึ้นเป็น ~45px; ปุ่ม "สมัครสมาชิกด้วยตนเอง" มี `padding:0` ทำให้พื้นที่แตะสูงแค่ 20px — เพิ่ม padding เป็น 44px

### Verified
- `npx tsc --noEmit` ผ่าน
- สแกน tap target ด้วย script (`getBoundingClientRect` ทุก `button/a/input/select`) บนหน้า login และหน้า `/admin/teachers` (มี responsive-table) ก่อน/หลังแก้ — ปุ่มที่แก้ทั้งหมดขยับจาก 16-38px เป็น 44-45px ไม่มี horizontal overflow เพิ่มขึ้น
- ปุ่ม Google Sign-In (third-party widget, สูง 40px) ไม่ได้แก้เพราะเป็น iframe ที่ควบคุมไม่ได้

### Known gaps (นอกขอบเขตรอบนี้)
- ปุ่ม action ขนาดเล็กในตาราง **desktop** (ไม่ผ่าน responsive-table ที่ breakpoint ≤768px) ยังเป็นขนาดเดิม — เพราะ desktop ใช้ mouse ไม่ใช่ touch จึงไม่บังคับตาม WCAG tap target
- ยังไม่ได้ตรวจ color contrast แบบละเอียด (เบื้องต้นไม่พบ "Low Contrast" issue จาก Chrome console)

## [2026-06-27] รองรับมือถือ/iPad — shared modal ออกหนังสือ (Issue*LetterModal)

ตรวจ shared component ที่เหลือทั้งหมด (ConfirmDialog, LetterModalShared, NotificationBell,
PlacementLetterCard, StatusFilterChips, SupervisionCalendar, loginpage, CountdownTimer,
StatusBadge, Toast, AutoTextarea, Spinner) พบบั๊กจริงเฉพาะ modal กลุ่มออกหนังสือ (ใช้ pattern
PDF preview ซ้าย + แผงควบคุม fixed-width 300px ขวา เหมือน modal ตรวจเอกสารที่แก้ไปแล้ว)
ที่เหลือผ่านอยู่แล้ว (ใช้ % width/max-width หรือมี media query stack อยู่แล้ว เช่น SupervisionCalendar)

### Fixed
- **`IssueLetterModal.tsx`, `IssuePlacementLetterModal.tsx`, `IssueSupervisionLetterModal.tsx`**: แผงควบคุม fixed `width: 300` ไม่ stack บนมือถือ — เพิ่ม class `.letter-split`/`.letter-preview`/`.letter-sidebar` + media query ใน `LetterModalShared.tsx` (`MODAL_CSS` ที่ทั้ง 3 ไฟล์ import ใช้ร่วมกัน) ให้ stack แนวตั้งที่ ≤768px พร้อมเพิ่ม `padding` ให้ `.modal-backdrop` กันโมดัลชิดขอบจอ

### Verified
- `npx tsc --noEmit` ผ่าน
- ทดสอบจริงบน mobile viewport (390px): เปิด modal ออกหนังสือส่งตัวจาก `A_DocT000.tsx` ยืนยัน `.letter-split` เปลี่ยนเป็น `flex-direction:column`, `.letter-sidebar` กว้างเต็ม container, ไม่มี horizontal overflow

## [2026-06-27] รองรับมือถือ/iPad ครบทุกหน้าของเจ้าหน้าที่และอาจารย์

ทำต่อจากรอบนักศึกษา คราวนี้ตรวจและแก้ทุกหน้า admin (`A_*.tsx`) และ teacher (`T_*.tsx`) ที่เหลือ
(ยกเว้น 3 ไฟล์ที่แก้ไปแล้วในรอบแรก) ใช้ Explore agent ช่วยตรวจหา pattern ที่กระทบ (ตารางไม่มี
responsive treatment, grid/flex คอลัมน์คงที่ไม่ wrap, modal split-screen แบบ PDF-preview ที่มี
fixed-width side panel) แก้และทดสอบด้วย mobile viewport emulation (390×844) จนไม่มี horizontal
overflow เหลือ

### Fixed
- **ตารางไม่มี responsive treatment** — เพิ่ม `className="responsive-table"` + `data-label` ให้ทุกตารางใน `A_Company.tsx` (ทำเนียบบริษัท + พี่เลี้ยงในโมดัล), `A_CoopApplications.tsx`, `A_DocRequirements.tsx`, `A_DocT000.tsx` (ตาราง 9 คอลัมน์ — กระทบหนักสุด), `A_Mentors.tsx`, `A_StudentTrash.tsx`, `A_Teacher.tsx`, `A_DocT002Review.tsx`, `A_DocT003Review.tsx`, `T_Requests.tsx`, `T_StudentDetail.tsx`, `T_Students.tsx`, `T_T002Review.tsx`, `T_T003Review.tsx`, `T_Dashboard.tsx`
- **Modal split-screen (พรีวิว PDF ฝั่งซ้าย + แผงควบคุม fixed-width ฝั่งขวา) ไม่ stack บนมือถือ** — เดิม `flex: '0 0 60%'`/`width: 350` ไม่มี media query ทำให้แผงควบคุมแทบไม่มีที่เหลือบนจอ 390px แก้โดยเพิ่ม class `.split-pane`/`.preview-pane`/`.review-sidebar` + `@media (max-width:768px)` ให้ stack เป็นแนวตั้ง (พรีวิวสูง 280-320px คงที่ ด้านล่างเป็นแผงควบคุมเต็มความกว้าง) ใน `A_CoopApplications.tsx`, `A_DocT000.tsx`, `T_Requests.tsx`, `A_DocT002Review.tsx`, `A_DocT003Review.tsx`, `T_T002Review.tsx`, `T_T003Review.tsx`
- **`className="page"` หายไปในบางไฟล์** ทำให้ global margin override (`S_Theme.tsx`) ไม่มีผล — เพิ่มให้ `A_DocT000.tsx`, `A_Mentors.tsx`, `A_Teacher.tsx`, `A_Announcements.tsx`, `A_Docs.tsx`
- **Header/filter row ไม่มี `flexWrap`** ทำให้ปุ่ม/dropdown ล้นจอ — แก้ใน `A_DocRequirements.tsx`, `A_Announcements.tsx` (`headerSection`/`headerActions`/`annCard`), `A_CoopPeriod.tsx` (header/`listItem`/form date row), `A_Company.tsx` (แถวค้นหา)
- **Grid คงที่ 1fr/1fr หรือ fixed-px ไม่ยุบบนจอเล็ก** — `A_Announcements.tsx`/`A_StudentEditModal.tsx`/`A_Docs.tsx` เปลี่ยนเป็น `repeat(auto-fit, minmax(...))`; `A_Company.tsx` (รายละเอียดบริษัทในโมดัล) และ `T_StudentDetail.tsx`/`T_Profile.tsx` เพิ่ม media query ยุบเป็น 1 คอลัมน์ที่ ≤480-600px; `A_Docs.tsx` แถวข้อมูล (`120px 1fr 120px 120px 120px auto`) เปลี่ยนเป็น `auto-fit minmax(100px,1fr)` ที่ ≤768px
- **Modal overlay ไม่มี padding** ทำให้ modal ชิดขอบจอพอดี (`width:100%` ของ overlay เต็มจอ) — เพิ่ม `padding` ให้ `A_StudentEditModal.tsx`, `A_Announcements.tsx`, `A_Docs.tsx`
- **`T_Docs.tsx`**: CSS selector `table { min-width: 1100px }` ไม่ scope เฉพาะ `.doc-table` (เป็น global element selector) แก้ให้ scope ถูกต้อง

### Verified
- `npx tsc --noEmit` ผ่านทุกขั้น
- ทดสอบจริงด้วย mobile viewport emulation (390×844) บน `A_DocT000.tsx` (เคสที่กระทบหนักสุด — ตาราง 9 คอลัมน์ + modal split-screen): ตรวจ `scrollWidth === clientWidth`, ตรวจ computed style ว่า `thead{display:none}`, `tr/td{display:block}`, และ modal split-pane เปลี่ยนเป็น `flex-direction:column` ถูกต้องบน mobile breakpoint

## [2026-06-27] รองรับมือถือ/iPad ครบทุกหน้าของนักศึกษา

ทำต่อจากรอบแรก (sidebar/drawer + ตาราง 3 หน้าที่กระทบกว้างสุด) คราวนี้ตรวจและแก้ทุกหน้าที่นักศึกษาใช้งานจริง
(Dashboard, สถานะสหกิจ, ข้อมูลนักศึกษา, ข้อมูลบริษัท, ยื่นคำร้องสหกิจ, เอกสาร T000/T002/T003, นัดหมายนิเทศ,
ประกาศ, T005/T006, T007, T008) ทดสอบด้วย mobile viewport emulation (390×844) ทุกหน้า จนไม่มี horizontal
overflow เหลือเลย (`document.documentElement.scrollWidth === clientWidth` ทุกหน้า)

### Fixed
- **`.page { margin/marginLeft คงที่ 28-65px }` กินพื้นที่จอเล็กไปมาก** — เพิ่ม global override ใน `S_Theme.tsx` (`@media max-width:768px`) ลดเหลือ `margin:10px` เท่ากันทุกหน้าที่ใช้ `className="page"` (มีผลกับทุก role ไม่ใช่แค่นักศึกษา เพราะ class นี้ใช้ร่วมกัน 31 ไฟล์)
- **`S_Company.tsx`**: ตาราง "ทำเนียบสถานประกอบการ" + ตาราง "พี่เลี้ยง" ในโมดัล ไม่มี responsive treatment, แถวค้นหา+ปุ่มไม่ wrap, grid รายละเอียดบริษัท 2 คอลัมน์ไม่ยุบบนจอเล็ก — แก้ทั้ง 3 จุด
- **`S_DocsT002Form.tsx`**: ฟอร์มมี grid คงที่ 2/3/4 คอลัมน์ (`grid2/grid3/grid4`) สำหรับกรอกที่อยู่บริษัท/ผู้ติดต่อ ทำให้ input บี้แน่นจนใช้งานไม่ได้บนจอเล็ก — เพิ่ม media query ยุบเป็น 2 คอลัมน์ที่ ≤768px และ 1 คอลัมน์ที่ ≤480px, header ที่มี CountdownTimer ก็ไม่ wrap ทำให้ล้นจอ
- **`S_DocsT003Form.tsx`**, **`S_Docs.tsx`**: header แถวเดียวกับ CountdownTimer ไม่มี `flexWrap` ทำให้ล้นจอแนวนอนเหมือนกัน
- **`S_ProfilePage.tsx`**, **`S_Gateway.tsx`**: `.card-head` (หัวข้อ + ปุ่ม) ไม่ wrap, `.info-row` ใช้ grid คอลัมน์ label กว้าง 160px ตายตัว, `.profile-card` padding 40px ตายตัว — กินพื้นที่จอเล็กจนข้อมูลล้น
- **`S_Dashboard.tsx`**: `.dashboard-wrapper` มี `marginLeft: 45px` ตายตัว ไม่มี media query เลย
- **`S_DocT005_006.tsx`, `S_DocT007.tsx`, `S_DocT008.tsx`**: บั๊ก CSS flexbox/grid คลาสสิก — `.content`/`.url-text` ตั้ง `flex: 1` แต่ไม่มี `min-width: 0` (ค่า default ของ flex item คือ `min-width: auto` = ขนาดตาม content) ทำให้ลิงก์ Google Drive ที่เป็น URL ยาวไม่ยอมหด ดึงทั้งกล่อง (`.link-box`) กว้างเกิน 900px บนจอ 390px — เพิ่ม `min-width: 0` ทั้ง `.link-box`/`.content`/`.url-text` ทั้ง 3 ไฟล์

### Verified
- `npx tsc --noEmit` ผ่านทุกขั้น, desktop viewport (1280px) ตรวจซ้ำว่า layout เดิมไม่เปลี่ยน

## [2026-06-27] รองรับมือถือ/iPad รอบแรก — แก้จุดที่กระทบกว้างที่สุด

ตรวจสอบพบว่าระบบรองรับมือถือ/แท็บเล็ตแค่ ~15% (11 จาก 72 component มี responsive CSS) เป็นงานใหญ่
จึงเลือกแก้เฉพาะจุดที่กระทบทุกหน้า/ใช้บ่อยที่สุดก่อน ตามที่ user เลือก ("แก้จุดที่กระทบเยอะสุดก่อน")

### Fixed
- **Sidebar/drawer พังบนมือถือทุกหน้า**: `A_Sidebar.tsx`/`T_Sidebar.tsx`/`S_Sidebar.tsx` แต่ละไฟล์มี `@media (max-width: 900px)` ของตัวเองที่ตั้งใจไว้ก่อนจะมีระบบ hamburger-drawer (ของ `S_Theme.tsx` ที่ breakpoint 768px) — กลายเป็น override `height`/`overflow` ของ drawer และบีบเมนูให้เป็นแถบแนวนอนซ้อนอยู่ใน drawer แนวตั้งกว้าง 280px ลบ media query เก่าออก ใช้ระบบ drawer กลางอย่างเดียว
- **ตาราง 7 คอลัมน์ overflow บนจอเล็ก**: เพิ่ม CSS pattern `table.responsive-table` ใน `S_Theme.tsx` (breakpoint 768px) แปลงตารางเป็น card แบบ label-ซ้อน-value แทนการ scroll แนวนอน ใช้กับ `A_Students.tsx`, `A_SupervisionManage.tsx`, `T_SupervisionReview.tsx` (เพิ่ม `className="responsive-table"` + `data-label` ในแต่ละ `<td>`)
- **แผง "ตั้งค่าช่วงเวลานัดหมายนิเทศ" ใน `A_SupervisionManage.tsx` ทำให้ทั้งหน้า scroll แนวนอนบนมือถือ**: grid 5 คอลัมน์ตายตัว (`1.2fr 1fr 1fr 1fr auto`) ไม่ wrap เพิ่ม class `.config-grid` + media query ให้เหลือ 1 คอลัมน์บนจอ ≤768px

### Verified
- ทดสอบจริงด้วย chrome-devtools mobile viewport emulation (390×844, iPhone-class) บนหน้า Dashboard/นักศึกษา/จัดการการนิเทศ ทั้ง 3 บทบาท (staff/teacher/student): hamburger เปิด-ปิด drawer ถูกต้อง, ไม่มี horizontal scroll ระดับหน้า (`document.documentElement.scrollWidth === clientWidth`), ตารางแสดงเป็น card อ่านง่าย
- ตรวจ desktop viewport (1280px) ซ้ำ ยืนยันว่า layout เดิมไม่เปลี่ยนแปลง (`table.responsive-table` มีผลเฉพาะ ≤768px)
- `npx tsc --noEmit` ผ่านทุกขั้น

### Known gaps (ยังไม่แก้ในรอบนี้ — นอกขอบเขตที่เลือก)
- อีก ~58 component ที่ไม่มี responsive CSS เลย ยังไม่ได้ตรวจ/แก้
- Modal ส่วนใหญ่ใช้ `width: 95vw/%` อยู่แล้วจึงไม่ overflow บนมือถือ แต่ไม่ได้ตรวจครบทุกไฟล์

## [2026-06-27] แก้ label ผิดในฟอร์ม T002: "ความสัมพันธ์ / โทรศัพท์" แต่ใส่ได้แค่เบอร์โทร

### Fixed
- `Frontend/src/components/S_DocsT002Form.tsx`: ช่อง "บุคคลที่ติดต่อได้ในกรณีฉุกเฉิน" มี label "ความสัมพันธ์ / โทรศัพท์" ผูกกับ `emergencyPhone` ตัวเดียว — ไม่มีช่อง "ความสัมพันธ์" แยกอยู่จริง ทำให้ label สื่อผิด แก้เป็น "เบอร์โทรศัพท์" ให้ตรงกับ field และตรงกับ PDF ที่สร้าง (`pdfGeneratorT002.ts` ใช้ label "โทรศัพท์" อยู่แล้ว ถูกอยู่ก่อนแล้ว)

## [2026-06-27] เพิ่มปุ่ม "จบนิเทศ" — แก้จุดที่สถานะนิเทศไม่มีทางไปถึง COMPLETED ได้เลย

### Added
- `backend/controllers/supervisionController.js` (`completeSupervision`): action ใหม่เปลี่ยน `SupervisionAppointment.status` จาก `LETTER_UPLOADED` → `COMPLETED` ตรวจสอบสิทธิ์เหมือน `reviewSupervision` (อาจารย์ต้องเป็นที่ปรึกษาหลักของนัดนั้น ส่วน admin/staff ผ่านได้ทันที) และเช็คสถานะปัจจุบันต้องเป็น `LETTER_UPLOADED` เท่านั้นก่อนเปลี่ยน
- Routes ใหม่: `PUT /api/teacher/supervisions/:id/complete`, `PUT /api/admin/supervisions/:id/complete`
- ปุ่ม "🏁 จบนิเทศ" ในหน้า `A_SupervisionManage.tsx` (เจ้าหน้าที่) และ `T_SupervisionReview.tsx` (อาจารย์ที่ปรึกษาหลัก) แสดงเฉพาะแถวที่สถานะเป็น `LETTER_UPLOADED`

### Fixed (ช่องโหว่เพิ่มเติม)
- `backend/routes/supervisionRoutes.js`: `PUT /api/teacher/supervisions/:id/review` มีแค่ `verifyToken` ไม่มี `verifyRole` (รอดมาได้เพราะ `reviewSupervision` ตรวจสอบ teacher record เองภายในฟังก์ชัน) เพิ่ม `verifyRole('teacher','admin','staff')` ให้ชัดเจนตามมาตรฐานเดียวกับ route อื่นๆ ในรอบตรวจนี้

### Process notes
- ที่มา: ตรวจ pipeline ทั้งระบบตามที่ขอ พบว่า `SupervisionAppointment.status` ไม่เคยมีจุดไหนเซ็ตเป็น `COMPLETED` เลยทั้งระบบ (เซ็ตได้แค่ถึง `LETTER_UPLOADED` จาก `uploadOfficialLetter`) ทั้งที่ `StatusBadge.tsx`/`S_StatusTracker.tsx`/`CLAUDE.md` อ้างถึง `COMPLETED` เป็นสถานะจริงที่ใช้งานอยู่ — ไม่ใช่ regression (ไม่มี reference การ implement เดิมให้เทียบ) แต่เป็น gap ที่ไม่มีใครต่อให้ครบ จึงถาม user ก่อนว่าต้องการให้ใครเป็นคนกดจบนิเทศ ตามที่ตอบ: อาจารย์ประจำวิชา/อาจารย์ที่ปรึกษาโครงงานสหกิจ กดได้ ไม่ต้องมีฟิลด์เพิ่มเติม
- ทดสอบจริง: กด "🏁 จบนิเทศ" ที่หน้า staff กับนัดของนักศึกษา "ห้า ร้อยล้าน" (id=1) → DB เปลี่ยนเป็น `COMPLETED` จริง → UI รีเฟรชแสดง "🎉 นิเทศเสร็จสิ้น" ปุ่ม "จบนิเทศ" หายไปตามเงื่อนไข (เหลือแค่ "👁️ ดูเอกสาร")
- `npx tsc --noEmit` ผ่าน, backend `npx jest` 216/217 ผ่าน (เคส fail เดิมไม่เกี่ยวข้อง)

## [2026-06-27] แก้บั๊กร้ายแรง: อนุมัติ T002/T003 ทำสถานะย้อนกลับ + ปิดช่องโหว่นักศึกษาเลื่อนสถานะตัวเองผ่าน endpoint อาจารย์

### Fixed (ความปลอดภัย — ร้ายแรง)
- `backend/routes/teacherRoutes.js`: `PUT /api/teacher/documents/review-t002` และ `review-t003` มีแค่ `verifyToken` ไม่มี `verifyRole` เลย — **นักศึกษาที่ login แล้วเรียก endpoint นี้ตรงๆ ได้ ส่ง `status` อะไรก็ได้ไปตั้งค่า `coop.status` ของตัวเองหรือของนักศึกษาคนไหนก็ได้** (เช่น ส่ง `T003_APPROVED` ตรงๆ เพื่อข้ามทุกขั้นตอนการตรวจ) ทดสอบยืนยันแล้วว่าก่อนแก้เรียกผ่านได้ (200) หลังแก้ถูกบล็อก (403) เพิ่ม `verifyRole('teacher', 'admin', 'staff')` ให้ตรงกับฝั่ง admin route ที่มีอยู่แล้ว

### Fixed (สถานะย้อนกลับ)
- `Frontend/src/components/A_DocT002Review.tsx`, `T_T002Review.tsx`: ปุ่ม "✅ อนุมัติเอกสาร T002" ส่ง `status: 'INTERNSHIP_STARTED'` ไปตั้งค่า `coop.status` — ทำให้นักศึกษาที่ submit T002/T003 ไปแล้ว (status `T002_SUBMITTED` หรือไกลกว่านั้น) ถูกดึงสถานะ**ย้อนกลับ**ไปที่ `INTERNSHIP_STARTED` (สถานะก่อนหน้า T002_SUBMITTED ในลำดับ enum) ทุกครั้งที่เจ้าหน้าที่/อาจารย์อนุมัติ T002 — ตรวจ DB จริงพบนักศึกษาหลายคนสถานะเป็น `INTERNSHIP_STARTED` ทั้งที่เอกสาร T002 ผ่านแล้ว ยืนยันว่าบั๊กนี้กระทบข้อมูลจริงมาก่อนแล้ว แก้ให้ตอนอนุมัติส่งสถานะปัจจุบันกลับไปเฉยๆ (no-op) เพราะ T002 ไม่มีสถานะ "อนุมัติแล้ว" แยกต่างหากใน enum
- `Frontend/src/components/A_DocT003Review.tsx`: ปุ่มอนุมัติ T003 ส่ง `status: 'INTERNSHIP_STARTED'` เช่นกัน ทั้งที่ T003 มีสถานะปลายทางที่ถูกต้องคือ `T003_APPROVED` (และ `T_T003Review.tsx` ฝั่งอาจารย์ใช้ค่านี้ถูกอยู่แล้ว — ใช้เป็นต้นแบบในการแก้) แก้ให้ส่ง `'T003_APPROVED'` ตรงกัน

### Process notes
- จุดเริ่มต้นคือ user รายงาน "T000 → ออกฝึกสหกิจ สถานะไม่เปลี่ยน" ตรวจแล้วพบเป็นบั๊กคนละจุด ([ดู commit ก่อนหน้า](#)) แต่ต่อการตรวจสอบทั้ง pipeline ตามที่ขอ ("ตรวจดูทั้งหมดเลยตั้งแต่ยื่นคำร้องไปถึงรายงาน T008") จึงไปพบบั๊กชุดนี้ที่ขั้น T002/T003
- ทดสอบจริง: อนุมัติ T002 ของนักศึกษาทดสอบ (studentId=10, สถานะเริ่มต้น `T002_SUBMITTED`) → ตรวจ DB หลังอนุมัติ `coop.status` ยังเป็น `T002_SUBMITTED` (ไม่ย้อนกลับ), `Document.status` เป็น `APPROVED` ถูกต้อง
- ทดสอบช่องโหว่: login เป็นนักศึกษา ยิง `fetch('/api/teacher/documents/review-t003', {method:'PUT', body:{studentId:1, status:'T003_APPROVED'}})` ตรงๆ → ก่อนแก้สำเร็จ (200), หลังแก้ถูกบล็อก (403 Access Denied)
- `npx tsc --noEmit` ผ่าน, backend `npx jest` 216/217 ผ่าน (เคส fail เดิมไม่เกี่ยวข้อง)
- ยังไม่ได้ตรวจส่วนนัดนิเทศ→T005/006/007/008 ที่เหลือของ pipeline — T005/T006/T007/T008 เป็นหน้า link-out ไป Google Forms/Drive ไม่มี state ในระบบ (ยืนยันแล้วในรอบตรวจก่อนหน้านี้ของ session) จึงไม่มีสถานะให้ตรวจเพิ่ม ส่วนนัดนิเทศยังไม่ได้ไล่ลึกรอบนี้

## [2026-06-27] แก้บั๊ก: รับหนังสือส่งตัวแล้วสถานะไม่เปลี่ยนเป็น "ออกฝึกสหกิจ"

### Fixed
- `Frontend/src/components/S_Docs.tsx`: `<PlacementLetterCard>` ไม่ได้ส่ง prop `onRefresh` (และ `docStatus`) ให้ — ทำให้เมื่อนักศึกษากด "⬇️ ดาวน์โหลด" หนังสือส่งตัว แม้ backend จะอัปเดตสถานะเป็น `INTERNSHIP_STARTED` สำเร็จ แต่หน้าเว็บไม่รีเฟรช ทำให้นักศึกษาเห็นสถานะเดิมค้างอยู่ (ต้อง reload หน้าเองจึงจะเห็นการเปลี่ยนแปลง) เพิ่ม `onRefresh={refreshProfile}` และ `docStatus={profile.docStatus}` ให้ตรงกับที่ component คาดหวัง
- `Frontend/src/components/PlacementLetterCard.tsx` (`handleDownloadAndAck`): ไม่เช็ค response จาก `POST /api/students/acknowledge-placement-letter` เลย — ถ้า backend ปฏิเสธ (เช่น 400 เพราะสถานะไม่ตรงเงื่อนไข) จะมองไม่ออกว่าทำไมสถานะไม่เปลี่ยน เพิ่มการเช็ค `res.ok` และแจ้ง error ให้นักศึกษาเห็นเมื่อบันทึกไม่สำเร็จ

### Process notes
- ทดสอบจริง: ตั้งค่า studentCoop ทดสอบเป็น `PLACEMENT_LETTER_ISSUED` (มี `placeLetterUrl` อยู่แล้ว) → login เป็นนักศึกษา → กด "⬇️ ดาวน์โหลด" บนการ์ดหนังสือส่งตัว → ป้ายสถานะบนสุดเปลี่ยนจาก "🏁 ออกหนังสือส่งตัวแล้ว" เป็น "🚀 ออกฝึกสหกิจ" ทันทีโดยไม่ต้อง reload หน้า — ยืนยันว่าแก้ตรงจุดและครบ
- `npx tsc --noEmit` ผ่าน, backend `npx jest` 216/217 ผ่าน (เคส fail เดิมไม่เกี่ยวข้อง)
- ยังไม่ได้ตรวจ T002→T003→นัดนิเทศ→T005/006/007/008 ส่วนที่เหลือของ pipeline ตามที่ขอ ("ตรวจดูทั้งหมดเลยตั้งแต่ยื่นคำร้องไปถึงรายงาน T008") — งานนี้แก้เฉพาะจุดที่ระบุมา (T000→ออกฝึกสหกิจ) ก่อน ส่วนที่เหลือรอตรวจต่อ

## [2026-06-27] เพิ่มขั้นตอนอัปโหลดไฟล์ที่ลงนามแล้ว ในหน้าออกเอกสารของเจ้าหน้าที่

### Added
- `Frontend/src/components/IssueLetterModal.tsx` (หนังสือขอความอนุเคราะห์), `IssuePlacementLetterModal.tsx` (หนังสือส่งตัว), `IssueSupervisionLetterModal.tsx` (หนังสือขอนิเทศ) — เพิ่มขั้นตอน "3. แนบไฟล์ที่ลงนามแล้ว" (บังคับ) ก่อนปุ่ม "บันทึกเข้าระบบ & แจ้งนักศึกษา" เดิมทั้ง 3 modal นี้สร้าง PDF/Word แบบร่าง (ยังไม่เซ็น) แล้วบันทึกไฟล์ร่างนั้นเข้าระบบเลย มีแค่ข้อความ "ลงนามจริงก่อนส่ง" เป็น hint แต่ไม่มีช่องให้แนบไฟล์ที่เซ็นจริงกลับเข้าระบบ — นักศึกษาที่ดาวน์โหลดไฟล์จากระบบจะได้ไฟล์ที่ไม่มีลายเซ็นเสมอ
- ปุ่ม "บันทึกเข้าระบบ" ถูก disable จนกว่าจะอัปโหลดไฟล์ที่เซ็นแล้ว ไฟล์ที่อัปโหลดจะถูกใช้แทนไฟล์ร่างทั้งหมดตอนส่งเข้าระบบ (ไม่ใช่ส่งคู่กัน)

### Process notes
- Backend ไม่ต้องแก้ — endpoint ที่เกี่ยวข้อง (`PUT /api/admin/t000/review`, `POST /api/admin/supervisions/:id/upload-letter`) ใช้ multer middleware (`pdfOrImageFileFilter`) ที่รับไฟล์ PDF/รูปภาพแบบทั่วไปอยู่แล้ว ไม่ได้ผูกกับ blob ที่ frontend สร้าง
- ทดสอบจริงผ่าน browser: เปิด modal ทั้ง 3 แบบ, ปุ่มบันทึกถูก disable ก่อนแนบไฟล์, อัปโหลดไฟล์แล้วปุ่มเปิดใช้งาน, ทดสอบ submit จริง 1 เคส (หนังสือขอความอนุเคราะห์) → `PUT /api/admin/t000/review` คืน 200 และ DB บันทึกชื่อไฟล์ที่อัปโหลดถูกต้อง (ไม่ใช่ไฟล์ร่าง)
- `npx tsc --noEmit` ผ่าน, backend `npx jest` 216/217 ผ่าน (เคสที่เหลือ fail เดิมอยู่แล้ว ไม่เกี่ยวกับการแก้ไขนี้)

## [2026-06-27] ตรวจสอบและแก้ไขวันที่ที่ยังโชว์ปีคริสตศักราช (ค.ศ.) ทั้งระบบ

### Fixed
- `Frontend/src/components/SupervisionCalendar.tsx` (`fmtDate`): แสดงวันที่เลือกในปฏิทินนิเทศเป็น ค.ศ. (เช่น "15/6/2025") แทน พ.ศ. ใช้อยู่ใน `S_Supervision.tsx`, `A_SupervisionManage.tsx`, `T_SupervisionReview.tsx` (component ใช้ร่วมกัน 3 ที่) เพิ่ม `+543` ให้ปี
- `Frontend/src/components/A_SupervisionManage.tsx` (`parseProposedList`): รายการวันที่อาจารย์เสนอมา (proposedDates) แสดงปี ค.ศ. ในหน้าจัดการนิเทศของเจ้าหน้าที่ เพิ่ม `+543`
- `Frontend/src/components/T_SupervisionReview.tsx` (`formatDMY`, `formatDMYTime`): ใช้แสดงวันที่นัดยืนยันแล้ว/เวลาในหน้าตรวจนิเทศของอาจารย์ — เดิม comment ของฟังก์ชันเขียนไว้ตรงๆว่า "ทุกที่ใช้ d/m/y (วัน/เดือน/ปีคริสตศักราช)" คือตั้งใจใช้ ค.ศ. มาแต่ต้น แก้เป็น พ.ศ. (`+543`) ให้ตรงกับ convention ของระบบ พร้อมแก้ comment

### Process notes
- ตรวจสอบทั้งระบบตามที่ขอ (ทั้ง `Frontend/src/` และ `backend/`) ครอบคลุม: `toLocaleDateString(` ทุกที่, การประกอบสตริงวันที่มือด้วย `getFullYear()/getMonth()/getDate()`, การใช้ `+543`/`-543`, PDF generator ทุกไฟล์ใน `Frontend/src/utils/pdfGenerator*`, backend (ไม่มี date-formatting logic เลย ส่งเป็น ISO ให้ frontend แปลงทั้งหมด)
- พบ 4 จุดที่ผิดจริง (แก้แล้วทั้งหมดตามด้านบน) ส่วนที่เหลือถูกต้องอยู่แล้ว — ใช้ `toLocaleDateString('th-TH', ...)` (browser/Node แปลงเป็น พ.ศ. ให้อัตโนมัติเมื่อ locale เป็น th-TH) หรือบวก `+543` เองถูกที่ถูกจุดแล้ว
- จุดที่ใช้ `getFullYear()` โดยไม่บวก 543 ที่เหลือ (เช่น `dayKeyOf` ใน SupervisionCalendar.tsx, `getWeekKey` ใน S_DailyPage.tsx, `monday.getFullYear()` ใน A_Daily.tsx) ตรวจแล้วเป็นแค่ internal key/sort index ที่ไม่ได้ render ให้ผู้ใช้เห็น ไม่ใช่บั๊ก ไม่แก้
- พบความไม่สม่ำเสมอเล็กน้อย (ไม่ใช่บั๊ก แค่ inconsistent): มี local `formatDateTH()`/`toThaiDate()` ซ้ำกันหลายไฟล์ใน `Frontend/src/utils/pdfGenerator*.ts` ทั้งที่มี shared helper `toThaiDate()` อยู่แล้วใน `docGeneratorUtils.ts` — แต่ละที่ที่มีอยู่ +543 ถูกต้องแล้วทุกที่ ไม่มีผลต่อความถูกต้องที่แสดงผล จึงไม่ได้ refactor รวมในรอบนี้เพราะนอกเหนือจากที่ขอ (เป็นเรื่อง DRY/maintainability ไม่ใช่ความถูกต้องของวันที่)
- `npx tsc --noEmit` ผ่าน

## [2026-06-27] T000/T002/T003: เปลี่ยนเป็นบันทึกอัตโนมัติ + ย้ายปุ่มดูตัวอย่าง/โหลด PDF ลงด้านล่าง

### Changed
- `Frontend/src/components/S_Docs.tsx` (T000), `S_DocsT002Form.tsx` (T002), `S_DocsT003Form.tsx` (T003): เอาปุ่ม "บันทึกแบบร่าง"/"บันทึกข้อมูลร่าง" ออกทั้ง 3 ฟอร์ม เปลี่ยนเป็นบันทึกอัตโนมัติ (autosave) แบบ debounce หลังหยุดพิมพ์ ~1.5 วินาที — ข้อมูลที่กรอกจะถูกเก็บไว้เองโดยไม่ต้องกดปุ่ม กลับมาที่หน้านี้ทีหลังข้อมูลยังอยู่ มีตัวบอกเล็กๆ "💾 บันทึกล่าสุด HH:mm" แทนปุ่มเดิม (ข้ามการ autosave รอบแรกตอนโหลดหน้า ไม่ save ทันทีที่เปิดหน้าทั้งที่ยังไม่ได้แก้ไขอะไร)
- T002/T003: ย้ายปุ่ม "👁️ ดูตัวอย่าง / โหลด PDF" จากมุมขวาบนของหน้า (header) ไปไว้ท้ายฟอร์ม ก่อนส่วนอัปโหลดเอกสาร — ตรงกับลำดับการใช้งานจริง (กรอกให้ครบก่อน ค่อยพิมพ์/อัปโหลด) เหมือนโครงสร้างของ T000 ที่มีอยู่แล้ว (Step1 กรอก → Step2 พิมพ์เอกสาร → Step3 อัปโหลด); T000 มีปุ่มเหล่านี้อยู่ใน Step2 แยกต่างหากอยู่แล้วจึงไม่ต้องย้าย
- `handlePreviewPDF`/`handleGeneratePDF` (T002/T003 และ T000 เดิม) เรียก save แบบ silent ก่อนสร้าง PDF ทุกครั้ง เพื่อให้แน่ใจว่าข้อมูลล่าสุดถูกบันทึกแล้วก่อนพิมพ์/ดาวน์โหลด ไม่ต้องรอ debounce
- ลบ `<form onSubmit>` ที่ไม่มีปุ่ม submit เหลืออยู่แล้ว (T002/T003) เปลี่ยนเป็น `<div>` ธรรมดา ป้องกัน native form submission ที่อาจเกิดจากการกด Enter ในช่องกรอกข้อมูล

### Process notes (ตรวจสอบฟอร์มตามที่ขอ — มีซ้ำหรือปัญหาไหม)
- ไม่พบ field ซ้ำกันภายในฟอร์มเดียวกัน (เช็ค `name=`/`value={formData.X}` ทุกช่องใน T000/T002/T003 แล้ว ไม่มี input สองช่องผูกกับ state key เดียวกันโดยไม่ตั้งใจ — `coordinatorType` ที่เจอซ้ำ 2 ที่เป็น radio group ปกติ ไม่ใช่บั๊ก)
- พบ "ความซ้ำซ้อนข้ามฟอร์ม" ที่เป็น design ที่มีอยู่แล้ว ไม่ใช่บั๊กใหม่ แต่ควรรู้ไว้: ข้อมูลผู้ติดต่อฉุกเฉิน (emergencyName/Address/Phone/Email) ถูกกรอกใน T000 แล้วมาถาม "ซ้ำ" อีกครั้งใน T002 (ดึงมา prefill จาก T000 ให้ แต่บันทึกเป็นค่าอิสระแยกกันคนละ record) เช่นเดียวกับข้อมูลบริษัท (ชื่อ/ที่อยู่/เบอร์โทร) ที่ดึง prefill มาจาก Company entity แต่ T002 เก็บเป็น snapshot ของตัวเองอีกชุด — ถ้านักศึกษาแก้ไขข้อมูลที่ต้นทาง (T000 หรือ Company) ภายหลัง ค่าที่ T002 บันทึกไว้แล้วจะไม่อัปเดตตาม เข้าใจว่าตั้งใจให้เป็น snapshot ของเอกสารทางการ ณ ขณะนั้น ไม่ได้แก้ในรอบนี้เพราะเป็นการเปลี่ยน data model ใหญ่กว่าที่ขอมา — แจ้งไว้เผื่อต้องการให้ sync แทนในอนาคต
- Verified live ผ่าน chrome-devtools-mcp ทั้ง 3 ฟอร์ม: พิมพ์ข้อมูล → รอ debounce → indicator "บันทึกล่าสุด" ปรากฏ → reload หน้า → ข้อมูลที่พิมพ์ยังอยู่ ไม่มี console error
- `npx tsc --noEmit` ผ่านทุกไฟล์

## [2026-06-27] ปิดช่องโหว่นักศึกษาเลื่อนสถานะสหกิจเองได้ + ล็อก T002/T003 ตามขั้นตอนสถานะ

### Fixed (Security)
- `backend/controllers/docController.js` (`acknowledgePlacementLetter`): เดิม endpoint นี้รับค่า `status` จาก request body ของ client ตรงๆ แล้วเอาไปเซ็ตลง `StudentCoop.status` โดยไม่ตรวจสอบใดๆ — นักศึกษาที่ login แล้วสามารถยิง `POST /api/students/acknowledge-placement-letter` พร้อม `{ status: "<ค่าอะไรก็ได้>" }` เพื่อเลื่อนสถานะตัวเองข้ามขั้นตอนการตรวจสอบของเจ้าหน้าที่/อาจารย์ได้ทั้งหมด แก้โดยลบการรับ `status` จาก client ออก เปลี่ยนเป็น hardcode เป็น `INTERNSHIP_STARTED` ที่ฝั่ง server เท่านั้น พร้อมเช็ค precondition ว่ามีไฟล์หนังสือส่งตัว (`placeLetterUrl`) แล้ว และสถานะปัจจุบันต้องอยู่ใน zone ก่อนเริ่มฝึกงาน (REQ_LETTER_ISSUED ถึง PLACEMENT_LETTER_ISSUED) ก่อนเท่านั้น
- `backend/controllers/studentController.js` (`downloadPlacementLetter`): endpoint คู่กันอีกตัว (ไม่ได้ถูกเรียกจาก frontend แล้ว แต่ route ยังเปิดอยู่) มีช่องโหว่เดียวกัน — เซ็ต `status: 'INTERNSHIP_STARTED'` แบบไม่มี precondition ใดๆเลย แก้ด้วย precondition เดียวกับด้านบน

### Changed
- `Frontend/src/components/S_DocsT002Form.tsx`, `S_DocsT003Form.tsx`: เดิมฟอร์ม T002/T003 เช็คแค่ว่าระบบเปิดรับเอกสารอยู่ในช่วงเวลาหรือไม่ (`isSystemOpen`) แต่ไม่เช็คว่านักศึกษาผ่านขั้นตอน T000 (ได้รับหนังสือขอความอนุเคราะห์ REQ_LETTER_ISSUED) มาก่อนหรือยัง ทำให้เข้าถึงฟอร์ม/อัปโหลดได้ผ่าน URL ตรงๆ ก่อนถึงขั้นตอนจริง เพิ่มเงื่อนไข `isUnlocked` (เช็ค `profile.coop.status` ต้องอยู่ใน REQ_LETTER_ISSUED ขึ้นไป) ควบคู่กับ `isSystemOpen` เดิม พร้อม banner แจ้ง "ยังไม่ถึงขั้นตอนนี้" เมื่อยังไม่ปลดล็อก

### Process notes
- ตรวจสอบ flow สถานะนักศึกษาทั้งสาย (ยื่นคำร้อง → T000 → T002/T003 → นัดนิเทศ → T005/T006 → T007 → T008) ตามที่ขอ พบว่า T005/T006, T007, T008 เป็นแค่หน้าแสดงคำชี้แจง + ลิงก์ไป Google Forms/Drive ภายนอก ไม่มีการบันทึกสถานะในระบบเราเลย จึงไม่ใช่ช่องโหว่จริง (ต่างจากที่ตรวจสอบรอบแรกเข้าใจผิด)
- การนัดหมายนิเทศ (`S_Supervision.tsx`) ตรวจสอบแล้วว่า gate เดิม (`isInternshipPhase` ต้องเป็น INTERNSHIP_STARTED ขึ้นไป) เพียงพอแล้วในเชิง logic เพราะ INTERNSHIP_STARTED มาทีหลัง REQ_LETTER_ISSUED ใน flow ปกติเสมอ — ปัญหาจริงคือช่องโหว่ backend ข้างบนที่ทำให้ข้าม INTERNSHIP_STARTED ได้ ไม่ใช่เงื่อนไขหน้านัดนิเทศเอง จึงแก้ที่ root cause (backend) แทนการเพิ่มเงื่อนไขซ้ำซ้อนที่หน้านัดนิเทศ
- Backend tests: `npx jest` ผ่าน 216/217 (1 fail เป็น pre-existing ไม่เกี่ยวกับการแก้ครั้งนี้ ใน `teacherController.test.js`)
- Verified live: ทดสอบลด/คืนสถานะนักศึกษาทดสอบชั่วคราว (QUALIFIED → INTERNSHIP_STARTED) ผ่าน chrome-devtools-mcp ยืนยัน banner ล็อกแสดงถูกต้อง ฟอร์ม/ปุ่มบันทึก/ส่วนอัปโหลดถูกซ่อนเมื่อ locked และกลับมาแสดงปกติเมื่อปลดล็อก ไม่มี console error

## [2026-06-23] เพิ่ม flow ต่อเนื่อง "เพิ่มพี่เลี้ยง" หลังเพิ่มบริษัทใหม่

### Changed
- `Frontend/src/components/A_Company.tsx` และ `Frontend/src/components/S_Company.tsx`: หลังเพิ่มบริษัทใหม่สำเร็จ เดิม modal จะปิดเงียบๆ กลับไปหน้ารายการ ไม่มีการแนะนำให้ไปเพิ่มข้อมูลพี่เลี้ยงต่อ ผู้ใช้ (ทั้งเจ้าหน้าที่และนักศึกษาที่เพิ่มบริษัทของตัวเอง) ต้องจำเองว่าต้องกลับไปกด "รายละเอียด" แล้วกด "+ เพิ่มพี่เลี้ยง" แยกต่างหาก เพิ่มหน้าถาม "เพิ่มพี่เลี้ยงเลยหรือไม่" หลังบันทึกบริษัทสำเร็จ พร้อมปุ่ม "เพิ่มพี่เลี้ยงเลย" (ไปกรอกฟอร์มพี่เลี้ยงต่อทันที reuse ฟอร์มเดิม) และ "ข้ามไปก่อน" (กลับหน้ารายการแบบเดิม) — ไม่บังคับ skip ได้

### Fixed
- `Frontend/src/components/S_Company.tsx`: พบบั๊ก `c.mentors is not iterable` ตอนทดสอบ flow ใหม่ — เพิ่ม/แก้ไข/ลบพี่เลี้ยงบนบริษัทที่ตอบกลับจาก API ไม่มี field `mentors` (เช่น บริษัทที่เพิ่งสร้างใหม่) จะ crash ทั้งหน้า เพราะ spread `...c.mentors`/`...prev.mentors` ตรงๆ โดยไม่มี fallback เป็นบั๊กเดียวกับที่เคยแก้ใน `A_Company.tsx` ไปแล้วก่อนหน้านี้ (ดู entry "System-wide QA sweep" ด้านล่าง) แต่ไม่ได้แก้ในไฟล์ฝั่งนักศึกษาที่ใช้ logic เดียวกัน เพิ่ม `|| []` defaults ให้ทั้ง 3 mentor handler (add/edit/delete) เหมือนฝั่ง admin

### Process notes
- Flow การเพิ่มพี่เลี้ยงจากหน้า "รายละเอียดบริษัท" ตามปกติ (ปุ่ม "+ เพิ่มพี่เลี้ยง" ที่มีอยู่แล้ว) ไม่เปลี่ยน behavior — ยังคงอยู่ที่หน้ารายละเอียดหลังบันทึกสำเร็จเหมือนเดิม การเปลี่ยนแปลงนี้มีผลเฉพาะตอน "เพิ่มบริษัทใหม่" เท่านั้น
- ผ่าน brainstorming → spec → plan → inline execution flow ตามปกติ; spec/plan อยู่ที่ `docs/superpowers/specs/2026-06-23-company-mentor-flow-design.md` และ `docs/superpowers/plans/2026-06-23-company-mentor-flow-plan.md`
- Verified live ทั้ง golden path (เพิ่มพี่เลี้ยงเลย → บันทึก → ปิดกลับหน้ารายการ → เปิดรายละเอียดยืนยันพี่เลี้ยงอยู่จริง) และ skip path ทั้งฝั่ง staff และ student ผ่าน chrome-devtools-mcp พร้อม `npx tsc --noEmit` clean

## [2026-06-23] Fix advisor fields not editable in admin student edit modal; normalize Excel-imported major names

### Fixed
- `Frontend/src/components/A_StudentEditModal.tsx`: "อาจารย์ที่ปรึกษาปกติ" only edited the denormalized `advisorName` text field, never the real `generalAdvisorId` FK that the rest of the system (dashboard counts, advisee lists, supervision data) actually relies on — so changes appeared to save but had no effect anywhere else. Replaced both advisor fields with a type-to-search picker (`TeacherSearchInput`, built locally, no UI library) bound to `generalAdvisorId`/`coopAdvisorId`. Added "อาจารย์ที่ปรึกษาโครงการ" (`coopAdvisorId`) search-select as requested, mirroring the same component.
- `backend/controllers/studentController.js` `updateStudentBasicInfo`: now accepts `generalAdvisorId`/`coopAdvisorId`, re-deriving `advisorName` server-side from the resolved teacher so the display text always stays in sync with the FK (never accepted as independent free-text from the client). Also fixed a regression this change exposed: an empty `prefix`/`studyProgram` (legacy records with no value set) was passed straight to Prisma as `''`, which is not a valid enum value and threw a 500 — now coerced to `null`.
- `backend/controllers/adminDocController.js` `getAllStudentsForReview`: included `generalAdvisor`/`coopAdvisor` relations so the edit modal can show the currently-assigned advisor.
- `backend/controllers/studentImportController.js`: Excel imports stored the "สาขาวิชา / แผนกการศึกษา" column as the raw Thai full name (e.g. "วิทยาการคอมพิวเตอร์"), which didn't match the short codes (CS/IT/GIS/CYB/AI) used everywhere else in the system (filters, dashboard, criteria). Added a name→code mapping; unrecognized values are kept as-is and surfaced as a warning in the import result instead of silently breaking the row. `Frontend/src/components/A_Students.tsx` now displays these warnings after import.

### Process notes
- Verified live: advisor picker save round-trip (select → save → reload → confirm persisted) and a real Excel upload with a full Thai major name (correctly normalized to `CS`, no warning) via chrome-devtools-mcp; backend Jest suites for both controllers still passing.

## [2026-06-23] System-wide QA sweep (student/teacher/staff): fix 6 bugs found via live testing

### Fixed
- `Frontend/src/components/A_Announcements.tsx`: create/edit/delete all sent no `Authorization` header (unlike the GET calls in the same file), so the backend correctly rejected them with 401 — which the global axios interceptor treated as a session timeout and force-logged-out the user. Every staff user who tried to manage an announcement was instantly logged out. Added the header to both the POST and DELETE calls.
- `Frontend/src/components/A_Company.tsx`: adding a mentor under a company crashed the whole page (`mentors is not iterable`) right after a successful save, because the response handler spread `prev.mentors`/`c.mentors` without defaulting to `[]`. The mentor was actually saved server-side; only the UI update crashed. Hardened all three mentor mutation handlers (add/edit/delete) with `|| []` defaults. Also fixed a copy-paste bug where the *failure* branch of the edit-mentor handler showed a "สำเร็จ" (success) alert.
- `Frontend/src/components/S_DocsT002Form.tsx`: "บันทึกข้อมูลร่าง T002" never called the backend — it only showed a success alert while the form data lived in local React state, so any edited field not already present elsewhere (job description, accommodation address, etc.) was silently lost on refresh. Added a `CoopT002Form` Prisma model (mirroring the existing, working `CoopT003Form`), a `POST /api/docs/t002-form` route + controller, included it in the student profile query, and wired the frontend save button to actually persist and reload saved drafts.
- `backend/controllers/teacherController.js` `getDashboardStats`: counted advisees via a fragile `student.advisorName: { contains: teacher.firstName }` text match, while the real advisee list (`getMyStudents`) filters by the `generalAdvisorId`/`coopAdvisorId` foreign keys. The two disagreed whenever a student's `advisorName` text wasn't backed by the FK (legacy data), so a teacher's dashboard count didn't match who actually showed up in their advisee list. Switched the dashboard query to the same FK-based filter (respecting the `isCoopTeacher` "sees everyone" case). Backfilled 10 pre-existing students whose `advisorName` had never been linked to the FK via a one-time script (`backend/scripts/backfill_student_advisor_fk.js`).
- `Frontend/src/components/T_Dashboard.tsx`: the "จัดการนัดนิเทศ →" dashboard link pointed at `/teacher/supervisions`, a route that doesn't exist (silently redirected back to the dashboard via the catch-all route). Fixed to point at the real route, `/teacher/review-supervision`.
- `Frontend/src/components/A_StudentEditModal.tsx`: the "คำนำหน้า" (prefix) `<select>` was marked `required` even though `Student.prefix` is nullable in the schema, so editing any legacy student record with no prefix silently blocked the save behind a native browser tooltip with no app-level error. Removed `required` to match the data model.

### Investigated, not a bug
- Student-side `/student/company` page showing "แก้ไข/ลบ" buttons on companies, and `getMyStudents` showing all students to `isCoopTeacher` teachers — both confirmed to be intentional, backend-enforced behavior (per-record ownership checks via `isStaffOrCompanyOwner`, and the coordinator role intentionally seeing the full roster), not access-control gaps.

### Process notes
- Found via a 4-way QA sweep (student / teacher / staff-people / staff-docs) combining live chrome-devtools-mcp browser testing and static code analysis, dispatched as parallel subagents per CLAUDE.md's testing conventions. All 6 fixes re-verified live in-browser after the fix (including a reload-persistence check for the two "fake success" bugs) plus a clean `npx tsc --noEmit`.

## [2026-06-22] Redesign supervision calendar (stats strip, filters, agenda view)

### Changed
- `Frontend/src/components/SupervisionCalendar.tsx` redesigned (shared by admin/staff, teacher, and student supervision pages): added a stats strip (total/online/onsite this month + today's count), filter chips (ทั้งหมด/ออนไลน์/ออนไซต์), and replaced the old "click a day → detail panel below" layout with a split view — a compact month grid on the left and a chronological agenda of the month's appointments on the right. Clicking a day now narrows the agenda instead of opening a separate panel; a "ดูทั้งเดือน" link resets it. Below ~768px the grid and agenda stack vertically.
- Each agenda row now shows the student's company name and, for online appointments, a clickable meeting link (or "ยังไม่ระบุลิงก์" if none was saved) — previously the calendar only showed student name, time, and an online/onsite emoji.

### Fixed
- `backend/controllers/supervisionController.js` `getSupervisionCalendar` (used by the student-facing calendar) was hand-picking response fields and never included company name or online link, even though the data existed on the appointment/student records. Extended the Prisma query and mapping to include both. The other two calendar data sources (admin's `getAllSupervisions`, teacher's `getSupervisionsForTeacher`) already returned this data via Prisma's default `include` behavior — only their frontend `.map()` calls needed to start passing it through to the calendar component.

### Process notes
- Went through full brainstorming (visual mockup comparison via the brainstorming companion) → spec → plan → inline execution flow for this UI redesign; spec and plan committed under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Verified via Jest (backend field changes) and an ad-hoc Playwright script exercising all three pages with synthetic data covering every edge case (online+link, online without link, multiple appointments same day, today, responsive stacking) — script was temporary and removed after manual visual review, not part of the permanent suite.

## [2026-06-22] Whole-system code review: fix all findings (auth gaps, soft-delete leaks, frontend 401 bypass)

### Fixed (Security / Auth)
- `announcementRoutes.js`: POST/DELETE were completely unauthenticated — anyone could add or delete announcements. Added `verifyToken` + `verifyRole('admin','staff')`.
- Removed dead, unauthenticated duplicate route `routes/criteriaRoutes.js` (frontend only calls the already-protected `/api/admin/criteria`).
- `companyController.js`: mentor add/update/delete had no ownership check — any logged-in user could edit mentors on any company. Added an `isStaffOrCompanyOwner` helper, consistent with the existing company update/delete pattern.
- `teacherRoutes.js`: `PUT /:id` (edit any teacher's profile) was open to any authenticated role. Restricted to staff; `GET /` stays open since students need it to pick an advisor.
- `studentRoutes.js`: `GET /` let any student enumerate the full student roster. Restricted to staff/teacher.
- `adminRoutes.js`: 4 destructive student endpoints (update/soft-delete/restore/permanent-delete/trash-list) allowed `teacher` role via the shared `ADMIN_ROLES` constant. Scoped down to the existing `STAFF_ONLY` constant.
- `visitController.js`: added ownership checks (`toggleVisitStatus`, `deleteVisit` now require the requesting teacher to own the visit) and a conflict check in `createVisit` (duplicate same-day visit for the same student now returns 409).
- `authController.js` `signIn`: email lookup was case-sensitive, inconsistent with `registerStudent`/`loginWithKKU` which always lowercase. Now lowercases before the `findFirst` query.

### Fixed (Data integrity)
- `studentImportController.js`: re-importing a soft-deleted (trashed) student's `studentId` silently revived them via upsert. Now blocks the row with an `errorRows` entry instructing staff to restore first.
- `studentController.js` `permanentlyDeleteStudent`: deleted the `Student` row but left the linked `User` (login account) row orphaned. Now wraps both deletes in a `$transaction`.
- `studentController.js` `exportStudents`: Excel export had no `deletedAt` filter, so trashed students appeared in exports. Added the filter, matching `getStudents`.
- `adminDocController.js` `getCoopApplications`: no `deletedAt` filter on the related student, so soft-deleted students' coop applications stayed visible/actionable to staff. Added the filter.
- `adminDocController.js` `getAllStudentsForReview`: hardcoded `take: 500` with no pagination silently truncated beyond 500 students and never returned a `meta` envelope — `T_Dashboard.tsx`'s T002/T003 pending counts were reading `data.meta.total`, which never existed, so those counts were silently stuck. Added `page`/`limit`/`status` query support and a `meta: { total, page, limit, totalPages }` response, while defaulting `limit` to 1000 (not a small page) so existing callers that rely on getting the full list for client-side filtering are unaffected.
- `announcementController.js` `deleteAnnouncement`: used a relative path (`path.join("uploads", f.path)`) to locate attachment files for deletion, which only works if the process's CWD happens to be `backend/`. Fixed to use the same absolute-path pattern (`path.join(__dirname, '../uploads', f.path)`) already used elsewhere in the file — under PM2 (CWD often not `backend/`), attachment files were never actually deleted from disk on announcement deletion.
- `supervisionController.js` `getSupervisionsForTeacher`: matched co-teachers via `coTeacherName.contains(teacher.firstName)` with no minimum-length guard, so a 1-character first name could match unrelated appointments. Added the same `length >= 2` guard already present on the sibling function `getTeacherSupervisions`.

### Fixed (Frontend)
- Added missing `Authorization` headers (functionally broken — requests silently 401'd) in `A_CoopPeriod.tsx` (create/update/toggle/delete), `A_DocRequirements.tsx` (create/update/delete), `A_CriteriaPage.tsx` (create/delete), and `A_Settings.tsx`'s `handleUpload` (the sibling `handleDeleteAsset`/`handleSaveDeanInfo` already had it).
- Added `Frontend/src/utils/apiFetch.ts`: a `fetch()` wrapper that mirrors the global axios 401-interceptor in `main.tsx` (clears the token and forces re-login). Raw `fetch()` calls bypassed that interceptor entirely, so an expired token caused those calls to fail silently instead of logging the user out. Applied to all `fetch()` call sites in `S_App.tsx`, `S_Docs.tsx`, `S_DocsT002Form.tsx`, and `T_StudentDetail.tsx`.
- `T_StudentDetail.tsx` `fetchData`: had no guard against stale responses — navigating to a different student while a fetch for the previous student was still in flight could let the old response overwrite the new student's state. Added an `isStale()` check before each `setState` call.
- `A_DocT000.tsx` `handleApproveAll`: applied an optimistic UI update (mark all docs approved) before the API call, but never checked `res.ok` or rolled back on failure — a failed approve-all silently left the UI showing "approved" while the backend still showed the old status. Now checks `res.ok`, rolls back to the captured previous state on any failure, and alerts the user.

### Testing
- Added/updated tests across `visitController`, `studentImportController`, `studentController`, `companyController` (mentor ownership + existing addMentor tests updated for the new check), `adminDocController` (new `getCoopApplications` + extended `getAllStudentsForReview` tests), `authController` (case-insensitive signIn), `announcementController` (absolute-path assertion), and `supervisionController` (short-name guard). Full backend suite: 217/217 passing. Frontend `tsc --noEmit`: clean.

## [2026-06-22] Code review follow-up: advisor-matching safety + deploy script exit-code bug

### Fixed
- **Excel import advisor matching** (`studentImportController.js`): a typo or extra space in the advisor name column (e.g. missing academic title, double space) caused a silent no-match, which unconditionally wrote `generalAdvisorId: null` — wiping a previously-assigned advisor on re-import with no error reported. Now distinguishes "no advisor given" (clears the field) from "advisor given but unmatched" (leaves the existing value untouched, Prisma ignores `undefined` fields) and adds a non-fatal `errorRows` entry so it's visible via the API response.
- **Duplicate teacher names**: if two teachers share the same first/last name, the code previously picked whichever `findMany` happened to return last, silently linking the wrong teacher. Now treats same-name collisions as ambiguous and refuses to guess, also surfaced via `errorRows`.
- **`docs/deploy.ps1` retry blocks** (both the new `prisma generate` step and the pre-existing `prisma migrate deploy` step): `$LASTEXITCODE` was being overwritten by `pm2 start`/`pm2 save` running between the retried command and the success check, so the script was actually checking PM2's exit code, not the retried command's. Now captures the exit code into a dedicated variable immediately after each `npx` call.

## [2026-06-22] Set Express trust proxy for accurate rate-limit IPs

### Fixed
- Express never called `app.set('trust proxy', ...)`, so behind nginx, `express-rate-limit` couldn't determine each user's real IP from `X-Forwarded-For` — logged `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` on every login/register attempt and risked bucketing all users behind nginx under one shared rate-limit count.
- Added `app.set('trust proxy', 1)` (trust the first hop — nginx) in `server.js`. Confirmed the warning no longer fires and the full test suite (193/193) still passes.

## [2026-06-22] Fix Excel import header detection (real file has title row above headers)

### Fixed
- After fixing the column header names, a real import still failed every row with "email หรือ id ว่างเปล่า". Root cause: the real template has a merged title row and a blank row above the actual header row, but `studentImportController.js` assumed the header was row 1 (`XLSX.utils.sheet_to_json(sheet)` default behavior), so it parsed the title text as a single bogus header and never found the real columns.
- Now scans the sheet for the row containing `รหัสนักศึกษา` and uses that as the header row, regardless of how many title/blank rows precede it. Returns 400 if no such row is found.

## [2026-06-22] Add explicit `prisma generate` step to deploy script

### Fixed
- `docs/deploy.ps1` ran `npm install` but never explicitly ran `npx prisma generate`, relying on npm's implicit postinstall hook. On the VM, that postinstall silently failed (PM2 holding the query engine DLL open), leaving a stale Prisma Client after deploy and causing `POST /api/auth/signin` to 500 with `P2022` on a column that had already been dropped from the schema.
- Added an explicit "Generating Prisma Client..." step (same stop-backend/retry-on-failure pattern already used for `prisma migrate deploy`), placed before migrations run.

## [2026-06-22] Fix Excel import column headers to match real template

### Fixed
- `studentImportController.js` was reading column headers (`id`, `ชื่อ`, `สกุล`, `ปี`, `สาขาวิชา`, `รูปแบบการศึกษา`, `อาจารย์ที่ปรึกษาทั่วไป`, `email อาจารย์`, `email นักศึกษา`) that didn't match the Excel template actually used by staff (`รหัสนักศึกษา`, `คำนำหน้าชื่อ`, `ชื่อ-นามสกุล (ภาษาไทย)`, `ชื่อ-นามสกุล (ภาษาอังกฤษ)`, `สาขาวิชา / แผนกการศึกษา`, `ชั้นปี`, `เบอร์โทรศัพท์`, `อีเมล`, `ภาคการศึกษา (ปกติ/พิเศษ)`, `เกรดเฉลี่ยสะสม (GPA)`, `ชื่ออาจารย์ที่ปรึกษา`) — every row would fail with "email หรือ id ว่างเปล่า" since `id`/`email นักศึกษา` never matched anything in the real file.

### Changed
- Column headers updated to match the real template.
- Combined "ชื่อ-นามสกุล" columns (Thai and English) are now split into `firstName`/`lastName` and `firstNameEn`/`lastNameEn` on the first space.
- `คำนำหน้าชื่อ`, `เบอร์โทรศัพท์`, and `เกรดเฉลี่ยสะสม (GPA)` are now imported (previously ignored).
- Advisor lookup (`generalAdvisorId`) now matches by the advisor's name against the `Teacher` table, since the template has no advisor-email column. Previously matched by email.

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
