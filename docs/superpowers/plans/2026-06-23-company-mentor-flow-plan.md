# เพิ่ม flow ต่อเนื่อง "เพิ่มพี่เลี้ยง" หลังเพิ่มบริษัทใหม่ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หลังเพิ่มบริษัทใหม่สำเร็จ (ทั้งฝั่งเจ้าหน้าที่และนักศึกษา) แสดงหน้าถาม "ต้องการเพิ่มพี่เลี้ยงเลยหรือไม่" แทนการปิด modal เงียบๆ กลับไปหน้ารายการ.

**Architecture:** เพิ่ม 2 state ใหม่ (`justCreatedCompany`, `quickAddMentor`) และ 1 modal เล็กในไฟล์ frontend ที่มีอยู่แล้ว 2 ไฟล์ — ไม่มีการเปลี่ยน backend, ไม่มี API ใหม่, ไม่มี component ใหม่แยกไฟล์ (reuse `Modal`/`MentorForm` ที่มีอยู่แล้วในไฟล์เดิม).

**Tech Stack:** React 19 + TypeScript (ของเดิมในไฟล์), ไม่มี state management library เพิ่ม.

## Global Constraints

- ใช้ relative path สำหรับ API call เสมอ (ของเดิมในไฟล์เป็นแบบนี้อยู่แล้ว ไม่แก้)
- Token จาก `localStorage.getItem("coop.token")` (ของเดิม ไม่แก้)
- ไม่แก้ `saveEdit` (แก้ไขบริษัท) — หน้าถามนี้ใช้เฉพาะตอน "เพิ่มบริษัทใหม่" เท่านั้น
- ไม่แก้ `A_Mentors.tsx` และไม่แก้ behavior ของปุ่ม "+ เพิ่มพี่เลี้ยง" ที่อยู่ใน modal "รายละเอียดบริษัท" ตามปกติ (ต้องยังคงอยู่ที่หน้ารายละเอียดหลังบันทึกสำเร็จ ไม่ปิด)
- ไม่ทำการ refactor ลดโค้ดซ้ำระหว่าง `A_Company.tsx` กับ `S_Company.tsx` — แก้แบบคู่ขนานในทั้งสองไฟล์ตามโครงสร้างเดิมของแต่ละไฟล์
- โปรเจกต์นี้ไม่มี unit/component test framework สำหรับ frontend (มีแค่ Playwright smoke tests ที่ mock API แบบ render-only ใน `Frontend/tests/`, ไม่ครอบคลุม form-fill flow) ดังนั้นทุก task verify ด้วย `npx tsc --noEmit` + เดิน flow จริงในเบราว์เซอร์ (เหมือนที่ทำมาตลอด session นี้) แทน automated unit test — ตรงกับ convention ของโปรเจกต์ตาม skill `verify-feature`

---

### Task 1: `A_Company.tsx` (ฝั่งเจ้าหน้าที่) — quick-add-mentor flow

**Files:**
- Modify: `Frontend/src/components/A_Company.tsx:49-56` (state), `:129-159` (`saveAdd`), `:204-258` (`saveMentor`), `:390-393` (ปุ่ม "+ เพิ่มพี่เลี้ยง" ใน modal รายละเอียด), `:425-429` (ตำแหน่งแทรก modal ใหม่)

**Interfaces:**
- Consumes: `AdminCompanyRecord` interface ที่มีอยู่แล้วในไฟล์เดียวกัน (export อยู่แล้วที่บรรทัด 9), `Modal` component ที่มีอยู่แล้วในไฟล์เดียวกัน, `MentorForm` component ที่มีอยู่แล้วในไฟล์เดียวกัน
- Produces: ไม่มีไฟล์อื่นพึ่งพา task นี้ — เป็นการเปลี่ยนแปลงภายในไฟล์เดียว ปิดจบในตัว

- [ ] **Step 1: เพิ่ม state ใหม่ 2 ตัว**

เปิด `Frontend/src/components/A_Company.tsx` หาบรรทัดนี้ (มีอยู่แล้วที่บรรทัด ~52-53):

```tsx
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);
```

แก้เป็น (เพิ่ม 2 บรรทัดต่อท้าย):

```tsx
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);
  const [justCreatedCompany, setJustCreatedCompany] = useState<AdminCompanyRecord | null>(null);
  const [quickAddMentor, setQuickAddMentor] = useState(false);
```

