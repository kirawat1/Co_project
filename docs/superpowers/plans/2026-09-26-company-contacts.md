# ผู้ติดต่อ (HR) แทนพี่เลี้ยง — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นักศึกษาเลือก/เพิ่ม "ผู้ติดต่อ (HR)" ของบริษัทแทนการเลือกพี่เลี้ยง (บังคับก่อนยื่นคำร้อง) ส่วนพี่เลี้ยงกรอกที่แบบฟอร์ม T002 ข้อ 3 ที่เดียว และหนังสือราชการใช้ผู้ติดต่อของคำร้องนั้นในช่อง "เรียน"

**Architecture:** เพิ่มตาราง `CompanyContact` โครงเดียวกับ `Mentor` (ผูกบริษัท + many-to-many กับ `StudentCoop`) พร้อม API CRUD ชุดเดียวกับพี่เลี้ยง ฝั่งหน้าเว็บสลับจุดที่นักศึกษาเลือกพี่เลี้ยงมาเป็นผู้ติดต่อ ใช้ฟอร์มผู้ติดต่อตัวเดียวร่วมกันทุกหน้า และรวมการเลือกผู้รับหนังสือไว้ที่ฟังก์ชันเดียว `letterRecipient()`

**Tech Stack:** Express + Prisma 4 + MySQL (backend, Jest) · React 19 + TypeScript + Vite (frontend, Playwright e2e)

**Spec:** การตัดสินใจจากผู้ใช้ในแชต (2026-09-26):
1. ผู้ติดต่อเหมือนพี่เลี้ยง (เลือกได้หลายคน, เพิ่มได้เอง) และมาแทนพี่เลี้ยงในหน้าข้อมูลนักศึกษา
2. พี่เลี้ยงกรอกตอน T002 ทีเดียว (ข้อ 3 — ระบบสร้างพี่เลี้ยงให้ตอนส่ง T002 อยู่แล้วใน `backend/utils/t002Supervisors.js`)
3. **บังคับ** มีผู้ติดต่ออย่างน้อย 1 คนก่อนยื่นคำร้อง
4. นักศึกษาที่เคยเลือกพี่เลี้ยงไว้ — **ปล่อยไว้** (เป็นข้อมูลทดสอบ) ไม่ต้องย้ายเป็นผู้ติดต่อ
5. **เพิ่มเมนู "ผู้ติดต่อ"** ให้เจ้าหน้าที่ (คงเมนู "พี่เลี้ยง" ไว้)

## Global Constraints

- ทำตาม `CLAUDE.md`: route ใส่ `verifyToken` ก่อน `verifyRole` · controller มี try/catch ตอบ `{ ok, ... }` · frontend ใช้ path แบบ relative + `apiFetch`
- ห้ามใช้ `alert/confirm/prompt` — ใช้ `notify` / `askConfirm` จาก `Frontend/src/utils/notify.ts` (มีเทสต์ `noNativeDialogs` ฟ้อง)
- ทุก route ที่เขียนข้อมูลต้องมีชื่อไทยใน `backend/utils/auditActions.js` (เทสต์ reverse-coverage ใน `backend/__tests__/auditLog.test.js` ฟ้อง)
- Migration: ชื่อตาราง PascalCase (`CompanyContact`, `StudentCoop`) — VM เป็น Linux ชื่อตารางแยกตัวพิมพ์ · สร้าง SQL ด้วย `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script` ตัดบรรทัด banner ของ CLI ทิ้ง แล้ว `migrate deploy` + `generate` (หยุด backend ก่อน)
- ไม่ลบคอลัมน์ `Company.contactPerson` / `contactPosition` — ใช้เป็นค่าสำรองของหนังสือ
- ไม่แตะแบบฟอร์ม T002 ข้อ 3 และ `syncT002SupervisorsToMentors`
- แก้ไฟล์ด้วยการคงรูปแบบบรรทัดเดิม (ไฟล์ปน LF/CRLF) · บันทึก `CHANGELOG.md` ทุกครั้ง · commit แยกตาม task · trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- tsc baseline ปัจจุบัน = **23 error เดิม** ห้ามเพิ่ม

## Review Focus

1. **เปลี่ยนบริษัทหลังเลือกผู้ติดต่อแล้ว** — ผู้ติดต่อของบริษัทเก่าต้องหลุดออก ไม่ค้างเป็นผู้ติดต่อของคำร้อง → เทสต์ใน Task 3 (`contactIds` ที่ไม่ใช่ของบริษัทที่เลือก = 400) และ Task 5 (หน้าเว็บล้างรายการเมื่อเปลี่ยนบริษัท)
2. **ลบผู้ติดต่อที่นักศึกษายื่นคำร้องไปแล้ว** (ตัดสินใจ: **ให้ลบได้**) — ระบบถอดออกจากคำร้องเอง คำร้องไม่พัง หนังสือถอยไปใช้ผู้ติดต่อของบริษัท · เมนูผู้ติดต่อเตือนก่อนลบว่ามีนักศึกษากี่คนเลือกอยู่ → เทสต์ใน Task 2 (ลบได้แม้มีคนเลือก) และ Task 8 (`letterRecipient` ไม่มีผู้ติดต่อ → ใช้ `company.contactPerson` → ค่าเริ่มต้น)
3. **ยื่นคำร้องโดยยิง API ตรง ไม่ผ่านหน้าเว็บ** — backend ต้องบังคับผู้ติดต่อเอง → เทสต์ใน Task 4
4. **ผู้ติดต่อมีชื่อคำเดียว / ชื่อยาวมาก / อีเมลผิดรูป** (ข้อมูลที่ย้ายมาจาก `contactPerson` เป็นชื่อเต็มในช่องเดียว) → ต้องแสดงและพิมพ์ในหนังสือได้ไม่มี "undefined" → เทสต์ใน Task 2 (validate) และ Task 8 (ชื่อสกุลว่าง)
5. **คำร้องที่ยื่นไปก่อนมีฟีเจอร์นี้ (ไม่มีผู้ติดต่อ)** (ตัดสินใจ: **ไม่บังคับย้อนหลัง + ขึ้นป้ายเตือน**) — เจ้าหน้าที่ยังตรวจ/ออกหนังสือได้ตามปกติ แต่เห็นป้าย "⚠️ ยังไม่มีผู้ติดต่อ" ในหน้าตรวจคำร้องและตอนออกหนังสือ จะได้ตามนักศึกษาก่อน → เทสต์ใน Task 4 (บังคับเฉพาะตอนยื่น), Task 7 Step 6 (ป้าย) และ Task 8

---

## File Structure

**Backend**
- Modify `backend/prisma/schema.prisma` — model `CompanyContact`, relation ใน `Company` / `StudentCoop` / `User`
- Create `backend/prisma/migrations/20260926100000_add_company_contacts/migration.sql` — ตาราง + ตารางเชื่อม + ย้ายข้อมูล `contactPerson` เดิม
- Modify `backend/controllers/companyController.js` — `addContact` / `updateContact` / `deleteContact` / `getAllContacts` + include `contacts`
- Modify `backend/routes/companyRoutes.js` — 4 route ใหม่
- Modify `backend/utils/auditActions.js`, `backend/middlewares/auditLogger.js` — ชื่อการกระทำ + ชื่อเป้าหมาย
- Modify `backend/controllers/studentController.js` — บันทึก `contactIds`, include `contacts`
- Modify `backend/controllers/coopController.js` — บังคับผู้ติดต่อตอนยื่นคำร้อง
- Modify `backend/controllers/adminDocController.js`, `backend/controllers/teacherController.js` — include `contacts`
- Modify `backend/utils/studentExport.js` — คอลัมน์ "ผู้ติดต่อ (HR)"
- Modify `backend/__tests__/__mocks__/prismaClient.js` — mock `companyContact`
- Create `backend/__tests__/companyContact.test.js`
- Modify `backend/__tests__/studentController.test.js`, `coopController.test.js`, `studentExport.test.js`

