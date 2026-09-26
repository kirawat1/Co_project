# เปลี่ยนชื่อเรียก สาขา → หลักสูตร · หลักสูตร → รูปแบบการศึกษา — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ข้อความบนหน้าจอ ไฟล์ Excel และข้อความตอบกลับจากระบบ เรียก `major` (CS, AI …) ว่า **"หลักสูตร"** และเรียก `studyProgram` (ภาคปกติ/ภาคพิเศษ) ว่า **"รูปแบบการศึกษา"** ให้ตรงกันทั้งระบบ

**Architecture:** เปลี่ยนเฉพาะข้อความที่ผู้ใช้เห็น ไม่แตะชื่อฟิลด์ฐานข้อมูล/ชื่อตัวแปร/API · ทำ **สองจังหวะ** ในแต่ละไฟล์ — เปลี่ยน "หลักสูตร" (ความหมายเดิม = ภาคปกติ/พิเศษ) เป็น "รูปแบบการศึกษา" **ก่อน** แล้วค่อยเปลี่ยน "สาขา" เป็น "หลักสูตร" (ถ้าสลับลำดับ คำที่เพิ่งเปลี่ยนจะถูกเปลี่ยนซ้ำ) · มีเทสต์กันคำเก่ากลับมาในข้อความหน้าจอ

**Tech Stack:** React 19 + TypeScript (frontend) · Express + Jest (backend)

**Spec:** โน้ตผู้ใช้ "เปลี่ยน สาขา -> หลักสูตร, หลักสูตร -> รูปแบบการศึกษา" (ลำดับ 2 ในรายการความสำคัญ, ยืนยันในแชต 2026-09-26)

## Global Constraints

- **ไม่แก้หนังสือราชการ/แบบฟอร์มทางการ** (ไฟล์ใน `Frontend/src/utils/pdf*.ts`, `docGeneratorUtils.ts`) — ข้อความเช่น "หลักสูตร … สาขาวิชา …", "สาขาวิชาวิทยาการคอมพิวเตอร์", ช่อง "สาขาวิชา" ใน T000/T003 เป็นรูปแบบของมหาวิทยาลัย
- **ไม่แก้หัวคอลัมน์ที่อ่านจากไฟล์นำเข้า** (`backend/controllers/studentImportController.js` — `'สาขาวิชา/แผนกการศึกษา'`, `'ภาคการศึกษา (ปกติ/พิเศษ)'` มาจากไฟล์ของทะเบียน/แบบฟอร์มภายนอก)
- ไม่เปลี่ยนชื่อฟิลด์ DB (`major`, `studyProgram`), ชื่อตัวแปร (`CURRICULUM_TH`, `filterMajor` …), route, หรือคอมเมนต์ในโค้ด
- คำที่ใช้: `major` → **หลักสูตร** (ช่องกรอก/หัวตาราง), "สาขาวิชา" → **หลักสูตร**, "รหัสสาขา" → **รหัสหลักสูตร**, "ทุกสาขา" → **ทุกหลักสูตร**, "จัดการสาขาวิชา" → **จัดการหลักสูตร** · `studyProgram` → **รูปแบบการศึกษา** (รวมคำเดิม "หลักสูตร", "หลักสูตรการศึกษา", "ระบบการศึกษา", "แผนการศึกษา")
- ห้ามใช้ `alert/confirm/prompt` · tsc baseline = **23 error เดิม** · CHANGELOG ทุกครั้ง · commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- แก้ไฟล์โดยคงรูปแบบบรรทัดเดิม (ไฟล์ปน LF/CRLF)

## Review Focus

