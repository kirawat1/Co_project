# Google OAuth + Excel Student Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace KKU REG API student login with Google OAuth (kkumail only), replace KKU sync with Excel import, and add proper advisor relations (general + co-op) to the Student model.

**Architecture:** Staff imports Excel → creates User (username=studentId, email=kkumail, password=null) + Student records + links generalAdvisor by teacher email. Students click Google Sign-In → frontend gets `credential` (id_token) → sends to `POST /api/auth/google` → backend verifies with `google-auth-library` → finds User by email → issues JWT. Teacher/staff login unchanged.

**Tech Stack:** `google-auth-library` (backend), `@react-oauth/google` (frontend), `xlsx` (SheetJS — Excel parsing), Prisma + MySQL, Express, React 19 + TypeScript

---

## Prerequisites (manual — do before running tasks)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create/select a project → APIs & Services → OAuth consent screen → External
3. Credentials → Create OAuth 2.0 Client ID → Web application
4. Authorized JavaScript origins: `http://localhost:5173`
5. Copy Client ID (format: `<numbers>.apps.googleusercontent.com`)
6. Add to `backend/.env`: `GOOGLE_CLIENT_ID=<your-client-id>`
7. Add to `Frontend/.env` (create if missing): `VITE_GOOGLE_CLIENT_ID=<your-client-id>`

---

## Current State (read before coding)

| File | What matters |
|---|---|
| `backend/prisma/schema.prisma` | `User` has `username @unique`, `password String?`, `email String?` (nullable). `Student` has `advisorName String?` (text only). `Teacher` has `email String @unique`. IDs are `Int`. |
| `backend/controllers/authController.js` | `signIn` uses `{ email, role }` to find user, issues JWT with `{ id: user.id, role: user.role }`. `loginWithKKU` is the function to disable (not delete). |
| `backend/routes/authRoutes.js` | Has `router.post("/login/kku", loginWithKKU)` — comment this out |
| `Frontend/src/components/loginpage.tsx` | `role === "student"` section has KKU SSO block (lines ~349–420). States: `kkuMode`, `kkuUser`, `kkuPass`, `kkuLoading`. Remove these + their JSX. Add Google button in same location. |
| `Frontend/src/main.tsx` | Need to wrap with `GoogleOAuthProvider` |

---

## File Map

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/controllers/authController.js` |
| Modify | `backend/routes/authRoutes.js` |
| Create | `backend/controllers/studentImportController.js` |
| Modify | `backend/routes/adminRoutes.js` |
| Modify | `backend/__tests__/authController.test.js` (if exists) |
| Modify | `Frontend/src/main.tsx` |
| Modify | `Frontend/src/components/loginpage.tsx` |
| Modify | `Frontend/src/components/A_Students.tsx` |
| Modify | `Frontend/src/components/S_ProfilePage.tsx` |

---

## Task 1: Schema — Add advisor relations to Student + Teacher

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Read the Student and Teacher models**

Read `backend/prisma/schema.prisma` lines 40–80 (Student) and lines 256–270 (Teacher) to see exact current fields.

- [ ] **Step 2: Add advisor fields to Student model**

In the Student model, after `advisorName String?`, add:

```prisma
  generalAdvisorId  Int?
  coopAdvisorId     Int?
  generalAdvisor    Teacher? @relation("GeneralAdvisor", fields: [generalAdvisorId], references: [id])
  coopAdvisor       Teacher? @relation("CoopAdvisor", fields: [coopAdvisorId], references: [id])
```

- [ ] **Step 3: Add inverse relations to Teacher model**

In the Teacher model, after `supervisionAppointments SupervisionAppointment[]`, add:

```prisma
  generalAdvisees   Student[] @relation("GeneralAdvisor")
  coopAdvisees      Student[] @relation("CoopAdvisor")
```

- [ ] **Step 4: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_student_advisor_relations
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Verify**

```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log('generalAdvisor' in p.student.fields || 'ok')"
```

Expected: output without error

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add generalAdvisor and coopAdvisor relations to Student"
```

---

## Task 2: Backend — Google OAuth endpoint

