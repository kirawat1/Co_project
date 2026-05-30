# Planning: UX/UI Improvements — ระบบจัดการสหกิจศึกษา

> อัปเดต: 2026-05-15  
> ครอบคลุม: นักศึกษา · อาจารย์ · เจ้าหน้าที่  
> แนวทาง: จัดลำดับ High → Medium → Low priority ตามผลกระทบต่อผู้ใช้

---

## สารบัญ

1. [ปัญหาร่วมทุก Role](#1-ปัญหาร่วมทุก-role)
2. [นักศึกษา (Student)](#2-นักศึกษา-student)
3. [อาจารย์ (Teacher)](#3-อาจารย์-teacher)
4. [เจ้าหน้าที่ (Staff/Admin)](#4-เจ้าหน้าที่-staffadmin)
5. [Component & System Level](#5-component--system-level)

---

## 1. ปัญหาร่วมทุก Role

### 🔴 HIGH — ต้องแก้ก่อน

#### 1.1 Feedback หลังกดปุ่มบันทึก/ส่ง
- **ปัญหา:** หลาย action ใช้ `alert()` ซึ่งแสดงเป็น popup ของ browser ดูไม่ professional  
- **แก้:** สร้าง Toast Notification component (`<Toast type="success|error|info" message="" />`) แสดงที่มุมบนขวา 3 วินาที แล้วหายไปเอง  
- **ไฟล์ที่ต้องสร้าง:** `Frontend/src/components/Toast.tsx`  
- **ไฟล์ที่ต้องแก้:** ทุก component ที่มี `alert(...)` — ประมาณ 20+ ไฟล์

#### 1.2 Loading State ของปุ่ม
- **ปัญหา:** บางหน้าปุ่ม disabled แต่ไม่มี spinner ผู้ใช้ไม่รู้ว่ากำลังโหลดอยู่  
- **แก้:** เพิ่ม spinner icon บนปุ่มขณะ `loading = true` เช่น `{loading ? <Spinner /> : 'บันทึก'}`  
- **ไฟล์ที่ต้องแก้:** S_Gateway.tsx, S_DocsT002Form.tsx, S_DocsT003Form.tsx, A_CoopApplications.tsx, A_DocT002Review.tsx, A_DocT003Review.tsx

#### 1.3 Error State หน้า Empty
- **ปัญหา:** เมื่อ API error หรือข้อมูลว่าง บางหน้าแสดง blank หรือ error code  
- **แก้:** สร้าง `<EmptyState icon="..." message="..." action={...} />` component ใช้เมื่อไม่มีข้อมูล พร้อม retry button  
- **ตัวอย่าง:** A_Students หากค้นหาไม่เจอ ให้แสดง "ไม่พบนักศึกษา" พร้อมล้างตัวกรอง

#### 1.4 Confirm Dialog ก่อนลบ/ส่ง action สำคัญ
- **ปัญหา:** ใช้ `confirm()` ของ browser ซึ่งดูเก่า และบาง browser บล็อก  
- **แก้:** สร้าง `<ConfirmDialog title="" message="" onConfirm onCancel />` component  
- **ใช้ใน:** การลบไฟล์, การ Reject เอกสาร, การลบบริษัท/อาจารย์

---

### 🟡 MEDIUM

#### 1.5 Keyboard Navigation
- **ปัญหา:** Custom dropdown ใน S_ProfilePage, S_Company ไม่รองรับ Tab/Enter navigation  
- **แก้:** เพิ่ม `onKeyDown` handler บน dropdown items และ close on Escape

#### 1.6 Responsive Table
- **ปัญหา:** ตารางข้อมูลนักศึกษา, ตาราง T003 work plan ล้นหน้าจอบนมือถือ  
- **แก้:** เพิ่ม `overflow-x: auto` wrapper และ horizontal scroll indicator บนตาราง

#### 1.7 Form Validation Real-time
- **ปัญหา:** validate เฉพาะตอน submit ทำให้ผู้ใช้รู้ข้อผิดพลาดช้า  
- **แก้:** เพิ่ม `onBlur` validation บน input ที่สำคัญ (email, เบอร์โทร, GPA)

---

## 2. นักศึกษา (Student)

### 🔴 HIGH

#### 2.1 S_Dashboard — แสดงสถานะปัจจุบันชัดเจนขึ้น
- **ปัญหา:** Dashboard ไม่แสดงสถานะคำร้องสหกิจ ต้องไปดูที่หน้า Gateway เอง  
- **แก้:** เพิ่ม "สถานะปัจจุบัน" card ที่ top ของ Dashboard แสดง `<StatusBadge>` + ข้อความสรุปว่าต้องทำอะไรต่อ  
- **ตัวอย่าง:** "📋 สถานะ: รอตรวจเอกสาร — กรุณารอเจ้าหน้าที่ตรวจสอบ T000"  
- **ไฟล์:** `S_Dashboard.tsx` — เพิ่ม API call `/api/students/me` แล้วแสดง status card

#### 2.2 S_Gateway — Step Indicator / Progress Bar
- **ปัญหา:** ผู้ใช้ไม่รู้ว่าตัวเองอยู่ขั้นตอนไหนของกระบวนการสมัคร  
- **แก้:** เพิ่ม Stepper component ด้านบนหน้า Gateway แสดง 4 ขั้นตอน:
  ```
  [1. กรอกข้อมูล] → [2. อัปโหลดเอกสาร] → [3. รอตรวจสอบ] → [4. สำเร็จ]
  ```
  ไฮไลท์ขั้นตอนปัจจุบันตามค่า `currentStatus`

#### 2.3 S_Gateway — แสดงเหตุผลที่ต้องแก้ไขชัดเจน
- **ปัญหา:** เมื่อสถานะเป็น `EDITS_REQUIRED` ข้อความ comment อยู่ใน box เล็กมาก  
- **แก้:** แสดง comment box แบบ full-width พร้อม border สีส้ม และ header "สิ่งที่ต้องแก้ไข" ชัดเจน  
- **เพิ่ม:** แสดง timestamp ว่า comment นี้มาจากเมื่อไหร่

#### 2.4 S_Docs (T000) — Required Field Indicators
- **ปัญหา:** ไม่มีการแสดงว่าช่องไหน required ชัดเจน  
- **แก้:** เพิ่ม `*` สีแดงที่ label ของ required fields ทุกช่อง  
- **เพิ่ม:** Progress bar แสดง % ที่กรอกครบแล้ว เช่น "กรอกข้อมูลแล้ว 7/12 ช่อง"

#### 2.5 S_DocsT002Form — Auto-fill ข้อมูลบริษัท
- **ปัญหา:** ผู้ใช้ต้องกรอกข้อมูลบริษัทซ้ำทั้งที่มีอยู่ใน Profile แล้ว  
- **แก้:** เมื่อโหลดหน้า ดึงข้อมูล company จาก `/api/students/me` แล้ว pre-fill ช่องชื่อบริษัท, ที่อยู่, เบอร์โทร  
- **ประโยชน์:** ลดเวลากรอกข้อมูลซ้ำ ~5 นาที

#### 2.6 S_DocsT003Form — Work Plan Table UX
- **ปัญหา:** ตารางแผนงาน 16 สัปดาห์อ่านยากบนมือถือ checkbox เล็กมาก  
- **แก้:**  
  - เพิ่ม "เลือกทั้งแถว" button ทางซ้ายของแต่ละ task  
  - เพิ่ม "ล้างทั้งหมด" / "เลือกทั้งหมด" button  
  - Mobile: แสดงเป็น vertical list แทน horizontal table

#### 2.7 S_Supervision — Time Slot Selection
- **ปัญหา:** Dropdown เวลามี 19 ตัวเลือก (ทุก 30 นาที) ยาวมาก  
- **แก้:** เปลี่ยนเป็น Time Grid แบบ "คลิกช่วงเวลา" แทน dropdown  
  ```
  08:00  08:30  09:00  09:30 ...
  [ ]    [ ]    [✓]    [ ]   ...
  ```
- **เพิ่ม:** แสดงป้าย "นิเทศวันนี้" / "จองแล้ว" บนปฏิทิน

---

### 🟡 MEDIUM

#### 2.8 S_Dashboard — Search/Filter ประกาศ
- **ปัญหา:** แสดงแค่ 5 ล่าสุด ไม่มีช่องค้นหา  
- **แก้:** เพิ่มปุ่ม "ดูทั้งหมด" → หน้าประกาศแบบ full page พร้อม search + filter ตามปีการศึกษา

#### 2.9 S_StatusTracker — เพิ่ม Action Buttons
- **ปัญหา:** Timeline เป็น read-only ไม่มีปุ่ม action  
- **แก้:** แต่ละ step แสดง "ไปยังหน้านี้ →" button link ไปยัง page ที่เกี่ยวข้อง  
- **เพิ่ม:** ปลดล็อค Step 5 (T004 Report) ที่ถูก comment ออก

#### 2.10 S_Company — Filter เพิ่มเติม
- **ปัญหา:** ค้นหาได้แค่ชื่อบริษัท/จังหวัด/email  
- **แก้:** เพิ่มกรองตาม "ประเภทธุรกิจ" และ "มีนักศึกษาของฉัน/ไม่มี"

#### 2.11 Deadline Countdown บน Dashboard
- **ปัญหา:** ไม่มีการแสดงว่าเหลือเวลาเท่าไหรก่อนปิดรับ  
- **แก้:** ใช้ `CountdownTimer` component (มีอยู่แล้วในโปรเจกต์) แสดงบน S_Dashboard สำหรับ deadline ที่ใกล้ที่สุด

---

### 🟢 LOW

#### 2.12 PDF Preview Enhancement
- **ปัญหา:** iframe PDF preview ใช้ `invert()` filter ใน dark mode ทำให้ signature/stamp เสียหาย  
- **แก้:** เพิ่ม toggle "ดู PDF แบบปกติ" ที่ปิด dark mode filter ชั่วคราว

#### 2.13 File Upload — Drag & Drop
- **แก้:** เพิ่ม drag-and-drop zone แทนปุ่ม input file ธรรมดา  
- **แสดง:** Preview thumbnail ของ PDF/รูปก่อนอัปโหลด

---

## 3. อาจารย์ (Teacher)

### 🔴 HIGH

#### 3.1 T_Dashboard — ภาพรวมนักศึกษาที่ดูแล
- **ปัญหา:** Dashboard ไม่มีข้อมูลสรุปที่ชัดเจนว่ามีนักศึกษาคนไหนรอการอนุมัติอะไร  
- **แก้:** เพิ่ม "Action Required" section แสดงรายการที่ต้องทำ:
  ```
  📋 รอตรวจ T002: 3 คน
  📋 รอตรวจ T003: 1 คน  
  📅 รอยืนยันวันนิเทศ: 2 คน
  ```
  แต่ละรายการ clickable → ไปยังหน้าที่เกี่ยวข้อง

#### 3.2 T_Requests / T_T002Review / T_T003Review — Inline Comment Box
- **ปัญหา:** เมื่อ Reject ต้องกรอก comment ใน text field เล็กๆ ไม่มี template  
- **แก้:** เพิ่ม Quick Comment Templates: "รูปแบบเอกสารไม่ถูกต้อง", "ขาดข้อมูล...", "กรุณาแก้ไข..."  
- **เพิ่ม:** Character counter บน textarea comment  
- **ประโยชน์:** ลดเวลากรอก feedback ~2 นาทีต่อครั้ง

#### 3.3 T_SupervisionReview — แสดง Availability ชัดเจนขึ้น
- **ปัญหา:** อาจารย์เห็นวันที่นักศึกษาเสนอ แต่ต้องจำตารางตัวเองเอง  
- **แก้:** เพิ่ม "ปฏิทินของฉัน" mini-view ด้านข้าง แสดงวันที่มีนิเทศอื่นแล้ว  
- **ป้องกัน:** Block ปุ่ม "ยืนยัน" ถ้าวันนั้นมีนิเทศอื่นซ้อนอยู่แล้ว (มี backend check แต่ UX ยังไม่ชัด)

#### 3.4 T_Students — Quick Actions บน Student Card
- **ปัญหา:** ต้องคลิกเปิด Modal เพื่อดูข้อมูล ถ้าแค่อยากรู้สถานะต้องคลิกหลายขั้น  
- **แก้:** แสดง `<StatusBadge>` บน student row โดยตรง  
- **เพิ่ม:** Icon button "ดู T002" / "ดู T003" บนแต่ละ row แบบ quick link

#### 3.5 T_T002Review / T_T003Review — Side-by-side View
- **ปัญหา:** Modal review แสดง PDF กับ info form ซ้อนกัน ต้อง scroll ขึ้นลง  
- **แก้:** เปลี่ยน modal เป็น split-pane layout: PDF ซ้าย, form/comment ขวา (ปัจจุบัน modal-card-split มีแล้ว แต่ PDF อาจไม่ render ถูก)  
- **ตรวจสอบ:** PDF viewer ใน dark mode ว่า invert filter ทำให้ readable

---

### 🟡 MEDIUM

#### 3.6 T_Docs — เพิ่มหน้าดูเอกสารของนักศึกษาแต่ละคน
- **ปัญหา:** T_Docs.tsx มีอยู่แต่ไม่ชัดเจนว่าแสดงอะไร  
- **แก้:** รวม T_Docs เข้ากับ T_Students → tab "เอกสาร" ใน modal ของแต่ละนักศึกษา

#### 3.7 Batch Actions บน T_T002Review
- **แก้:** เพิ่ม checkbox select multiple students → "อนุมัติทั้งหมด" batch action  
- **ใช้กับ:** กรณีที่เอกสารถูกต้องทั้งหมด ไม่ต้องคลิกทีละคน

#### 3.8 Notification Badge บน Sidebar
- **แก้:** แสดง badge จำนวน pending items บน Sidebar icons  
  ```
  T002 เอกสารรายละเอียด (3)  ← badge แดง
  T003 โครงร่างรายงาน (1)
  ```

---

## 4. เจ้าหน้าที่ (Staff/Admin)

### 🔴 HIGH

#### 4.1 A_Dashboard — KPI Cards ที่ meaningful
- **ปัญหา:** Dashboard อาจไม่แสดงตัวเลขสำคัญที่เจ้าหน้าที่ต้องการ  
- **แก้:** เพิ่ม/ปรับ KPI cards:
  - นักศึกษาทั้งหมด / ออกฝึกแล้ว / รอดำเนินการ
  - เอกสารรอตรวจ (T000, T002, T003, T008)
  - นิเทศที่ใกล้ถึง (7 วันข้างหน้า)
  - รอออกหนังสือ

#### 4.2 A_Students — Advanced Search & Filter
- **ปัญหา:** Search อาจจำกัดแค่ชื่อ/รหัส  
- **แก้:** เพิ่มตัวกรอง:
  - สถานะคำร้อง (multi-select dropdown)
  - บริษัท
  - อาจารย์ที่ปรึกษา
  - ปีการศึกษา/ภาคเรียน  
- **Export:** ปุ่ม "Export Excel" รายชื่อนักศึกษาตาม filter

#### 4.3 A_CoopApplications — Bulk Approve/Reject
- **ปัญหา:** ต้องคลิกอนุมัติทีละคน ถ้ามี 50+ คนใช้เวลามาก  
- **แก้:** เพิ่ม checkbox select → "อนุมัติที่เลือก (n คน)" batch action  
- **Safety:** Confirm dialog แสดงรายชื่อก่อน confirm

#### 4.4 A_DocT000 — Quick Approve Flow
- **ปัญหา:** Flow review T000 ยาวเกินไป ต้องคลิกหลายขั้น  
- **แก้:** เพิ่ม "อนุมัติด่วน" button ที่ approve และออก Request Letter ในขั้นตอนเดียว (สำหรับกรณีที่เอกสารครบถ้วน)

#### 4.5 A_SupervisionManage — Calendar View
- **ปัญหา:** รายการนิเทศแสดงเป็น list อ่านยากเมื่อมีหลายรายการ  
- **แก้:** เพิ่ม toggle "มุมมองปฏิทิน" / "มุมมองรายการ"  
- **Calendar:** แสดงนิเทศแต่ละวัน color-coded ตามอาจารย์

#### 4.6 A_Students — Profile Modal ปรับปรุง
- **ปัญหา:** Modal ดูข้อมูลนักศึกษาอาจมีข้อมูลไม่ครบ หรือ layout ไม่ชัด  
- **แก้:** Tab layout ใน modal:
  - "ข้อมูลส่วนตัว" (ชื่อ, รหัส, อีเมล, เบอร์)
  - "ข้อมูลการศึกษา" (สาขา, GPA, หน่วยกิต)  
  - "สถานะสหกิจ" (timeline ขนาดเล็ก)
  - "เอกสาร" (รายการ documents)

---

### 🟡 MEDIUM

#### 4.7 A_Announcements — Rich Text Editor
- **ปัญหา:** กรอก body ประกาศเป็น plain textarea  
- **แก้:** เพิ่ม Markdown preview หรือ simple rich text (bold, bullet, link)  
- **เพิ่ม:** Preview mode ก่อน publish

#### 4.8 A_CoopPeriod — Timeline Visual
- **ปัญหา:** รอบรับสมัครแสดงเป็น list ข้อมูลดิบ  
- **แก้:** แสดง horizontal timeline ของแต่ละ period พร้อม status badge (เปิด/ปิด/อนาคต)

#### 4.9 A_Teacher / A_Mentors — Import/Export
- **แก้:** เพิ่มฟีเจอร์ import อาจารย์/พี่เลี้ยงจาก Excel/CSV  
- **Export:** รายชื่อพร้อมจำนวนนักศึกษาที่ดูแล

#### 4.10 Letter Modals — Preview ก่อน issue
- **ปัญหา:** `IssueLetterModal`, `IssuePlacementLetterModal`, `IssueSupervisionLetterModal` อาจไม่มี preview  
- **แก้:** แสดง PDF preview ของหนังสือก่อนกด "ออกหนังสือ"  
- **เพิ่ม:** ช่องแก้ไขข้อมูลในหนังสือ (วันที่, ชื่อผู้รับ) ก่อน generate

---

### 🟢 LOW

#### 4.11 A_CriteriaPage — Import เกณฑ์
- **แก้:** เพิ่ม import เกณฑ์จากไฟล์ JSON หรือ copy-paste จาก Excel

#### 4.12 A_DocRequirements — Drag to Reorder
- **แก้:** เรียงลำดับ required documents ได้ด้วย drag and drop

---

## 5. Component & System Level

### 🔴 HIGH

#### 5.1 Toast Notification System
- **สร้าง:** `Frontend/src/components/Toast.tsx`
```tsx
// ใช้งาน:
toast.success("บันทึกสำเร็จ")
toast.error("เกิดข้อผิดพลาด: " + message)
toast.info("กำลังประมวลผล...")
```
- **Provider:** Wrap ใน `main.tsx` พร้อม `ThemeProvider`

#### 5.2 Global Loading Spinner
- **สร้าง:** `Frontend/src/components/Spinner.tsx` — inline spinner ใช้ในปุ่ม
- **สร้าง:** `Frontend/src/components/PageLoader.tsx` — full page loading สำหรับ initial fetch

#### 5.3 ConfirmDialog Component
- **สร้าง:** `Frontend/src/components/ConfirmDialog.tsx`
- **แทนที่:** `window.confirm()` ทุกที่ในโปรเจกต์

#### 5.4 Error Boundary
- **ปัญหา:** ถ้า component crash จะ white screen ทั้งหน้า  
- **แก้:** เพิ่ม React Error Boundary ใน `App.tsx` แสดงหน้า fallback แทน

---

### 🟡 MEDIUM

#### 5.5 StatusBadge — เพิ่ม Legend/Tooltip
- **ปัญหา:** สีและ icon ของ badge อาจไม่ชัดเจนสำหรับผู้ใช้ใหม่  
- **แก้:** เพิ่ม `tooltip` prop บน StatusBadge แสดง description เมื่อ hover  
- **เพิ่ม:** หน้า "คู่มือสถานะ" หรือ Legend popup

#### 5.6 Search Debounce
- **ปัญหา:** Search ที่ call API ทุกครั้ง keypress สิ้นเปลือง resource  
- **แก้:** เพิ่ม debounce 300ms บน search inputs ทุกหน้า  
- **ไฟล์:** A_Students.tsx, A_Company.tsx, S_Company.tsx, T_Students.tsx

#### 5.7 Pagination Component
- **ปัญหา:** บางหน้ามี pagination logic ซ้ำๆ กัน  
- **สร้าง:** `Frontend/src/components/Pagination.tsx` reusable component  
- **ใช้:** A_Students, A_Company, A_DocT000, A_DocT002Review

#### 5.8 Form AutoSave (Draft)
- **แก้:** สำหรับ S_Docs T000, T002, T003 เพิ่ม auto-save ใน `localStorage` ทุก 30 วินาที  
- **แสดง:** "บันทึกร่างล่าสุด: 14:23" ที่มุมบน  
- **Restore:** เมื่อเปิดหน้าใหม่ ถามว่าต้องการโหลด draft หรือเริ่มใหม่

#### 5.9 Mobile Sidebar Toggle
- **ปัญหา:** บน mobile sidebar drawer อาจไม่ปิดเมื่อคลิก overlay บนบางหน้า  
- **ตรวจสอบ:** M_App.tsx ไม่มี `sidebarOpen` state → เพิ่ม hamburger button และ drawer

#### 5.10 Accessibility (a11y)
- **แก้พื้นฐาน:**
  - เพิ่ม `aria-label` บนปุ่ม icon-only (logout, hamburger, close)
  - เพิ่ม `role="alert"` บน error message containers
  - ใช้ `<button>` แทน `<div onClick>` ในทุกที่

---

### 🟢 LOW

#### 5.11 Dark Mode — PDF Preview
- **ปัญหา:** `iframe` ใน dark mode ใช้ `filter: invert(1) hue-rotate(180deg)` ทำให้สี signature เพี้ยน  
- **แก้:** เพิ่มปุ่ม toggle "ดู PDF ปกติ" ที่ซ่อน dark filter ชั่วคราว

#### 5.12 Print Stylesheet
- **แก้:** เพิ่ม `@media print` CSS ซ่อน sidebar, topbar, buttons เมื่อพิมพ์หน้า

#### 5.13 Breadcrumb Navigation
- **แก้:** เพิ่ม breadcrumb บนหน้าที่ deep level เช่น "หน้าหลัก > เอกสาร > T002"

---

## สรุปลำดับความสำคัญ

| # | Feature | Role | Impact | Effort |
|---|---------|------|--------|--------|
| 1 | Toast Notification (แทน `alert()`) | ทุก | ⭐⭐⭐ | S |
| 2 | Loading Spinner บนปุ่ม | ทุก | ⭐⭐⭐ | S |
| 3 | ConfirmDialog (แทน `confirm()`) | ทุก | ⭐⭐⭐ | S |
| 4 | S_Dashboard — สถานะปัจจุบัน + Countdown | นักศึกษา | ⭐⭐⭐ | M |
| 5 | S_Gateway — Step Indicator | นักศึกษา | ⭐⭐⭐ | S |
| 6 | S_DocsT002Form — Auto-fill company | นักศึกษา | ⭐⭐⭐ | M |
| 7 | T_Dashboard — Action Required section | อาจารย์ | ⭐⭐⭐ | M |
| 8 | T_T002/T003 — Quick Comment Templates | อาจารย์ | ⭐⭐ | S |
| 9 | A_CoopApplications — Bulk Approve | เจ้าหน้าที่ | ⭐⭐⭐ | M |
| 10 | A_Students — Advanced Filter + Export | เจ้าหน้าที่ | ⭐⭐⭐ | L |
| 11 | Search Debounce | ทุก | ⭐⭐ | S |
| 12 | Pagination Component (reusable) | ทุก | ⭐⭐ | M |
| 13 | Form Auto-save Draft | นักศึกษา | ⭐⭐ | L |
| 14 | Error Boundary | ทุก | ⭐⭐ | S |
| 15 | Sidebar Notification Badge | อาจารย์ | ⭐⭐ | M |
| 16 | A_Dashboard — KPI Cards | เจ้าหน้าที่ | ⭐⭐ | M |
| 17 | T_SupervisionReview — Calendar mini-view | อาจารย์ | ⭐⭐ | M |
| 18 | A_Announcements — Rich Text | เจ้าหน้าที่ | ⭐ | L |
| 19 | File Upload Drag & Drop | นักศึกษา | ⭐ | L |
| 20 | Print Stylesheet | ทุก | ⭐ | S |

**Effort:** S = < 1 วัน · M = 1-3 วัน · L = 3-5 วัน

---

> อัปเดตล่าสุด: 2026-05-15  
> สร้างโดยการตรวจสอบ source code ทุกหน้าของระบบ

---

## 6. KKU Registration API Integration

> ที่มา: https://reg2.kku.ac.th/api/v1.2/docs/  
> ติดต่อขอสิทธิ์: kritssa@kku.ac.th  
> Base URL: `https://reg2.kku.ac.th/api/v1.2`

### Endpoints ที่เกี่ยวข้องกับระบบสหกิจ

| Endpoint | ข้อมูลที่ได้ | นำไปใช้ใน |
|----------|-------------|-----------|
| `GET /student/info` | ชื่อ-นามสกุล, รหัสนักศึกษา, สาขา, คณะ, ชั้นปี | Auto-fill โปรไฟล์ |
| `GET /student/get_grade_summary` | GPA, หน่วยกิตสะสม | ตรวจสอบคุณสมบัติอัตโนมัติ |
| `GET /student/get_advisor` | ชื่ออาจารย์ที่ปรึกษา | จับคู่อาจารย์-นักศึกษา |
| `GET /student/get_student_image` | รูปถ่าย (base64) | แสดงรูปโปรไฟล์จริง |
| `GET /student/enroll_credit_condition/:year/:sem` | หน่วยกิตกิจกรรม | ตรวจสอบคุณสมบัติ |
| `GET /other/academic/get_current_semester` | ปีการศึกษา+ภาคเรียนปัจจุบัน | Sync รอบสหกิจ |
| `POST /auth/login/sso` | SSO Token authentication | Login ด้วย KKU account |

---

### Feature Plans

#### 🔴 HIGH

##### 6.1 Auto-fill ข้อมูลนักศึกษาจาก REG
- **ปัญหา:** นักศึกษากรอกชื่อ, สาขา, คณะ, ชั้นปีด้วยมือ → ผิดพลาดบ่อย
- **แนวทาง:**
  1. ปุ่ม **"ดึงข้อมูลจาก KKU"** ใน `S_ProfilePage.tsx`
  2. Frontend ส่ง KKU credentials ไป `POST /api/students/sync-from-reg`
  3. Backend เรียก `GET /student/info` → อัปเดต DB
  4. Auto-fill: `firstName`, `lastName`, `firstNameEn`, `lastNameEn`, `faculty`, `major`, `year`, `studentId`
- **ไฟล์ที่แก้:** `S_ProfilePage.tsx`, `backend/routes/studentRoutes.js`
- **Backend endpoint ใหม่:** `POST /api/students/sync-from-reg`

##### 6.2 Auto-verify GPA และคุณสมบัติจาก REG
- **ปัญหา:** GPA ในระบบอาจไม่ตรงกับ REG จริง → ผ่าน/ไม่ผ่านไม่แม่นยำ
- **แนวทาง:**
  1. เรียก `GET /student/get_grade_summary` → ดึง `gpax` (GPA สะสมจริง)
  2. เรียก `GET /student/enroll_credit_condition/:year/:sem` → ดึงหน่วยกิตกิจกรรม
  3. อัปเดต `gpa`, `activityUnit` ใน DB แล้วคำนวณ `isQualified` ใหม่
  4. แสดงป้าย "ยืนยันจาก KKU" เมื่อข้อมูลถูก sync แล้ว
- **ผลที่ได้:** ลดการ override GPA ด้วยมือ ป้องกันข้อมูลเท็จ

##### 6.3 Auto-link อาจารย์ที่ปรึกษา
- **ปัญหา:** ต้องพิมพ์ชื่ออาจารย์เอง → ผิดพลาด ไม่ตรงกับ Teacher ใน DB
- **แนวทาง:**
  1. เรียก `GET /student/get_advisor` หลัง login
  2. Match ชื่อ-นามสกุลกับ `Teacher` ใน DB
  3. ถ้าพบ → set `advisorTeacherId` อัตโนมัติ → นักศึกษาเห็นชื่ออาจารย์ทันที
  4. ถ้าไม่พบ → แสดงชื่อเป็น string สำรอง (เผื่ออาจารย์ยังไม่ได้สมัครระบบ)
- **ผลที่ได้:** ระบบ T002/T003/supervision ส่ง notify ถึงอาจารย์ถูกต้องอัตโนมัติ

---

#### 🟡 MEDIUM

##### 6.4 Sync รอบปีการศึกษาอัตโนมัติ
- **แนวทาง:**
  1. ปุ่ม **"ดึงภาคเรียนปัจจุบัน"** ใน `A_CoopPeriod.tsx`
  2. เรียก `GET /other/academic/get_current_semester`
  3. Pre-fill `semester` และ `academicYear` ให้อัตโนมัติ
- **Effort:** S

##### 6.5 รูปถ่ายนักศึกษาจาก KKU
- **แนวทาง:**
  1. เรียก `GET /student/get_student_image` → base64 image
  2. แสดงแทน avatar placeholder ใน topbar `S_App.tsx`
  3. แสดงใน modal `A_Students.tsx` เมื่อเจ้าหน้าที่ดูข้อมูล
  4. Cache ใน localStorage 24 ชั่วโมง ไม่เรียก API ซ้ำ
- **Effort:** M

##### 6.6 KKU SSO Login (ทางเลือก)
- **แนวทาง:**
  1. เพิ่มปุ่ม **"เข้าสู่ระบบด้วยบัญชี KKU"** ใน `loginpage.tsx`
  2. Backend รับ credentials → เรียก `POST /auth/login/reg-account` ของ REG
  3. นำ access-token มาดึงข้อมูล → สร้าง JWT ของระบบเรา
- **ข้อควรระวัง:** ต้องขอ OAuth credentials จาก KKU ก่อน
- **Effort:** L

---

#### 🟢 LOW

##### 6.7 ตรวจสอบประวัติการลงทะเบียน
- เรียก `GET /student/enroll_list/:year/:sem` → ตรวจว่าลงทะเบียนครบตามเงื่อนไข
- ใช้เป็นข้อมูลเพิ่มเติมก่อนอนุมัติคำร้อง

---

### Architecture

```
Frontend              Backend (Proxy)           KKU REG API
   │                       │                        │
   │── POST /sync-from-reg ─▶                        │
   │                       │── GET /student/info ───▶│
   │                       │◀── { name, major } ─────│
   │                       │── GET /grade_summary ──▶│
   │                       │◀── { gpax, credits } ───│
   │◀── { profile updated }│                        │
```

**หลักการ:**
- Frontend **ไม่เรียก REG API โดยตรง** (ป้องกัน CORS + token leak)
- Backend เป็น Proxy — รับ KKU credentials, เรียก REG, คืนผลสรุป
- REG access-token **ไม่บันทึกใน DB** — ใช้ครั้งเดียวแล้วทิ้ง
- **Rate limiting:** cache ผล 1 ชั่วโมง ไม่ spam REG API
- **Fallback:** ถ้า REG API ไม่ตอบ → ใช้ข้อมูลจาก DB ของระบบแทน

### ขั้นตอน Implement

1. ขอ API credentials จาก KKU REG (kritssa@kku.ac.th) **ก่อน**
2. สร้าง `backend/services/kkuRegService.js` — ห่อหุ้มการเรียก REG API
3. เพิ่ม `POST /api/students/sync-from-reg` ใน studentRoutes.js
4. อัปเดต `S_ProfilePage.tsx` เพิ่มปุ่ม "ดึงข้อมูลจาก KKU"
5. อัปเดต `A_CoopPeriod.tsx` เพิ่มปุ่ม "ดึงภาคเรียนปัจจุบัน"
6. ทดสอบกับ REG sandbox ก่อน deploy production

---

> บันทึก: 2026-05-16