- [ ] **Step 2: แก้ `saveAdd` ให้ตั้ง `justCreatedCompany` หลังบันทึกสำเร็จ**

หาฟังก์ชัน `saveAdd` (มีอยู่แล้วที่บรรทัด ~129-159) ส่วนนี้:

```tsx
      setItems(prev => [...prev, data.company]);
      setShowAdd(false);

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }
```

แก้เป็น:

```tsx
      setItems(prev => [...prev, data.company]);
      setShowAdd(false);
      setJustCreatedCompany(data.company);

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }
```

- [ ] **Step 3: แก้ `saveMentor` ให้ปิด flow ทั้งหมดเมื่อมาจาก quick-add**

หาส่วนท้ายของฟังก์ชัน `saveMentor` (มีอยู่แล้วที่บรรทัด ~248-258) ส่วนนี้:

```tsx
      setEditingMentor(null);
      setMentorForm(emptyMentor());
      setShowAddMentor(false);

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }
```

แก้เป็น:

```tsx
      setEditingMentor(null);
      setMentorForm(emptyMentor());
      setShowAddMentor(false);

      if (quickAddMentor) {
        setViewCompany(null);
        setQuickAddMentor(false);
      }

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }
```

- [ ] **Step 4: แก้ปุ่ม "+ เพิ่มพี่เลี้ยง" ใน modal รายละเอียดให้ reset flag**

หาปุ่มนี้ (มีอยู่แล้วที่บรรทัด ~392):

```tsx
            <button className="btn" style={{ background: '#0284c7', padding: '6px 12px', fontSize: 13 }} onClick={() => setShowAddMentor(true)}>+ เพิ่มพี่เลี้ยง</button>
```

แก้เป็น:

```tsx
            <button className="btn" style={{ background: '#0284c7', padding: '6px 12px', fontSize: 13 }} onClick={() => { setQuickAddMentor(false); setShowAddMentor(true); }}>+ เพิ่มพี่เลี้ยง</button>
```

- [ ] **Step 5: เพิ่ม modal ถาม "เพิ่มพี่เลี้ยงเลยหรือไม่"**

หาบล็อกนี้ (มีอยู่แล้วที่บรรทัด ~425-429):

```tsx
      {showAddMentor && (
        <Modal title={editingMentor ? "✏️ แก้ไขพี่เลี้ยง" : "➕ เพิ่มพี่เลี้ยง"} onClose={() => { setShowAddMentor(false); setEditingMentor(null); }}>
          <MentorForm form={mentorForm} setForm={setMentorForm} onSubmit={saveMentor} />
        </Modal>
      )}
```

เพิ่มบล็อกใหม่ต่อท้าย (หลัง `)}` ของบล็อกข้างบน):

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

- [ ] **Step 6: ตรวจ TypeScript**

Run: `cd Frontend && npx tsc --noEmit`
Expected: ไม่มี error (exit code 0, ไม่มี output)

- [ ] **Step 7: ทดสอบ golden path จริงในเบราว์เซอร์ (ฝั่งเจ้าหน้าที่)**

ถ้า dev server ยังไม่รัน ใช้ skill `run-dev` ก่อน แล้ว login เป็น staff ที่ `/admin/company`:

1. กด "+ เพิ่มบริษัท" → กรอกฟอร์ม (ชื่อ, ที่อยู่ครบทุกช่อง required, เบอร์โทร) → กด "💾 บันทึกข้อมูลบริษัท"
2. **คาดหวัง:** modal เดิมปิด เปลี่ยนเป็น modal ใหม่ "✅ เพิ่มบริษัทสำเร็จ" พร้อมชื่อบริษัทที่เพิ่งกรอก และปุ่ม "ข้ามไปก่อน" / "เพิ่มพี่เลี้ยงเลย"
3. กด "เพิ่มพี่เลี้ยงเลย" → **คาดหวัง:** เปลี่ยนเป็น modal "➕ เพิ่มพี่เลี้ยง" (ฟอร์ม `MentorForm` เดิม)
4. กรอกฟอร์มพี่เลี้ยงให้ครบ (ชื่อ, นามสกุล, ตำแหน่ง, แผนก, อีเมล, เบอร์โทร) → กด "💾 บันทึกข้อมูลพี่เลี้ยง"
5. **คาดหวัง:** modal ทั้งหมดปิด กลับมาที่หน้ารายการบริษัท (ไม่ใช่หน้ารายละเอียด)
6. กด "รายละเอียด" ที่บริษัทเดิมอีกครั้ง → **คาดหวัง:** เห็นพี่เลี้ยงที่เพิ่งเพิ่มอยู่ในตาราง "ข้อมูลพี่เลี้ยง"
7. เปิด DevTools console — **คาดหวัง:** ไม่มี error สีแดง