**Files:**
- Modify: `backend/controllers/authController.js`
- Modify: `backend/routes/authRoutes.js`
- Test: `backend/__tests__/authController.test.js` (or create)

- [ ] **Step 1: Install dependency**

```bash
cd backend && npm install google-auth-library
```

Expected: package added to `node_modules/`

- [ ] **Step 2: Write failing test**

In `backend/__tests__/authController.test.js`, find or create the file. Add this describe block:

```js
// At top of file (if not already present):
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

const prisma = require('./__mocks__/prismaClient');
const { OAuth2Client } = require('google-auth-library');
const { loginWithGoogle } = require('../controllers/authController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('loginWithGoogle', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 – valid kkumail token issues JWT', async () => {
    const mockClient = { verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'test@kkumail.com' }),
    }) };
    OAuth2Client.mockImplementation(() => mockClient);

    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@kkumail.com', role: 'student' });

    const req = { body: { id_token: 'valid-token' } };
    const res = makeRes();

    await loginWithGoogle(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, token: expect.any(String) }));
  });

  test('403 – non-KKU email rejected', async () => {
    const mockClient = { verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'user@gmail.com' }),
    }) };
    OAuth2Client.mockImplementation(() => mockClient);

    const req = { body: { id_token: 'valid-token' } };
    const res = makeRes();

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('401 – email not in system', async () => {
    const mockClient = { verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'notfound@kkumail.com' }),
    }) };
    OAuth2Client.mockImplementation(() => mockClient);

    prisma.user.findUnique.mockResolvedValue(null);

    const req = { body: { id_token: 'valid-token' } };
    const res = makeRes();

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('400 – missing id_token', async () => {
    const req = { body: {} };
    const res = makeRes();

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=authController
```

Expected: FAIL — `loginWithGoogle` not exported yet.

- [ ] **Step 4: Add loginWithGoogle to authController.js**

Read `backend/controllers/authController.js` fully. At the top (after existing requires), add:

```js
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
```

Add this export at the bottom of the file (before last line):

```js
// ==========================================
// Google OAuth Login (students only)
// ==========================================
exports.loginWithGoogle = async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) {
      return res.status(400).json({ ok: false, message: "id_token required" });
    }

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // Restrict to KKU email domains
    if (!email.endsWith('@kkumail.com') && !email.endsWith('@kku.ac.th')) {
      return res.status(403).json({ ok: false, message: "กรุณาใช้ KKU Mail (@kkumail.com หรือ @kku.ac.th)" });
    }

    // Lookup user by email
    const user = await prisma.user.findFirst({ where: { email, role: 'student' } });
    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }

    // Issue JWT — same format as existing signIn
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[loginWithGoogle]', err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการยืนยันตัวตน" });
  }
};
```

- [ ] **Step 5: Add route and comment out KKU route**

Read `backend/routes/authRoutes.js`. Update:

```js
const { signIn, getProfile, loginWithSSO, loginWithKKU, registerStudent, loginWithGoogle } = require("../controllers/authController");

router.post("/signin", signIn);
router.post("/login/sso", loginWithSSO);
// router.post("/login/kku", loginWithKKU);  // ปิดแล้ว — ใช้ Google OAuth แทน
router.post("/login/google", loginWithGoogle);   // NEW
router.post("/register", registerStudent);
router.get("/me", getProfile);
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=authController
```

Expected: All 4 new tests pass. Full suite: `npm test` — no new failures.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/authController.js backend/routes/authRoutes.js backend/__tests__/authController.test.js
git commit -m "feat: Google OAuth login endpoint for students"
```

---

## Task 3: Backend — Excel student import

**Files:**
- Create: `backend/controllers/studentImportController.js`
- Modify: `backend/routes/adminRoutes.js`

- [ ] **Step 1: Install dependency**

```bash
cd backend && npm install xlsx
```

Expected: xlsx in node_modules

- [ ] **Step 2: Write failing test**

Create `backend/__tests__/studentImportController.test.js`:

```js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));
jest.mock('fs', () => ({ readFileSync: jest.fn() }));

