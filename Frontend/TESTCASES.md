# Test Cases — Co-op Management System (UI)

**Framework:** Playwright (`@playwright/test`)  
**วันที่เขียน:** 2026-05-28  
**ขอบเขต:** UI test สำหรับ 3 user roles — Student, Admin/Staff, Teacher  
**หมายเหตุ:** ยังไม่ทดสอบกระบวนการ Login (ใช้ localStorage token inject แทน)

---

## วิธีรันทดสอบ

```bash
# 1. เปิด dev server ก่อน (terminal แยก)
cd Frontend && npm run dev

# 2. รัน test ทั้งหมด
cd Frontend && npx playwright test

# 3. รัน test เฉพาะ role
npx playwright test tests/student.spec.ts
npx playwright test tests/admin.spec.ts
npx playwright test tests/teacher.spec.ts
npx playwright test tests/mentor.spec.ts

# 4. ดู HTML report
npx playwright show-report
```

---

## โครงสร้างไฟล์

```
Frontend/
├── playwright.config.ts
├── TESTCASES.md          ← ไฟล์นี้
└── tests/
    ├── helpers/
    │   └── mockApi.ts    ← mock API + auth helper
    ├── student.spec.ts
    ├── admin.spec.ts
    └── teacher.spec.ts
```

---

## กลยุทธ์การทดสอบ

| กลยุทธ์ | รายละเอียด |
|---------|-----------|
| **Token injection** | inject `coop.token` ใน `localStorage` ผ่าน `page.addInitScript()` ก่อน page load |
| **API mocking** | ใช้ `page.route()` ดัก URL pattern ทุก `/api/**` คืนค่า mock JSON |
| **Backend independence** | ทุก test รันได้โดยไม่ต้องพึ่ง backend/database จริง |
| **Auth guard test** | test แยกต่างหากสำหรับกรณีไม่มี token (ต้อง redirect ไป `/`) |

---

## 📘 Student Role — `/student/*`

| ID | ชื่อ Test | เงื่อนไขเริ่มต้น | ขั้นตอน | ผลที่คาดหวัง |
|----|----------|----------------|---------|-------------|
| TC-S-00 | /student/ redirect | มี token ใน localStorage | navigate ไป `/student/` | redirect ไปที่ `/student/dashboard` |
| TC-S-01 | Dashboard หน้าหลัก | มี token | navigate ไป `/student/dashboard` | topbar แสดง, URL ยังอยู่ที่ `/student/` |
| TC-S-02 | โปรไฟล์นักศึกษา | มี token | navigate ไป `/student/profile` | topbar แสดง, ไม่ redirect |
| TC-S-03 | Gateway (สมัครสหกิจ) | มี token | navigate ไป `/student/gateway` | topbar แสดง, ไม่ redirect |
| TC-S-04 | บันทึกประจำวัน | มี token | navigate ไป `/student/daily` | topbar แสดง, ไม่ redirect |
| TC-S-05 | เอกสาร | มี token | navigate ไป `/student/docs` | topbar แสดง, ไม่ redirect |
| TC-S-06 | ข้อมูลบริษัท | มี token | navigate ไป `/student/company` | topbar แสดง, ไม่ redirect |
| TC-S-07 | ฟอร์มเอกสาร T002 | มี token | navigate ไป `/student/docs-t002` | topbar แสดง, ไม่ redirect |
| TC-S-08 | ฟอร์มเอกสาร T003 | มี token | navigate ไป `/student/docs-t003` | topbar แสดง, ไม่ redirect |
| TC-S-09 | หน้านิเทศ | มี token | navigate ไป `/student/supervision` | topbar แสดง, ไม่ redirect |
| TC-S-10 | Status Tracker | มี token | navigate ไป `/student/status-tracker` | topbar แสดง, ไม่ redirect |
| TC-S-11 | เอกสาร T005/T006 | มี token | navigate ไป `/student/doc-t005-006` | topbar แสดง, ไม่ redirect |
| TC-S-12 | เอกสาร T007 | มี token | navigate ไป `/student/doc-t007` | topbar แสดง, ไม่ redirect |
| TC-S-13 | เอกสาร T008 | มี token | navigate ไป `/student/doc-t008` | topbar แสดง, ไม่ redirect |
| TC-S-14 | Sidebar มีเมนู | มี token | navigate ไป dashboard → คลิก hamburger | sidebar component ปรากฏ |
| TC-S-15 | ปุ่ม Logout | มี token | navigate ไป dashboard | ปุ่ม `aria-label="ออกจากระบบ"` มองเห็นได้ |
| TC-S-16 | ไม่มี token | ไม่มี token | navigate ไป `/student/dashboard` | redirect กลับไป `/` (login page) |
| TC-S-17 | Daily มี content | มี token | navigate ไป daily | `<main>` แสดงเนื้อหา |
| TC-S-18 | โลโก้ Co-op | มี token | navigate ไป dashboard | `img[alt="Co-op Logo"]` แสดง |