**Frontend**
- Create `Frontend/src/components/ContactForm.tsx` — ฟอร์มเพิ่ม/แก้ผู้ติดต่อ ใช้ร่วมทุกหน้า
- Create `Frontend/src/utils/contacts.ts` — type `CompanyContact`, `contactName()`, `contactLine()`
- Create `Frontend/src/utils/letterRecipient.ts` — เลือกผู้รับหนังสือ
- Create `Frontend/src/components/A_Contacts.tsx` — เมนูผู้ติดต่อของเจ้าหน้าที่
- Modify `S_ProfilePage.tsx`, `S_Company.tsx`, `S_Gateway.tsx`, `utils/pdfGenerator.ts`
- Modify `A_Company.tsx`, `A_Students.tsx`, `A_CoopApplications.tsx`, `T_Students.tsx`, `T_StudentDetail.tsx`, `A_Sidebar.tsx`, `A_App.tsx`
- Modify `IssueLetterModal.tsx`, `IssuePlacementLetterModal.tsx`, `LetterModalShared.tsx`, `utils/pdfDispatchGenerator.ts`, `utils/pdfGeneratorPlacement.ts`, `utils/pdfSupervisionLetterGenerator.ts`
- Modify `Frontend/tests/helpers/e2eSeed.ts`, `Frontend/tests/admin.spec.ts`

---