const prisma = require('./__mocks__/prismaClient');
const XLSX = require('xlsx');
const { importStudents } = require('../controllers/studentImportController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('importStudents', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 – imports valid rows, returns summary', async () => {
    XLSX.read.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils.sheet_to_json.mockReturnValue([
      {
        'email นักศึกษา': 'stu1@kkumail.com',
        'id': '645040001-1',
        'ชื่อ': 'สมชาย',
        'สกุล': 'ใจดี',
        'ปี': '3',
        'คณะ': 'คณะวิทยาการคอมพิวเตอร์',
        'สาขาวิชา': 'CS',
        'รูปแบบการศึกษา': 'ปกติ',
        'อาจารย์ที่ปรึกษาทั่วไป': 'อ.ทดสอบ',
        'email อาจารย์': 'teacher@kku.ac.th',
      }
    ]);

    prisma.user.upsert.mockResolvedValue({ id: 1 });
    prisma.student.upsert.mockResolvedValue({ id: 1 });
    prisma.teacher.findFirst.mockResolvedValue({ id: 10 });

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();

    await importStudents(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      summary: expect.objectContaining({ total: 1 }),
    }));
  });

  test('400 – no file uploaded', async () => {
    const req = { file: null };
    const res = makeRes();

    await importStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('skips row with missing email or id', async () => {
    XLSX.read.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils.sheet_to_json.mockReturnValue([
      { 'email นักศึกษา': '', 'id': '', 'ชื่อ': 'test' }
    ]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();

    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(1);
    expect(body.summary.created).toBe(0);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=studentImportController
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create studentImportController.js**

Create `backend/controllers/studentImportController.js`:

```js
const XLSX = require('xlsx');
const prisma = require('../config/prismaClient');

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาอัปโหลดไฟล์ Excel" });
    }

    // Parse Excel from buffer (multer memoryStorage) or path
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let created = 0, updated = 0, errors = 0;
    const errorRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const email = String(row['email นักศึกษา'] || '').trim();
      const studentId = String(row['id'] || '').trim();
      const firstName = String(row['ชื่อ'] || '').trim();
      const lastName = String(row['สกุล'] || '').trim();
      const year = String(row['ปี'] || '').trim();
      const curriculum = String(row['คณะ'] || '').trim();
      const major = String(row['สาขาวิชา'] || '').trim();
      const studyProgram = String(row['รูปแบบการศึกษา'] || '').trim() || null;
      const advisorName = String(row['อาจารย์ที่ปรึกษาทั่วไป'] || '').trim() || null;
      const advisorEmail = String(row['email อาจารย์'] || '').trim() || null;

      if (!email || !studentId) {
        errors++;
        errorRows.push({ row: i + 2, email, reason: 'email หรือ id ว่างเปล่า' });
        continue;
      }

      try {
        // 1. Upsert User (username = studentId, email = student email)
        const existingUser = await prisma.user.findFirst({ where: { email } });
        let user;
        if (existingUser) {
          user = existingUser;
          updated++;
        } else {
          user = await prisma.user.upsert({
            where: { username: studentId },
            update: { email },
            create: { username: studentId, email, password: null, role: 'student', provider: 'google' },
          });
          created++;
        }

        // 2. Find teacher by advisor email
        let generalAdvisorId = null;
        if (advisorEmail) {
          const teacher = await prisma.teacher.findFirst({ where: { email: advisorEmail } });
          if (teacher) generalAdvisorId = teacher.id;
        }

        // 3. Upsert Student
        await prisma.student.upsert({
          where: { studentId },
          update: {
            firstName, lastName, year, curriculum, major, studyProgram, advisorName,
            ...(generalAdvisorId !== null && { generalAdvisorId }),
          },
          create: {
            studentId, firstName, lastName, year, curriculum, major, studyProgram, advisorName,
            generalAdvisorId,
            userId: user.id,
          },
        });
      } catch (rowErr) {
        console.error(`[importStudents] row ${i + 2} error:`, rowErr.message);
        errors++;
        errorRows.push({ row: i + 2, email, reason: rowErr.message });
        if (errors > updated + created) updated = Math.max(0, updated - 1); // revert increment if error
      }
    }

    res.json({
      ok: true,
      summary: { total: rows.length, created, updated, errors },
      errorRows,
    });
  } catch (err) {
    console.error('[importStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" });
  }
};
```

- [ ] **Step 5: Add route in adminRoutes.js**

Read `backend/routes/adminRoutes.js` lines 1–25. Add import at top:

```js
const studentImportController = require('../controllers/studentImportController');
const multerMemory = require('multer')({ storage: require('multer').memoryStorage() });
```

Add route (anywhere in the file, after existing routes):

```js
// POST /api/admin/students/import-excel — นำเข้าข้อมูลนักศึกษาจาก Excel
router.post(
  '/students/import-excel',
  verifyToken,
  verifyRole(...STAFF_ONLY),
  multerMemory.single('file'),
  studentImportController.importStudents
);
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=studentImportController
```

Expected: All 3 tests pass.

Full suite:
```bash
cd backend && npm test
```

Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/studentImportController.js backend/routes/adminRoutes.js backend/__tests__/studentImportController.test.js
git commit -m "feat: Excel student import endpoint"
```

---

## Task 4: Frontend — Replace KKU login with Google OAuth button

**Files:**
- Modify: `Frontend/src/main.tsx`
- Modify: `Frontend/src/components/loginpage.tsx`

- [ ] **Step 1: Install dependency**

```bash
cd Frontend && npm install @react-oauth/google
```

- [ ] **Step 2: Wrap app in GoogleOAuthProvider**

Read `Frontend/src/main.tsx`. Add import and wrap:

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

// Wrap <App /> with GoogleOAuthProvider:
root.render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <App />
  </GoogleOAuthProvider>
);
```

- [ ] **Step 3: Create Frontend/.env if not exists**

Create `Frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

(Replace with actual Client ID from Google Cloud Console)

- [ ] **Step 4: Read loginpage.tsx to find KKU section**

Read `Frontend/src/components/loginpage.tsx` lines 50–200 to identify:
- States to remove: `kkuMode`, `kkuUser`, `kkuPass`, `kkuLoading`
- Functions to remove: `onKkuSubmit`
- JSX block to replace: the `{role === "student" && ( <> ... </> )}` section (~line 349–420)

- [ ] **Step 5: Remove KKU states and handler**

Remove these state declarations:
```ts
// REMOVE:
const [kkuMode, setKkuMode] = useState(false);
const [kkuUser, setKkuUser] = useState("");
const [kkuPass, setKkuPass] = useState("");
const [kkuLoading, setKkuLoading] = useState(false);
```

Remove the entire `onKkuSubmit` function.

Also remove KKU-related imports/refs in `resetMode` if present:
```ts
// Update resetMode to remove kkuMode:
function resetMode() { setRegisterMode(false); setError(""); setNotice(""); }
```

- [ ] **Step 6: Add Google imports**

At the top of loginpage.tsx, add:
```tsx
import { GoogleLogin } from '@react-oauth/google';
```

- [ ] **Step 7: Replace KKU JSX section with Google button**

Find and replace the entire `{role === "student" && ( <> ... KKU section ... </> )}` block with:

```tsx
{role === "student" && (
  <>
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border,#e5e7eb)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted,#6b7280)", fontWeight: 600, whiteSpace: "nowrap" }}>
        หรือเข้าสู่ระบบด้วย
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border,#e5e7eb)" }} />
    </div>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          try {
            setLoading(true);
            const res = await fetch("/api/auth/login/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_token: credentialResponse.credential }),
            });
            const data = await res.json();
            if (!data.ok || !data.token) throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");

            localStorage.setItem("coop.token", data.token);
            if (data.user?.id) localStorage.setItem("coop.userId", String(data.user.id));

            const claims = AuthAPI.decodeToken(data.token);
            if (claims) localStorage.setItem("coop.claims", JSON.stringify(claims));

            setNotice("เข้าสู่ระบบสำเร็จ");
            const userRole = (data.user?.role || "student") as Role;
            setTimeout(() => navigate(HOME_BY_ROLE[userRole] ?? "/", { replace: true }), 900);
          } catch (er: unknown) {
            setError(friendlyError(er instanceof Error ? er.message : String(er)));
          } finally {
            setLoading(false);
          }
        }}
        onError={() => setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่")}
        text="signin_with"
        locale="th"
        useOneTap={false}
      />
    </div>
  </>
)}
```

- [ ] **Step 8: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add Frontend/src/main.tsx Frontend/src/components/loginpage.tsx Frontend/.env
git commit -m "feat: replace KKU login with Google OAuth button for students"
```

---

## Task 5: Frontend — Excel import UI in A_Students.tsx

**Files:**
- Modify: `Frontend/src/components/A_Students.tsx`

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/A_Students.tsx` lines 1–60 to understand current state/imports and header section.

- [ ] **Step 2: Add import state**

Inside the component, add:

```ts
const [importFile, setImportFile] = useState<File | null>(null);
const [importLoading, setImportLoading] = useState(false);
const [importResult, setImportResult] = useState<{ total: number; created: number; updated: number; errors: number } | null>(null);
```

- [ ] **Step 3: Add handleImport function**

```ts
const handleImport = async () => {
  if (!importFile) return;
  setImportLoading(true);
  setImportResult(null);
  try {
    const form = new FormData();
    form.append("file", importFile);
    const res = await axios.post("/api/admin/students/import-excel", form, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
    });
    if (res.data.ok) {
      setImportResult(res.data.summary);
      setImportFile(null);
      fetchStudents(); // refresh list
    } else {
      alert(res.data.message || "นำเข้าไม่สำเร็จ");
    }
  } catch (err: any) {
    alert(err.response?.data?.message || "เกิดข้อผิดพลาด");
  } finally {
    setImportLoading(false);
  }
};
```

- [ ] **Step 4: Add import section to JSX**

In the page header (near the existing filter/button section), add:

```tsx
{/* Excel Import Section */}
<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
  <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>📥 นำเข้าข้อมูลนักศึกษา</span>
  <label style={{ cursor: "pointer", fontSize: 12, padding: "6px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, color: "#475569" }}>
    เลือกไฟล์ Excel
    <input
      type="file"
      accept=".xlsx,.xls"
      hidden
      onChange={e => setImportFile(e.target.files?.[0] || null)}
    />
  </label>
  {importFile && (
    <>
      <span style={{ fontSize: 12, color: "#64748b" }}>📄 {importFile.name}</span>
      <button
        style={{ padding: "6px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
        onClick={handleImport}
        disabled={importLoading}
      >
        {importLoading ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
      </button>
    </>
  )}
  {importResult && (
    <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
      ✅ นำเข้า {importResult.created} | อัปเดต {importResult.updated} | error {importResult.errors} รายการ
    </span>
  )}
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/A_Students.tsx
git commit -m "feat: Excel student import UI in A_Students"
```

---

## Task 6: Frontend — CoopAdvisor selector in S_ProfilePage

**Files:**
- Modify: `Frontend/src/components/S_ProfilePage.tsx`

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/S_ProfilePage.tsx` lines 1–60 to understand state, imports, and form structure.

- [ ] **Step 2: Add teacher list state**

```ts
const [teachers, setTeachers] = useState<{ id: number; firstName: string; lastName: string; email: string }[]>([]);
const [coopAdvisorId, setCoopAdvisorId] = useState<number | null>(null);
```

- [ ] **Step 3: Fetch teachers on mount**

Add to the existing `useEffect` or create a new one:

```ts
useEffect(() => {
  const fetchTeachers = async () => {
    try {
      const res = await axios.get("/api/teachers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // API returns array or { data: [] } — adapt to what /api/teachers returns
      const arr = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.teachers ?? []);
      setTeachers(arr);
    } catch { /* silent */ }
  };
  fetchTeachers();
}, [token]);
```

Also read `coopAdvisorId` from the existing profile data when profile loads:
```ts
// Inside the profile-loading effect, after setProfile():
if (profileData.coopAdvisorId) setCoopAdvisorId(profileData.coopAdvisorId);
```

- [ ] **Step 4: Add coopAdvisor section to form JSX**

Find the profile form and add this section (after the advisorName display or in the profile edit section):

```tsx
{/* อาจารย์ที่ปรึกษาโครงงานสหกิจ */}
<div style={{ marginTop: 20 }}>
  <label style={{ fontWeight: 700, fontSize: 14, color: "#334155", display: "block", marginBottom: 8 }}>
    อาจารย์ที่ปรึกษาโครงงานสหกิจ (Co-op Project Advisor)
  </label>
  <select
    value={coopAdvisorId ?? ""}
    onChange={e => setCoopAdvisorId(e.target.value ? Number(e.target.value) : null)}
    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
  >
    <option value="">-- ยังไม่ได้เลือก --</option>
    {teachers.map(t => (
      <option key={t.id} value={t.id}>
        {t.firstName} {t.lastName} {t.email ? `(${t.email})` : ""}
      </option>
    ))}
  </select>
</div>
```

- [ ] **Step 5: Include coopAdvisorId in save/update call**

Find the existing save/submit function in S_ProfilePage.tsx. Add `coopAdvisorId` to the request body:

```ts
// In the existing PUT/PATCH /api/students/me call:
await axios.put("/api/students/me", {
  // ... existing fields ...
  coopAdvisorId: coopAdvisorId,
}, { headers: { Authorization: `Bearer ${token}` } });
```

Also verify `backend/routes/studentRoutes.js` has a `PUT /api/students/me` that accepts and saves `coopAdvisorId` to the Student model via Prisma. If not, add it to the controller that handles student profile updates.

- [ ] **Step 6: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/components/S_ProfilePage.tsx
git commit -m "feat: student can select coopAdvisor from profile page"
```

---

## Task 7: Final verification + CHANGELOG

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
```

Expected: All tests pass. 1 pre-existing failure (adminDocController) unchanged.

- [ ] **Step 2: Frontend TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at top of `CHANGELOG.md`:

```markdown
## [2026-05-31] Google OAuth + Excel Student Import

### Added
- `POST /api/auth/login/google` — Google OAuth login สำหรับนักศึกษา (ต้องเป็น @kkumail.com หรือ @kku.ac.th)
- `POST /api/admin/students/import-excel` — นำเข้าข้อมูลนักศึกษาจาก Excel (.xlsx/.xls)
- `Student.generalAdvisorId` → FK to Teacher (set ตอน Excel import โดย match email อาจารย์)
- `Student.coopAdvisorId` → FK to Teacher (นักศึกษาเลือกเองผ่าน profile page)
- `GoogleLogin` button บนหน้า login สำหรับ role นักศึกษา
- Excel import UI ใน `A_Students.tsx` — เลือกไฟล์ + preview summary
- CoopAdvisor dropdown ใน `S_ProfilePage.tsx`

### Changed
- `POST /api/auth/login/kku` — ปิดแล้ว (route commented out), ใช้ Google OAuth แทน
- `Frontend/src/main.tsx` — wrapped ด้วย `GoogleOAuthProvider`
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for Google OAuth and Excel import"
```

---

## Self-Review

**Spec coverage:**
- [x] Google OAuth for students only — Task 2 + Task 4
- [x] @kkumail.com / @kku.ac.th restriction — Task 2 (backend check)
- [x] Email not found → 401 error — Task 2
- [x] Excel import — Task 3 + Task 5
- [x] Excel columns: email, id, ชื่อ, สกุล, ปี, คณะ, สาขาวิชา, รูปแบบการศึกษา, อาจารย์, email อาจารย์ — Task 3
- [x] Upsert on re-import — Task 3 (upsert logic)
- [x] Self-register kept as fallback — not removed
- [x] generalAdvisorId (from import) + coopAdvisorId (student picks) — Task 1 + Task 3 + Task 6
- [x] Teacher match by email during import — Task 3
- [x] Remove KKU login UI — Task 4

**Type consistency:**
- `loginWithGoogle` exported in authController → imported in authRoutes ✓
- `importStudents` exported in studentImportController → used in adminRoutes ✓
- `coopAdvisorId: Int?` in schema → `Number` in frontend ✓
- JWT format `{ id, role }` matches existing signIn ✓

**Known dependency:**
- Task 4 (Google button) requires Google Client ID in `.env` files — see Prerequisites section
- Task 6 (coopAdvisor) assumes `PUT /api/students/me` already accepts arbitrary Student fields — verify this in Task 6 Step 5
