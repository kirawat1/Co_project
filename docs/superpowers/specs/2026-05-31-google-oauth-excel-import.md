# Google OAuth + Excel Student Import — Design Spec

## Goal

Replace KKU REG API student login with Google OAuth (restricted to @kkumail.com / @kku.ac.th). Replace KKU API data sync with Excel file import by staff. Add proper advisor relations (general + co-op) to the Student model.

## Architecture

```
[Staff uploads Excel]                    [Student clicks Google button]
         ↓                                          ↓
POST /api/admin/students/import-excel      POST /api/auth/google { id_token }
         ↓                                          ↓
  parse xlsx (SheetJS)               google-auth-library: verify id_token
         ↓                                          ↓
  upsert User (passwordHash=null)         extract email
  + upsert Student                                  ↓
  + link generalAdvisor by email         check @kkumail.com / @kku.ac.th
                                                    ↓
                                         lookup User by email
                                                    ↓
                                    not found → 401 "ไม่พบรายชื่อในระบบ"
                                    found → issue JWT (same as current)
```

**Tech Stack:** `@react-oauth/google` (frontend), `google-auth-library` (backend), `xlsx` (SheetJS — backend Excel parsing), Prisma + MySQL, Express, React 19 + TypeScript

---

## Out of Scope

- Google OAuth for teacher/staff — they keep email+password
- KKU REG API course search / grade sync (separate feature, unaffected)
- Push notifications or real-time features

---

## Section 1: Schema Changes

### 1a. Add advisor relations to Student

```prisma
model Student {
  // ... existing fields ...
  generalAdvisorId  String?
  coopAdvisorId     String?

  generalAdvisor    Teacher? @relation("GeneralAdvisor", fields: [generalAdvisorId], references: [id])
  coopAdvisor       Teacher? @relation("CoopAdvisor", fields: [coopAdvisorId], references: [id])
}
```

- `generalAdvisorId` — set during Excel import (matched by teacher email)
- `coopAdvisorId` — set by student later via profile page
- Both nullable; `advisorName String?` field kept as text fallback

### 1b. Teacher model — add named relations

The existing `Teacher` model needs the inverse relations:

```prisma
model Teacher {
  // ... existing fields ...
  generalAdvisees Student[] @relation("GeneralAdvisor")
  coopAdvisees    Student[] @relation("CoopAdvisor")
}
```

Migration name: `add_student_advisor_relations`

---

## Section 2: Backend — Google OAuth

### 2a. New endpoint: `POST /api/auth/google`

**File:** `backend/controllers/authController.js`

**Install:** `npm install google-auth-library`

**Logic:**

```js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.loginWithGoogle = async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ ok: false, message: "id_token required" });

    // Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // Restrict to KKU email domains
    if (!email.endsWith('@kkumail.com') && !email.endsWith('@kku.ac.th')) {
      return res.status(403).json({ ok: false, message: "กรุณาใช้ KKU Mail (@kkumail.com หรือ @kku.ac.th)" });
    }

    // Lookup user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }

    // Issue JWT (same as existing signIn flow)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[loginWithGoogle]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการยืนยันตัวตน" });
  }
};
```

**Route:** `POST /api/auth/google` (add to `authRoutes.js`)

### 2b. Remove `loginWithKKU` route