1. **เปลี่ยนซ้ำสองรอบ** — "หลักสูตร" เดิม (ภาคปกติ/พิเศษ) กลายเป็น "รูปแบบการศึกษา" แล้ว "สาขา" กลายเป็น "หลักสูตร" ต้องไม่มีจุดไหนที่หัวข้อ `studyProgram` แสดงเป็น "หลักสูตร" → ตรวจใน Task 3 (grep คำว่า "หลักสูตร" ทุกจุดที่เหลือต้องเป็นของ `major`)
2. **ป้ายเดียวกันต่างหน้า** — หน้าเจ้าหน้าที่/อาจารย์/นักศึกษาดูข้อมูลคนเดียวกันต้องเรียกเหมือนกัน → เทสต์กันคำเก่าใน Task 3 ครอบคลุมทุก `components/*.tsx`
3. **ไฟล์ Excel ที่ถูกเปิดด้วยสูตร/ระบบอื่นอ้างหัวคอลัมน์เก่า** — หัวคอลัมน์ "สาขา"/"ระบบการศึกษา" เปลี่ยน ใครทำ VLOOKUP ตามชื่อหัวจะพัง → ระบุใน CHANGELOG ชัดๆ (Task 2) · ไม่มีทางแก้ในโค้ด
4. **หนังสือราชการถูกแก้โดยไม่ตั้งใจ** → เทสต์ใน Task 3 ยืนยันว่าข้อความทางการใน `utils/pdf*.ts` ยังเหมือนเดิม
5. **ข้อความ error จาก backend ที่หน้าเว็บแสดงตรงๆ** ("ไม่พบสาขาวิชา …") → Task 2 แก้พร้อมเทสต์ที่ match ข้อความ

---

## File Structure

- Modify (frontend, ข้อความเท่านั้น): `A_Students.tsx`, `A_StudentEditModal.tsx`, `A_AddStudentModal.tsx`, `A_CriteriaPage.tsx`, `A_Sidebar.tsx`, `A_Teacher.tsx`, `A_Announcements.tsx`, `S_ProfilePage.tsx`, `S_Gateway.tsx`, `T_Students.tsx`, `T_StudentDetail.tsx`, `T_Profile.tsx`
- Modify (backend): `backend/utils/studentExport.js`, `backend/controllers/criteriaController.js`, `backend/controllers/studentController.js:745`
- Modify (tests): `backend/__tests__/studentExport.test.js`, `backend/__tests__/studentController.test.js:890`
- Create: `backend/__tests__/terminology.test.js` — กันคำเก่ากลับมา + กันหนังสือราชการถูกแก้
- Modify: `CHANGELOG.md`

---

### Task 1: หน้าเว็บ — เปลี่ยนป้ายทุกจุด

**Files:** ไฟล์ frontend ตาม File Structure (ตำแหน่งบรรทัดจากการสำรวจ 2026-09-26)

**Interfaces:** ไม่มี (ข้อความล้วน)

- [ ] **Step 1: จังหวะที่ 1 — `studyProgram`: "หลักสูตร/ระบบการศึกษา/แผนการศึกษา/หลักสูตรการศึกษา" → "รูปแบบการศึกษา"**

| ไฟล์:บรรทัด | เดิม | ใหม่ |
|---|---|---|
| `A_Students.tsx:525` | `"สาขาวิชา", "หลักสูตร",` (หัวตารางตัวอย่างนำเข้า) | `"หลักสูตร", "รูปแบบการศึกษา",` |
| `A_Students.tsx:651` | `title="ระบบการศึกษา"` | `title="รูปแบบการศึกษา"` |
| `A_Students.tsx:723` | `{ label: "ระบบการศึกษา", key: "studyProgram" }` | `{ label: "รูปแบบการศึกษา", key: "studyProgram" }` |
| `A_Students.tsx:766` | `data-label="ระบบการศึกษา"` | `data-label="รูปแบบการศึกษา"` |
| `A_Students.tsx:886` | `InfoRow label="ระบบการศึกษา"` | `InfoRow label="รูปแบบการศึกษา"` |
| `A_StudentEditModal.tsx:132` | `<Field label="หลักสูตร">` | `<Field label="รูปแบบการศึกษา">` |
| `A_AddStudentModal.tsx:139` | `แผนการศึกษา` | `รูปแบบการศึกษา` |
| `A_CriteriaPage.tsx:344` | `📋 หลักสูตรการศึกษา` | `📋 รูปแบบการศึกษา` |
| `A_CriteriaPage.tsx:349` | `>หลักสูตร</div>` | `>รูปแบบการศึกษา</div>` |
| `S_ProfilePage.tsx:424` | `label="หลักสูตรการศึกษา"` | `label="รูปแบบการศึกษา"` |
| `S_Gateway.tsx:420` | `หลักสูตร:</span>` | `รูปแบบการศึกษา:</span>` |
| `T_StudentDetail.tsx:275` | `หลักสูตร: <b>` | `รูปแบบการศึกษา: <b>` |
| `T_StudentDetail.tsx:312` | `InfoRow label="หลักสูตร"` | `InfoRow label="รูปแบบการศึกษา"` |
| `T_Students.tsx:254` | `📚 ทุกหลักสูตร` | `📚 ทุกรูปแบบการศึกษา` |
| `T_Students.tsx:268` | `<th>หลักสูตร</th>` | `<th>รูปแบบการศึกษา</th>` |
| `T_Students.tsx:290` | `data-label="หลักสูตร"` | `data-label="รูปแบบการศึกษา"` |
| `T_Students.tsx:449` | `InfoRow label="หลักสูตร"` | `InfoRow label="รูปแบบการศึกษา"` |