**รวม: 19 test cases**

---

## 🔧 Admin/Staff Role — `/admin/*`

| ID | ชื่อ Test | เงื่อนไขเริ่มต้น | ขั้นตอน | ผลที่คาดหวัง |
|----|----------|----------------|---------|-------------|
| TC-A-00 | /admin/ redirect | มี token | navigate ไป `/admin` | redirect ไปที่ `/admin/dashboard` |
| TC-A-01 | Dashboard | มี token | navigate ไป `/admin/dashboard` | topbar แสดง, URL ยังอยู่ที่ `/admin/` |
| TC-A-02 | จัดการนักศึกษา | มี token | navigate ไป `/admin/students` | topbar แสดง, ไม่ redirect |
| TC-A-03 | จัดการพี่เลี้ยง | มี token | navigate ไป `/admin/mentors` | topbar แสดง, ไม่ redirect |
| TC-A-04 | จัดการบริษัท | มี token | navigate ไป `/admin/company` | topbar แสดง, ไม่ redirect |
| TC-A-05 | เอกสาร | มี token | navigate ไป `/admin/docs` | topbar แสดง, ไม่ redirect |
| TC-A-06 | บันทึกประจำวัน | มี token | navigate ไป `/admin/daily` | topbar แสดง, ไม่ redirect |
| TC-A-07 | ประกาศข่าวสาร | มี token | navigate ไป `/admin/announcements` | topbar แสดง, ไม่ redirect |
| TC-A-08 | ตั้งค่า | มี token | navigate ไป `/admin/settings` | topbar แสดง, ไม่ redirect |
| TC-A-09 | จัดการอาจารย์ | มี token | navigate ไป `/admin/teachers` | topbar แสดง, ไม่ redirect |
| TC-A-10 | เกณฑ์คะแนน | มี token | navigate ไป `/admin/criteria` | topbar แสดง, ไม่ redirect |
| TC-A-11 | เอกสาร T000 | มี token | navigate ไป `/admin/doct000` | topbar แสดง, ไม่ redirect |
| TC-A-12 | ตรวจ T002 | มี token | navigate ไป `/admin/doct002` | topbar แสดง, ไม่ redirect |
| TC-A-13 | ตรวจ T003 | มี token | navigate ไป `/admin/doct003` | topbar แสดง, ไม่ redirect |
| TC-A-14 | จัดการรอบสหกิจ | มี token | navigate ไป `/admin/coop-period` | topbar แสดง, ไม่ redirect |
| TC-A-15 | ใบสมัครสหกิจ | มี token | navigate ไป `/admin/coop-applications` | topbar แสดง, ไม่ redirect |
| TC-A-16 | จัดการนิเทศ | มี token | navigate ไป `/admin/supervision-manager` | topbar แสดง, ไม่ redirect |
| TC-A-17 | เอกสาร T005/T006 | มี token | navigate ไป `/admin/doc-t005-006` | topbar แสดง, ไม่ redirect |
| TC-A-18 | เอกสาร T007 | มี token | navigate ไป `/admin/doc-t007` | topbar แสดง, ไม่ redirect |
| TC-A-19 | เอกสาร T008 | มี token | navigate ไป `/admin/doc-t008` | topbar แสดง, ไม่ redirect |
| TC-A-20 | ข้อกำหนดเอกสาร | มี token | navigate ไป `/admin/doc-requirements` | topbar แสดง, ไม่ redirect |
| TC-A-21 | ไม่มี token | ไม่มี token | navigate ไป `/admin/dashboard` | redirect กลับไป `/` (login page) |
| TC-A-22 | แสดงชื่อ admin | มี token | navigate ไป dashboard | `.user-name` มีข้อความ (email/ชื่อ) |
| TC-A-23 | Students มี content | มี token | navigate ไป students | `<main>` แสดงได้ |
| TC-A-24 | ปุ่ม Logout | มี token | navigate ไป dashboard | ปุ่ม `aria-label="ออกจากระบบ"` มองเห็น |
| TC-A-25 | โลโก้ Co-op | มี token | navigate ไป dashboard | `img[alt="Co-op Logo"]` แสดง |
| TC-A-26 | URL ไม่ถูกต้อง | มี token | navigate ไป `/admin/nonexistent-page` | redirect ไป `/admin/dashboard` |

