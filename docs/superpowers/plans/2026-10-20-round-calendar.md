# ปฏิทินของรอบ (Round Calendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** กำหนดส่งของแต่ละขั้นผูกกับรอบ (เทอม × หลักสูตร) ตั้งที่หน้า `/admin/coop-period` ที่เดียว · หลักสูตรปรับต่างจากวิทยาลัยได้ · เลือกได้ว่าเลยกำหนดแล้ว "ปิดจริง" หรือ "ส่งช้าได้ (ติดป้าย)" · ขยายเวลารายคนได้ตั้งแต่วันแรกที่ปิดจริง

**Architecture:** ทำตามแบบที่ช่วงนิเทศใช้อยู่แล้ว — เก็บบน `CoopPeriodMajor` (รอบ × หลักสูตร) เป็นคอลัมน์ JSON `deadlines` + ค่าตั้งต้นของวิทยาลัยบน `CoopPeriod.deadlines` · ไม่มีระบบสืบทอด: ค่าในแถวหลักสูตร = ค่าที่ใช้จริง · บันทึกค่าวิทยาลัยแล้ว "ติ๊กเลือก" หลักสูตรที่จะใช้ค่านั้น · เวลาส่งของแต่ละขั้นบันทึกที่ `StudentCoop.submittedSteps` ที่เดียว ใช้ทั้งตัดสินส่งช้า แจ้งเตือน และไทม์ไลน์ · สถานะ (`CoopStatus`) ไม่เปลี่ยน

**Tech Stack:** Express + Prisma + MySQL, React 19 + TypeScript, Jest, Playwright

**Spec:** ข้อตกลงใน conversation 2026-10-20 + PDF "ปฏิทินสหกิจศึกษา ปีการศึกษา 2569" + ผล scrutinize 2026-10-20 (M1–M4, S1, N1–N4) (ไม่มีไฟล์ spec แยก)

## Global Constraints

