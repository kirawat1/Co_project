# Status Display Redesign — Design Spec

## Goal

ปรับปรุงการแสดงสถานะสหกิจศึกษาให้ดูได้ง่ายขึ้นทั้งฝั่งนักศึกษา อาจารย์ และเจ้าหน้าที่ — นักศึกษาเห็น journey ของตัวเองแบบ timeline พร้อม "ต้องทำอะไรต่อ", เจ้าหน้าที่/อาจารย์กรองนักศึกษาตามสถานะด้วย chip ที่มีจำนวน

## Architecture

สร้าง `S_StatusTracker.tsx` component ใหม่ (horizontal stepper + sub-steps + action card) แทนที่ section สถานะปัจจุบันใน S_Gateway และ S_Dashboard. ฝั่งเจ้าหน้าที่/อาจารย์ เพิ่ม `StatusFilterChips.tsx` shared component ไว้ด้านบนตาราง A_Students และ T_Students.

**Tech Stack:** React 19 + TypeScript, inline styles (ตาม pattern ของโปรเจกต์)

---

## Phase Map (4 เฟสหลัก + sub-steps)

```
Phase 1: ยื่นคำร้อง
  → NOT_SUBMITTED, APPLYING, QUALIFICATION_FAILED, APPLICATION_EDITS_REQUIRED, QUALIFIED

Phase 2: เอกสาร T000
  2.1 อัปโหลดเอกสาร
      → WAITING_FOR_STAFF_CHECK, EDITS_REQUIRED, DOCS_APPROVED
  2.2 หนังสือขอความอนุเคราะห์
      → REQ_LETTER_ISSUED
  2.3 ใบตอบรับ (Acceptance)
      → WAITING_FOR_PLACEMENT_LETTER, WAITING_FOR_STAFF_CHECK_LETTER,
        ACCEPTANCE_CHECKED, PLACEMENT_LETTER_ISSUED

Phase 3: ออกฝึกสหกิจ
  3.1 T002 แบบแจ้งรายละเอียดงาน
      → T002_SUBMITTED, T002_EDITS_REQUIRED
  3.2 T003 โครงร่างรายงาน (Proposal)
      → T003_SUBMITTED, T003_EDITS_REQUIRED
  3.3 นัดหมายนิเทศสหกิจ
      → PENDING_TEACHER, TEACHER_REJECTED, DATE_CONFIRMED, LETTER_UPLOADED, COMPLETED
  3.4 แบบประเมิน T005 / T006 (เจ้าหน้าที่ upload)
  3.5 แบบประเมินสถานประกอบการ T007

Phase 4: อัปโหลดเล่มรายงาน T008
```

---

## Section 1: S_StatusTracker.tsx (Student View)

### Layout

**Top: Horizontal Phase Stepper**
```
①ยื่นคำร้อง  ──●──  ②เอกสาร T000  ──○──  ③ฝึกสหกิจ  ──○──  ④รายงาน T008
   ✅             ◀ ปัจจุบัน
```
- Phase สำเร็จแล้ว: สีเขียว + ✅
- Phase ปัจจุบัน: สีน้ำเงิน highlight + ลูกศรชี้
- Phase ยังไม่ถึง: สีเทา

**Middle: Active Phase Sub-steps**
```
📋 เอกสาร T000
─────────────────────────────────────
✅ 2.1 อัปโหลดเอกสาร          ผ่านแล้ว
🚚 2.2 หนังสือขอความอนุเคราะห์  ออกแล้ว
▶ ⏳ 2.3 ใบตอบรับ             รอดำเนินการ   ← ไฮไลต์ขั้นตอนปัจจุบัน
```

**Bottom: "ต้องทำตอนนี้" Action Card**
- กรณีปกติ: บอก action ที่ต้องทำ + ลิงก์ไปหน้าที่เกี่ยวข้อง
- กรณีต้องแก้ไข: แสดงชื่อเอกสาร + comment จากเจ้าหน้าที่ + ลิงก์ไปหน้าแก้ไข

**Revision Status — แสดงเอกสารชัดเจน:**
```
⚠️ ต้องแก้ไข T002 — แบบแจ้งรายละเอียดงานและที่พัก
   "กรุณาแนบไฟล์ให้ครบและส่งใหม่ภายใน 3 วัน"
   [ไปหน้าเอกสาร T002 →]
```

### Action Messages per Status

