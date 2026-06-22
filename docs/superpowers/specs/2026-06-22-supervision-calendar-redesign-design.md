# ปฏิทินนิเทศสหกิจ — Redesign (SupervisionCalendar.tsx)

## บริบท

`Frontend/src/components/SupervisionCalendar.tsx` เป็น component ปฏิทินแบบ month-grid ที่สร้างเอง ใช้ร่วมกัน 3 หน้า:
- `A_SupervisionManage.tsx` — Admin/Staff (จัดการการนิเทศทั้งระบบ)
- `T_SupervisionReview.tsx` — อาจารย์ (ดูตารางนิเทศของตัวเอง)
- `S_Supervision.tsx` — นักศึกษา (ดูปฏิทินนิเทศที่ยืนยันแล้วทั้งหมด)

แบบเดิม: month-grid + คลิกวันเพื่อดูรายละเอียดในแผงด้านล่าง (emoji แทนประเภทนิเทศ, ไม่มี filter, ไม่มี list view, ไม่มีข้อมูลบริษัท/ลิงก์ออนไลน์)

ผู้ใช้ต้องการรีดีไซน์ใหม่ทั้งหมด ผ่านการเทียบ mockup 3 แนวทาง (A: ปรับโฉม grid เดิม, B: split-view grid+agenda, C: stats strip + list) แล้วเลือก **B ผสม C** พร้อมระบุเพิ่มว่ารายละเอียดแต่ละนัดต้องมี: ชื่อนักศึกษา, เวลา, บริษัท, ประเภท (ออนไลน์/ออนไซต์), และถ้าออนไลน์ต้องมีลิงก์

## Scope

- รีดีไซน์ **เฉพาะ component `SupervisionCalendar.tsx`** (ใช้ร่วมกันทั้ง 3 หน้าเหมือนเดิม ไม่แยกเวอร์ชันต่อ role)
- ไม่แก้ตาราง/รายการด้านล่าง calendar ในแต่ละหน้า (เช่น ตาราง "รายการนัดหมายนิเทศทั้งหมด" ใน `A_SupervisionManage.tsx`) — อยู่นอก scope
- ต้องเพิ่มข้อมูล "บริษัท" และ "ลิงก์ออนไลน์" เข้าไปใน flow ข้อมูลที่ส่งเข้า component นี้ ซึ่งต้องแก้ทั้ง backend (1 endpoint) และ frontend (3 จุด mapping)

## ดีไซน์ที่อนุมัติแล้ว (จาก visual mockup)

**Layout บน-ลง:**
1. **Stats strip** — แถบสรุป 4 ช่อง: จำนวนนัดหมายในเดือนที่ดู / จำนวนออนไลน์ / จำนวนออนไซต์ / สรุปนัดของวันนี้ (ถ้ามี)
2. **Filter chips** — ทั้งหมด / ออนไลน์ / ออนไซต์ (filter ฝั่ง client เท่านั้น ไม่เรียก API ใหม่)
3. **Split view** (flex row, แตกเป็นแนวตั้งบนจอแคบ — ดูส่วน Responsive):
   - **ซ้าย** — month grid กะทัดรัดกว่าเดิม (ลูกศรเดือนก่อนหน้า/ถัดไป + ปุ่ม "วันนี้" คงไว้เหมือนเดิม) ช่องที่มีนิเทศแสดงสีพื้นหลัง/ขอบตามเดิม (เขียว=มีนิเทศ, เหลือง=วันนี้, ฟ้า=วันที่เลือก) แต่ตัวเลขในช่องไม่ต้องโชว์ emoji ของแต่ละ event ในช่องอีกต่อไป (เพราะรายละเอียดไปอยู่ฝั่ง agenda แล้ว) — แสดงแค่เลขวันที่ + จุดสีเล็ก ๆ บอกว่ามีกี่นัด
   - **ขวา** — Agenda: รายการนัดหมายเรียงตามวัน-เวลา (ascending) ของ**เดือนที่กำลังดู** ทั้งหมด (ไม่ใช่แค่วันที่เลือก) แต่ละแถวแสดง:
     - ไอคอนวงกลมตามประเภท (🌐 ออนไลน์ / 🏢 ออนไซต์)
     - ชื่อนักศึกษา
     - ชื่อบริษัท (หรือ "-" ถ้าไม่มีข้อมูล)
     - วันที่ + เวลา (ชิดขวา)
     - ถ้าเป็นออนไลน์: แสดงลิงก์เป็น `<a>` คลิกได้ (เปิด tab ใหม่) ใต้ชื่อบริษัท ถ้าไม่มีลิงก์ให้แสดง "ยังไม่ระบุลิงก์" สีเทาแทน