ช่องเลือก `studyProgram` ในฟอร์มแก้ไขของนักศึกษาเอง (`S_ProfilePage.tsx` ใกล้บรรทัด 580 ที่มี `studyProgramMapToUI`) — ถ้ามีป้ายของช่องนั้น ให้เป็น "รูปแบบการศึกษา" ด้วย ตรวจด้วย:
```bash
grep -n "studyProgram" Frontend/src/components/S_ProfilePage.tsx
```

- [ ] **Step 2: จังหวะที่ 2 — `major`: "สาขา/สาขาวิชา" → "หลักสูตร"**

| ไฟล์:บรรทัด | เดิม | ใหม่ |
|---|---|---|
| `A_Students.tsx:483` | `` ` · เพิ่มสาขาใหม่ ${…} สาขา` `` | `` ` · เพิ่มหลักสูตรใหม่ ${…} หลักสูตร` `` |
| `A_Students.tsx:635` | `>สาขาวิชา</div>` | `>หลักสูตร</div>` |
| `A_Students.tsx:642` | `🎓 ทุกสาขา` | `🎓 ทุกหลักสูตร` |
| `A_Students.tsx:646` | `— ยังไม่ระบุสาขา —` | `— ยังไม่ระบุหลักสูตร —` |
| `A_Students.tsx:722` | `{ label: "สาขา", key: null }` | `{ label: "หลักสูตร", key: null }` |
| `A_Students.tsx:765` | `data-label="สาขา"` | `data-label="หลักสูตร"` |
| `A_Students.tsx:885` | `InfoRow label="สาขาวิชา"` | `InfoRow label="หลักสูตร"` |
| `A_AddStudentModal.tsx:125` | `สาขาวิชา / หลักสูตร` | `หลักสูตร` |
| `A_AddStudentModal.tsx:127` | `"-- เลือกสาขาวิชา --"` | `"-- เลือกหลักสูตร --"` |
| `A_AddStudentModal.tsx:135` | `ยังไม่มีสาขาวิชา — เพิ่มที่เมนู "จัดการสาขาวิชา"` | `ยังไม่มีหลักสูตร — เพิ่มที่เมนู "จัดการหลักสูตร"` |
| `A_Sidebar.tsx:176` | `จัดการสาขาวิชา` | `จัดการหลักสูตร` |
| `A_CriteriaPage.tsx:103` | `"เพิ่มสาขาวิชาล้มเหลว"` | `"เพิ่มหลักสูตรไม่สำเร็จ"` |
| `A_CriteriaPage.tsx:178` | `🏛️ จัดการสาขาวิชา` | `🏛️ จัดการหลักสูตร` |
| `A_CriteriaPage.tsx:181` | `เพิ่ม แก้ไข หรือลบสาขาวิชา · <strong>รหัสสาขา</strong>` | `เพิ่ม แก้ไข หรือลบหลักสูตร · <strong>รหัสหลักสูตร</strong>` |
| `A_CriteriaPage.tsx:186` | `+ เพิ่มสาขาวิชา` | `+ เพิ่มหลักสูตร` |
| `A_CriteriaPage.tsx:203` | `>รหัสสาขา</div>` | `>รหัสหลักสูตร</div>` |
| `A_CriteriaPage.tsx:248` | `ยังไม่มีสาขาวิชา — กดปุ่ม "+ เพิ่มสาขาวิชา"` | `ยังไม่มีหลักสูตร — กดปุ่ม "+ เพิ่มหลักสูตร"` |
| `A_CriteriaPage.tsx:284` | `รหัสสาขา (ตัวย่อ)` | `รหัสหลักสูตร (ตัวย่อ)` |
| `A_CriteriaPage.tsx:309` | `แก้ไขเพื่อตั้งรหัสสาขา` | `แก้ไขเพื่อตั้งรหัสหลักสูตร` |
| `A_CriteriaPage.tsx:364` | `ยืนยันการลบสาขาวิชา` | `ยืนยันการลบหลักสูตร` |
| `A_CriteriaPage.tsx:366-367` | `ต้องการลบสาขาวิชา` · `ที่เลือกสาขานี้ไว้` · `เลือกสาขานี้ใหม่ได้` | `ต้องการลบหลักสูตร` · `ที่เลือกหลักสูตรนี้ไว้` · `เลือกหลักสูตรนี้ใหม่ได้` |
| `A_Teacher.tsx:294, 358, 393, 594, 596` | `สาขาวิชา` / `-- เลือกสาขาวิชา --` | `หลักสูตร` / `-- เลือกหลักสูตร --` |
| `A_Announcements.tsx:264` | `ทุกสาขา (ไม่จำกัดสาขา)` | `ทุกหลักสูตร (ไม่จำกัดหลักสูตร)` |
| `A_Announcements.tsx:298, 379` | `ทุกสาขา` | `ทุกหลักสูตร` |
| `A_Announcements.tsx:381, 388` | `ยังไม่มีข้อมูลสาขา` · `เลือกสาขา` | `ยังไม่มีข้อมูลหลักสูตร` · `เลือกหลักสูตร` |
| `S_ProfilePage.tsx:381` | `ชื่อ-นามสกุล, สาขา, คณะ` | `ชื่อ-นามสกุล, หลักสูตร, คณะ` |
| `S_ProfilePage.tsx:423` | `label="สาขาวิชา"` | `label="หลักสูตร"` |
| `S_ProfilePage.tsx:664, 666` | `สาขาวิชา` · `-- เลือกสาขาวิชา --` | `หลักสูตร` · `-- เลือกหลักสูตร --` |
| `T_Profile.tsx:208, 271, 277` | `สาขาวิชา` · `-- เลือกสาขาวิชา --` | `หลักสูตร` · `-- เลือกหลักสูตร --` |