- [ ] **Step 8: ทดสอบ skip path จริงในเบราว์เซอร์**

1. กด "+ เพิ่มบริษัท" → กรอกฟอร์มบริษัทอันใหม่อีกอัน → บันทึก
2. ที่หน้า "✅ เพิ่มบริษัทสำเร็จ" กด "ข้ามไปก่อน"
3. **คาดหวัง:** modal ปิดทั้งหมด กลับหน้ารายการ บริษัทใหม่ปรากฏในตาราง ไม่มี mentor ใดๆ (ตามที่คาดไว้ เพราะยังไม่ได้เพิ่ม)

- [ ] **Step 9: ทดสอบว่า flow เดิม (เพิ่มพี่เลี้ยงจากหน้ารายละเอียดตามปกติ) ไม่เปลี่ยน**

1. กด "รายละเอียด" ที่บริษัทเดิม (บริษัทที่มีอยู่แล้วก่อนหน้านี้ ไม่ใช่บริษัทที่เพิ่งสร้างใน Step 7-8)
2. กด "+ เพิ่มพี่เลี้ยง" (ปุ่มในหน้ารายละเอียด ไม่ใช่จาก flow ใหม่) → กรอกฟอร์ม → บันทึก
3. **คาดหวัง:** modal "เพิ่มพี่เลี้ยง" ปิด แต่ **ยังอยู่ที่หน้า "รายละเอียดสถานประกอบการ" เดิม** (ไม่ปิดกลับไปหน้ารายการ) — เห็นพี่เลี้ยงคนใหม่อยู่ในตารางทันที — ยืนยันว่า behavior เดิมไม่เปลี่ยน

- [ ] **Step 10: Commit**

```bash
git add Frontend/src/components/A_Company.tsx
git commit -m "feat: prompt to add mentor right after creating a company (staff)"
```

---

### Task 2: `S_Company.tsx` (ฝั่งนักศึกษา) — quick-add-mentor flow

**Files:**
- Modify: `Frontend/src/components/S_Company.tsx:51-59` (state), `:100-117` (`saveAdd`), `:163-202` (`saveMentor`), `:299` (ปุ่ม "+ เพิ่มพี่เลี้ยง" ใน modal รายละเอียด), `:329-331` (ตำแหน่งแทรก modal ใหม่)

**Interfaces:**
- Consumes: `CompanyRecord` interface ที่มีอยู่แล้วในไฟล์เดียวกัน (บรรทัด 16), `Modal` component ที่มีอยู่แล้วในไฟล์เดียวกัน, `MentorForm` component ที่มีอยู่แล้วในไฟล์เดียวกัน
- Produces: ไม่มีไฟล์อื่นพึ่งพา task นี้ — เป็นการเปลี่ยนแปลงภายในไฟล์เดียว ปิดจบในตัว (ขนานกับ Task 1 แต่เป็นไฟล์/หน้าคนละหน้า ของนักศึกษา)

- [ ] **Step 1: เพิ่ม state ใหม่ 2 ตัว**

เปิด `Frontend/src/components/S_Company.tsx` หาบรรทัดนี้ (มีอยู่แล้วที่บรรทัด ~55-56):

```tsx
    const [showAddMentor, setShowAddMentor] = useState(false);
    const [editingMentor, setEditingMentor] = useState<MentorRecord | null>(null);
```

แก้เป็น:

```tsx
    const [showAddMentor, setShowAddMentor] = useState(false);
    const [editingMentor, setEditingMentor] = useState<MentorRecord | null>(null);
    const [justCreatedCompany, setJustCreatedCompany] = useState<CompanyRecord | null>(null);
    const [quickAddMentor, setQuickAddMentor] = useState(false);
```

- [ ] **Step 2: แก้ `saveAdd` ให้ตั้ง `justCreatedCompany` หลังบันทึกสำเร็จ**

หาฟังก์ชัน `saveAdd` (มีอยู่แล้วที่บรรทัด ~100-117) ส่วนนี้:

```tsx
            setItems(prev => [...prev, data.company]);
            setShowAdd(false);
            setForm(emptyCompany());
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }
```

