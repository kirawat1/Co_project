# เพิ่ม flow ต่อเนื่อง "เพิ่มพี่เลี้ยง" หลังเพิ่มบริษัทใหม่

## Context

ปัจจุบันทั้งฝั่งเจ้าหน้าที่ (`Frontend/src/components/A_Company.tsx`) และฝั่งนักศึกษา
(`Frontend/src/components/S_Company.tsx`) มี flow การเพิ่มบริษัทที่เหมือนกัน (โค้ด copy-paste กัน):

1. กด "+ เพิ่มบริษัท" → เปิด modal `CompanyForm`
2. กรอกและกด "บันทึกข้อมูลบริษัท" → `saveAdd()` เรียก `POST /api/companies` →
   สำเร็จแล้ว `setItems(prev => [...prev, data.company]); setShowAdd(false);`
3. Modal ปิด กลับไปหน้ารายการบริษัท — **จบ flow ตรงนี้ ไม่มีการแนะนำให้ไปเพิ่มพี่เลี้ยงต่อ**

ถ้าต้องการเพิ่มพี่เลี้ยง ผู้ใช้ต้องกลับไปหารายการบริษัทที่ตัวเองเพิ่งเพิ่ม กด "รายละเอียด"/"ดูรายละเอียด"
แยกต่างหาก แล้วกด "+ เพิ่มพี่เลี้ยง" ข้างใน modal รายละเอียดอีกที — เป็นสองสเต็ปที่ไม่เชื่อมกัน
ผู้ใช้ลืมไปเพิ่มพี่เลี้ยงต่อได้ง่าย

หน้า "จัดการข้อมูลพี่เลี้ยง" (`A_Mentors.tsx`) ที่มีอยู่แยกต่างหากในเมนู ไม่มีปุ่มเพิ่มพี่เลี้ยงเลย —
มีแค่แก้ไข/ลบ ดังนั้นจุดเดียวที่เพิ่มพี่เลี้ยงได้คือผ่าน modal รายละเอียดบริษัทเท่านั้น (คงไว้แบบนี้ ไม่ใช่ scope ของงานนี้)

## เป้าหมาย

หลังเพิ่มบริษัทสำเร็จ ชวนผู้ใช้ไปเพิ่มพี่เลี้ยงต่อทันที โดยไม่บังคับ (skip ได้ถ้ายังไม่มีข้อมูลพร้อม)
ใช้กับทั้งฝั่งเจ้าหน้าที่และนักศึกษา เพราะทั้งสองฝั่งมีปัญหาเดียวกัน

## Flow ที่ออกแบบ

```
[กรอกฟอร์มบริษัท] --กด "บันทึกข้อมูลบริษัท" (saveAdd สำเร็จ)--> [หน้าถาม "เพิ่มพี่เลี้ยงเลยหรือไม่"]
                                                                      |                  |
                                                      กด "เพิ่มพี่เลี้ยงเลย"      กด "ข้ามไปก่อน" / กดปิด (✕)
                                                                      |                  |
                                                            [ฟอร์มเพิ่มพี่เลี้ยง]      [กลับหน้ารายการบริษัท]
                                                                      |
                                                  กด "บันทึกข้อมูลพี่เลี้ยง" (saveMentor สำเร็จ)
                                                                      |
                                                          [ปิดทุกอย่าง กลับหน้ารายการบริษัท]
                                              (ถ้าจะเพิ่มพี่เลี้ยงคนที่ 2 ต้องเข้าไปที่ "รายละเอียด" บริษัทนั้นเอง)
```

หน้า "ถามเพิ่มพี่เลี้ยงเลยหรือไม่" ใช้ข้อความ:
*"เพิ่มบริษัท `<ชื่อบริษัท>` สำเร็จ! ต้องการเพิ่มข้อมูลพี่เลี้ยงตอนนี้เลยหรือไม่?"*
พร้อมปุ่ม **"เพิ่มพี่เลี้ยงเลย"** (primary) และ **"ข้ามไปก่อน"** (secondary)

## สิ่งที่ไม่เปลี่ยน (out of scope)

- `saveEdit` (แก้ไขบริษัท) — ไม่มีหน้าถามนี้ เฉพาะตอน "เพิ่มบริษัทใหม่" เท่านั้น
- `A_Mentors.tsx` — ยังไม่มีปุ่มเพิ่มพี่เลี้ยงในหน้านี้ ตามเดิม
- การเพิ่มพี่เลี้ยงจากใน modal "รายละเอียดบริษัท" (ปุ่ม "+ เพิ่มพี่เลี้ยง" ที่มีอยู่แล้ว) — behavior เดิมไม่เปลี่ยน
  (เพิ่มแล้วยังอยู่ที่หน้ารายละเอียด ไม่ปิด)
- ไม่รวมการ refactor ลดโค้ด copy-paste ระหว่าง `A_Company.tsx` กับ `S_Company.tsx` —
  ทำการเปลี่ยนแปลงแบบคู่ขนานในทั้งสองไฟล์ตามโครงสร้างเดิม

## การเปลี่ยนแปลงทางเทคนิค (เหมือนกันทั้ง 2 ไฟล์)

### State ใหม่