### Task 1: ตาราง CompanyContact + migration + ย้ายผู้ติดต่อเดิม

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Company` ~บรรทัด 240, `StudentCoop` ~91, `User` ~13)
- Create: `backend/prisma/migrations/20260926100000_add_company_contacts/migration.sql`

**Interfaces:**
- Produces: `prisma.companyContact` (id, firstName, lastName, position, department, email, phone, companyId, createdById) · `StudentCoop.contacts` · `Company.contacts`

- [ ] **Step 1: แก้ schema**

```prisma
// ผู้ติดต่อฝั่งบริษัท (HR / ผู้ประสานงาน) — นักศึกษาเลือกตอนกรอกข้อมูลบริษัท ใช้เป็นผู้รับหนังสือ ("เรียน …")
// พี่เลี้ยง (Mentor) แยกกัน — กรอกในแบบฟอร์ม T002 ข้อ 3
model CompanyContact {
  id           String        @id @default(uuid())
  firstName    String
  lastName     String        @default("")
  position     String?
  department   String? // ทีม/แผนก — บริษัทใหญ่มี HR แยกตามทีม
  email        String?
  phone        String?
  companyId    String
  company      Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  studentCoops StudentCoop[] @relation("CoopContacts")
  createdById  Int?
  createdBy    User?         @relation("ContactCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```

ใน `model Company` เพิ่มใต้ `mentors Mentor[]`:
```prisma
  contacts     CompanyContact[]
```
ใน `model StudentCoop` เพิ่มใต้ `mentors Mentor[]`:
```prisma
  // ผู้ติดต่อ (HR) ที่นักศึกษาเลือก — บังคับอย่างน้อย 1 คนก่อนยื่นคำร้อง
  contacts CompanyContact[] @relation("CoopContacts")
```
ใน `model User` เพิ่ม:
```prisma
  createdContacts CompanyContact[] @relation("ContactCreatedBy")
```

- [ ] **Step 2: สร้าง SQL** (หยุด backend ก่อน)

```bash
cd backend
mkdir -p prisma/migrations/20260926100000_add_company_contacts
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```
คัดเฉพาะ SQL (ตัดบรรทัดกรอบ/`prisma@latest`) ลง `migration.sql` · เปลี่ยนชื่อตารางตัวเล็กเป็น `CompanyContact` / `StudentCoop` / `Company` / `User` · ตารางเชื่อมจะชื่อ `_CoopContacts`
Expected: มี `CREATE TABLE \`CompanyContact\``, `CREATE TABLE \`_CoopContacts\``, FK 4 ตัว ไม่มี `DROP`

- [ ] **Step 3: ต่อท้าย migration.sql ด้วยการย้ายผู้ติดต่อเดิมของบริษัท**

```sql
-- ย้ายผู้ติดต่อเดิม (Company.contactPerson เป็นข้อความชื่อเต็ม) มาเป็นผู้ติดต่อคนแรกของบริษัท
-- ชื่อเต็มเก็บในช่อง firstName ทั้งก้อน (แยกชื่อ/สกุลภาษาไทยจากข้อความเดียวไม่แม่น) · คอลัมน์เดิมยังเก็บไว้เป็นค่าสำรองของหนังสือ
INSERT INTO `CompanyContact` (`id`, `firstName`, `lastName`, `position`, `companyId`, `createdAt`, `updatedAt`)
SELECT UUID(), TRIM(`contactPerson`), '', NULLIF(TRIM(`contactPosition`), ''), `id`, NOW(3), NOW(3)
FROM `Company`
WHERE `contactPerson` IS NOT NULL AND TRIM(`contactPerson`) <> '';
```

- [ ] **Step 4: apply + generate + ตรวจ**

```bash
npx prisma migrate deploy && npx prisma generate
node -e "require('dotenv').config();const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.company.count({where:{contactPerson:{not:null}}}),p.companyContact.count()]).then(r=>{console.log(r);return p.\$disconnect()})"
```
Expected: สองตัวเลขเท่ากัน (dev ปัจจุบัน `[10, 10]`)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma
git commit -m "feat(db): ตารางผู้ติดต่อบริษัท (CompanyContact) + ย้ายผู้ติดต่อเดิม"
```

---

### Task 2: API ผู้ติดต่อ (เพิ่ม/แก้/ลบ/รายการ)

**Files:**
- Modify: `backend/controllers/companyController.js` (ต่อท้ายส่วน Mentor ~บรรทัด 300; include ใน `getCompanies` ~บรรทัด 88 และ `searchCompanies`)
- Modify: `backend/routes/companyRoutes.js`
- Modify: `backend/utils/auditActions.js` (~บรรทัด 96-98), `backend/middlewares/auditLogger.js` (~บรรทัด 115)
- Modify: `backend/__tests__/__mocks__/prismaClient.js`
- Create: `backend/__tests__/companyContact.test.js`

**Interfaces:**
- Consumes: `prisma.companyContact` (Task 1)
- Produces:
  - `GET /api/companies/contacts` → `{ ok, contacts: (CompanyContact & { company: {id,name}, _count: { studentCoops } })[] }` (staff)
  - `POST /api/companies/:companyId/contacts` body `{firstName,lastName?,position?,department?,email?,phone?}` → `{ ok, contact }`
  - `PUT /api/companies/contacts/:id` → `{ ok, contact }` · `DELETE /api/companies/contacts/:id` → `{ ok }`
  - `GET /api/companies` และ `/search` คืน `contacts` ในแต่ละบริษัท

- [ ] **Step 1: เพิ่ม mock** ใน `__mocks__/prismaClient.js` ถัดจาก `mentor`:

```js
  companyContact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
```

- [ ] **Step 2: เขียนเทสต์ที่ fail** — `backend/__tests__/companyContact.test.js`

```js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { addContact, updateContact, deleteContact, getAllContacts } = require('../controllers/companyController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});

describe('addContact', () => {
  test('400 — ไม่มีชื่อ', async () => {
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: '  ' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.companyContact.create).not.toHaveBeenCalled();
  });

  test('400 — อีเมลผิดรูป', async () => {
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: 'สมศรี', email: 'not-an-email' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — ไม่พบบริษัท', async () => {
    prisma.company.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await addContact({ params: { companyId: 'nope' }, body: { firstName: 'สมศรี' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ตัดช่องว่าง นามสกุลว่างได้ (ชื่อคำเดียว)', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.companyContact.create.mockImplementation(({ data }) => ({ id: 'k1', ...data }));
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: ' สมศรี ', position: ' HR ' }, user: { id: 7 } }, res);
    const { data } = prisma.companyContact.create.mock.calls[0][0];
    expect(data).toMatchObject({ firstName: 'สมศรี', lastName: '', position: 'HR', companyId: 'c1', createdById: 7 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('updateContact / deleteContact', () => {
  test('404 — แก้ผู้ติดต่อที่ไม่มี', async () => {
    prisma.companyContact.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await updateContact({ params: { id: 'x' }, body: { firstName: 'ก' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ลบได้แม้มีนักศึกษาเลือกไว้ (ตารางเชื่อมลบตาม)', async () => {
    prisma.companyContact.findUnique.mockResolvedValue({ id: 'k1' });
    prisma.companyContact.delete.mockResolvedValue({ id: 'k1' });
    const res = makeRes();
    await deleteContact({ params: { id: 'k1' } }, res);
    expect(prisma.companyContact.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('getAllContacts', () => {
  test('คืนผู้ติดต่อพร้อมชื่อบริษัทและจำนวนนักศึกษาที่เลือก', async () => {
    prisma.companyContact.findMany.mockResolvedValue([{ id: 'k1', company: { id: 'c1', name: 'บ.ก' }, _count: { studentCoops: 2 } }]);
    const res = makeRes();
    await getAllContacts({}, res);
    expect(prisma.companyContact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { company: { select: { id: true, name: true } }, _count: { select: { studentCoops: true } } },
    }));
    expect(res.json.mock.calls[0][0].contacts).toHaveLength(1);
  });
});
```

- [ ] **Step 3: รันให้ fail**

Run: `cd backend && npx jest __tests__/companyContact.test.js`
Expected: FAIL — `addContact is not a function`

- [ ] **Step 4: เขียน controller** ต่อท้าย `companyController.js`

```js
// ---------------- ผู้ติดต่อ (HR) ----------------
// โครงเดียวกับพี่เลี้ยง: ใครก็เพิ่ม/แก้/ลบได้ (ข้อมูลบริษัทใช้ร่วมกันทุกรุ่น)
const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const trimOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

function contactData(body) {
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 200) : '';
  if (!firstName) throw Object.assign(new Error('กรุณากรอกชื่อผู้ติดต่อ'), { is400: true });
  const email = trimOrNull(body.email);
  if (email && !CONTACT_EMAIL_RE.test(email)) throw Object.assign(new Error('รูปแบบอีเมลผู้ติดต่อไม่ถูกต้อง'), { is400: true });
  return {
    firstName,
    lastName: typeof body.lastName === 'string' ? body.lastName.trim().slice(0, 200) : '',
    position: trimOrNull(body.position),
    department: trimOrNull(body.department),
    email,
    phone: trimOrNull(body.phone),
  };
}

function contactError(res, err, fallback) {
  if (err.is400) return res.status(400).json({ ok: false, message: err.message });
  if (err.is404 || err.code === 'P2025') return res.status(404).json({ ok: false, message: err.is404 ? err.message : 'ไม่พบผู้ติดต่อ' });
  console.error(fallback, err);
  return res.status(500).json({ ok: false, message: fallback });
}

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await prisma.companyContact.findMany({
      include: { company: { select: { id: true, name: true } }, _count: { select: { studentCoops: true } } },
      orderBy: [{ company: { name: 'asc' } }, { firstName: 'asc' }],
    });
    res.json({ ok: true, contacts });
  } catch (err) { contactError(res, err, 'โหลดรายชื่อผู้ติดต่อไม่สำเร็จ'); }
};

exports.addContact = async (req, res) => {
  try {
    const data = contactData(req.body || {});
    let contact;
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: req.params.companyId }, select: { id: true } });
      if (!company) throw Object.assign(new Error('ไม่พบบริษัท'), { is404: true });
      contact = await tx.companyContact.create({ data: { ...data, companyId: company.id, createdById: req.user.id } });
    });
    res.json({ ok: true, contact });
  } catch (err) { contactError(res, err, 'เพิ่มผู้ติดต่อไม่สำเร็จ'); }
};

exports.updateContact = async (req, res) => {
  try {
    const data = contactData(req.body || {});
    let contact;
    await prisma.$transaction(async (tx) => {
      const found = await tx.companyContact.findUnique({ where: { id: String(req.params.id) } });
      if (!found) throw Object.assign(new Error('ไม่พบผู้ติดต่อ'), { is404: true });
      contact = await tx.companyContact.update({ where: { id: found.id }, data });
    });
    res.json({ ok: true, contact });
  } catch (err) { contactError(res, err, 'แก้ไขผู้ติดต่อไม่สำเร็จ'); }
};

exports.deleteContact = async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      const found = await tx.companyContact.findUnique({ where: { id: String(req.params.id) } });
      if (!found) throw Object.assign(new Error('ไม่พบผู้ติดต่อ'), { is404: true });
      // ถอดออกจากคำร้องที่เคยเลือกไว้ด้วย (ตาราง _CoopContacts ลบตาม) — หนังสือถอยไปใช้ผู้ติดต่อของบริษัท
      await tx.companyContact.delete({ where: { id: found.id } });
    });
    res.json({ ok: true });
  } catch (err) { contactError(res, err, 'ลบผู้ติดต่อไม่สำเร็จ'); }
};
```
และใน `getCompanies` / `searchCompanies` เปลี่ยน `include: { mentors: true }` เป็น `include: { mentors: true, contacts: { orderBy: { createdAt: 'asc' } } }` (search ยังไม่มี include — เพิ่ม `include: { contacts: { orderBy: { createdAt: 'asc' } } }`)

- [ ] **Step 5: routes** — ใน `companyRoutes.js` วาง **ก่อน** `router.put("/:id"…)` (กัน `/contacts` ถูกจับเป็น `:id`):

```js
router.get("/contacts", verifyToken, verifyRole('staff'), companyController.getAllContacts);
router.post("/:companyId/contacts", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addContact);
router.put("/contacts/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateContact);
router.delete("/contacts/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteContact);
```

- [ ] **Step 6: บันทึกการใช้งาน** — `auditActions.js` ถัดจากแถว mentor (แถวที่เจาะจงกว่าต้องอยู่ก่อน `'/api/companies/:x'`; ตรวจลำดับการ match ของ RULES ในไฟล์เดียวกัน):

```js
  ['POST', '/api/companies/:x/contacts', 'เพิ่มผู้ติดต่อบริษัท', 'บริษัท', ':1'],
  ['PUT', '/api/companies/contacts/:x', 'แก้ไขผู้ติดต่อบริษัท', 'ผู้ติดต่อ', ':1'],
  ['DELETE', '/api/companies/contacts/:x', 'ลบผู้ติดต่อบริษัท', 'ผู้ติดต่อ', ':1'],
```
`auditLogger.js` ตรง resolve ชื่อเป้าหมาย (ข้าง `prisma.mentor.findUnique` บรรทัด ~115) เพิ่มกรณี `'ผู้ติดต่อ'`:
```js
      if (targetType === 'ผู้ติดต่อ') {
        const c = await prisma.companyContact.findUnique({ where: { id: raw }, select: { firstName: true, lastName: true, company: { select: { name: true } } } });
        return c ? `${[c.firstName, c.lastName].filter(Boolean).join(' ')} (${c.company?.name || '-'})` : raw;
      }
```
(ใช้รูปแบบเดียวกับสาขา `'พี่เลี้ยง'` ที่อยู่ข้างๆ — ถ้าโครงเป็น switch/if-chain ให้ตามโครงเดิม)

- [ ] **Step 7: รันเทสต์ทั้งหมด**

Run: `cd backend && npx jest`
Expected: PASS ทั้งหมด (รวม `auditLog.test.js` reverse-coverage)

- [ ] **Step 8: Commit** `feat(api): เพิ่ม/แก้/ลบผู้ติดต่อบริษัท`

---

### Task 3: บันทึกผู้ติดต่อจากหน้าข้อมูลนักศึกษา + ส่งผู้ติดต่อไปทุกหน้า

**Files:**
- Modify: `backend/controllers/studentController.js` (updateProfile ~บรรทัด 205-245, getMyProfile ~16-75, getStudents ~331)
- Modify: `backend/controllers/adminDocController.js:695` (getCoopApplications), `backend/controllers/teacherController.js` (include ของรายชื่อนักศึกษาที่มี `mentors: true`)
- Test: `backend/__tests__/studentController.test.js`

**Interfaces:**
- Consumes: `StudentCoop.contacts` (Task 1)
- Produces: body ของ `PUT /api/students/me` (หรือ endpoint บันทึกโปรไฟล์เดิม) รับ `contactIds: string[]` · ทุก response ที่มี `coop.mentors` มี `coop.contacts` ด้วย · `company.contacts` ในโปรไฟล์

- [ ] **Step 1: เทสต์ที่ fail** (ใน describe ของ updateProfile เดิม — ใช้ setup/mock ของ describe นั้น)

```js
test('400 — contactIds มีผู้ติดต่อที่ไม่ใช่ของบริษัทที่เลือก', async () => {
  prisma.companyContact.findMany.mockResolvedValue([{ id: 'k1', companyId: 'c1' }, { id: 'k9', companyId: 'OTHER' }]);
  const res = makeRes();
  await updateProfile(reqWith({ companyId: 'c1', contactIds: ['k1', 'k9'] }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(prisma.studentCoop.upsert).not.toHaveBeenCalled();
});

test('บันทึกผู้ติดต่อด้วย set (แทนที่ของเดิม) และไม่แตะพี่เลี้ยง', async () => {
  prisma.companyContact.findMany.mockResolvedValue([{ id: 'k1', companyId: 'c1' }]);
  prisma.studentCoop.upsert.mockResolvedValue({ company: { id: 'c1' }, contacts: [{ id: 'k1' }], mentors: [] });
  const res = makeRes();
  await updateProfile(reqWith({ companyId: 'c1', contactIds: ['k1'] }), res);
  const arg = prisma.studentCoop.upsert.mock.calls[0][0];
  expect(arg.update.contacts).toEqual({ set: [{ id: 'k1' }] });
  expect(arg.update).not.toHaveProperty('mentors');
});
```
(`reqWith` / `updateProfile` = ชื่อ helper/ฟังก์ชันที่ไฟล์เทสต์เดิมใช้ — ถ้าไฟล์ยังไม่มี helper ให้สร้าง `const reqWith = (body) => ({ user: { id: 10, role: 'student' }, userId: 10, body })` และ mock `prisma.student.findUnique` ให้คืนนักศึกษา)

- [ ] **Step 2: รันให้ fail** — `npx jest __tests__/studentController.test.js -t "contactIds|ผู้ติดต่อ"` → FAIL

- [ ] **Step 3: implement** แทนบล็อก `mentorConnect` เดิม:

```js
      if (data.companyId !== undefined) {
        // ผู้ติดต่อ (HR) ต้องเป็นของบริษัทที่เลือกเท่านั้น — เปลี่ยนบริษัทแล้วผู้ติดต่อเก่าต้องหลุด
        // พี่เลี้ยงไม่รับจากหน้านี้แล้ว (กรอกใน T002 ข้อ 3) — ไม่แตะรายการพี่เลี้ยงเดิม
        const contactIds = Array.isArray(data.contactIds) ? [...new Set(data.contactIds.map(String))] : [];
        if (contactIds.length > 0) {
          const found = await tx.companyContact.findMany({ where: { id: { in: contactIds } }, select: { id: true, companyId: true } });
          if (found.length !== contactIds.length || found.some((c) => c.companyId !== data.companyId)) {
            throw Object.assign(new Error('ผู้ติดต่อที่เลือกไม่ใช่ของบริษัทนี้ กรุณาเลือกใหม่'), { is400: true });
          }
        }
        const contactSet = { set: contactIds.map((id) => ({ id })) };
        updatedCoop = await tx.studentCoop.upsert({
          where: { studentId: student.id },
          update: { companyId: data.companyId, contacts: contactSet },
          create: {
            studentId: student.id,
            companyId: data.companyId,
            contacts: { connect: contactIds.map((id) => ({ id })) },
            status: "NOT_SUBMITTED",
          },
          include: {
            company: { include: { mentors: true, contacts: { orderBy: { createdAt: 'asc' } } } },
            mentors: true,
            contacts: true,
          },
        });
      }
```
และ response: `company: updatedCoop?.company ? { ...updatedCoop.company, mentors: updatedCoop.mentors, selectedContacts: updatedCoop.contacts } : null`
ใน getMyProfile: `company: { include: { mentors: true, contacts: { orderBy: { createdAt: 'asc' } } } }, mentors: true, contacts: true` · getStudents / getCoopApplications / teacher: เพิ่ม `contacts: true` ข้าง `mentors: true` ทุกที่ (`grep -n "mentors: true" backend/controllers`)

- [ ] **Step 4: รันเทสต์** — `npx jest` → PASS

- [ ] **Step 5: Commit** `feat(api): นักศึกษาเลือกผู้ติดต่อแทนพี่เลี้ยง`

---

### Task 4: บังคับผู้ติดต่อก่อนยื่นคำร้อง (backend)

**Files:**
- Modify: `backend/controllers/coopController.js` (submitCoopApplication — ใน transaction ตรง `freshCoop` ~บรรทัด 109)
- Test: `backend/__tests__/coopController.test.js`

**Interfaces:**
- Produces: `POST` ยื่นคำร้องคืน `400 { message: 'กรุณาเลือกผู้ติดต่อ (HR) ของบริษัทอย่างน้อย 1 คนก่อนยื่นคำร้อง' }` เมื่อไม่มีผู้ติดต่อของบริษัทที่เลือก

- [ ] **Step 1: เทสต์ที่ fail** (ใช้ setup ของ describe `submitCoopApplication` เดิม — period active, apply window เปิด)

```js
test('400 — ยังไม่มีผู้ติดต่อ (HR)', async () => {
  prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c1', contacts: [] });
  const res = makeRes();
  await submitCoopApplication(validReq(), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].message).toMatch(/ผู้ติดต่อ/);
});

test('400 — ผู้ติดต่อเป็นของบริษัทเก่า (เปลี่ยนบริษัทแล้ว)', async () => {
  prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c2', contacts: [{ id: 'k1', companyId: 'c1' }] });
  const res = makeRes();
  await submitCoopApplication(validReq(), res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('ผ่าน — มีผู้ติดต่อของบริษัทที่เลือก', async () => {
  prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c1', contacts: [{ id: 'k1', companyId: 'c1' }] });
  const res = makeRes();
  await submitCoopApplication(validReq(), res);
  expect(res.status).not.toHaveBeenCalledWith(400);
});
```

- [ ] **Step 2: รันให้ fail** → FAIL (ข้อ 1-2 ได้ 200)

- [ ] **Step 3: implement** — เปลี่ยน select ของ `freshCoop` และตรวจหลังเช็ค REAPPLY:

```js
      const freshCoop = await tx.studentCoop.findUnique({
        where: { studentId: student.id },
        select: { status: true, companyId: true, contacts: { select: { id: true, companyId: true } } },
      });
      if (freshCoop && !REAPPLY_ALLOWED.has(freshCoop.status)) {
        reapplyBlocked = true;
        return;
      }
      // ผู้ติดต่อ (HR) บังคับ — ใช้เป็นผู้รับหนังสือขอความอนุเคราะห์ ("เรียน …")
      // บังคับเฉพาะตอนยื่น คำร้องเก่าที่ยื่นก่อนมีฟีเจอร์นี้ยังตรวจ/ออกหนังสือได้ตามปกติ
      const hasContact = !!freshCoop?.companyId
        && (freshCoop.contacts || []).some((c) => c.companyId === freshCoop.companyId);
      if (!hasContact) {
        throw Object.assign(new Error('กรุณาเลือกผู้ติดต่อ (HR) ของบริษัทอย่างน้อย 1 คนก่อนยื่นคำร้อง'), { is400: true });
      }
```
ตรวจว่า catch ของฟังก์ชันลบไฟล์ที่อัปโหลดมา (`files`) เมื่อ is400 — ถ้าไม่ลบ ให้เพิ่ม `files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} })` ในสาขา is400

- [ ] **Step 4: รันเทสต์** — `npx jest` → PASS
- [ ] **Step 5: Commit** `feat(api): บังคับผู้ติดต่อก่อนยื่นคำร้องสหกิจ`

---

### Task 5: ฟอร์มผู้ติดต่อ + หน้าข้อมูลนักศึกษาเลือกผู้ติดต่อแทนพี่เลี้ยง

**Files:**
- Create: `Frontend/src/utils/contacts.ts`, `Frontend/src/components/ContactForm.tsx`
- Modify: `Frontend/src/components/S_ProfilePage.tsx` (interface ~11-80, state `noMentorYet` ~131, โหลด ~197/256, บันทึก ~276, ตัวเลือก ~326-330, UI ~449-560)

**Interfaces:**
- Consumes: `POST /api/companies/:companyId/contacts` (Task 2), `contactIds` (Task 3)
- Produces:
  - `utils/contacts.ts`: `export interface CompanyContact { id: string; firstName: string; lastName?: string; position?: string|null; department?: string|null; email?: string|null; phone?: string|null; companyId?: string }` · `contactName(c): string` · `contactLine(c): string` (ชื่อ · ตำแหน่ง · ทีม · เบอร์ · อีเมล ที่มีค่า)
  - `ContactForm` props: `{ companyId: string; contact?: CompanyContact | null; onSaved: (c: CompanyContact) => void; onCancel: () => void }` — เรียก POST/PUT เอง แจ้งผลด้วย `notify`

- [ ] **Step 1: `utils/contacts.ts`**

```ts
// ผู้ติดต่อฝั่งบริษัท (HR) — ใช้ร่วมกันทุกหน้า
export interface CompanyContact {
  id: string;
  firstName: string;
  lastName?: string;
  position?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  companyId?: string;
}

export const contactName = (c: Pick<CompanyContact, "firstName" | "lastName">) =>
  [c.firstName, c.lastName].map((s) => (s || "").trim()).filter(Boolean).join(" ");

export const contactLine = (c: CompanyContact) =>
  [contactName(c), c.position, c.department, c.phone, c.email].map((s) => (s || "").trim()).filter(Boolean).join(" · ");
```

- [ ] **Step 2: `ContactForm.tsx`**

```tsx
import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import type { CompanyContact } from "../utils/contacts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS: Array<[keyof CompanyContact, string, string]> = [
  ["firstName", "ชื่อ *", "เช่น สมศรี"],
  ["lastName", "นามสกุล", ""],
  ["position", "ตำแหน่ง", "เช่น HR Manager"],
  ["department", "ทีม/แผนก", "เช่น ฝ่ายบุคคล"],
  ["phone", "เบอร์โทร", ""],
  ["email", "อีเมล", ""],
];

// ฟอร์มเพิ่ม/แก้ผู้ติดต่อ (HR) — ใช้ในหน้าข้อมูลนักศึกษา หน้าบริษัท และหน้าผู้ติดต่อของเจ้าหน้าที่
export default function ContactForm({ companyId, contact, onSaved, onCancel }: {
  companyId: string;
  contact?: CompanyContact | null;
  onSaved: (c: CompanyContact) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<CompanyContact>>(contact ?? { firstName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName?.trim()) next.firstName = "กรุณากรอกชื่อ";
    if (form.email?.trim() && !EMAIL_RE.test(form.email.trim())) next.email = "รูปแบบอีเมลไม่ถูกต้อง";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const url = contact ? `/api/companies/contacts/${contact.id}` : `/api/companies/${companyId}/contacts`;
      const res = await apiFetch(url, {
        method: contact ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { notify.error(data.message || "บันทึกผู้ติดต่อไม่สำเร็จ"); return; }
      notify.success(contact ? "แก้ไขผู้ติดต่อแล้ว" : "เพิ่มผู้ติดต่อแล้ว");
      onSaved(data.contact);
    } catch {
      notify.error("บันทึกผู้ติดต่อไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {FIELDS.map(([key, label, ph]) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
          {label}
          <input className="input" placeholder={ph} value={(form[key] as string) ?? ""}
            aria-invalid={!!errors[key]}
            onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }); }} />
          {errors[key] && <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 500 }}>{errors[key]}</span>}
        </label>
      ))}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>ยกเลิก</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? "กำลังบันทึก..." : "💾 บันทึกผู้ติดต่อ"}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: S_ProfilePage — สลับพี่เลี้ยงเป็นผู้ติดต่อ**
  - interface: เพิ่ม `contacts?: CompanyContact[]; selectedContacts?: CompanyContact[]` ใน company · ลบการใช้ `selectedMentors` ในการเลือก (คงการ**แสดง**พี่เลี้ยงจาก `coop.mentors` แบบอ่านอย่างเดียว พร้อมข้อความ "กรอกในแบบฟอร์ม T002 ข้อ 3")
  - ลบ state `noMentorYet` และตัวเลือก "ยังไม่มีพี่เลี้ยง" ทั้งหมด (ผู้ติดต่อบังคับ ไม่มีตัวเลือกว่าง)
  - โหลด: `selectedContacts: profileData.coop.contacts || []`
  - บันทึก: เปลี่ยน `mentorIds: …` เป็น
    ```ts
    contactIds: (profile.company?.selectedContacts || []).map((c) => c.id),
    ```
  - เปลี่ยนบริษัท (onSelect ของช่องบริษัท ~บรรทัด 464-468): ตั้ง `selectedContacts: []` เสมอ (Review Focus #1)
  - UI: หัวข้อ `"เลือกบริษัทและผู้ติดต่อ"` · label `"ผู้ติดต่อ (HR) — เลือกได้หลายคน *"` · chips ของ `selectedContacts` (ปุ่ม × เอาออก) · ช่องค้นหาใช้ `profile.company.contacts` ที่ยังไม่ถูกเลือก label `contactLine(c)` · ปุ่ม `"+ เพิ่มผู้ติดต่อ"` เปิด `<ContactForm companyId={profile.company.id} onSaved={(c) => เพิ่ม c ทั้งใน company.contacts และ selectedContacts} />` ใน modal เดิมของหน้า
  - บริษัทไม่มีผู้ติดต่อเลย: ข้อความใต้ช่อง `"บริษัทนี้ยังไม่มีผู้ติดต่อในระบบ — กด + เพิ่มผู้ติดต่อ"` (สีเหลือง)
  - ส่วนแสดงรายละเอียด (~บรรทัด 544-560): หัวข้อ `"รายละเอียดผู้ติดต่อ"` ใช้ `Info` label ชื่อ / ตำแหน่ง / ทีม / เบอร์ / อีเมล
- [ ] **Step 4: ตรวจ** — `cd Frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → 23 · เปิด `/student/profile` (ชื่อ route ตาม S_App.tsx) เลือกบริษัท → เพิ่มผู้ติดต่อ → บันทึก → รีโหลดแล้วผู้ติดต่อยังอยู่ · เปลี่ยนบริษัท → chips ว่าง
- [ ] **Step 5: Commit** `feat(student): เลือกผู้ติดต่อ (HR) แทนพี่เลี้ยงในหน้าข้อมูลนักศึกษา`

---

### Task 6: หน้าบริษัทของนักศึกษา + หน้ายื่นคำร้อง + PDF คำร้อง

**Files:**
- Modify: `Frontend/src/components/S_Company.tsx` (ส่วนพี่เลี้ยง ~337-390, `MentorForm` ~641, `emptyMentor` ~415)
- Modify: `Frontend/src/components/S_Gateway.tsx` (~228 เช็คก่อนยื่น, ~298-300, ~428-456)
- Modify: `Frontend/src/utils/pdfGenerator.ts` (~172-195)

**Interfaces:**
- Consumes: `ContactForm`, `contactName`, `contactLine` (Task 5) · `company.contacts` (Task 2) · `coop.contacts` (Task 3)

- [ ] **Step 1: S_Company** — ส่วน `"👥 ข้อมูลพี่เลี้ยง (Mentors)"` เปลี่ยนเป็น `"📇 ผู้ติดต่อ (HR)"` + ปุ่ม `"+ เพิ่มผู้ติดต่อ"` · ตารางผู้ติดต่อ (ชื่อ ตำแหน่ง ทีม เบอร์ อีเมล + แก้ไข/ลบ — ลบใช้ `askConfirm("ลบผู้ติดต่อคนนี้? นักศึกษาที่เลือกไว้จะต้องเลือกใหม่", { confirmLabel: "ลบผู้ติดต่อ", danger: true })` แล้ว `DELETE /api/companies/contacts/:id`) · modal ใช้ `<ContactForm>` · หลังสร้างบริษัทใหม่ถาม `"ต้องการเพิ่มผู้ติดต่อ (HR) ตอนนี้เลยหรือไม่?"` ปุ่ม `"เพิ่มผู้ติดต่อเลย"`
  - พี่เลี้ยง: แสดงรายการแบบอ่านอย่างเดียว หัวข้อ `"👥 พี่เลี้ยง"` + ข้อความ `"พี่เลี้ยงกรอกในแบบฟอร์ม T002 ข้อ 3 (ระบบบันทึกให้เมื่อส่ง T002)"` · ลบปุ่มเพิ่ม/แก้/ลบพี่เลี้ยง, `MentorForm`, `saveMentor*`, `removeMentor`, `emptyMentor`, state ที่เกี่ยวข้อง
- [ ] **Step 2: S_Gateway**
  - `displayContacts = profile.coop?.contacts || []` · หัวข้อ `"ข้อมูลหน่วยงานและผู้ติดต่อ"` · กล่อง `"📇 ผู้ติดต่อ (HR)"` แสดง `contactLine` ทุกคน · ไม่มี → กล่องเหลือง `"ยังไม่ได้เลือกผู้ติดต่อ — ต้องเลือกที่หน้าข้อมูลนักศึกษาก่อนยื่นคำร้อง"` + ลิงก์ไปหน้านั้น · ลบกล่องพี่เลี้ยงและข้อความ "ยังไม่มีพี่เลี้ยง"
  - ก่อนยื่น (ต่อจากเช็คบริษัท ~บรรทัด 228):
    ```ts
    const coopContacts: any[] = profile?.coop?.contacts || [];
    if (coopContacts.length === 0) {
      toast.warning("กรุณาเลือกผู้ติดต่อ (HR) ของบริษัทที่หน้าข้อมูลนักศึกษาก่อนยื่นคำร้อง");
      return;
    }
    ```
  - แสดงข้อความ 400 จาก backend ถ้ามี (`data.message`) แทนข้อความทั่วไป
- [ ] **Step 3: PDF คำร้อง** (`pdfGenerator.ts`) — ช่อง "ชื่อผู้ประสานงาน" / "ตำแหน่ง" / อีเมล:
  ```ts
  // ผู้ประสานงาน = ผู้ติดต่อ (HR) คนแรกที่นักศึกษาเลือก (เดิมใช้พี่เลี้ยงคนแรก)
  const contact = (profile.coop?.contacts || [])[0];
  const coordinatorName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "-";
  ```
  แทน `mentor` / `mentorName` / `mentor?.position` / `mentor?.email` · เพิ่ม `contacts?: any[]` ใน interface `coop`
- [ ] **Step 4: ตรวจ** — tsc = 23 · นักศึกษาไม่มีผู้ติดต่อกดยื่น → คำเตือน ไม่ยิง API · มีผู้ติดต่อ → ยื่นได้ · ดาวน์โหลด PDF คำร้อง มีชื่อผู้ติดต่อในช่องผู้ประสานงาน
- [ ] **Step 5: Commit** `feat(student): หน้าบริษัทจัดการผู้ติดต่อ · ยื่นคำร้องต้องมีผู้ติดต่อ`

---

### Task 7: หน้าเจ้าหน้าที่/อาจารย์ + เมนูผู้ติดต่อ + Excel

**Files:**
- Create: `Frontend/src/components/A_Contacts.tsx`
- Modify: `A_App.tsx:116` (route), `A_Sidebar.tsx:76` (เมนู), `A_Company.tsx` (รายละเอียดบริษัท ~436/513), `A_Students.tsx:925`, `A_CoopApplications.tsx` (modal ข้อมูลผู้สมัคร), `T_Students.tsx:479`, `T_StudentDetail.tsx`
- Modify: `backend/utils/studentExport.js`, `backend/__tests__/studentExport.test.js`
- Modify: `Frontend/tests/admin.spec.ts:17`

**Interfaces:**
- Consumes: `GET /api/companies/contacts` (Task 2), `ContactForm`/`contactLine` (Task 5), `coop.contacts` (Task 3)

- [ ] **Step 1: เทสต์ Excel ที่ fail** (`studentExport.test.js`)

```js
test('คอลัมน์ "ผู้ติดต่อ (HR)" แสดงชื่อ ตำแหน่ง เบอร์ อีเมล ทุกคน', () => {
  const rows = sheetToRows(buildStudentExportWorkbook([{
    studentId: '1', firstName: 'ก', lastName: 'ข',
    coop: { status: 'APPLYING', contacts: [
      { firstName: 'สมศรี', lastName: '', position: 'HR', phone: '0811111111', email: 'hr@x.co' },
      { firstName: 'คุณเอ', lastName: 'บี' },
    ] },
  }]));
  expect(rows[0]['ผู้ติดต่อ (HR)']).toBe('สมศรี · HR · 0811111111 · hr@x.co, คุณเอ บี');
});
```
แล้วเพิ่ม `'ผู้ติดต่อ (HR)': '-'` ในแถวคาดหวังของเทสต์เดิม 2 ตัว (ใส่ใน `NO_FILES` ไม่ได้ เพราะเป็นคอลัมน์หลัก — ใส่ตรงแถวหลัง `'พี่เลี้ยง'`)

- [ ] **Step 2: รันให้ fail** → FAIL

- [ ] **Step 3: implement studentExport** — `STUDENT_EXPORT_INCLUDE.coop.include` เพิ่ม `contacts: true` · `COLUMNS` เพิ่ม `['ผู้ติดต่อ (HR)', 40]` **ก่อน** `['พี่เลี้ยง', 32]` · ฟังก์ชัน:
```js
function contactsText(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return '-';
  return contacts.map((c) => [
    [c.firstName, c.lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' '),
    c.position, c.phone, c.email,
  ].map((s) => String(s || '').trim()).filter(Boolean).join(' · ')).join(', ');
}
```
แถว: `'ผู้ติดต่อ (HR)': contactsText(coop?.contacts),` · รัน `npx jest` → PASS

- [ ] **Step 4: เมนูผู้ติดต่อ** — `A_Contacts.tsx` ลอกโครง `A_Mentors.tsx` (ตาราง + ค้นหา + modal) แต่:
  - โหลด `GET /api/companies/contacts` · คอลัมน์: ชื่อ, บริษัท, ตำแหน่ง/ทีม, เบอร์, อีเมล, `"นักศึกษาที่เลือก"` (`_count.studentCoops`), จัดการ
  - เพิ่มผู้ติดต่อ: เลือกบริษัท (select จาก `/api/companies`) แล้วแสดง `<ContactForm companyId=… />` · แก้ไข: `<ContactForm contact=… companyId={c.companyId} />` · ลบ: `askConfirm` (danger) + ถ้า `_count.studentCoops > 0` ข้อความ `"มีนักศึกษา N คนเลือกผู้ติดต่อคนนี้อยู่ — จะถูกถอดออก"`
  - `A_App.tsx`: `<Route path="contacts" element={<Contacts />} />` · `A_Sidebar.tsx` ใต้ "พี่เลี้ยง": `<NavItem to="/admin/contacts" label="ผู้ติดต่อ (HR)" icon={<IcUser />} onClick={nav} />`
  - `admin.spec.ts` เพิ่ม `{ path: "/admin/contacts", label: "TC-A-03b: หน้าจัดการผู้ติดต่อ" },`
- [ ] **Step 5: แสดงผู้ติดต่อในหน้าดูข้อมูล** — ทุกที่ที่มี `InfoRow label="อาจารย์ที่ปรึกษา…"` / หัวข้อพี่เลี้ยง: เพิ่มส่วน `"📇 ผู้ติดต่อ (HR)"` **ใต้อาจารย์ที่ปรึกษา** แสดง `contactLine(c)` ต่อคน (ไม่มี → `"-"`) และคงส่วนพี่เลี้ยงไว้ (มาจาก T002):
  `A_Students.tsx` (~925 แทน `companyData.contactPerson`) · `T_Students.tsx` (~479) · `T_StudentDetail.tsx` · `A_CoopApplications.tsx` (กล่อง "ข้อมูลผู้สมัคร") · `A_Company.tsx` รายละเอียดบริษัท: รายการผู้ติดต่อ + ปุ่มเพิ่ม/แก้/ลบ (ใช้ `ContactForm`) แทนบรรทัด `ผู้ติดต่อ: {contactPerson}` และคอลัมน์ตาราง "ผู้ติดต่อ" แสดงผู้ติดต่อคนแรก + `"+N"`
- [ ] **Step 6: ป้าย "ยังไม่มีผู้ติดต่อ" สำหรับคำร้องเก่า** (ไม่บังคับ แค่เตือน)
  - ป้ายใช้ร่วมกัน — ใส่ใน `utils/contacts.ts`:
    ```ts
    // คำร้องที่ยื่นก่อนมีผู้ติดต่อ (หรือผู้ติดต่อถูกลบ) — เตือนเจ้าหน้าที่ ไม่ขวางงาน
    export const missingContact = (coop?: { contacts?: unknown[] | null; companyId?: string | null } | null) =>
      !!coop?.companyId && (coop.contacts?.length ?? 0) === 0;
    ```
  - `A_CoopApplications.tsx`: ในตาราง ใต้ชื่อบริษัท (คอลัมน์ "หน่วยงาน / ตำแหน่ง") ถ้า `missingContact(app)` แสดง
    `<span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 99, padding: "1px 8px" }}>⚠️ ยังไม่มีผู้ติดต่อ</span>`
    และในกล่อง "ข้อมูลผู้สมัคร" ของ modal ข้อความ `"ยังไม่ได้เลือกผู้ติดต่อ (HR) — หนังสือจะใช้ผู้ติดต่อเดิมของบริษัท: {company.contactPerson || 'ไม่มี'}"`
  - `IssueLetterModal.tsx` / `IssuePlacementLetterModal.tsx` (ในกล่องที่อยู่บริษัท `CompanyAddressBox` ของ `LetterModalShared.tsx`): ถ้า `missingContact(student.coop)` แสดงป้ายเดียวกัน + `"ช่อง 'เรียน' จะใช้ผู้ติดต่อเดิมของบริษัท"`
  - ตรวจในเบราว์เซอร์: คำร้องเก่าไม่มีผู้ติดต่อ → เห็นป้ายทั้งสองที่ และยังกดตรวจ/ออกหนังสือได้ · คำร้องที่มีผู้ติดต่อ → ไม่มีป้าย
- [ ] **Step 7: ตรวจ** — tsc = 23 · `npx vite build` ผ่าน
- [ ] **Step 8: Commit** `feat(admin): เมนูผู้ติดต่อ · แสดงผู้ติดต่อในหน้าข้อมูล · ป้ายคำร้องที่ยังไม่มีผู้ติดต่อ · คอลัมน์ Excel`

---

### Task 8: หนังสือราชการใช้ผู้ติดต่อของคำร้อง (+ แก้ตำแหน่งไม่ขึ้น)

**Files:**
- Create: `Frontend/src/utils/letterRecipient.ts`
- Modify: `IssueLetterModal.tsx:106`, `IssuePlacementLetterModal.tsx:68`, `LetterModalShared.tsx:124`, `utils/pdfDispatchGenerator.ts:131-137`, `utils/pdfGeneratorPlacement.ts:127-128`, `utils/pdfSupervisionLetterGenerator.ts:141-143`
- Test: `Frontend/tests/letterRecipient.spec.ts` (Jest ของ backend อ่านไฟล์ TS ไม่ได้ — ใช้ Playwright test แบบไม่เปิดเบราว์เซอร์ ซึ่งรัน TS ได้)

**Interfaces:**
- Produces: `letterRecipient(coop?: { contacts?: CompanyContact[]; company?: { contactPerson?: string|null; contactPosition?: string|null } | null } | null): { name: string; position: string }` — ชื่อ/ตำแหน่ง ว่างเป็น `""` เมื่อไม่มีข้อมูล (ผู้เรียกใส่ค่าเริ่มต้นเอง เช่น `"ผู้จัดการ / ผู้อำนวยการ"`)

- [ ] **Step 1: เขียนฟังก์ชัน**

```ts
import { contactName, type CompanyContact } from "./contacts";