(บรรทัดที่เป็นคอมเมนต์ เช่น `A_Students.tsx:136, 193, 257, 849`, `A_AddStudentModal.tsx:30, 123`, `A_Announcements.tsx:57`, `T_Profile.tsx:133` — **ไม่แก้**)

- [ ] **Step 3: ตรวจว่าไม่เหลือ** — ต้องไม่มีผลลัพธ์ที่ไม่ใช่คอมเมนต์:
```bash
cd Frontend/src/components
grep -n "สาขา\|ระบบการศึกษา\|แผนการศึกษา\|หลักสูตรการศึกษา" *.tsx | grep -v "^\S*:\s*//\|{/\*"
```
และทุกบรรทัดที่มี "หลักสูตร" ต้องเป็นเรื่อง `major` (ไม่มีคำว่า ภาคปกติ/studyProgram/CURRICULUM อยู่ใกล้):
```bash
grep -n "หลักสูตร" *.tsx | grep -v "รูปแบบการศึกษา"
```
- [ ] **Step 4: tsc** — `cd Frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → 23
- [ ] **Step 5: Commit** `refactor(ui): เรียกสาขาว่าหลักสูตร และภาคปกติ/พิเศษว่ารูปแบบการศึกษา`

---

### Task 2: Backend — หัวคอลัมน์ Excel + ข้อความตอบกลับ

**Files:**
- Modify: `backend/utils/studentExport.js:60-61, 201-202`
- Modify: `backend/controllers/criteriaController.js:24, 46, 56, 57`, `backend/controllers/studentController.js:745`
- Test: `backend/__tests__/studentExport.test.js` (บรรทัด 29, 77-78, 120-121, 144, 155-156), `backend/__tests__/studentController.test.js:890`, `backend/__tests__/criteriaController.test.js`

- [ ] **Step 1: แก้เทสต์ให้คาดหวังชื่อใหม่ (fail ก่อน)**
  - `studentExport.test.js`: แทน `'สาขา':` → `'หลักสูตร':` และ `'ระบบการศึกษา'` → `'รูปแบบการศึกษา'` ทุกจุด (บรรทัด 29, 77, 78, 120, 121, 155, 156) · ชื่อเทสต์บรรทัด 144 เปลี่ยนเป็น `'หลักสูตร: ไม่มีชื่อไทยใน criteria ใช้ค่าเดิม · รูปแบบการศึกษาภาคปกติ · …'`
  - `studentController.test.js:890`: `toMatch(/ไม่พบหลักสูตร/)`
  - `criteriaController.test.js`: ถ้ามี assertion ข้อความ `"กรุณาระบุชื่อสาขา"` / `"ไม่พบสาขาวิชา"` / `"ชื่อสาขาวิชานี้มีอยู่แล้ว"` ให้เปลี่ยนเป็นชื่อใหม่ตามตาราง Step 3 (ตรวจ: `grep -n "สาขา" backend/__tests__/criteriaController.test.js`)

Run: `cd backend && npx jest __tests__/studentExport.test.js __tests__/studentController.test.js __tests__/criteriaController.test.js`
Expected: FAIL (หัวคอลัมน์/ข้อความยังเป็นแบบเก่า)

- [ ] **Step 2: studentExport.js**

```js
  ['หลักสูตร', 22],
  ['รูปแบบการศึกษา', 13],
