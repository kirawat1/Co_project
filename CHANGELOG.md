# CHANGELOG — Co_project

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