// ผู้รับหนังสือ ("เรียน …") — ผู้ติดต่อคนแรกของคำร้อง → ผู้ติดต่อเดิมของบริษัท (Company.contactPerson) → ว่าง
// เดิมหนังสือแต่ละฉบับอ่านเองและอ่านชื่อช่องผิด (contactPersonName / contactPersonPosition ไม่มีอยู่จริง) — ตำแหน่งไม่เคยขึ้น
export function letterRecipient(coop?: {
  contacts?: CompanyContact[] | null;
  company?: { contactPerson?: string | null; contactPosition?: string | null } | null;
} | null): { name: string; position: string } {
  const first = (coop?.contacts || []).find((c) => contactName(c));
  if (first) return { name: contactName(first), position: (first.position || "").trim() };
  return {
    name: (coop?.company?.contactPerson || "").trim(),
    position: (coop?.company?.contactPosition || "").trim(),
  };
}
```

- [ ] **Step 2: เทสต์** — เพิ่มใน Playwright ที่รันเร็ว `Frontend/tests/letterRecipient.spec.ts` (ไม่เปิดเบราว์เซอร์ — Playwright รัน TS ได้):

```ts
import { test, expect } from "@playwright/test";
import { letterRecipient } from "../src/utils/letterRecipient";

test("ใช้ผู้ติดต่อคนแรกของคำร้อง", () => {
  expect(letterRecipient({ contacts: [{ id: "1", firstName: "สมศรี", lastName: "", position: " HR " }], company: { contactPerson: "เก่า" } }))
    .toEqual({ name: "สมศรี", position: "HR" });
});
test("ไม่มีผู้ติดต่อ (คำร้องเก่า / ผู้ติดต่อถูกลบ) → ใช้ผู้ติดต่อของบริษัท", () => {
  expect(letterRecipient({ contacts: [], company: { contactPerson: "คุณเอ", contactPosition: "ผู้จัดการ" } }))
    .toEqual({ name: "คุณเอ", position: "ผู้จัดการ" });
});
test("ไม่มีข้อมูลเลย → ว่าง ไม่ใช่ undefined", () => {
  expect(letterRecipient(null)).toEqual({ name: "", position: "" });
});
```
Run: `cd Frontend && npx playwright test tests/letterRecipient.spec.ts` → FAIL ก่อนสร้างไฟล์, PASS หลังสร้าง

- [ ] **Step 3: ใช้ในหนังสือทั้ง 3 ฉบับ + modal**
  - `IssueLetterModal.tsx:106`: `companyContact: letterRecipient(student.coop).name || undefined,` และส่ง `companyContactPosition: letterRecipient(student.coop).position || undefined` (เพิ่ม param ใน generator ถ้ายังไม่มี)
  - `IssuePlacementLetterModal.tsx:68`: `companyRecipient: letterRecipient(student.coop).name || undefined,`
  - `LetterModalShared.tsx:124`: รับ `recipient` (ผลของ `letterRecipient`) แทน `company.contactPerson` → `เรียน: {recipient.name}{recipient.position ? \` (${recipient.position})\` : ""}`
  - `pdfDispatchGenerator.ts:131-137`, `pdfGeneratorPlacement.ts:127-128`, `pdfSupervisionLetterGenerator.ts:141-143`: แทนการอ่าน `contactPersonName` / `contactPersonPosition` / `contactPerson` ด้วย `letterRecipient(profile.coop ?? student.coop)` (ค่าเริ่มต้นเดิมของแต่ละไฟล์คงไว้ เช่น `|| "ผู้จัดการ / ผู้อำนวยการ"`) — ถ้า generator รับแค่ `company` ให้ขยาย param ให้รับ `coop` ด้วย
- [ ] **Step 4: ตรวจ** — tsc = 23 · ออกร่างหนังสือขอความอนุเคราะห์ของนักศึกษาที่มีผู้ติดต่อ → "เรียน" เป็นชื่อผู้ติดต่อ + ตำแหน่ง · นักศึกษาเก่าไม่มีผู้ติดต่อ → ใช้ชื่อเดิมของบริษัท
- [ ] **Step 5: Commit** `feat(letters): ผู้รับหนังสือใช้ผู้ติดต่อของคำร้อง · แก้ตำแหน่งผู้รับไม่ขึ้น`

---

### Task 9: e2e + ตรวจทั้งระบบ + CHANGELOG

**Files:**
- Modify: `Frontend/tests/helpers/e2eSeed.ts:134-160` (fixture ต้องมีผู้ติดต่อ ไม่งั้นยื่นคำร้อง P1 ได้ 400)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: fixture** — หลังสร้าง company:

```ts
  const contact = await prisma.companyContact.create({
    data: { firstName: "ผู้ประสานงาน", lastName: "อีทูอี", position: "HR", email: "hr@company.test", companyId: company.id, createdById: staffUser.id },
  });
```
และใน `studentCoop.create` เพิ่ม `contacts: { connect: [{ id: contact.id }] },` (cleanup ไม่ต้องแก้ — ลบบริษัทแล้วผู้ติดต่อลบตาม)
- [ ] **Step 2: รันทั้งหมด** (restart backend ก่อน e2e เพราะ rate limit 500/15 นาที)
  - `cd backend && npx jest` → PASS ทั้งหมด
  - `cd Frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → 23 · `npx vite build` ผ่าน
  - `npx playwright test --config=playwright.config.ts` → ผ่านทั้งหมด (เดิม 97 + ใหม่)
  - crawl ทุกหน้า (`scratchpad/crawl_all_pages.js`) → ไม่มีปัญหา
  - สคริปต์ตรวจในเบราว์เซอร์ (scratchpad, คืนข้อมูลตอนจบ): นักศึกษา NOT_SUBMITTED ไม่มีผู้ติดต่อ → กดยื่นได้คำเตือน · เพิ่มผู้ติดต่อในหน้าข้อมูลนักศึกษา → ยื่นได้ · เปลี่ยนบริษัท → ผู้ติดต่อหลุด · เจ้าหน้าที่ออกร่างหนังสือ → "เรียน" = ผู้ติดต่อ · ลบผู้ติดต่อ (มีคนเลือกอยู่ → เห็นคำเตือนจำนวนนักศึกษาก่อนลบ) → หนังสือกลับไปใช้ชื่อบริษัท และหน้าตรวจคำร้องขึ้นป้าย "ยังไม่มีผู้ติดต่อ" · ส่ง T002 → พี่เลี้ยงเข้าระบบ (ของเดิม) · ไม่มี native dialog / JS error
- [ ] **Step 3: CHANGELOG** — entry `## [วันที่] feat: ผู้ติดต่อ (HR) แทนพี่เลี้ยง` สรุป: ตารางใหม่ + ย้ายข้อมูล, บังคับก่อนยื่น, พี่เลี้ยงกรอกที่ T002 ที่เดียว, เมนูผู้ติดต่อ, หนังสือใช้ผู้ติดต่อ + แก้บั๊กตำแหน่ง, คอลัมน์ Excel, migration `20260926100000_add_company_contacts` (ต้อง `migrate deploy` + `generate` ตอน deploy)
- [ ] **Step 4: Commit + push**

---

## หมายเหตุการ deploy
- migration ค้างขึ้น VM รวมเป็น 6 ตัว (4 เดิม + รอพิจารณาเกรด + ผู้ติดต่อ) — ใช้ skill `deploy` (มี `prisma generate` แล้ว)
- หลัง deploy: นักศึกษาที่ยัง **ไม่ยื่น** คำร้องต้องเลือกผู้ติดต่อก่อนยื่น · คนที่ยื่นแล้วไม่กระทบ
