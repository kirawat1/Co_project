# Co-op System Fixes — Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 issues spanning supervision scheduling, teacher profiles, password policy, document generation, and data integrity.

**Architecture:** Tasks 1–3 are backend-only prerequisites (DB schema, utilities, controller guards). Tasks 4–11 are frontend-only and independent of each other. Task 12 is the final CHANGELOG + verification sweep. Within each task, implementation follows TDD where backend logic is testable.

**Tech Stack:** Express + Prisma + MySQL (backend), React 19 + TypeScript + Vite (frontend), jsPDF + docx (PDF/Word generation), bcryptjs (password hashing), Jest (backend tests).

## Global Constraints

- All async backend controllers: `try/catch` → `res.status(500).json({ ok: false, message: '...' })`.
- API calls in frontend: relative paths only (no `http://localhost:5000`), token from `localStorage.getItem("coop.token")`.
- Role names: `student`, `teacher`, `staff` (lowercase enum). `verifyToken` before `verifyRole` on every route.
- Component naming: `A_*` = Admin/Staff, `T_*` = Teacher, `S_*` = Student.
- Run `npx tsc --noEmit` in `Frontend/` before every frontend commit. Fix all errors before committing.
- `CHANGELOG.md` updated in Task 12 final commit.
- Never commit `node_modules`, `.env`, or generated migration SQL that was already applied in production.

---

## File Map

| File | Task(s) | Change |
|------|---------|--------|
| `backend/prisma/schema.prisma` | 1 | Add `Teacher.prefix String?`; explicit `onDelete: SetNull` on advisor FKs |
| `backend/utils/validatePassword.js` | 2 | Create — shared password policy validator |
| `backend/__tests__/validatePassword.test.js` | 2 | Create — unit tests for validator |
| `backend/controllers/teacherController.js` | 2, 3 | Apply password policy; add prefix; remove faculty; fix createTeacher default password |
| `backend/controllers/supervisionController.js` | 3 | Lock resubmission after DATE_CONFIRMED; extract type from confirmed date |
| `backend/routes/coopRoutes.js` | 9 | Add `GET /config/doc-requirements` for students |
| `Frontend/src/components/A_Teacher.tsx` | 4 | Prefix dropdown; password field; remove faculty from forms |
| `Frontend/src/components/S_Supervision.tsx` | 5, 7 | Per-date type selector; lock UI after confirmation; status text labels |
| `Frontend/src/components/T_SupervisionReview.tsx` | 6 | Display per-date ONLINE/ONSITE badge |
| `Frontend/src/components/IssueLetterModal.tsx` | 8 | Co-op start date input; dark mode fix |
| `Frontend/src/components/LetterModalShared.tsx` | 8 | Force light mode CSS in modal |
| `Frontend/src/components/A_DocT000.tsx` | 10 | Advisor name mismatch warning |
| `Frontend/src/components/S_Docs.tsx` | 9 | Fetch + display doc instructions per type |
| `Frontend/src/utils/docGeneratorUtils.ts` | 11 | Add `studyProgramLabel`; separate studyProgram field in dispatch letter HTML |
| `CHANGELOG.md` | 12 | Batch 1 entry |

---

### Task 1: DB Schema — Teacher.prefix + onDelete: SetNull on advisor FKs

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: migration (auto-generated)

**Interfaces:**
- Produces: `Teacher.prefix: String?` field; `Student.generalAdvisorId` FK with `ON DELETE SET NULL`; `Student.coopAdvisorId` FK with `ON DELETE SET NULL`.

- [ ] **Step 1: Add Teacher.prefix to schema**

Open `backend/prisma/schema.prisma`. In the `Teacher` model (around line 255), add `prefix` as the second field:

```prisma
model Teacher {
  id            Int     @id @default(autoincrement())
  prefix        String? // อ., ผศ., ผศ.ดร., รศ., รศ.ดร., ศ., ศ.ดร., ดร.
  firstName     String
  lastName      String
  email         String  @unique
  phone         String?
  faculty       String?
  major         String?
  isCoopTeacher Boolean @default(false)
  userId        Int     @unique
  user          User    @relation(fields: [userId], references: [id])
  // keep all existing relation fields unchanged
```

- [ ] **Step 2: Add onDelete: SetNull to advisor relations**

In the `Student` model, find the two advisor relation lines and change them:

```prisma
  generalAdvisor   Teacher? @relation("GeneralAdvisor", fields: [generalAdvisorId], references: [id], onDelete: SetNull)
  coopAdvisor      Teacher? @relation("CoopAdvisor", fields: [coopAdvisorId], references: [id], onDelete: SetNull)
```

(The `deleteTeacher` controller already nulls these manually before deleting — adding `onDelete: SetNull` makes the DB constraint self-consistent with that logic.)