**รวม: 27 test cases**

---

## 👩‍🏫 Teacher Role — `/teacher/*`

| ID | ชื่อ Test | เงื่อนไขเริ่มต้น | ขั้นตอน | ผลที่คาดหวัง |
|----|----------|----------------|---------|-------------|
| TC-T-00 | /teacher/ redirect | มี token | navigate ไป `/teacher` | redirect ไปที่ `/teacher/dashboard` |
| TC-T-01 | Dashboard | มี token | navigate ไป `/teacher/dashboard` | topbar แสดง, ไม่ redirect |
| TC-T-02 | Requests | มี token | navigate ไป `/teacher/requests` | topbar แสดง, ไม่ redirect |
| TC-T-03 | รายชื่อนักศึกษา | มี token | navigate ไป `/teacher/students` | topbar แสดง, ไม่ redirect |
| TC-T-04 | การสอบ | มี token | navigate ไป `/teacher/exams` | topbar แสดง, ไม่ redirect |
| TC-T-05 | โปรไฟล์อาจารย์ | มี token | navigate ไป `/teacher/profile` | topbar แสดง, ไม่ redirect |
| TC-T-06 | ตรวจ T002 | มี token | navigate ไป `/teacher/review-t002` | topbar แสดง, ไม่ redirect |
| TC-T-07 | ตรวจ T003 | มี token | navigate ไป `/teacher/review-t003` | topbar แสดง, ไม่ redirect |
| TC-T-08 | ตรวจบันทึกนิเทศ | มี token | navigate ไป `/teacher/review-supervision` | topbar แสดง, ไม่ redirect |
| TC-T-09 | เอกสาร T005/T006 | มี token | navigate ไป `/teacher/doc-t005-006` | topbar แสดง, ไม่ redirect |
| TC-T-10 | เอกสาร T007 | มี token | navigate ไป `/teacher/doc-t007` | topbar แสดง, ไม่ redirect |
| TC-T-11 | เอกสาร T008 | มี token | navigate ไป `/teacher/doc-t008` | topbar แสดง, ไม่ redirect |
| TC-T-12 | ไม่มี token | ไม่มี token | navigate ไป `/teacher/dashboard` | redirect กลับไป `/` (login page) |
| TC-T-13 | แสดงชื่ออาจารย์ | มี token, profile ใน localStorage | navigate ไป dashboard | `.user-name` มีชื่ออาจารย์ |
| TC-T-14 | Students มี content | มี token | navigate ไป students | `<main>` แสดงได้ |
| TC-T-15 | ปุ่ม Logout | มี token | navigate ไป dashboard | ปุ่ม `aria-label="ออกจากระบบ"` มองเห็น |
| TC-T-16 | URL ไม่ถูกต้อง | มี token | navigate ไป `/teacher/unknown` | redirect ไป `/teacher/dashboard` |
| TC-T-17 | Sidebar เปิดได้ | มี token | navigate → คลิก hamburger | sidebar component ปรากฏ |

**รวม: 18 test cases**

---

## สรุปจำนวน Test Cases

| Role | ไฟล์ | จำนวน |
|------|------|-------|
| Student | `tests/student.spec.ts` | 19 |
| Admin/Staff | `tests/admin.spec.ts` | 27 |
| Teacher | `tests/teacher.spec.ts` | 18 |
| **รวม** | | **64** |

---

## ประเภทการตรวจสอบที่ครอบคลุม

| ประเภท | รายละเอียด |
|--------|-----------|
| ✅ Page load | ทุกหน้าโหลดได้ ไม่ crash |
| ✅ Auth guard (with token) | มี token → เข้าถึงหน้าได้ปกติ |
| ✅ Auth guard (no token) | ไม่มี token → redirect ไป login |
| ✅ Redirect fallback | URL ไม่ถูกต้อง → redirect ไป dashboard |
| ✅ UI layout | topbar, logo, logout button, sidebar |
| ✅ Role root redirect | `/role/` → `/role/dashboard` |
| ❌ Login flow | ยังไม่ทดสอบ (pending) |
| ❌ Form submission | ยังไม่ทดสอบ (pending) |
| ❌ API error handling | ยังไม่ทดสอบ (pending) |