Remove `router.post("/login/kku", loginWithKKU)` from `authRoutes.js`. Keep the controller function for now (don't delete, just unregister route).

### 2c. Environment variable

Add to `backend/.env`:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

---

## Section 3: Backend — Excel Import

### 3a. New endpoint: `POST /api/admin/students/import-excel`

**Install:** `npm install xlsx`

**File:** new `backend/controllers/studentImportController.js`

**Excel columns (exact header row — case-insensitive match):**
| Column | Maps to |
|---|---|
| `email นักศึกษา` | `User.email` |
| `id` | `Student.studentId` |
| `ชื่อ` | `Student.firstName` |
| `สกุล` | `Student.lastName` |
| `ปี` | `Student.year` |
| `คณะ` | `Student.curriculum` |
| `สาขาวิชา` | `Student.major` |
| `รูปแบบการศึกษา` | `Student.studyProgram` |
| `อาจารย์ที่ปรึกษาทั่วไป` | `Student.advisorName` (text fallback) |
| `email อาจารย์` | lookup Teacher → set `generalAdvisorId` |

**Logic per row:**
1. Validate: email and id must be non-empty
2. `upsert User` by email: if not exists → create (`role: 'student'`, `passwordHash: null`); if exists → no change to password
3. `upsert Student` by `studentId`: create or update all fields
4. Lookup `Teacher` by `User.email = email_อาจารย์` → if found, set `generalAdvisorId`
5. Accumulate `{ created, updated, errors }` counts

**Response:**
```json
{ "ok": true, "summary": { "created": 5, "updated": 12, "errors": 1 }, "errorRows": [{ "row": 3, "email": "x@y.com", "reason": "invalid email" }] }
```

**Multer:** reuse existing `upload` middleware (single file, field name `file`)

**Route:** `POST /api/admin/students/import-excel` — `verifyToken`, `verifyRole('staff', 'admin')`, `upload.single('file')`  
**Add to:** `backend/routes/adminRoutes.js` or new `backend/routes/studentImportRoutes.js` (mount at `/api/admin`)

---

## Section 4: Frontend — Login Page

**File:** `Frontend/src/components/loginpage.tsx`

**Changes:**

1. **Remove KKU login tab** — delete the `kkuMode` state, `onKkuSubmit` function, and all KKU form JSX
2. **Add Google button for student role** — when `role === 'student'`, show Google Sign-In button above the self-register option

**Install:** `npm install @react-oauth/google`

**Wrap app in GoogleOAuthProvider** in `Frontend/src/main.tsx`:
```tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

**Add to `Frontend/.env`:**
```
VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

**Google button component in loginpage.tsx:**
```tsx
import { useGoogleLogin } from '@react-oauth/google';

// Inside A_Announcements component, when role === 'student':
const googleLogin = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    // tokenResponse.access_token — need to exchange for id_token
    // Use credential response instead with GoogleLogin component
  }
});
```

**Better: use `GoogleLogin` component** (renders Google's styled button, returns `credential` = id_token directly):
```tsx
import { GoogleLogin } from '@react-oauth/google';

{role === 'student' && (
  <GoogleLogin
    onSuccess={async (credentialResponse) => {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!data.ok) { setError(friendlyError(data.message)); return; }
      localStorage.setItem('coop.token', data.token);
      // decode claims, navigate — same as existing onSubmit success flow
    }}
    onError={() => setError('เข้าสู่ระบบด้วย Google ไม่สำเร็จ')}
    text="signin_with"
    locale="th"
  />
)}
```

---

## Section 5: Frontend — Excel Import UI

**File:** `Frontend/src/components/A_Students.tsx` — add import section at top

**UI:**
```
[📥 นำเข้าข้อมูลนักศึกษา (Excel)]
  → file input (.xlsx/.xls only)
  → after select: preview table (first 5 rows)
  → [ยืนยันนำเข้า] button
  → show result: "นำเข้า 5 รายการ | อัปเดต 12 รายการ | error 1 รายการ"
```

**State:** `importFile`, `importPreview`, `importLoading`, `importResult`

---

## Section 6: Frontend — Student CoopAdvisor Selector

**File:** `Frontend/src/components/S_ProfilePage.tsx`

**Add section:** "อาจารย์ที่ปรึกษาโครงงานสหกิจ"
- Fetch `GET /api/teachers` to populate dropdown
- `PUT /api/students/me` with `{ coopAdvisorId }` to save

Current `PUT /api/students/me` or `PATCH` endpoint — check if it accepts `coopAdvisorId`, add if missing.

---

## Files to Create / Modify

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/controllers/studentImportController.js` |
| Modify | `backend/controllers/authController.js` |
| Modify | `backend/routes/authRoutes.js` |
| Modify | `backend/routes/adminRoutes.js` |
| Modify | `Frontend/src/main.tsx` |
| Modify | `Frontend/src/components/loginpage.tsx` |
| Modify | `Frontend/src/components/A_Students.tsx` |
| Modify | `Frontend/src/components/S_ProfilePage.tsx` |

---

## Google Cloud Console Setup (one-time manual step)

1. Create project at console.cloud.google.com
2. Enable Google+ API or People API
3. Create OAuth 2.0 Client ID (Web application)
4. Add Authorized JavaScript origins: `http://localhost:5173`
5. Copy Client ID → set `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID`

> This step must be done manually before implementation.