```
```js
    // major เก็บเป็นรหัส (CS) — ใช้ชื่อไทยจาก criteria ถ้ามี
    'หลักสูตร': dash(resolveMajorNameTh(student.major, criteria) || student.major),
    'รูปแบบการศึกษา': STUDY_PROGRAM_LABEL_TH[student.studyProgram] || '-',
```

- [ ] **Step 3: ข้อความตอบกลับ**

| ไฟล์:บรรทัด | เดิม | ใหม่ |
|---|---|---|
| `criteriaController.js:24, 46` | `"กรุณาระบุชื่อสาขา"` | `"กรุณาระบุชื่อหลักสูตร"` |
| `criteriaController.js:56` | `"ไม่พบสาขาวิชาที่ต้องการแก้ไข…"` | `"ไม่พบหลักสูตรที่ต้องการแก้ไข…"` (คงท้ายข้อความเดิม) |
| `criteriaController.js:57` | `"ชื่อสาขาวิชานี้มีอยู่แล้ว"` | `"ชื่อหลักสูตรนี้มีอยู่แล้ว"` |
| `studentController.js:745` | `` `ไม่พบสาขาวิชา "${majorInput}" ในระบบ — เพิ่มที่…` `` | `` `ไม่พบหลักสูตร "${majorInput}" ในระบบ — เพิ่มที่เมนู "จัดการหลักสูตร"` `` (ถ้าท้ายข้อความเดิมอ้างชื่อเมนู ให้เปลี่ยนชื่อเมนูด้วย) |

- [ ] **Step 4: รัน** — `npx jest` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `refactor(api): หัวคอลัมน์ Excel และข้อความใช้ หลักสูตร / รูปแบบการศึกษา`

---

### Task 3: เทสต์กันคำเก่ากลับมา + กันหนังสือราชการถูกแก้

**Files:**
- Create: `backend/__tests__/terminology.test.js`

- [ ] **Step 1: เขียนเทสต์**

```js
/**
 * ชื่อเรียกมาตรฐาน: major = "หลักสูตร" · studyProgram = "รูปแบบการศึกษา"
 * กันคำเก่า (สาขา / ระบบการศึกษา / แผนการศึกษา / หลักสูตรการศึกษา) กลับมาในข้อความหน้าจอ
 * และกันหนังสือราชการ (utils/pdf*.ts) ถูกแก้ตาม — หนังสือใช้ถ้อยคำทางการของมหาวิทยาลัย
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'Frontend', 'src');
const COMPONENTS = path.join(SRC, 'components');
const hasFrontend = fs.existsSync(COMPONENTS);

// ตัดคอมเมนต์ (// … และ /* … */ รวม {/* … */} ใน JSX) — คอมเมนต์ในโค้ดพูดถึง "สาขา" ได้
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');
}

const OLD_TERMS = /สาขา|ระบบการศึกษา|แผนการศึกษา|หลักสูตรการศึกษา/;