- [ ] **Step 3: Run migration**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx prisma migrate dev --name "teacher_prefix_advisor_set_null"
```

Expected output contains: `The following migration(s) have been created and applied` and lists an ALTER TABLE adding `prefix VARCHAR(191)`.

- [ ] **Step 4: Verify**

```powershell
npx prisma studio
```

Open browser → Teacher table → confirm `prefix` column exists (all rows show `null`). Close Prisma Studio (Ctrl+C).

- [ ] **Step 5: Commit**

```powershell
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: DB — Teacher.prefix field + explicit onDelete SetNull for advisor FKs"
```

---

### Task 2: Backend — Password policy utility + apply to all credential endpoints

**Files:**
- Create: `backend/utils/validatePassword.js`
- Create: `backend/__tests__/validatePassword.test.js`
- Modify: `backend/controllers/teacherController.js`
- Modify: `backend/scripts/create_user.js`

**Interfaces:**
- Produces: `validatePassword(password: string): string | null` — `null` = valid; string = Thai error message.

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/validatePassword.test.js`:

```js
const { validatePassword } = require('../utils/validatePassword');

describe('validatePassword', () => {
  test('rejects password shorter than 8 chars', () => {
    expect(validatePassword('Abc1!')).not.toBeNull();
  });
  test('rejects password with no uppercase', () => {
    expect(validatePassword('abcdef1!')).not.toBeNull();
  });
  test('rejects password with no lowercase', () => {
    expect(validatePassword('ABCDEF1!')).not.toBeNull();
  });
  test('rejects password with no digit', () => {
    expect(validatePassword('Abcdefg!')).not.toBeNull();
  });
  test('rejects password with no special character', () => {
    expect(validatePassword('Abcdef1g')).not.toBeNull();
  });
  test('accepts valid password', () => {
    expect(validatePassword('Secure1!')).toBeNull();
  });
  test('accepts valid password with Thai-adjacent special chars', () => {
    expect(validatePassword('Hello1@world')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx jest validatePassword --no-coverage
```

Expected: FAIL — `Cannot find module '../utils/validatePassword'`

- [ ] **Step 3: Create validatePassword.js**