- ขั้น (key ตายตัว): `T000` `T002` `T003` มี `{ due, mode, closed }` · `T005_T006` `T007` `T008` มี `{ due }` อย่างเดียว (ฟอร์มอยู่นอกระบบ — แสดงวันเท่านั้น)
- ยื่นคำร้อง = `CoopPeriodMajor.endDate/isActive` เดิม (ปิดอัตโนมัติด้วย `autoCloseRows`) · เลิกใช้ `APPLY_CONFIG` ตัดสิน · นิเทศ = ช่วงเดิมบน `CoopPeriodMajor` ครั้งเดียว ตั้งที่หน้า "จัดการนิเทศ" เหมือนเดิม · ไม่ทำขั้นที่ทำนอกระบบ
- `due` = `"YYYY-MM-DD"` เวลาไทย ปิดที่ 23:59:59.999 (+07:00) ใช้ `periodCloseAt` (`backend/utils/coopPeriodHelper.js`) · ไม่มี `due` = ไม่มีกำหนด
- `mode`: `HARD` (ค่าเริ่ม) = เลยกำหนดแล้วส่งครั้งแรกไม่ได้ · `SOFT` = ส่งได้ ติดป้าย "ส่งช้า"
- `closed: true` (สวิตช์ "ปิดรับชั่วคราว") = ส่งครั้งแรกไม่ได้ทุกโหมด แม้มีขยายเวลา · การส่งแก้ยังได้
- **ส่งแก้ได้เสมอ** (ไม่ติดกำหนด/สวิตช์): สถานะ `EDITS_REQUIRED` และ `APPLICATION_EDITS_REQUIRED` (กลุ่ม T000 — ชุดเดียวกับ `docController.js:286`) · `T002_EDITS_REQUIRED` · `T003_EDITS_REQUIRED`
- ขยายเวลารายคน (`StudentCoop.deadlineExtensions = { T002: "YYYY-MM-DD" }`) เฉพาะ `T000/T002/T003` · ส่งภายในวันขยายได้ แต่ยังนับว่า "ส่งช้า" (เทียบกับ `due` เดิม)
- **"ส่งแล้ว"** = `StudentCoop.submittedSteps[step] = { at: ISO, backfill?: true }` บันทึกครั้งเดียว ไม่ทับตอนส่งแก้: `T000` = เวลาที่อัปโหลด**ครบทุกหัวข้อบังคับของหลักสูตรตัวเอง**ครั้งแรก · `T002`/`T003` = ส่งแบบฟอร์ม `T002_FORM`/`T003_FORM` ครั้งแรก · "ส่งช้า" = `at > due` (ไม่นับแถว `backfill`)
- เอกสารหัวข้ออื่นที่ไม่ใช่ T002/T003 (ยกเว้น `CP-ACCEPTANCE`) ใช้กำหนดของ `T000` เหมือนเดิม
- หารอบ: `student.coop.coopPeriodId` + `student.major` → `CoopPeriodMajor.deadlines[step]` · รอบนั้นยังไม่ตั้งขั้นนั้น → ตรรกะเดิมทั้งก้อน (`readEffective` + วันเริ่ม/`isOpen`/วันสิ้นสุด) แล้วค่อยใช้กฎส่งแก้ทับ · **นักศึกษาไม่มีรอบ** (`coopPeriodId = null`) → ไม่มีกำหนด (ส่งได้) — เจ้าหน้าที่เห็นได้จากตัวกรอง "ยังไม่เลือกรอบ"
- ไม่กรอกค่าจาก PDF ให้ — เจ้าหน้าที่กรอกเอง · คัดลอกจากรอบก่อนได้**เฉพาะเทอมเดียวกัน** เลื่อนปีตามผลต่าง `academicYear`
- สิทธิ์ (ต่อจากหน้า coop-period เดิม): **อาจารย์ประจำวิชา** เพิ่มรอบได้ (มีอยู่แล้ว `coopPeriodController.createPeriod`) · ตั้งกำหนดส่ง/โหมด/สวิตช์ของหลักสูตรที่ดูแล · คัดลอกจากรอบก่อนเฉพาะหลักสูตรที่ดูแล · ขยายเวลานักศึกษาในหลักสูตร — ขอบเขตด้วย `getMajorScope`/`targetMajors`/`studentInScope` · **ค่าตั้งต้นของวิทยาลัย** (`CoopPeriod.deadlines`) = staff เท่านั้น · แถวหลักสูตรที่สร้างใหม่ได้ค่าวิทยาลัยติดมา · route ใหม่ลงตาราง `__tests__/routes/*.permissions.test.js` + label ไทยใน `utils/auditActions.js`
- ไม่แตะการเปลี่ยนสถานะ (`QUALIFIED → WAITING_FOR_STAFF_CHECK` ตอนส่ง T000 ครั้งแรก เป็นงานแยกที่ผู้ใช้เลื่อนไว้)
- `{ ok, ... }` · try/catch · CHANGELOG ทุก commit · baseline unit 1599 / e2e 133 / tsc 23 (ห้ามเพิ่ม) · ค้นโค้ดตามกฎใน CLAUDE.md · ถามผู้ใช้ก่อนเปิด dev server

## Review Focus