(hasFrontend ? describe : describe.skip)('ชื่อเรียก หลักสูตร / รูปแบบการศึกษา', () => {
  test('หน้าเว็บ (components) ไม่ใช้คำเก่าในข้อความ', () => {
    const hits = [];
    for (const name of fs.readdirSync(COMPONENTS).filter((n) => n.endsWith('.tsx'))) {
      stripComments(fs.readFileSync(path.join(COMPONENTS, name), 'utf8')).split('\n').forEach((line, i) => {
        if (OLD_TERMS.test(line)) hits.push(`${name}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  test('หนังสือราชการยังใช้ถ้อยคำทางการเดิม (ไม่ถูกเปลี่ยนตาม)', () => {
    const read = (f) => fs.readFileSync(path.join(SRC, 'utils', f), 'utf8');
    expect(read('pdfGeneratorParentalConsent.ts')).toMatch(/หลักสูตร \$\{curriculum\} สาขาวิชา \$\{major\}/);
    expect(read('pdfSupervisionLetterGenerator.ts')).toMatch(/สาขาวิชาวิทยาการคอมพิวเตอร์/);
    expect(read('pdfGeneratorT000.ts')).toMatch(/drawText\("สาขาวิชา"/);
  });
});

test('ไฟล์ Excel ใช้หัวคอลัมน์ หลักสูตร / รูปแบบการศึกษา', () => {
  const { EXPORT_HEADERS } = require('../utils/studentExport');
  expect(EXPORT_HEADERS).toEqual(expect.arrayContaining(['หลักสูตร', 'รูปแบบการศึกษา']));
  expect(EXPORT_HEADERS.some((h) => OLD_TERMS.test(h))).toBe(false);
});
```

- [ ] **Step 2: รัน** — `cd backend && npx jest __tests__/terminology.test.js` → PASS (ถ้า FAIL แปลว่า Task 1 ตกหล่น — แก้ไฟล์ที่เทสต์ชี้ แล้วรันใหม่)
- [ ] **Step 3: ลองว่าเทสต์จับได้จริง** — ใส่ `<span>สาขา</span>` ชั่วคราวใน `A_Sidebar.tsx` → รัน → ต้อง FAIL ชี้ไฟล์นั้น → ลบออก → PASS
- [ ] **Step 4: Commit** `test: กันชื่อเรียกสาขา/ระบบการศึกษากลับมา และกันหนังสือราชการถูกแก้`

---

### Task 4: ตรวจทั้งระบบ + CHANGELOG

- [ ] **Step 1: รันทั้งหมด** (restart backend ก่อน e2e — rate limit 500/15 นาที)
  - `cd backend && npx jest` → PASS
  - `cd Frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → 23 · `npx vite build` ผ่าน
  - `npx playwright test --config=playwright.config.ts` → ผ่านทั้งหมด (e2e ไม่มี selector ที่อ้างคำเหล่านี้ — ตรวจแล้ว 2026-09-26)
  - crawl ทุกหน้า → ไม่มีปัญหา
  - เปิดดูด้วยตา: `/admin/students` (ตัวกรอง + หัวตาราง + หน้าต่างดูข้อมูล), `/admin/criteria`, เมนูข้าง, `/teacher/students`, `/student/profile`, `/student/gateway` · export Excel แล้วดูหัวคอลัมน์
- [ ] **Step 2: CHANGELOG** — entry `## [วันที่] refactor: เปลี่ยนชื่อเรียก สาขา → หลักสูตร · หลักสูตร → รูปแบบการศึกษา` ระบุ:
  - ขอบเขต: ข้อความหน้าจอ, หัวคอลัมน์ Excel ("สาขา" → "หลักสูตร", "ระบบการศึกษา" → "รูปแบบการศึกษา"), ข้อความตอบกลับ, เมนู "จัดการหลักสูตร"
  - **ไม่เปลี่ยน**: หนังสือราชการ/แบบฟอร์ม T000/T003/หนังสือผู้ปกครอง, หัวคอลัมน์ไฟล์นำเข้านักศึกษา, ฐานข้อมูล
  - ⚠️ ใครใช้ไฟล์ Excel ที่อ้างหัวคอลัมน์เดิม (สูตร/ระบบอื่น) ต้องปรับตาม
- [ ] **Step 3: Commit + push**

---

## ลำดับเทียบกับแผนผู้ติดต่อ (HR)
ทำก่อนหรือหลัง `2026-09-26-company-contacts.md` ก็ได้ ไม่ชนกัน — ถ้าทำแผนผู้ติดต่อก่อน ให้ grep ตรวจซ้ำ (Task 1 Step 3) เพราะหน้าที่แก้บางไฟล์ตรงกัน (`A_Students.tsx`, `S_ProfilePage.tsx`, `S_Gateway.tsx`, `T_Students.tsx`, `T_StudentDetail.tsx`) · แนะนำทำ **แผนนี้ก่อน** เพราะเล็กและเสร็จเร็ว