```js
// backend/utils/validatePassword.js
function validatePassword(password) {
  if (!password || password.length < 8)
    return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (!/[A-Z]/.test(password))
    return 'รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)';
  if (!/[a-z]/.test(password))
    return 'รหัสผ่านต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)';
  if (!/\d/.test(password))
    return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)';
  if (!/[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(password))
    return 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว เช่น !@#$%^&*';
  return null;
}

module.exports = { validatePassword };
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
npx jest validatePassword --no-coverage
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Apply to teacherController.js — resetTeacherPassword**

In `backend/controllers/teacherController.js`, find `resetTeacherPassword` (around line 530). Replace the length check:

```js
// REMOVE:
if (!newPassword || newPassword.length < 6) {
  return res.status(400).json({ ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
}

// ADD (at top of the try block):
const { validatePassword } = require('../utils/validatePassword');
const pwError = validatePassword(newPassword);
if (pwError) return res.status(400).json({ ok: false, message: pwError });
```

- [ ] **Step 6: Apply to teacherController.js — createTeacher**

In `createTeacher` (around line 450), replace the hardcoded default password and add prefix:

```js
// OLD destructure line:
const { firstName, lastName, email, phone, faculty, major, prefix } = req.body;

// CHANGE validation check to include password:
const { firstName, lastName, email, phone, major, prefix, password } = req.body;
if (!firstName || !lastName || !email || !password) {
  return res.status(400).json({ ok: false, message: "กรุณากรอก ชื่อ นามสกุล อีเมล และรหัสผ่าน" });
}
const { validatePassword } = require('../utils/validatePassword');
const pwError = validatePassword(password);
if (pwError) return res.status(400).json({ ok: false, message: pwError });

// REMOVE this line:
// const hashed = await bcrypt.hash("1111111111111", 10);
// ADD:
const hashed = await bcrypt.hash(password, 10);
```

Also update the Prisma `teacher.create` data to include `prefix` and remove `faculty` from form input (keep hardcoded):

```js
const teacher = await prisma.teacher.create({
  data: {
    userId: user.id,
    firstName,
    lastName,
    email,
    phone: phone || null,
    faculty: 'วิทยาลัยการคอมพิวเตอร์', // fixed — not from form
    major: major || null,
    prefix: prefix || null,
  },
});
```

- [ ] **Step 7: Apply to create_user.js**

In `backend/scripts/create_user.js`, find the existing length check (around line 42). Replace:

```js
// REMOVE:
if (password.length < 6) {
  console.error("❌ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  process.exit(1);
}

// ADD:
const { validatePassword } = require('./utils/validatePassword');
const pwError = validatePassword(password);
if (pwError) {
  console.error(`❌ รหัสผ่านไม่ผ่านนโยบาย: ${pwError}`);
  process.exit(1);
}
```

Note: path is `'./utils/validatePassword'` relative to the `scripts/` directory — adjust to `'../utils/validatePassword'` if `create_user.js` is inside `scripts/`.

- [ ] **Step 8: Run full test suite**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx jest --no-coverage
```

Expected: all existing tests pass + 7 new validatePassword tests pass

- [ ] **Step 9: Commit**

```powershell
git add backend/utils/validatePassword.js backend/__tests__/validatePassword.test.js backend/controllers/teacherController.js backend/scripts/create_user.js
git commit -m "feat: password policy — min 8 chars + uppercase + lowercase + digit + special char"
```

---

### Task 3: Backend — Supervision lock after teacher confirms + extract type from confirmed date

**Files:**
- Modify: `backend/controllers/supervisionController.js`

**Interfaces:**
- Consumes: `validatePassword` from Task 2 (already applied in Task 2, no dependency here).
- `proposedDates` format: `"YYYY-MM-DD|HH:MM-HH:MM|ONLINE"` or `"...|ONSITE"` (3-part pipe-delimited). Must stay backward-compatible with old 2-part format.

- [ ] **Step 1: Add lock guard to proposeSupervisionDate**

In `backend/controllers/supervisionController.js`, find `exports.proposeSupervisionDate`. Add this block immediately after fetching the student record and before the upsert:

```js
// Block resubmission if appointment already confirmed
const existingAppt = await prisma.supervisionAppointment.findUnique({
  where: { studentId: student.id },
  select: { status: true }
});
if (existingAppt) {
  const LOCKED_STATUSES = ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'];
  if (LOCKED_STATUSES.includes(existingAppt.status)) {
    return res.status(403).json({
      ok: false,
      message: 'ไม่สามารถแก้ไขได้ เนื่องจากอาจารย์ยืนยันวันนิเทศแล้ว'
    });
  }
}
```

- [ ] **Step 2: Extract supervision type from confirmed date in reviewSupervision**

In `exports.reviewSupervision`, find where the teacher approves and a confirmed date is parsed. The current split is:

```js
const [dPart, tRange] = dateStr.split('|');
```

Change to:

```js
const parts = dateStr.split('|');
const [dPart, tRange] = parts;
const confirmedType = parts[2]; // 'ONLINE' | 'ONSITE' | undefined (old format has no parts[2])
```

Then in the Prisma `update` call for confirming, add `supervisionType` if `confirmedType` is present:

```js
const updateData = {
  status: 'DATE_CONFIRMED',
  confirmedDate: new Date(`${dPart}T${startTime}:00`),
  rejectReason: null,
};
if (confirmedType === 'ONLINE' || confirmedType === 'ONSITE') {
  updateData.supervisionType = confirmedType;
}
await prisma.supervisionAppointment.update({
  where: { id: parseInt(id) },
  data: updateData,
});
```

- [ ] **Step 3: Manually test the lock**

Start backend (`cd backend && npm run dev`), then:

```powershell
# 1. Login as student, get token
# 2. Confirm an appointment exists with status DATE_CONFIRMED
# 3. Try to re-propose:
$token = "student-token"
$body = @{ proposedDates = '["2026-09-01|09:00-12:00|ONLINE"]'; supervisionType = "ONLINE" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/coop/supervision/propose" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
```

Expected: `{ ok: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากอาจารย์ยืนยันวันนิเทศแล้ว' }` with status 403.

- [ ] **Step 4: Commit**

```powershell
git add backend/controllers/supervisionController.js
git commit -m "fix: supervision — lock resubmission after DATE_CONFIRMED + extract type from confirmed date"
```

---

### Task 4: Frontend — A_Teacher.tsx: prefix field + password on creation + remove faculty from forms

**Files:**
- Modify: `Frontend/src/components/A_Teacher.tsx`

- [ ] **Step 1: Update Teacher interface and constants**

At the top of `A_Teacher.tsx`, find the `Teacher` interface and `EMPTY_TEACHER` constant. Replace:

```tsx
const TEACHER_PREFIXES = ['อ.', 'ผศ.', 'ผศ.ดร.', 'รศ.', 'รศ.ดร.', 'ศ.', 'ศ.ดร.', 'ดร.'];

interface Teacher {
  id: number;
  prefix: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  major: string;
  userId?: number;
  isCoopTeacher: boolean;
  // faculty intentionally omitted from UI interface
}

const EMPTY_TEACHER: Omit<Teacher, 'id'> = {
  prefix: 'อ.',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  major: '',
  isCoopTeacher: false,
};
```

- [ ] **Step 2: Add createPassword state**

Inside the component body, add:

```tsx
const [createPassword, setCreatePassword] = useState('');
```

- [ ] **Step 3: Update handleCreate to send prefix + password, NOT faculty**

Find the function that POSTs to `/api/admin/teachers`. Update the request body:

```tsx
const body = {
  ...createForm,       // includes prefix, no faculty
  password: createPassword,
};
const res = await fetch('/api/admin/teachers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
```

After successful create, reset password field: `setCreatePassword('');`

- [ ] **Step 4: Update create modal JSX — add prefix + password, remove faculty**

Find the create modal form fields. Make these changes:

```tsx
{/* ADD: Prefix dropdown — before firstName */}
<div>
  <label className="label">คำนำหน้า</label>
  <select
    className="input"
    value={createForm.prefix}
    onChange={e => setCreateForm(f => ({ ...f, prefix: e.target.value }))}
  >
    {TEACHER_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
  </select>
</div>

{/* REMOVE: faculty input entirely */}

{/* ADD: Password field */}
<div>
  <label className="label">
    รหัสผ่านเริ่มต้น <span style={{ color: 'red' }}>*</span>
  </label>
  <input
    className="input"
    type="password"
    value={createPassword}
    onChange={e => setCreatePassword(e.target.value)}
    placeholder="อย่างน้อย 8 ตัว • พิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ"
  />
</div>
```

- [ ] **Step 5: Update edit modal JSX — add prefix, remove faculty**

Find the edit modal (the form for `editModal` state). Add prefix dropdown before firstName. Remove faculty input. Update the PUT body to send `prefix` instead of `faculty`.

- [ ] **Step 6: Update teacher list table — show prefix in name column, remove faculty column**

In the table that renders teacher rows:

```tsx
{/* Name column: */}
<td>{`${t.prefix || ''} ${t.firstName} ${t.lastName}`.trim()}</td>

{/* REMOVE the faculty column header and cell */}
```

- [ ] **Step 7: Update password reset validation hint**

Find the password reset modal. Update the frontend validation:

```tsx
// OLD:
if (newPassword.length < 6) { toast.error('...'); return; }

// NEW:
if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
  toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัว • พิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ');
  return;
}
```

Also add a hint paragraph near the input:

```tsx
<p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
  อย่างน้อย 8 ตัว — ต้องมีพิมพ์ใหญ่ (A-Z) + พิมพ์เล็ก (a-z) + ตัวเลข (0-9) + อักขระพิเศษ (!@#$%)
</p>
```

- [ ] **Step 8: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 9: Commit**

```powershell
git add Frontend/src/components/A_Teacher.tsx
git commit -m "feat: teacher form — prefix dropdown + password required on create + faculty hidden"
```

---

### Task 5: Frontend — S_Supervision.tsx: per-date ONLINE/ONSITE selector + lock UI after confirmation

**Files:**
- Modify: `Frontend/src/components/S_Supervision.tsx`

**Current date format stored:** `"YYYY-MM-DD|HH:MM-HH:MM"` (pipe-separated date and time range). New format appends type: `"YYYY-MM-DD|HH:MM-HH:MM|ONLINE"`.

- [ ] **Step 1: Replace date + type state**

Find the state declarations (~line 40). Replace:

```tsx
// REMOVE:
const [dates, setDates]     = useState<string[]>(['']);
const [supType, setSupType] = useState<'ONLINE' | 'ONSITE'>('ONLINE');

// ADD:
interface ProposedSlot { dateTime: string; endTime: string; type: 'ONLINE' | 'ONSITE'; }
const [slots, setSlots] = useState<ProposedSlot[]>([{ dateTime: '', endTime: '', type: 'ONLINE' }]);
```

(`dateTime` = `"YYYY-MM-DDTHH:MM"` from `<input type="datetime-local">`; `endTime` = `"HH:MM"` for end of range. Adjust field names to match the existing form inputs — inspect what the current date inputs look like and adapt.)

- [ ] **Step 2: Add confirmation lock constant**

After state declarations, add:

```tsx
const LOCKED_STATUSES = ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'];
const isConfirmed = appointment ? LOCKED_STATUSES.includes(appointment.status) : false;
```

- [ ] **Step 3: Update showFormView**

Find the `showFormView` declaration. Change:

```tsx
// OLD:
const showFormView = !appointment || appointment.status === 'TEACHER_REJECTED' || isEditing;

// NEW:
const showFormView = !appointment || appointment.status === 'TEACHER_REJECTED' || (isEditing && !isConfirmed);
```

- [ ] **Step 4: Update form JSX — per-date type selectors**

Find the section that renders date inputs. Replace the single `supType` selector with per-slot UI:

```tsx
{slots.map((slot, i) => (
  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
    {/* keep existing date/time inputs, map them to slot.dateTime and slot.endTime */}

    {/* ADD type selector per slot */}
    <select
      className="input"
      value={slot.type}
      style={{ width: 130 }}
      onChange={e => setSlots(prev =>
        prev.map((s, idx) => idx === i ? { ...s, type: e.target.value as 'ONLINE' | 'ONSITE' } : s)
      )}
    >
      <option value="ONLINE">🖥️ ออนไลน์</option>
      <option value="ONSITE">🏢 เอนไซต์</option>
    </select>

    {slots.length > 1 && (
      <button type="button" className="btn btn-secondary"
        onClick={() => setSlots(prev => prev.filter((_, idx) => idx !== i))}>
        ✕
      </button>
    )}
  </div>
))}
{slots.length < 3 && (
  <button type="button" className="btn btn-secondary"
    onClick={() => setSlots(prev => [...prev, { dateTime: '', endTime: '', type: 'ONLINE' }])}>
    + เพิ่มตัวเลือก
  </button>
)}
```

- [ ] **Step 5: Update submit handler — encode type into proposedDates string**

Find the `handleSubmit` or the `fetch('/api/coop/supervision/propose'...)` call. Encode slots:

```tsx
// Build the proposedDates array in existing format + |TYPE suffix
const encodedDates = slots.map(s => {
  const datePart = s.dateTime.split('T')[0]; // "YYYY-MM-DD"
  const startT   = s.dateTime.split('T')[1] || '09:00'; // "HH:MM"
  const endT     = s.endTime || startT;
  return `${datePart}|${startT}-${endT}|${s.type}`;
});

const payload = {
  proposedDates: JSON.stringify(encodedDates),
  // supervisionType removed — now per-slot
};
```

- [ ] **Step 6: Hide edit button when confirmed**

Find the button that sets `isEditing(true)`. Wrap it:

```tsx
{!isConfirmed && (
  <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
    ✏️ แก้ไขวันที่
  </button>
)}
{isConfirmed && (
  <p style={{ fontSize: 12, color: '#64748b' }}>
    🔒 ไม่สามารถแก้ไขได้ เนื่องจากอาจารย์ยืนยันวันนิเทศแล้ว
  </p>
)}
```

- [ ] **Step 7: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```powershell
git add Frontend/src/components/S_Supervision.tsx
git commit -m "feat: supervision — per-date online/onsite selection + lock form after teacher confirms"
```

---

### Task 6: Frontend — T_SupervisionReview.tsx: show per-date ONLINE/ONSITE badge

**Files:**
- Modify: `Frontend/src/components/T_SupervisionReview.tsx`

- [ ] **Step 1: Add date-parsing helper**

Before the component export, add:

```tsx
function parseProposedSlot(raw: string): { date: string; timeRange: string; type?: 'ONLINE' | 'ONSITE' } {
  const parts = raw.split('|');
  return {
    date: parts[0] ?? '',
    timeRange: parts[1] ?? '',
    type: (parts[2] as 'ONLINE' | 'ONSITE') || undefined,
  };
}
```

- [ ] **Step 2: Update proposed date list rendering**

Find where `parsedDates` (the JSON-parsed `proposedDates` array) is rendered as radio options or selectable rows. For each item, call `parseProposedSlot` and show the type badge:

```tsx
{parsedDates.map((raw: string, i: number) => {
  const { date, timeRange, type } = parseProposedSlot(raw);
  return (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {/* keep existing radio/select UI */}
      <span style={{ fontSize: 13 }}>{formatThaiDate(date)} {timeRange}</span>

      {type && (
        <span style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600,
          background: type === 'ONLINE' ? '#dbeafe' : '#dcfce7',
          color:      type === 'ONLINE' ? '#1d4ed8' : '#15803d',
        }}>
          {type === 'ONLINE' ? '🖥️ ออนไลน์' : '🏢 เอนไซต์'}
        </span>
      )}
    </div>
  );
})}
```

- [ ] **Step 3: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add Frontend/src/components/T_SupervisionReview.tsx
git commit -m "feat: supervision review — per-date online/onsite badge visible to teacher"
```

---

### Task 7: Frontend — S_Supervision.tsx: supervision status text labels with icons

**Files:**
- Modify: `Frontend/src/components/S_Supervision.tsx`

- [ ] **Step 1: Add status display map**

After imports, add:

```tsx
const SUPERVISION_STATUS_UI: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  PENDING_TEACHER:  { icon: '⏳', label: 'รออาจารย์ตรวจสอบ',             color: '#d97706', bg: '#fef3c7' },
  TEACHER_REJECTED: { icon: '❌', label: 'อาจารย์ตีกลับ — เสนอวันใหม่',   color: '#dc2626', bg: '#fee2e2' },
  DATE_CONFIRMED:   { icon: '✅', label: 'อาจารย์ยืนยันวันนิเทศแล้ว',    color: '#059669', bg: '#d1fae5' },
  LETTER_UPLOADED:  { icon: '📄', label: 'อัปโหลดหนังสือนิเทศแล้ว',      color: '#2563eb', bg: '#dbeafe' },
  COMPLETED:        { icon: '🎉', label: 'การนิเทศเสร็จสิ้น',            color: '#7c3aed', bg: '#ede9fe' },
};
```

- [ ] **Step 2: Replace color-only status indicator with text+icon card**

Find every place that shows the supervision appointment status (typically a badge or colored dot). Replace with:

```tsx
{appointment?.status && (() => {
  const ui = SUPERVISION_STATUS_UI[appointment.status];
  if (!ui) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 16px', borderRadius: 10,
      background: ui.bg, border: `1px solid ${ui.color}40`,
      marginBottom: 12,
    }}>
      <span style={{ fontSize: 20 }}>{ui.icon}</span>
      <div>
        <div style={{ fontWeight: 700, color: ui.color, fontSize: 14 }}>{ui.label}</div>
        {appointment.status === 'DATE_CONFIRMED' && appointment.confirmedDate && (
          <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
            วันที่นิเทศ:{' '}
            {new Date(appointment.confirmedDate).toLocaleDateString('th-TH', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
        )}
        {appointment.status === 'TEACHER_REJECTED' && appointment.rejectReason && (
          <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>
            เหตุผล: {appointment.rejectReason}
          </div>
        )}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add Frontend/src/components/S_Supervision.tsx
git commit -m "fix: supervision status shows text + icon card instead of color-only indicator"
```

---

### Task 8: Frontend — IssueLetterModal: co-op start date input + dark mode fix

**Files:**
- Modify: `Frontend/src/components/LetterModalShared.tsx`
- Modify: `Frontend/src/components/IssueLetterModal.tsx`

- [ ] **Step 1: Force light mode in MODAL_CSS**

Open `Frontend/src/components/LetterModalShared.tsx`. Find the `MODAL_CSS` string constant. Append at the end:

```tsx
/* Force light mode — document preview must not be affected by app dark theme */
.modal-backdrop { color-scheme: light; }
.modal-card {
  background: #ffffff !important;
  color: #1e293b !important;
}
.modal-card .input,
.modal-card select,
.modal-card textarea {
  background: #f8fafc !important;
  color: #1e293b !important;
  border-color: #e2e8f0 !important;
}
.modal-card label { color: #374151 !important; }
.modal-card h2, .modal-card h3 { color: #0f172a !important; }
```

- [ ] **Step 2: Add manual start date state in IssueLetterModal**

In `IssueLetterModal.tsx`, after the existing `startDate` const:

```tsx
const startDate = student.coop?.actualStartDate || student.coopApplicationForm?.startDate || '';
const endDate   = student.coop?.actualEndDate   || student.coopApplicationForm?.endDate   || '';

// ADD:
const [manualStartDate, setManualStartDate] = useState('');
const effectiveStartDate = startDate || manualStartDate;
```

- [ ] **Step 3: Add date picker when startDate is missing**

In the modal JSX, before the document number input, add:

```tsx
{!startDate && (
  <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef9c3', borderRadius: 8, border: '1px solid #fde047' }}>
    <label className="label" style={{ color: '#854d0e' }}>
      วันที่เริ่มฝึกสหกิจ <span style={{ color: 'red' }}>*</span>
      <span style={{ fontSize: 11, color: '#a16207', marginLeft: 6 }}>(ไม่พบในระบบ กรุณากรอกเพื่อออกเอกสาร)</span>
    </label>
    <input
      className="input"
      type="date"
      value={manualStartDate}
      onChange={e => setManualStartDate(e.target.value)}
    />
  </div>
)}
```

- [ ] **Step 4: Replace startDate with effectiveStartDate in all generator calls**

Find every call to `createDispatchPDF(...)` and `buildDispatchLetterHtml(...)`. Replace `startDate` argument with `effectiveStartDate`.

Also add a guard before generation if the date is still missing:

```tsx
if (!effectiveStartDate) {
  toast.error('กรุณากรอกวันที่เริ่มฝึกสหกิจก่อนออกเอกสาร');
  return;
}
```

- [ ] **Step 5: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add Frontend/src/components/LetterModalShared.tsx Frontend/src/components/IssueLetterModal.tsx
git commit -m "fix: dispatch letter — add start date input when missing + force light mode in modal"
```

---

### Task 9: Backend + Frontend — Doc instructions visible to students

**Goal:** Students can see the required-info text for each document type, configured by admin via `A_DocRequirements.tsx`.

**Files:**
- Modify: `backend/routes/coopRoutes.js`
- Modify: `Frontend/src/components/S_Docs.tsx`

- [ ] **Step 1: Find the doc-requirements controller function**

```powershell
Select-String -Path "C:\xampp\htdocs\Co_project\backend\routes\adminRoutes.js" -Pattern "doc-requirements"
```

Note the `require(...)` path and function names (e.g., `docController.getDocRequirements`). Read that controller file to see what `getDocRequirements` returns (shape of response).

- [ ] **Step 2: Add student-accessible GET route in coopRoutes.js**

In `backend/routes/coopRoutes.js`, after the existing imports and before `module.exports`:

```js
// Import the same controller used in adminRoutes (adjust path from Step 1):
const docReqController = require("../controllers/docRequirementsController");

// Doc requirements — read-only, accessible by all authenticated users
router.get("/doc-requirements", verifyToken, docReqController.getDocRequirements);
```

- [ ] **Step 3: Test the endpoint with a student token**

```powershell
$token = "paste-student-jwt-token"
Invoke-RestMethod -Uri "http://localhost:5000/api/coop/doc-requirements" `
  -Headers @{ Authorization = "Bearer $token" }
```

Expected: `{ ok: true, data: [...] }` — array of requirement objects. Note the shape of each object (`docType`, `description`, `requirement`, or whatever field holds the text).

- [ ] **Step 4: Add doc instructions in S_Docs.tsx**

In `Frontend/src/components/S_Docs.tsx`, add state + fetch:

```tsx
const [docInstructions, setDocInstructions] = useState<Record<string, string>>({});

useEffect(() => {
  const token = localStorage.getItem("coop.token");
  fetch('/api/coop/doc-requirements', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d?.ok && Array.isArray(d.data)) {
        const map: Record<string, string> = {};
        // Adjust 'docType' and 'description' keys to match actual response shape from Step 3:
        d.data.forEach((req: any) => {
          if (req.docType) map[req.docType] = req.description || req.requirement || '';
        });
        setDocInstructions(map);
      }
    })
    .catch(() => {});
}, []);
```

Near each document upload section, show the instruction box:

```tsx
{/* Call this wherever you know the docType for a section: */}
{docInstructions['T000'] && (
  <div style={{
    padding: '8px 14px', background: '#eff6ff', borderRadius: 8,
    border: '1px solid #bfdbfe', marginBottom: 10, fontSize: 13, color: '#1e40af'
  }}>
    ℹ️ {docInstructions['T000']}
  </div>
)}
```

Repeat for each document type section (T002, T003, T005, etc.) with the appropriate key.

- [ ] **Step 5: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add backend/routes/coopRoutes.js Frontend/src/components/S_Docs.tsx
git commit -m "feat: doc instructions per type visible to students via /api/coop/doc-requirements"
```

---

### Task 10: Frontend — Advisor name mismatch indicator in A_DocT000.tsx

**Goal:** When staff reviews student docs, show a warning if `student.advisorName` (free text) doesn't match the linked `generalAdvisor` Teacher record.

**Files:**
- Modify: `Frontend/src/components/A_DocT000.tsx`
- Possibly modify: the backend query for `GET /api/admin/t000/students` to include `generalAdvisor`

- [ ] **Step 1: Check if generalAdvisor is in admin student response**

```powershell
$token = "paste-staff-jwt-token"
$result = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/t000/students" `
  -Headers @{ Authorization = "Bearer $token" }
$result.data[0] | ConvertTo-Json -Depth 4
```

Look for `generalAdvisor` object in the output.

- [ ] **Step 2a: If generalAdvisor is NOT in response — add to backend query**

Find the controller that handles `GET /api/admin/t000/students`. Find its `prisma.student.findMany(...)` call. Add `generalAdvisor` to the `include`:

```js
include: {
  generalAdvisor: { select: { firstName: true, lastName: true, prefix: true } },
  // ... keep all existing includes
}
```

- [ ] **Step 2b: Add mismatch helper in A_DocT000.tsx**

Add before the component:

```tsx
function advisorMismatchWarning(student: any): string | null {
  const linked = student.generalAdvisor;
  if (!linked || !student.advisorName) return null;
  const storedName = (student.advisorName as string).toLowerCase();
  const matchesFirst = storedName.includes(linked.firstName.toLowerCase());
  const matchesLast  = storedName.includes(linked.lastName.toLowerCase());
  if (!matchesFirst && !matchesLast) {
    const linkedFull = `${linked.prefix || ''} ${linked.firstName} ${linked.lastName}`.trim();
    return `⚠️ ชื่ออาจารย์ไม่ตรง — นักศึกษากรอก "${student.advisorName}" / ระบบเชื่อมกับ "${linkedFull}"`;
  }
  return null;
}
```

- [ ] **Step 3: Show warning in student card/row**

In the section that shows student details, add:

```tsx
{advisorMismatchWarning(student) && (
  <div style={{
    fontSize: 12, color: '#b45309', background: '#fef3c7',
    border: '1px solid #fcd34d', borderRadius: 6,
    padding: '4px 10px', marginTop: 4
  }}>
    {advisorMismatchWarning(student)}
  </div>
)}
```

- [ ] **Step 4: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add Frontend/src/components/A_DocT000.tsx
git commit -m "feat: admin doc review — show warning when advisor name doesn't match Teacher record"
```

---

### Task 11: Frontend — studyProgram as separate labeled field in student table + dispatch letter

**Goal:** Display `studyProgram` (NORMAL → "ภาคปกติ", SPECIAL → "ภาคพิเศษ") as a separate field alongside `major` in the admin student table and in the dispatch letter document.

**Files:**
- Modify: `Frontend/src/utils/docGeneratorUtils.ts`
- Modify: Admin student list component (likely `A_Students.tsx` — confirm by searching for the component that renders the student table with major info)

- [ ] **Step 1: Add studyProgramLabel helper to docGeneratorUtils.ts**

In `Frontend/src/utils/docGeneratorUtils.ts`, add before any export:

```ts
export function studyProgramLabel(sp?: string | null): string {
  if (sp === 'NORMAL') return 'ภาคปกติ';
  if (sp === 'SPECIAL') return 'ภาคพิเศษ';
  return '';
}
```

- [ ] **Step 2: Add studyProgram to dispatch letter HTML**

In `buildDispatchLetterHtml(...)` (inside `docGeneratorUtils.ts`), find where the student's `major` is rendered. Add a row for studyProgram:

```ts
// Find something like: <td>สาขาวิชา</td><td>${student.major || '-'}</td>
// Add AFTER it:
<tr>
  <td style="...">หลักสูตร</td>
  <td style="...">${studyProgramLabel(student.studyProgram) || '-'}</td>
</tr>
```

- [ ] **Step 3: Find the admin student list component**

```powershell
Select-String -Path "C:\xampp\htdocs\Co_project\Frontend\src\components" -Pattern "studyProgram" -Recurse
```

Note which component files reference `studyProgram`. Read the main admin student list component (likely `A_Students.tsx`).

- [ ] **Step 4: Add studyProgram column to admin student table**

In the student table:

```tsx
// In column headers:
<th>หลักสูตร</th>

// In data rows:
<td>{student.studyProgram === 'NORMAL' ? 'ภาคปกติ' : student.studyProgram === 'SPECIAL' ? 'ภาคพิเศษ' : '-'}</td>
```

- [ ] **Step 5: TypeScript check + commit**

```powershell
npx tsc --noEmit
git add Frontend/src/utils/docGeneratorUtils.ts
git add Frontend/src/components/  # commit all modified component files
git commit -m "feat: studyProgram shown as separate field in student table and dispatch letter"
```

---

### Task 12: CHANGELOG + Final verification sweep

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

At the top of `CHANGELOG.md`, add:

```markdown
## [2026-07-22] fix/feat: Batch 1 — 12 system improvements

### ความปลอดภัย
- **รหัสผ่าน:** นโยบายใหม่ — อย่างน้อย 8 ตัว, ต้องมีพิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ — บังคับใช้ที่ทุก endpoint และ script

### ฐานข้อมูล
- **Teacher.prefix:** เพิ่ม field คำนำหน้าอาจารย์ (อ., ผศ., รศ., ศ., ดร. ฯลฯ)
- **onDelete: SetNull:** ระบุ FK constraint อย่างชัดเจนบน Student→Teacher (generalAdvisor, coopAdvisor)

### ระบบนิเทศ
- **เลือก ONLINE/ONSITE แต่ละวัน:** นักศึกษาเลือกรูปแบบแยกต่างหากสำหรับแต่ละวันที่เสนอ
- **ล็อกหลังยืนยัน:** ไม่สามารถแก้ไขวันนิเทศได้หลังอาจารย์ยืนยัน (frontend + backend)
- **ข้อความสถานะ:** แสดงข้อความ+ไอคอนแทนสีเพียงอย่างเดียว

### อาจารย์
- **คำนำหน้า:** ฟอร์มสร้าง/แก้ไขอาจารย์มี dropdown คำนำหน้า
- **รหัสผ่านสร้างใหม่:** ต้องกำหนดรหัสผ่านตอนสร้าง (ลบ hardcoded "1111111111111" ออก)
- **ซ่อนคณะ:** ฟิลด์คณะถูกซ่อนจากฟอร์ม

### เอกสาร
- **วันที่เริ่มฝึก:** modal ออกเอกสารขอความอนุเคราะห์มีช่องกรอกวันที่เมื่อไม่พบในระบบ
- **Dark mode:** modal ออกเอกสารบังคับ light mode — ไม่ขึ้นหน้าดำอีกต่อไป

### ผู้ดูแลระบบ
- **ตรวจชื่ออาจารย์ที่ปรึกษา:** แสดงคำเตือนเมื่อชื่อที่นักศึกษากรอกไม่ตรงกับ Teacher record ในระบบ

### นักศึกษา
- **คำแนะนำเอกสาร:** ข้อความแนะนำสำหรับแต่ละประเภทเอกสาร (กำหนดโดยเจ้าหน้าที่)
- **หลักสูตร:** แสดง studyProgram (ภาคปกติ/ภาคพิเศษ) แยกต่างหากในตารางและเอกสาร
```

- [ ] **Step 2: TypeScript final check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```

Expected: no output (exit code 0)

- [ ] **Step 3: Backend test suite**

```powershell
cd C:\xampp\htdocs\Co_project\backend
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 4: Final commit**

```powershell
cd C:\xampp\htdocs\Co_project
git add CHANGELOG.md
git commit -m "docs: CHANGELOG — Batch 1 fixes (12 items)"
```

---

## Self-Review

### Spec coverage

| User request | Task |
|---|---|
| นิเทศวันจองแยกวันนิเทศจริง เลือกแยกออนไลน์ เอนไซต์ได้แต่ละวัน | Tasks 3, 5, 6 |
| ล็อกวันไม่ให้นักศึกษาแก้ ตั้งแต่จารยืนยัน | Tasks 3, 5 |
| บอกรายละเอียดจำเป็นการกรอกเอกสารแต่ละตัว | Task 9 |
| ตรวจเรื่องอาจารที่ปรึกษาว่าชื่อขึ้นตามนักศึกษาที่เลือกไว้ | Task 10 |
| กรอกวันที่ไปฝึกสหกิจ เพื่อออกเอกสารอนุเคราะห์ | Task 8 |
| แจ้งเตือนนิเทศ ขึ้นข้อความบอกด้วยไม่ใช่แค่สี | Task 7 |
| ตอนออกเอกสาร โหมดมือ หน้าเอกสารเป็นสีดำ | Task 8 |
| Cby รหัสผ่านต้องผ่านการตั้งตามหลักการ | Task 2, 4 |
| หลักสูตร สาขาแยก ให้ออก | Task 11 |
| คำนำหน้า อาจารย์ | Tasks 1, 2, 4 |
| คณะของจารเอาออกไม่ต้องใส่ | Tasks 2, 4 |
| พวกข้อมูลที่เชื่อมกัน ตรวจสอบ referential integrity | Task 1 |

All 12 items covered. ✅

### Placeholder scan

- Task 9 Step 1 requires reading a file at implementation time (controller name unknown from this plan) — this is intentional, not a placeholder. The step instructs the implementer exactly how to find the name.
- Task 10 Step 1 requires a runtime API call to check response shape — same pattern; implementer is told exactly what to look for.
- No "TBD", "TODO", or "implement later" strings present.

### Type consistency

- `ProposedSlot` interface defined in Task 5, used only within Task 5 (local to S_Supervision.tsx). ✅
- `parseProposedSlot` function defined and used only in Task 6 (T_SupervisionReview.tsx). ✅
- `validatePassword` defined in Task 2, applied in Tasks 2 and 4 with matching import path. ✅
- `studyProgramLabel` defined in Task 11 `docGeneratorUtils.ts`, exported and available to all callers. ✅