```ts
const [justCreatedCompany, setJustCreatedCompany] = useState<AdminCompanyRecord | null>(null);
// (S_Company.tsx ใช้ type CompanyRecord ของไฟล์นั้นเอง)
const [quickAddMentor, setQuickAddMentor] = useState(false);
```

- `justCreatedCompany` — เก็บบริษัทที่เพิ่งสร้างสำเร็จ ใช้ควบคุมว่าจะ render หน้าถามหรือไม่
- `quickAddMentor` — flag บอกว่า "กำลังอยู่ใน flow เพิ่มพี่เลี้ยงต่อจากการเพิ่งสร้างบริษัท" (true) หรือ
  "เพิ่มพี่เลี้ยงจากหน้ารายละเอียดตามปกติ" (false) — ใช้ตัดสินใจว่า `saveMentor` สำเร็จแล้วต้องปิดทุกอย่างหรือไม่

### แก้ `saveAdd`

เดิม:
```ts
setItems(prev => [...prev, data.company]);
setShowAdd(false);
```

ใหม่:
```ts
setItems(prev => [...prev, data.company]);
setShowAdd(false);
setJustCreatedCompany(data.company);
```

### Modal ใหม่: หน้าถาม "เพิ่มพี่เลี้ยงเลยหรือไม่"

Render เมื่อ `justCreatedCompany` ไม่เป็น null โดยใช้ `Modal` component ที่มีอยู่แล้วในไฟล์เดิม:

```tsx
{justCreatedCompany && (
  <Modal title="✅ เพิ่มบริษัทสำเร็จ" onClose={() => setJustCreatedCompany(null)}>
    <p style={{ fontSize: 14, color: '#475569' }}>
      เพิ่มบริษัท <b>{justCreatedCompany.name}</b> สำเร็จ! ต้องการเพิ่มข้อมูลพี่เลี้ยงตอนนี้เลยหรือไม่?
    </p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
      <button className="btn-secondary" onClick={() => setJustCreatedCompany(null)}>
        ข้ามไปก่อน
      </button>
      <button
        className="btn"
        onClick={() => {
          setViewCompany(justCreatedCompany);
          setQuickAddMentor(true);
          setShowAddMentor(true);
          setJustCreatedCompany(null);
        }}
      >
        เพิ่มพี่เลี้ยงเลย
      </button>
    </div>
  </Modal>
)}
```

### แก้ปุ่ม "+ เพิ่มพี่เลี้ยง" ที่มีอยู่แล้วในหน้ารายละเอียด

ต้องตั้ง `quickAddMentor` เป็น `false` ตรงนี้ด้วย (ป้องกันค่าค้างจาก flow ก่อนหน้า):

```tsx
<button ... onClick={() => { setQuickAddMentor(false); setShowAddMentor(true); }}>+ เพิ่มพี่เลี้ยง</button>
```

### แก้ `saveMentor` (กิ่ง ADD เท่านั้น — กิ่ง EDIT ไม่เปลี่ยน)

หลัง state update เดิม (อัปเดต `viewCompany`/`items`) เพิ่ม logic ปิด flow เมื่อมาจาก quick-add:

```ts
setEditingMentor(null);
setMentorForm(emptyMentor());
setShowAddMentor(false);

if (quickAddMentor) {
  setViewCompany(null);
  setQuickAddMentor(false);
}
```

(วางหลัง `if (!editingMentor) { ... } else { ... }` block เดิม ที่ปัจจุบันมี
`setEditingMentor(null); setMentorForm(emptyMentor()); setShowAddMentor(false);` อยู่แล้ว — เพิ่มต่อท้าย)

## Error handling

ถ้า `saveMentor` ล้มเหลว (alert error เดิม) — ไม่ปิด `showAddMentor`/`viewCompany` ไม่ว่าจะมาจาก
quick-add หรือไม่ (`return` ก่อนถึงโค้ดปิด อยู่แล้วในโค้ดเดิม) ผู้ใช้แก้ไขแล้วลองใหม่ได้ในฟอร์มเดิม

## Verification

- `npx tsc --noEmit` ผ่าน
- ทดสอบ live ทั้ง 2 flow ในแต่ละไฟล์ (A_Company.tsx ในฐานะ staff, S_Company.tsx ในฐานะ student):
  1. เพิ่มบริษัทใหม่ → เห็นหน้าถาม → กด "เพิ่มพี่เลี้ยงเลย" → กรอกพี่เลี้ยง → บันทึก → ปิดกลับหน้ารายการ →
     เปิด "รายละเอียด" บริษัทนั้นใหม่ ยืนยันพี่เลี้ยงที่เพิ่งเพิ่มอยู่ในรายการ
  2. เพิ่มบริษัทใหม่อีกอัน → เห็นหน้าถาม → กด "ข้ามไปก่อน" → ยืนยันกลับหน้ารายการ บริษัทใหม่ปรากฏ ไม่มี mentor
  3. เปิด "รายละเอียด" บริษัทที่มีอยู่แล้ว → กด "+ เพิ่มพี่เลี้ยง" ปกติ (ไม่ผ่าน flow ใหม่) → บันทึกสำเร็จ →
     ยืนยันยังอยู่ที่หน้ารายละเอียดเดิม (ไม่ปิด) — behavior เดิมไม่เปลี่ยน