| Status | Action Card Text | Link |
|---|---|---|
| NOT_SUBMITTED | "กรอกข้อมูลและยื่นคำร้องขอเข้าร่วมโครงการ" | `/student/gateway` |
| APPLYING | "รอเจ้าหน้าที่ตรวจสอบคุณสมบัติ (1-3 วันทำการ)" | — |
| APPLICATION_EDITS_REQUIRED | "⚠️ ต้องแก้ไขใบสมัคร — ดูความคิดเห็นและส่งใหม่" | `/student/gateway` |
| QUALIFICATION_FAILED | "❌ คุณสมบัติไม่ผ่านเกณฑ์ กรุณาติดต่อเจ้าหน้าที่" | — |
| WAITING_FOR_STAFF_CHECK | "รอเจ้าหน้าที่ตรวจเอกสาร T000" | — |
| EDITS_REQUIRED | "⚠️ ต้องแก้ไขเอกสาร T000 — ดูความคิดเห็นจากเจ้าหน้าที่" | `/student/docs` |
| REQ_LETTER_ISSUED | "เจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์แล้ว รอบริษัทตอบรับ" | — |
| WAITING_FOR_PLACEMENT_LETTER | "รอใบตอบรับจากบริษัท" | — |
| PLACEMENT_LETTER_ISSUED | "ได้รับใบส่งตัวแล้ว 🎉 เตรียมตัวออกปฏิบัติงาน" | — |
| T002_SUBMITTED | "รออาจารย์ตรวจสอบ T002" | — |
| T002_EDITS_REQUIRED | "⚠️ ต้องแก้ไข T002 — แบบแจ้งรายละเอียดงานและที่พัก" | `/student/docs-t002` |
| T003_SUBMITTED | "รออาจารย์ตรวจสอบ T003" | — |
| T003_EDITS_REQUIRED | "⚠️ ต้องแก้ไข T003 — โครงร่างรายงานสหกิจ" | `/student/docs-t003` |
| PENDING_TEACHER | "รออาจารย์เลือกวันนัดหมายนิเทศ" | — |
| DATE_CONFIRMED | "วันนิเทศได้รับการยืนยันแล้ว รอเจ้าหน้าที่ออกหนังสือนิเทศ" | — |
| LETTER_UPLOADED | "หนังสือนิเทศอนุมัติแล้ว เตรียมพร้อมรับการนิเทศ" | — |
| COMPLETED | "การนิเทศเสร็จสิ้น ✅" | — |

### Component Interface

```tsx
interface StatusTrackerProps {
  status: string;
  supervisionStatus?: string;  // supervision sub-status
  lastComment?: string;        // comment จากเจ้าหน้าที่/อาจารย์
}
```

### Files

- **Create:** `Frontend/src/components/S_StatusTracker.tsx`
- **Modify:** `Frontend/src/components/S_Dashboard.tsx` — แทนที่ section สถานะเดิมด้วย `<S_StatusTracker>`
- **Modify:** `Frontend/src/components/S_Gateway.tsx` — เพิ่ม `<S_StatusTracker>` ด้านบน (นักศึกษาที่ยื่นแล้วเห็นสถานะ)

---

## Section 2: StatusFilterChips.tsx (Staff/Teacher View)

### Layout

เพิ่มที่ด้านบนตาราง A_Students และ T_Students:

```
[ทั้งหมด 48]  [⏳รอตรวจ 5]  [📝ต้องแก้ไข 3]  [🚀ฝึกสหกิจ 32]  [✅เสร็จสิ้น 8]
```

- กด chip → filter ตารางแสดงเฉพาะกลุ่มนั้น
- chip ที่ active แสดงสีน้ำเงิน
- ตัวเลขใน chip อัปเดตตาม data ที่มี

### Status Groups

| Chip | รวมสถานะ | สี |
|---|---|---|
| ทั้งหมด | ทุกสถานะ | เทา |
| รอตรวจสอบ | APPLYING, WAITING_FOR_STAFF_CHECK, T002_SUBMITTED, T003_SUBMITTED, DATE_CONFIRMED, WAITING_FOR_STAFF_CHECK_LETTER | เหลือง |
| ต้องแก้ไข | APPLICATION_EDITS_REQUIRED, EDITS_REQUIRED, T002_EDITS_REQUIRED, T003_EDITS_REQUIRED, TEACHER_REJECTED | แดง/ส้ม |
| กำลังดำเนินการ | QUALIFIED, DOCS_APPROVED, REQ_LETTER_ISSUED, WAITING_FOR_PLACEMENT_LETTER, ACCEPTANCE_CHECKED, PLACEMENT_LETTER_ISSUED, PENDING_TEACHER, LETTER_UPLOADED | น้ำเงิน |
| ฝึกสหกิจ | INTERNSHIP_STARTED, T003_SUBMITTED, T003_EDITS_REQUIRED, PENDING_TEACHER, DATE_CONFIRMED, LETTER_UPLOADED, COMPLETED | ม่วง |
| เสร็จสิ้น | COMPLETED | เขียว |

### Component Interface

```tsx
interface StatusFilterChipsProps {
  students: { coop?: { status: string } }[];
  activeFilter: string;           // "ALL" | "PENDING_REVIEW" | "NEEDS_EDIT" | ...
  onFilterChange: (filter: string) => void;
}
```

### Files

- **Create:** `Frontend/src/components/StatusFilterChips.tsx`
- **Modify:** `Frontend/src/components/A_Students.tsx` — เพิ่ม `<StatusFilterChips>` + filter logic
- **Modify:** `Frontend/src/components/T_Students.tsx` — เพิ่ม `<StatusFilterChips>` + filter logic

---

## Out of Scope

- ไม่เปลี่ยน backend หรือ status enum
- ไม่เพิ่ม notification/push
- A_CoopApplications.tsx — ไม่แก้ในรอบนี้ (complex workflow page)