4. คลิกวันใน grid → agenda filter เหลือแค่วันนั้น (ของเดิมที่มีอยู่แล้ว ปรับมาใช้กับ agenda แทนแผงด้านล่างเดิม) คลิกวันเดิมซ้ำ หรือกดปุ่ม "ดูทั้งเดือน" ที่โผล่ขึ้นตอน filter อยู่ → กลับมาแสดงทั้งเดือน
5. Legend สีของ grid ย้ายไปอยู่ใต้ grid (เหมือนเดิม แต่ตัดบรรทัด "🌐 ออนไลน์ / 🏢 ออนไซต์" ออกเพราะ agenda ฝั่งขวาสื่อความหมายนี้ชัดอยู่แล้วผ่านไอคอน)

**Responsive:** จอแคบกว่า ~768px ให้ split view ยุบเป็นแนวตั้ง (grid อยู่บน agenda อยู่ล่าง) เพื่อกันการ squeeze จนอ่านไม่ได้ — ใช้ `flexWrap` + breakpoint ผ่าน CSS class หรือ `window.innerWidth`/media query แบบง่าย (เลือกวิธีที่เข้ากับ pattern เดิมของไฟล์ ซึ่งใช้ inline style ทั้งหมด — จะใช้ CSS-in-JS `<style>` block แบบที่ไฟล์อื่นในโปรเจกต์ทำ เช่น `S_Supervision.tsx` มี `<style>{...}</style>` ท้ายไฟล์)

## Data Flow

### `CalendarEvent` interface (ขยายเพิ่ม 2 field, optional เพื่อไม่ breaking)

```ts
export interface CalendarEvent {
    id: number;
    confirmedDate: string;
    studentName: string;
    studentId?: string;
    type: "ONLINE" | "ONSITE";
    status?: string;
    companyName?: string;   // ใหม่
    onlineLink?: string | null; // ใหม่
}
```

### Backend: 1 จุดที่ต้องแก้

`backend/controllers/supervisionController.js` → `getSupervisionCalendar` (บรรทัด ~509, endpoint `/api/coop/supervision/calendar` ใช้โดย `S_Supervision.tsx`) สร้าง response object เองแบบ hand-picked field โดยไม่มี `companyName`/`onlineLink` เลย ต้องแก้:

```js
const appointments = await prisma.supervisionAppointment.findMany({
    where: {
        confirmedDate: { not: null },
        status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] }
    },
    include: {
        student: {
            select: {
                studentId: true, firstName: true, lastName: true,
                coop: { select: { company: { select: { name: true } } } }
            }
        }
    },
    orderBy: { confirmedDate: 'asc' }
});

const events = appointments.map(a => ({
    id: a.id,
    confirmedDate: a.confirmedDate,
    studentId: a.student.studentId,
    studentName: `${a.student.firstName} ${a.student.lastName}`,
    type: a.supervisionType,
    status: a.status,
    companyName: a.student.coop?.company?.name ?? null,
    onlineLink: a.onlineLink ?? null,
}));
```