แก้เป็น:

```tsx
            setItems(prev => [...prev, data.company]);
            setShowAdd(false);
            setForm(emptyCompany());
            setJustCreatedCompany(data.company);
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }
```

- [ ] **Step 3: แก้ `saveMentor` ให้ปิด flow ทั้งหมดเมื่อมาจาก quick-add**

หาส่วนท้ายของฟังก์ชัน `saveMentor` (มีอยู่แล้วที่บรรทัด ~198-202) ส่วนนี้:

```tsx
            setEditingMentor(null);
            setMentorForm(emptyMentor());
            setShowAddMentor(false);
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }
```

แก้เป็น:

```tsx
            setEditingMentor(null);
            setMentorForm(emptyMentor());
            setShowAddMentor(false);

            if (quickAddMentor) {
                setViewCompany(null);
                setQuickAddMentor(false);
            }
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }
```

- [ ] **Step 4: แก้ปุ่ม "+ เพิ่มพี่เลี้ยง" ใน modal รายละเอียดให้ reset flag**

หาปุ่มนี้ (มีอยู่แล้วที่บรรทัด ~299):

```tsx
                    <button className="btn-secondary small" onClick={() => setShowAddMentor(true)}>+ เพิ่มพี่เลี้ยง</button>
```

แก้เป็น:

```tsx
                    <button className="btn-secondary small" onClick={() => { setQuickAddMentor(false); setShowAddMentor(true); }}>+ เพิ่มพี่เลี้ยง</button>
```

- [ ] **Step 5: เพิ่ม modal ถาม "เพิ่มพี่เลี้ยงเลยหรือไม่"**

หาบล็อกนี้ (มีอยู่แล้วที่บรรทัด ~329-331):

```tsx
            {showAddMentor && <Modal title={editingMentor ? "แก้ไขพี่เลี้ยง" : "เพิ่มพี่เลี้ยง"} onClose={() => { setShowAddMentor(false); setEditingMentor(null) }}>
                <MentorForm form={mentorForm} setForm={setMentorForm} onSubmit={saveMentor} />
            </Modal>}
```

เพิ่มบล็อกใหม่ต่อท้าย (หลัง `</Modal>}` ของบล็อกข้างบน):

```tsx
            {justCreatedCompany && <Modal title="✅ เพิ่มบริษัทสำเร็จ" onClose={() => setJustCreatedCompany(null)}>
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
            </Modal>}
```

- [ ] **Step 6: ตรวจ TypeScript**

Run: `cd Frontend && npx tsc --noEmit`
Expected: ไม่มี error (exit code 0, ไม่มี output)

- [ ] **Step 7: ทดสอบ golden path จริงในเบราว์เซอร์ (ฝั่งนักศึกษา)**

Login เป็น student ที่มีสิทธิ์เข้าหน้าบริษัท (`/student/company` หรือ path ที่ `S_Company.tsx` ถูก mount — ตรวจจาก routing ปัจจุบันใน `S_App.tsx` ถ้าไม่แน่ใจ path):

1. กด "+ เพิ่มบริษัทใหม่" → กรอกฟอร์ม (ชื่อ, ที่อยู่ครบทุกช่อง required, เบอร์โทร) → กด "💾 บันทึกข้อมูลบริษัท"
2. **คาดหวัง:** modal เดิมปิด เปลี่ยนเป็น modal ใหม่ "✅ เพิ่มบริษัทสำเร็จ" พร้อมชื่อบริษัทที่เพิ่งกรอก
3. กด "เพิ่มพี่เลี้ยงเลย" → กรอกฟอร์มพี่เลี้ยงให้ครบ → กด "💾 บันทึกข้อมูลพี่เลี้ยง"
4. **คาดหวัง:** modal ทั้งหมดปิด กลับมาที่หน้ารายการบริษัท
5. กด "ดูรายละเอียด" ที่บริษัทเดิมอีกครั้ง → **คาดหวัง:** เห็นพี่เลี้ยงที่เพิ่งเพิ่มอยู่ในตาราง
6. เปิด DevTools console — **คาดหวัง:** ไม่มี error สีแดง

- [ ] **Step 8: ทดสอบ skip path และ flow เดิมไม่เปลี่ยน (เหมือน Step 8-9 ของ Task 1 แต่ทำในหน้านักศึกษา)**