1. รอบ 1/2569 กับ 2/2569 มีนักศึกษาพร้อมกัน → แต่ละคนใช้แถวของรอบตัวเอง
2. HARD เลย due ส่งครั้งแรก → 403 · ส่งแก้ → ผ่าน · `closed` → 403 แม้มีขยายเวลา · ขยายเวลาหมดอายุ → กลับไป 403 · ขยาย T002 ไม่เปิด T003
3. บันทึกค่าวิทยาลัย → เปลี่ยนเฉพาะหลักสูตรที่ติ๊ก · ที่ไม่ติ๊กไม่เปลี่ยนเลย
4. รอบที่ยังไม่ตั้ง → ผลเท่า `checkSystemOpen` เดิม (รวมวันเริ่มที่ยังไม่ถึง) **ยกเว้นการส่งแก้** · นักศึกษาไม่มีรอบ → ส่งได้
5. T000 อัปโหลดทีละหัวข้อ → `submittedSteps.T000` ถูกบันทึกตอนครบหัวข้อบังคับเท่านั้น และไม่ถูกทับตอนส่งแก้

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/utils/deadlines.js` (ใหม่) | ฟังก์ชันล้วน: ตรวจรูป, ประเมินกำหนด, ประเมินแบบเดิม, ใช้ค่าวิทยาลัยกับหลักสูตรที่เลือก, เลื่อนปี |
| `backend/utils/resolveDeadline.js` (ใหม่) | อ่านรอบ/ขยายเวลา/สถานะของนักศึกษา แล้วเรียกฟังก์ชันล้วน |
| `backend/utils/submittedSteps.js` (ใหม่) | ตัดสินว่า "ส่งแล้ว" เมื่อไหร่ + บันทึกในทรานแซกชันอัปโหลด |
| `backend/prisma/schema.prisma` + migration | `CoopPeriod.deadlines`, `CoopPeriodMajor.deadlines`, `StudentCoop.deadlineExtensions`, `StudentCoop.submittedSteps` (ทั้งหมด `Json?` migration เดียว) |
| `backend/scripts/backfill_submitted_steps.js` (ใหม่) | เติม `submittedSteps` ของคนที่ส่งก่อน deploy |
| `backend/controllers/coopPeriodController.js` | API ปฏิทินของรอบ + ค่าวิทยาลัยติดมากับแถวใหม่ |
| `backend/controllers/docController.js`, `coopController.js`, `adminDocController.js`, `configController.js`, `backend/utils/majorConfig.js` | จุดตัดสิน + API นักศึกษาคืนรูปเดิม + เอาที่ตั้งวันเดิมออก |
| `Frontend/src/components/A_RoundDeadlines.tsx` (ใหม่) | ตารางปฏิทิน ฝังใน `A_CoopPeriod.tsx` |
| `Frontend/src/components/DeadlineExtensionButton.tsx` (ใหม่) | ปุ่ม + หน้าต่างขยายเวลา ใช้ในหน้าตรวจ/แก้นักศึกษา |
| `Frontend/src/utils/deadlines.ts` (ใหม่) | ป้ายสถานะ, หลักสูตรที่ควรติ๊กไว้ก่อน |

---

## ช่วง A — วันผูกรอบ + ตั้งค่าที่เดียว + ขยายเวลา

### Task 0: Commit งานค้าง

**Files:** `Frontend/src/components/{A_DocT000,A_CoopApplications,T_Requests,A_SupervisionManage,T_SupervisionReview,LetterZipModal}.tsx`, `CHANGELOG.md`

- [ ] **Step 1:** `npx tsc -p tsconfig.app.json --noEmit` ใน `Frontend` → 23 error เดิม
- [ ] **Step 2:** ถามผู้ใช้ก่อนเปิด dev server — ไม่อนุญาต = ระบุใน CHANGELOG ว่ายังไม่ได้ลองในเบราว์เซอร์
- [ ] **Step 3:** CHANGELOG + commit `fix: ตัวเลือกยังไม่เลือกรอบไม่หายระหว่างเลือก + zip modal ไม่ error เมื่อรอบ none`

### Task 1: ฟังก์ชันล้วนของกำหนดส่ง

**Files:** Create `backend/utils/deadlines.js` · Test `backend/__tests__/deadlines.test.js`

**Interfaces — Produces:**
- `STEP_KEYS = ['T000','T002','T003','T005_T006','T007','T008']` · `MODE_STEPS = ['T000','T002','T003']`
- `normalizeDeadlines(input: object|null): Record<StepKey, { due: string|null, mode?: 'HARD'|'SOFT', closed?: boolean }>` — throw `badRequest` (400) เมื่อ key แปลก, วันผิดรูป, `mode`/`closed` บนขั้นที่ไม่ใช่ `MODE_STEPS`
- `evaluateDeadline(entry|null, now: Date, opts?: { resubmission?: boolean, extensionUntil?: string|null }): { configured: boolean, due: string|null, mode: 'HARD'|'SOFT', closed: boolean, canSubmit: boolean, late: boolean }`
- `evaluateLegacyWindow(config: { startDate, endDate, isOpen }|null, now: Date, opts?: { resubmission?: boolean }): ReturnType<evaluateDeadline>` — ย้ายตรรกะ `checkSystemOpen` (`docController.js:15-55`) มาเป็นฟังก์ชันล้วน (ไม่มี config = เปิด · `isOpen=false` = ปิด · ยังไม่ถึงวันเริ่ม = ปิด · เลยวันสิ้นสุด = ปิด) แล้วใช้กฎส่งแก้ทับ
- `applyCollegeChange(oldCollege, newCollege, rows: Array<{ major, deadlines }>, applyTo: string[]): Array<{ major, deadlines }>` — เฉพาะ major ใน `applyTo` · เขียนทับเฉพาะขั้นที่ค่าวิทยาลัยเปลี่ยนในครั้งนี้
- `shiftYears(deadlines, years: number)` — เลื่อน `due` ทุกขั้น (29 ก.พ. → 28 ก.พ.) · คง `mode`/`closed`

- [ ] **Step 1: เทสต์ล้ม**
  - `null → configured=false, canSubmit=true, late=false`
  - `HARD due 2026-07-03 ณ 2026-07-03T16:59:59Z → canSubmit=true · ณ 17:00:00Z → canSubmit=false, late=true`
  - `SOFT เลย due → canSubmit=true, late=true`
  - `HARD เลย due + resubmission → canSubmit=true, late=false`
  - `HARD เลย due + extensionUntil 2026-07-10 ณ 2026-07-08 → canSubmit=true, late=true · ณ 2026-07-11 → false`
  - `closed=true + extensionUntil อนาคต → canSubmit=false · closed=true + resubmission → canSubmit=true`
  - `evaluateLegacyWindow`: ชุดเดียวกับเทสต์ `checkSystemOpen` เดิมใน `docController.test.js` ให้ผลเท่ากัน · `startDate` อนาคต → `canSubmit=false` · + resubmission → `true`
  - `applyCollegeChange`: เปลี่ยน T002 แล้ว `applyTo=['CS']` → CS.T002 ใหม่, AI ไม่เปลี่ยน · ขั้นที่ค่าวิทยาลัยไม่เปลี่ยน → ไม่แตะแม้อยู่ใน `applyTo`
  - `normalizeDeadlines({T007:{due:'2026-10-23', mode:'HARD'}}) → 400` · `{X:{}} → 400` · `{T000:{due:'2026-13-01'}} → 400`
  - `shiftYears({T000:{due:'2028-02-29', mode:'SOFT'}}, 1) → { T000: { due:'2029-02-28', mode:'SOFT' } }`
- [ ] **Step 2:** `npx jest __tests__/deadlines.test.js` → FAIL
- [ ] **Step 3:** เขียนตาม Interfaces (`periodCloseAt` สำหรับเวลาปิด)
- [ ] **Step 4:** รันซ้ำ → PASS
- [ ] **Step 5:** commit `feat: ตรรกะกำหนดส่งของขั้น (HARD/SOFT/ปิดชั่วคราว/ส่งแก้/ขยายเวลา)`

### Task 2: Schema

**Files:** `backend/prisma/schema.prisma`, migration ใหม่ (skill `migrate-db`)

- [ ] **Step 1:** เพิ่ม `deadlines Json?` ใน `CoopPeriod`, `CoopPeriodMajor` · `deadlineExtensions Json?`, `submittedSteps Json?` ใน `StudentCoop`
- [ ] **Step 2:** สร้าง migration ตรวจ SQL เป็น `ADD COLUMN` 4 บรรทัดอย่างเดียว · `npx prisma generate`
- [ ] **Step 3:** unit ทั้งชุดผ่านเท่าเดิม → commit `feat: คอลัมน์ปฏิทินของรอบ + ขยายเวลา + เวลาส่งของขั้น`

### Task 3: จุดตัดสิน + บันทึกเวลาส่ง + API นักศึกษาคืนรูปเดิม

**Files:** Create `backend/utils/resolveDeadline.js`, `backend/utils/submittedSteps.js`, `backend/scripts/backfill_submitted_steps.js` · Modify `backend/controllers/docController.js` (`checkSystemOpen` :15-55 + เรียกที่ :179, เช็กในทรานแซกชัน :206-223, ส่วน T002/T003/อื่น ๆ :262-290), `coopController.js` (:52-57), `adminDocController.js` (`getT000Config` :89 ใช้ร่วม `adminRoutes.js:37` กับ `coopRoutes.js:37` → แยกฟังก์ชันฝั่งนักศึกษา), `configController.js` (get ฝั่งนักศึกษาของ t002/t003/evaluation/t007/t008/apply · ลบ `getDocConfig`/`checkSystemOpen` :8-37 ที่ไม่มีใครเรียก) · Test `backend/__tests__/resolveDeadline.test.js`, `backend/__tests__/submittedSteps.test.js`, แก้ `docController.test.js`, `adminDocController.test.js`, `applyWindow.test.js`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `resolveDeadline(stepKey, { studentId }, db = prisma, now = new Date()): Promise<ReturnType<evaluateDeadline> & { source: 'ROUND'|'LEGACY'|'NO_ROUND', periodId: number|null, startDate: string|null }>` — อ่าน `student.major`, `coop.coopPeriodId`, `coop.status` (→ `resubmission`), `coop.deadlineExtensions[stepKey]` · `startDate` = `CoopPeriodMajor.startDate` ของแถวรอบ (`YYYY-MM-DD`) หรือ `startDate` ของค่าเดิม
  - `markSubmitted(tx, { studentId, stepKey, major, now }): Promise<void>` — ไม่มีค่าเดิมเท่านั้นจึงเขียน · `T000`: เช็กว่าหัวข้อบังคับของหลักสูตร (`isRequired && isActive` + `appliesTo(withRules(req), major)`) มีเอกสารครบหลังอัปโหลดนี้
  - API นักศึกษาคืนรูปเดิม: กลุ่มช่วง → `{ isOpen: canSubmit, startDate, endDate: due, late, closed }` (ห้าม `startDate: null` เมื่อมีรอบ — นับถอยหลังใน `S_Dashboard.tsx:163` ต้องการ) · T005–T008 → ค่าเดิม (ลิงก์) โดย `deadline` = `due` ของรอบ · `/config/apply` → รูปเดิมทุกช่อง **รวม `state`** (`S_Dashboard.tsx:46`) ตัดสินจากแถว `CoopPeriodMajor` ที่เปิดของหลักสูตร
  - `backfill_submitted_steps.js [--dry-run]`: T002/T003 = `uploadedAt` ของ `Document` ประเภท `T002_FORM`/`T003_FORM` · T000 = `uploadedAt` ล่าสุดของหัวข้อบังคับเมื่อครบ · เขียน `{ at, backfill: true }` · ไม่ทับค่าที่มี · รันซ้ำได้

- [ ] **Step 1: เทสต์ล้ม** — Review Focus 1, 2, 4, 5 · เอกสารหัวข้ออื่นใช้ T000 · ใบตอบรับไม่ติดกำหนด · ร่าง T002/T003 (`saveT002Form`/`saveT003Form`) ไม่ติดกำหนด (ไม่แตะ)
- [ ] **Step 2:** รัน → FAIL
- [ ] **Step 3:** เขียน `resolveDeadline`/`markSubmitted` · แทนเช็กสองจุดใน `docController` ด้วยตัวเดียว (ในทรานแซกชันส่ง `db = tx`; ย้ายเช็กไปหลังหา `student`) · เรียก `markSubmitted` ในทรานแซกชันเดียวกับการอัปโหลด · `submitCoopApplication` เอาเช็ก `APPLY_CONFIG` ออก
- [ ] **Step 4:** พิมพ์ `APPLY_CONFIG` ใน DB dev (ตอนนี้ไม่มี) · ใส่ใน CHANGELOG: ก่อน deploy เช็กค่านี้บน VM เทียบวันปิดรอบ · รัน `backfill --dry-run` กับ DB dev ดูผล
- [ ] **Step 5:** unit ทั้งชุด → 1599 + ใหม่ · commit `feat: ตัดสินกำหนดส่งจากรอบของนักศึกษา + บันทึกเวลาส่งของขั้น + ส่งแก้ได้เสมอ`

### Task 4: API ปฏิทินของรอบ + ขยายเวลา

**Files:** `backend/controllers/coopPeriodController.js` (+ `createPeriod` :60 และส่วนสร้างแถวใน `updatePeriod`), controller ขยายเวลา (ใน `adminDocController.js` หรือไฟล์ใหม่ `deadlineExtensionController.js`), `backend/routes/adminRoutes.js`, `backend/utils/auditActions.js` · Test `backend/__tests__/coopPeriodDeadlines.test.js`, `backend/__tests__/deadlineExtension.test.js` + `admin.permissions.test.js`

**Interfaces — Produces (ใต้ `/api/admin`):**
- `GET /coop-periods/:id/deadlines` → `{ ok, college, majors: Array<{ major, deadlines, startDate }>, legacy: Record<StepKey, { startDate, endDate, isOpen }|null> }` (อาจารย์ประจำวิชาเห็นเฉพาะหลักสูตรในขอบเขต · `legacy` = ค่าเดิมที่ใช้อยู่เมื่อรอบยังไม่ตั้ง — N4)
- `PUT /coop-periods/:id/deadlines` body `{ major: '' | code, deadlines, applyTo?: string[] }` → `major=''` (staff เท่านั้น) บันทึกค่าวิทยาลัย + `applyCollegeChange` กับ `applyTo` · หลักสูตร → บันทึกแถวนั้น
- `POST /coop-periods/:id/deadlines/copy` body `{ fromPeriodId }` → เทอมต้องตรงกัน (ไม่ตรง → 400) · `shiftYears` ตามผลต่างปี · ไม่ทับขั้นที่ปลายทางมีค่า → `{ ok, copied, kept }` · อาจารย์ประจำวิชา = เฉพาะแถวหลักสูตรที่ดูแล ไม่แตะค่าวิทยาลัย
- `PUT /students/:id/deadline-extension` body `{ stepKey ∈ MODE_STEPS, until, reason }` · `DELETE /students/:id/deadline-extension/:stepKey` (`studentInScope`; `until` ย้อนหลัง → 400; บันทึก log พร้อมเหตุผล)
- แถวหลักสูตรที่สร้างใหม่ (`createPeriod`, `updatePeriod`) → `deadlines` = `CoopPeriod.deadlines`

- [ ] **Step 1: เทสต์ล้ม** — Review Focus 3 · อาจารย์ประจำวิชา CS แก้ AI → 403 · แก้ `major=''` → 403 · รูปผิด → 400 · copy ต่างเทอม → 400 · copy ไม่ทับค่าที่มี · อาจารย์ประจำวิชา CS copy → AI/ค่าวิทยาลัยไม่เปลี่ยน · อาจารย์ประจำวิชา CS เพิ่มรอบที่มีค่าวิทยาลัย → แถว CS ได้ค่าวิทยาลัย · ขยายเวลานักศึกษานอกหลักสูตร → 403 · `stepKey='T007'` → 400
- [ ] **Step 2:** เขียน controller + routes + label ไทย → เทสต์ผ่าน (รวมตารางสิทธิ์)
- [ ] **Step 3:** commit `feat: API ปฏิทินของรอบ + ขยายเวลารายคน`

### Task 5: หน้าตั้งค่าใน `/admin/coop-period` + เอาที่ตั้งวันเดิมออก

**Files:** Create `Frontend/src/components/A_RoundDeadlines.tsx`, `Frontend/src/utils/deadlines.ts` · Modify `A_CoopPeriod.tsx`, `A_CoopApplications.tsx`, `A_DocT000.tsx`, `A_DocT002Review.tsx`, `A_DocT003Review.tsx`, `A_DocT005_006.tsx`, `A_DocT007.tsx`, `A_DocT008.tsx` · Delete `A_ApplyWindowCard.tsx` · Backend (ย้ายมาทำที่นี่ให้ commit ไม่พังระหว่างทาง — N1): ลบ `saveT000Config`/`saveT002Config`/`saveT003Config`/`saveApplyConfig` + route ใน `adminRoutes.js` · `backend/utils/majorConfig.js` `REGISTRY` เอา `APPLY_CONFIG`/`T000_CONFIG`/`T002_CONFIG`/`T003_CONFIG` ออก และเอาช่อง `deadline` ออกจาก `EVALUATION_FORMS`/`CONFIG_T007`/`CONFIG_T008` (ค่าใน DB ยังอยู่ให้ทางค่าเดิมอ่าน) · Test `Frontend/tests/deadlines.spec.ts` + แก้ `majorConfig.test.js`, `routes/admin.permissions.test.js`, `routes/all.permissions.test.js`

**Interfaces — Produces:**
- `deadlineStatus(w: { due, mode, closed, canSubmit, late }, now: Date): { text: string, tone: 'ok'|'warn'|'closed'|'info' }`
- `suggestApplyTo(oldCollege, newCollege, rows): string[]` — หลักสูตรที่ค่าเท่าค่าวิทยาลัยเดิมในทุกขั้นที่เปลี่ยน (ติ๊กไว้ให้ก่อน)

- [ ] **Step 1:** เทสต์ `deadlineStatus` (เหลือ N วัน · ไม่มีกำหนด · ปิดชั่วคราว · HARD เลย "ปิดแล้ว" · SOFT เลย "ส่งช้าได้") + `suggestApplyTo` → FAIL → เขียน → PASS
- [ ] **Step 2:** `A_RoundDeadlines` ในแต่ละรอบของ `A_CoopPeriod`: คอลัมน์ "ทั้งวิทยาลัย" (staff แก้ได้ / อาจารย์ประจำวิชาอ่านอย่างเดียว) + หลักสูตร · แถวขั้น: ยื่นคำร้องและนิเทศอ่านจากข้อมูลเดิมของหน้า (ลิงก์ไปที่ตั้ง) · กำหนดส่ง + โหมด + สวิตช์ปิดรับชั่วคราว (เฉพาะ T000/T002/T003) · ช่องที่ต่างจากวิทยาลัยไฮไลต์ · บันทึกค่าวิทยาลัย → หน้าต่างติ๊กเลือกหลักสูตร (`suggestApplyTo` ติ๊กไว้ก่อน) · รอบที่ยังไม่ตั้ง → แสดง "ใช้ค่าเดิม: …" จาก `legacy` · ปุ่ม "คัดลอกจากรอบก่อน" (เสนอเทอมเดียวกันของปีก่อน) · เพิ่มรอบเสร็จ → เปิดส่วนปฏิทินของรอบนั้นต่อ · มือถือเป็นรายการต่อหลักสูตร (`minmax(min(100%, …))`)
- [ ] **Step 3:** หน้าตรวจ T000/T002/T003: เอาการ์ดตั้งช่วง + `MajorConfigTabs` ส่วนวันออก → แสดงกำหนดของรอบที่เลือก + ลิงก์ "แก้ที่รอบสหกิจ" · `A_CoopApplications`: เอา `A_ApplyWindowCard` ออก แสดงวันปิดรอบ + ลิงก์ · T005–T008: เอาเฉพาะช่อง "กำหนดส่ง" ออก ลิงก์/รูป/แท็บหลักสูตรของลิงก์ใช้ต่อ · ลบ route/`REGISTRY` ฝั่ง backend ใน commit เดียวกัน
- [ ] **Step 4:** unit + tsc ≤ 23 · เบราว์เซอร์ (ถ้าผู้ใช้อนุญาต) staff + อาจารย์ประจำวิชา × 390px/1400px ไม่มี error
- [ ] **Step 5:** CHANGELOG + commit `feat: ตั้งปฏิทินของรอบที่หน้ารอบสหกิจ (ที่เดียว)`

### Task 6: ปุ่มขยายเวลา

**Files:** Create `Frontend/src/components/DeadlineExtensionButton.tsx` · Modify `A_DocT000.tsx`, `A_DocT002Review.tsx`, `A_DocT003Review.tsx`, `A_StudentEditModal.tsx` · backend: รายการตรวจ T000/T002/T003 ใน `adminDocController.js` ส่ง `deadlineExtensions` ของแต่ละคนมาด้วย

- [ ] **Step 1:** ปุ่ม "ขยายเวลา" (ขั้น + วันที่ + เหตุผล) แสดงวันที่ขยายอยู่ + ปุ่มยกเลิก · เรียก API ของ Task 4
- [ ] **Step 2:** ยิง API จริง: นักศึกษา HARD เลย due → 403 → ขยาย → ส่งได้ → ยกเลิก → 403
- [ ] **Step 3:** tsc ≤ 23 · CHANGELOG + commit `feat: ปุ่มขยายเวลารายคนในหน้าตรวจ`

## ช่วง B — ป้ายส่งช้า

### Task 7: ป้ายในรายการตรวจ

**Files:** `adminDocController.js` (รายการ T000/T002/T003 ส่ง `submittedAt`, `late`, `overdueNotSubmitted` ของแต่ละคน คำนวณจาก `submittedSteps` + กำหนดของรอบ/หลักสูตรนั้น) · `A_DocT000.tsx`, `A_DocT002Review.tsx`, `A_DocT003Review.tsx` · Test ใน `adminDocController.test.js`

- [ ] **Step 1:** เทสต์: ส่งหลัง due → `late=true` · ส่งก่อน → `false` · แถว `backfill` → ไม่ติด `late` · เลย due ยังไม่ส่ง + อยู่ในขั้นที่ส่งได้ → `overdueNotSubmitted=true` → FAIL → เขียน → PASS
- [ ] **Step 2:** ป้าย "ส่งช้า" / "เลยกำหนด ยังไม่ส่ง" ในตาราง
- [ ] **Step 3:** CHANGELOG + commit `feat: ป้ายส่งช้าในรายการตรวจ`

## ช่วง C — นักศึกษาเห็นกำหนดของตัวเอง

### Task 8: ไทม์ไลน์ + เตือนก่อนปิด

**Files:** `coopController.js` + `coopRoutes.js` (`GET /api/coop/round-deadlines` → `{ ok, period, steps: Array<{ stepKey, label, due, mode, closed, canSubmit, late, submittedAt, extensionUntil }> }` รวมยื่นคำร้องและช่วงนิเทศ) · `S_Dashboard.tsx` (ต่อจาก countdown เดิม :133-200) · Create `backend/utils/deadlineReminders.js` + เริ่มใน `server.js` แบบ `startRetentionJob` · Test `backend/__tests__/deadlineReminders.test.js`

**Interfaces — Produces:** `findStudentsToRemind(stepKey, now, db): Promise<number[]>` (user id) — เงื่อนไขครบทุกข้อ: โหมด HARD · เหลือ ≤ 3 วัน (นับจาก `extensionUntil` ถ้ามี) · ยังไม่มี `submittedSteps[stepKey]` · อยู่ในขั้นที่ส่งได้ (`T000` = `QUALIFIED` · `T002` = `INTERNSHIP_STARTED` · `T003` = `T002_SUBMITTED` — ชุดเดียวกับที่ `docController` อนุญาตส่งครั้งแรก) · ไม่ `closed` · กันซ้ำด้วยกลไกเดิมของ `createNotifications`

- [ ] **Step 1:** เทสต์ endpoint: เห็นเฉพาะรอบ/หลักสูตรตัวเอง (ลง `all.permissions.test.js`) · เทสต์ reminder ทุกเงื่อนไขข้างบน (ครบ → แจ้ง · ขาดข้อใดข้อหนึ่ง → ไม่แจ้ง) → FAIL → เขียน → PASS
- [ ] **Step 2:** รายการขั้นบนหน้าแรกนักศึกษา ใช้ `deadlineStatus` · ขั้นที่ส่งแล้วแสดงวันที่ส่ง
- [ ] **Step 3:** unit + e2e + tsc ครบ · CHANGELOG + commit `feat: ไทม์ไลน์กำหนดส่งของนักศึกษา + เตือนก่อนปิด`

---

## Self-Review

- **Coverage:** วันผูกรอบ (T2–T3) · หลักสูตรต่างจากวิทยาลัย + ค่าวิทยาลัยเฉพาะ staff (T1 `applyCollegeChange`, T4–T5) · อาจารย์ประจำวิชาเพิ่มรอบ/ตั้งกำหนด (T4–T5) · เลือกโหมด + ปิดชั่วคราว (T1, T5) · ส่งแก้ได้เสมอ (T1, T3) · ที่ตั้งค่าที่เดียว (T3, T5) · ขยายเวลาในช่วง A (T4, T6 — M1) · นักศึกษาไม่มีรอบ = ส่งได้ (T3 — M2) · ค่าเดิมคงวันเริ่ม (T1 `evaluateLegacyWindow` — M3) · "ส่งแล้ว" กฎเดียว (T3 `submittedSteps` — M4) · ติ๊กเลือกหลักสูตร (S1) · ลบที่ตั้งเดิมพร้อม frontend (T5 — N1) · copy เทอมเดียวกัน (T4 — N2) · `/config/apply` คง `state` (T3 — N3) · แสดงค่าเดิมของรอบที่ยังไม่ตั้ง (T4–T5 — N4)
- **ความเสี่ยงที่ต้องบอกผู้ใช้:** (1) เอา `APPLY_CONFIG` ออก — ถ้าบน VM ตั้งปิดเร็วกว่าวันปิดรอบ ช่วงยื่นคำร้องจะยาวขึ้น (T3 Step 4) (2) ส่งแก้ได้เสมอเปลี่ยนพฤติกรรมเดิม (ผู้ใช้เลือกแล้ว) (3) เวลา backfill ของ T002/T003 อาจเป็นเวลาส่งแก้ครั้งล่าสุด จึงไม่ใช้ติดป้ายส่งช้า (4) ค่า `SystemConfig` เดิมยังถูกอ่านสำหรับรอบที่ยังไม่ตั้ง — ถอดได้เมื่อทุกรอบที่ใช้งานตั้งปฏิทินแล้ว (งานแยก)
- **ไม่ทำ:** นิเทศครั้งที่ 2 · ขั้นที่ทำนอกระบบ · ปิด/ติดป้ายส่งช้า T005–T008 · วันเปิดของ T000–T003 (สถานะคุมอยู่แล้ว) · กรอกค่าจาก PDF · เปลี่ยนสถานะตอนส่ง T000 ครั้งแรก (เลื่อนไว้)