อีก 2 endpoint ที่เลี้ยง component นี้ (admin's `getAllSupervisions`, teacher's `getSupervisionsForTeacher`) ใช้ `include` แบบไม่ `select` อยู่แล้ว ดังนั้น Prisma คืน scalar field ทั้งหมดมาให้ (รวม `onlineLink`) และมี `include: { coop: { include: { company: true }}}` อยู่แล้วด้วย — **ไม่ต้องแก้ backend ทั้ง 2 จุดนี้** แค่ frontend mapping ที่ยังไม่ได้หยิบ field มาใช้ (ดูหัวข้อถัดไป)

### Frontend: จุด mapping ที่ต้องแก้ (3 ไฟล์)

1. **`A_SupervisionManage.tsx`** (บรรทัด ~332-344): เพิ่ม `companyName: s.student.coop?.company?.name`, `onlineLink: s.onlineLink` ใน `.map()` — ต้องเพิ่ม field `onlineLink?: string | null;` เข้า `interface Supervision` (บรรทัด ~47-69) ก่อน เพราะยังไม่มี field นี้ในไฟล์นี้
2. **`T_SupervisionReview.tsx`** (บรรทัด ~209-221): เพิ่ม `companyName: s.student.coop?.company?.name`, `onlineLink: s.onlineLink` ใน `.map()` — **ไม่ต้องแก้ interface** เพราะ `SupervisionAppt` (บรรทัด 15) มี `onlineLink: string | null` อยู่แล้ว และ path `s.student.coop?.company?.name` ก็มีอยู่แล้วในไฟล์นี้ (ใช้จริงที่บรรทัด ~298, ~380)
3. **`S_Supervision.tsx`**: ไม่ต้องแก้ mapping เพราะ backend (`getSupervisionCalendar`) คืน field ที่ map มาเป็น `CalendarEvent` shape ตรงอยู่แล้ว (ดูหัวข้อ backend ด้านบน) — แค่รับ field ใหม่มาผ่าน type ที่ขยายแล้ว

## Error Handling / Edge Cases

- เดือนที่ดูไม่มีนัดหมายเลย → agenda แสดง empty state ข้อความ "ไม่มีนัดหมายในเดือนนี้" (stats strip แสดง 0 ทั้งหมด)
- ออนไลน์แต่ไม่มี `onlineLink` (ข้อมูลเก่าก่อนมี field นี้ หรือกรณีอื่น) → แสดง "ยังไม่ระบุลิงก์" สีเทาแทนลิงก์ ไม่ throw/ไม่ render error
- ไม่มี `companyName` → แสดง "-"
- ชื่อนักศึกษา/บริษัทยาวเกินพื้นที่ → ใช้ `text-overflow: ellipsis` + `white-space: nowrap` + `overflow: hidden` ไม่ดันให้ layout บิด
- เปลี่ยนเดือน (prev/next/วันนี้) → reset `selectedDay` และ filter type กลับเป็น "ทั้งหมด" เหมือน behavior เดิมของ `selectedDay` (filter type ไม่ reset ตามเดือน เพราะเป็นความตั้งใจของผู้ใช้ที่ต้องคงอยู่ข้ามเดือน)

## Testing

- ไม่มีและไม่จำเป็นต้องมี frontend unit test สำหรับ component นี้ (เป็น presentational component, ไม่มี business logic ซับซ้อนพอจะคุ้มกับ unit test — ตรวจสอบผ่าน browser ตาม `verify-feature` skill ของโปรเจกต์)
- Backend: แก้/เพิ่ม test ใน `backend/__tests__/supervisionController.test.js` describe block `getSupervisionCalendar` (มีอยู่แล้ว) ให้ยืนยันว่า response แต่ละ event มี `companyName` และ `onlineLink`
- Verification: `cd Frontend && npx tsc --noEmit` ต้องผ่าน, รัน dev server แล้วเปิดทั้ง 3 หน้า (admin/teacher/student) ทดสอบ golden path: ดู stats ถูกต้อง, filter chip ทำงาน, คลิกวันใน grid filter agenda ถูกวัน, ลิงก์ออนไลน์คลิกได้และเปิด tab ใหม่, responsive ที่จอแคบไม่บิด