1. เพิ่มบริษัทใหม่อีกอัน → ที่หน้า "✅ เพิ่มบริษัทสำเร็จ" กด "ข้ามไปก่อน" → **คาดหวัง:** กลับหน้ารายการ บริษัทใหม่ไม่มี mentor
2. เปิด "ดูรายละเอียด" บริษัทที่มีอยู่แล้วก่อนหน้า → กด "+ เพิ่มพี่เลี้ยง" ปกติ → บันทึก → **คาดหวัง:** ยังอยู่ที่หน้ารายละเอียดเดิม ไม่ปิด

- [ ] **Step 9: Commit**

```bash
git add Frontend/src/components/S_Company.tsx
git commit -m "feat: prompt to add mentor right after creating a company (student)"
```

---

### Task 3: อัปเดต CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (เพิ่ม entry ใหม่ที่บรรทัดบนสุด ใต้ `# CHANGELOG — Co_project`)

**Interfaces:**
- Consumes: ผลการทดสอบจาก Task 1 และ Task 2 (ต้องผ่านทั้งคู่ก่อนเขียน entry นี้)
- Produces: ไม่มี — เป็น task สุดท้ายของ plan นี้

- [ ] **Step 1: เพิ่ม CHANGELOG entry**

เปิด `CHANGELOG.md` เพิ่มบล็อกนี้ต่อจากบรรทัด `# CHANGELOG — Co_project` (บรรทัดบนสุดของไฟล์):

```markdown

## [2026-06-23] เพิ่ม flow ต่อเนื่อง "เพิ่มพี่เลี้ยง" หลังเพิ่มบริษัทใหม่

### Changed
- `Frontend/src/components/A_Company.tsx` และ `Frontend/src/components/S_Company.tsx`: หลังเพิ่มบริษัทใหม่สำเร็จ เดิม modal จะปิดเงียบๆ กลับไปหน้ารายการ ไม่มีการแนะนำให้ไปเพิ่มข้อมูลพี่เลี้ยงต่อ ผู้ใช้ (ทั้งเจ้าหน้าที่และนักศึกษาที่เพิ่มบริษัทของตัวเอง) ต้องจำเองว่าต้องกลับไปกด "รายละเอียด" แล้วกด "+ เพิ่มพี่เลี้ยง" แยกต่างหาก เพิ่มหน้าถาม "เพิ่มพี่เลี้ยงเลยหรือไม่" หลังบันทึกบริษัทสำเร็จ พร้อมปุ่ม "เพิ่มพี่เลี้ยงเลย" (ไปกรอกฟอร์มพี่เลี้ยงต่อทันที reuse ฟอร์มเดิม) และ "ข้ามไปก่อน" (กลับหน้ารายการแบบเดิม) — ไม่บังคับ skip ได้

### Process notes
- Flow การเพิ่มพี่เลี้ยงจากหน้า "รายละเอียดบริษัท" ตามปกติ (ปุ่ม "+ เพิ่มพี่เลี้ยง" ที่มีอยู่แล้ว) ไม่เปลี่ยน behavior — ยังคงอยู่ที่หน้ารายละเอียดหลังบันทึกสำเร็จเหมือนเดิม การเปลี่ยนแปลงนี้มีผลเฉพาะตอน "เพิ่มบริษัทใหม่" เท่านั้น
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for company-add-then-prompt-mentor flow"
```

---

## Self-Review Notes (สำหรับคนเขียน plan — ไม่ใช่ task)

- **Spec coverage:** ครอบคลุมทุก requirement ใน spec — flow ถาม/ข้าม (Task 1-2 Step 5), ปิดอัตโนมัติหลังบันทึกพี่เลี้ยงคนแรกจาก quick-add (Step 3), ไม่กระทบ flow เดิมจากหน้ารายละเอียด (Step 4 + Step 9/8 verification), ทั้ง 2 ไฟล์ (Task 1, 2), CHANGELOG (Task 3)
- **Type consistency:** `justCreatedCompany` ใช้ type `AdminCompanyRecord` ใน Task 1 และ `CompanyRecord` ใน Task 2 — ตรงกับ type ที่มีอยู่แล้วในแต่ละไฟล์ ไม่ใช่ type เดียวกันข้ามไฟล์ (เพราะเป็น 2 ไฟล์อิสระ ไม่ import ข้ามกัน)
- **No placeholders:** ทุก step มีโค้ดเต็มและ context บรรทัดที่ต้องหา ไม่มี TBD
