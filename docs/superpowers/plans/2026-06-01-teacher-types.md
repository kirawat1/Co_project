# Teacher Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แบ่งอาจารย์เป็น 2 ประเภท — อาจารย์ประจำวิชาสหกิจ (เห็นนักศึกษาทุกคน จัดการนิเทศได้เหมือนเจ้าหน้าที่) และอาจารย์ปกติ (เห็นเฉพาะนักศึกษาที่ตนเป็นอาจารย์ที่ปรึกษา) พร้อมแสดงข้อมูลอาจารย์ที่ปรึกษาทั้งสองคนในหน้าโปรไฟล์นักศึกษา

**Architecture:** เพิ่ม `isCoopTeacher Boolean @default(false)` ใน Teacher model — staff toggle ได้จาก A_Teacher.tsx. Backend `GET /api/teacher/my-students` คืนนักศึกษาทั้งหมดสำหรับ isCoopTeacher=true หรือเฉพาะ advisees สำหรับ false. `GET /api/students/me` เพิ่ม include generalAdvisor + coopAdvisor. Frontend T_Students ตรวจ isCoopTeacher ก่อน fetch.

**Tech Stack:** Prisma + MySQL, Express, React 19 + TypeScript

---

## Current State (read before coding)

| File | What matters |
|---|---|
| `backend/prisma/schema.prisma` | Teacher model line 261 — ไม่มี `isCoopTeacher` field |
| `backend/controllers/teacherController.js` | `getProfile` คืน teacher data, `getAllTeachers` คืน list, `adminUpdateTeacher` รับ body fields |
| `backend/controllers/studentController.js` | `getMyProfile` include emails/coop/documents — ยังไม่ include generalAdvisor/coopAdvisor |
| `backend/routes/teacherRoutes.js` | `GET /` → getAllTeachers, `GET /me` → getProfile |
| `backend/routes/adminRoutes.js` | `PUT /teachers/:id` → adminUpdateTeacher |
| `Frontend/src/components/T_Students.tsx` | fetchStudents ใช้ `/api/students?limit=50` — ดึงนักศึกษาทั้งหมด |
| `Frontend/src/components/A_Teacher.tsx` | Staff จัดการอาจารย์ — edit modal ยังไม่มี isCoopTeacher toggle |
| `Frontend/src/components/S_ProfilePage.tsx` | แสดง advisorName string — ยังไม่แสดง advisor details จาก FK |
| `Frontend/src/components/T_App.tsx` | ดึง teacher profile แล้วเก็บ state — ต้องส่ง isCoopTeacher ลง T_Students |

---

## File Map

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/controllers/teacherController.js` |
| Modify | `backend/routes/teacherRoutes.js` |
| Modify | `backend/controllers/studentController.js` |
| Modify | `backend/routes/adminRoutes.js` |
| Modify | `Frontend/src/components/T_Students.tsx` |
| Modify | `Frontend/src/components/T_App.tsx` |
| Modify | `Frontend/src/components/A_Teacher.tsx` |
| Modify | `Frontend/src/components/S_ProfilePage.tsx` |

---

## Task 1: Schema — Add isCoopTeacher to Teacher

**Files:**
- Modify: `backend/prisma/schema.prisma` (Teacher model ~line 261)

- [ ] **Step 1: Edit schema**

Find the `Teacher` model and add after the `major` field:

```prisma
model Teacher {
  id                      Int                      @id @default(autoincrement())
  firstName               String
  lastName                String
  email                   String                   @unique
  phone                   String?
  faculty                 String?
  major                   String?
  isCoopTeacher           Boolean                  @default(false)
  userId                  Int                      @unique
  ...
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_teacher_is_coop_teacher
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add isCoopTeacher flag to Teacher model"
```

---

## Task 2: Backend — Teacher endpoints include isCoopTeacher + my-students

**Files:**
- Modify: `backend/controllers/teacherController.js`
- Modify: `backend/routes/teacherRoutes.js`
- Test: `backend/__tests__/teacherController.test.js` (if exists, otherwise skip)

**Background:**
- `getProfile` ต้องคืน `isCoopTeacher` ด้วย เพื่อให้ frontend รู้ว่า teacher type ไหน
- `getAllTeachers` ต้องคืน `isCoopTeacher` เพื่อแสดงใน A_Teacher.tsx
- เพิ่ม `GET /api/teacher/my-students` — คืนนักศึกษาตาม teacher type

- [ ] **Step 1: Update getProfile to include isCoopTeacher**

Read `backend/controllers/teacherController.js`. ใน `getProfile`, find the `prisma.teacher.findUnique` call and add `isCoopTeacher` to the select/response.

Find where teacher data is returned and add `isCoopTeacher: teacher.isCoopTeacher` to the response object.

Example (find exact lines first):
```js
// ในส่วนที่ return teacher data
return res.json({
  firstName: teacher.firstName,
  lastName: teacher.lastName,
  phone: teacher.phone || "",
  faculty: teacher.faculty || "",
  major: teacher.major || null,
  email: teacher.user?.email || "",
  isCoopTeacher: teacher.isCoopTeacher,   // ADD THIS
});
```

- [ ] **Step 2: Update getAllTeachers to include isCoopTeacher**

In `getAllTeachers`, ensure the Prisma query includes `isCoopTeacher` in the select or just use `findMany` without select (which returns all fields).

If the query uses `select: { ... }`, add `isCoopTeacher: true` to the select object.

- [ ] **Step 3: Add getMyStudents handler**

At the bottom of `teacherController.js`, add:

```js
// GET /api/teacher/my-students
// isCoopTeacher=true → all students (same as admin)
// isCoopTeacher=false → only students where teacher is generalAdvisor or coopAdvisor
exports.getMyStudents = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      select: { id: true, isCoopTeacher: true },
    });

    if (!teacher) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const coopPeriodId = req.query.coopPeriodId ? parseInt(req.query.coopPeriodId) : undefined;

    const baseWhere = {
      ...(search && {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { studentId: { contains: search } },
        ],
      }),
      ...(coopPeriodId && { coop: { coopPeriodId } }),
    };

    // อาจารย์ปกติ — เฉพาะ advisees ของตัวเอง
    const where = teacher.isCoopTeacher
      ? baseWhere
      : {
          ...baseWhere,
          OR: [
            { generalAdvisorId: teacher.id },
            { coopAdvisorId: teacher.id },
          ],
        };

    const include = {
      user: { select: { email: true } },
      coop: { include: { company: true } },
      generalAdvisor: { select: { firstName: true, lastName: true, email: true } },
      coopAdvisor: { select: { firstName: true, lastName: true, email: true } },
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({ where, include, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.student.count({ where }),
    ]);

    res.json({
      ok: true,
      data: students,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[getMyStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};
```

- [ ] **Step 4: Add route**

In `backend/routes/teacherRoutes.js`, add:

```js
router.get('/my-students', verifyToken, teacherController.getMyStudents);
```

Place it after the `router.get('/me', ...)` line.

- [ ] **Step 5: Run tests (if test file exists)**

```bash
cd backend && npm test -- --testPathPattern=teacherController 2>/dev/null || echo "No test file — skip"
```

Run full suite to verify no regressions:
```bash
cd backend && npm test
```

Expected: same pass/fail count as before.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/teacherController.js backend/routes/teacherRoutes.js
git commit -m "feat: teacher getMyStudents endpoint respects isCoopTeacher flag"
```

---

## Task 3: Backend — Student profile includes advisor details

**Files:**
- Modify: `backend/controllers/studentController.js` (~line 56 getMyProfile)

**Background:** `getMyProfile` ยังไม่ include `generalAdvisor` และ `coopAdvisor` details — ต้องเพิ่มเพื่อให้ frontend แสดงชื่อ + email อาจารย์ที่ปรึกษา

- [ ] **Step 1: Update getMyProfile include**

Read `backend/controllers/studentController.js` line 56–75. Find the `prisma.student.findUnique` call and add generalAdvisor + coopAdvisor to include:

```js
const student = await prisma.student.findUnique({
  where: { userId: req.userId },
  include: {
    emails: true,
    coop: {
      include: {
        company: { include: { mentors: true } },
        mentor: true,
      },
    },
    coopApplicationForm: true,
    documents: true,
    user: true,
    t003Form: true,
    generalAdvisor: { select: { firstName: true, lastName: true, email: true } },  // ADD
    coopAdvisor: { select: { firstName: true, lastName: true, email: true } },       // ADD
  },
});
```

The `generalAdvisor` and `coopAdvisor` fields will now be included in the response automatically via Prisma's spread in `...student`.

- [ ] **Step 2: Verify the default empty-student response**

When student is not found (~line 77), the response doesn't need generalAdvisor (it's a fresh account). No changes needed there.

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test
```

Expected: same results.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/studentController.js
git commit -m "feat: getMyProfile includes generalAdvisor and coopAdvisor details"
```

---

## Task 4: Frontend — A_Teacher.tsx — isCoopTeacher toggle

**Files:**
- Modify: `Frontend/src/components/A_Teacher.tsx`

**Background:** Staff จัดการอาจารย์จากหน้านี้ — ต้องเพิ่ม toggle สำหรับ isCoopTeacher ในฟอร์มแก้ไข/เพิ่มอาจารย์

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/A_Teacher.tsx` lines 1–80 เพื่อดู Teacher type, state, form structure.

- [ ] **Step 2: Add isCoopTeacher to Teacher type and form state**

Find the `Teacher` type/interface and add `isCoopTeacher: boolean`.

Find the form state (likely an object `{ firstName, lastName, ... }`) and add `isCoopTeacher: false`.

- [ ] **Step 3: Add toggle to edit/create modal JSX**

In the teacher edit/create form, add a toggle after the major field:

```tsx
{/* อาจารย์ประจำวิชาสหกิจ */}
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
  <div>
    <div style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>อาจารย์ประจำวิชาสหกิจ</div>
    <div style={{ fontSize: 12, color: '#94a3b8' }}>เห็นนักศึกษาทั้งหมดและจัดการนิเทศได้</div>
  </div>
  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={form.isCoopTeacher}
      onChange={e => setForm({ ...form, isCoopTeacher: e.target.checked })}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
    <span style={{
      position: 'absolute', inset: 0, borderRadius: 24,
      background: form.isCoopTeacher ? '#2563eb' : '#cbd5e1',
      transition: '0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: form.isCoopTeacher ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </span>
  </label>
</div>
```

- [ ] **Step 4: Include isCoopTeacher in save API call**

Find where the form is submitted (axios.post or axios.put to `/api/admin/teachers`). Add `isCoopTeacher: form.isCoopTeacher` to the payload.

- [ ] **Step 5: Show badge in teacher list**

In the teacher card/row, add a badge next to the name:

```tsx
{teacher.isCoopTeacher && (
  <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>
    ประจำวิชาสหกิจ
  </span>
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/components/A_Teacher.tsx
git commit -m "feat: A_Teacher toggle and badge for isCoopTeacher"
```

---

## Task 5: Frontend — T_Students.tsx respects isCoopTeacher

**Files:**
- Modify: `Frontend/src/components/T_Students.tsx`
- Modify: `Frontend/src/components/T_App.tsx`

**Background:** T_Students ปัจจุบัน fetch `/api/students` ทั้งหมด — ต้องตรวจว่า teacher เป็น isCoopTeacher ก่อน แล้วเลือก endpoint ที่เหมาะสม

- [ ] **Step 1: Read T_App.tsx to understand how teacher profile is managed**

Read `Frontend/src/components/T_App.tsx` lines 1–80. ดูว่า teacher profile ถูกดึงและเก็บไว้ใน state ยังไง และ props ที่ส่งลง T_Students.

- [ ] **Step 2: Pass isCoopTeacher to T_Students**

In `T_App.tsx`, หลังจาก fetch teacher profile แล้ว extract `isCoopTeacher` และส่งเป็น prop ไปยัง `<T_Students isCoopTeacher={isCoopTeacher} />`.

If T_Students doesn't accept props yet, add the prop:

```tsx
// T_App.tsx
const [isCoopTeacher, setIsCoopTeacher] = useState(false);
// ... ใน fetch profile:
setIsCoopTeacher(data.isCoopTeacher ?? false);

// ใน JSX:
<T_Students isCoopTeacher={isCoopTeacher} />
```

- [ ] **Step 3: Update T_Students to use correct endpoint**

In `T_Students.tsx`, add `isCoopTeacher` prop and update `fetchStudents`:

```tsx
interface Props { isCoopTeacher?: boolean; }

export default function T_Students({ isCoopTeacher = false }: Props) {
  // ...
  const fetchStudents = async (periodId: string, search = "") => {
    const token = localStorage.getItem("coop.token");
    const params = new URLSearchParams({ limit: "50" });
    if (periodId !== "all") params.set("coopPeriodId", periodId);
    if (search.trim()) params.set("search", search.trim());

    // isCoopTeacher → ใช้ endpoint เดิม (all students)
    // อาจารย์ปกติ → ใช้ my-students (advisees เท่านั้น)
    const endpoint = isCoopTeacher
      ? `/api/students?${params}`
      : `/api/teacher/my-students?${params}`;

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllStudents(data?.data ?? []);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };
```

- [ ] **Step 4: Show section header indicating scope**

In the page header, add a subtle indicator:

```tsx
<div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
  {isCoopTeacher ? "แสดงนักศึกษาทั้งหมดในระบบ" : "แสดงเฉพาะนักศึกษาที่ท่านเป็นอาจารย์ที่ปรึกษา"}
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/T_Students.tsx Frontend/src/components/T_App.tsx
git commit -m "feat: T_Students filters by isCoopTeacher — advisees-only for regular teachers"
```

---

## Task 6: Frontend — S_ProfilePage.tsx — Show both advisors

**Files:**
- Modify: `Frontend/src/components/S_ProfilePage.tsx`

**Background:** นักศึกษาต้องเห็นอาจารย์ที่ปรึกษาทั้งสองคนพร้อม email ติดต่อ

- [ ] **Step 1: Read S_ProfilePage.tsx to find advisor display**

Read `Frontend/src/components/S_ProfilePage.tsx` lines 1–80. ดูว่า student profile ถูก load ยังไง และ advisorName แสดงที่ไหน.

- [ ] **Step 2: Update StudentProfile interface**

Add advisor fields to the TypeScript interface:

```ts
interface StudentProfile {
  // ... existing fields ...
  advisorName?: string;               // text fallback
  generalAdvisor?: { firstName: string; lastName: string; email: string } | null;
  coopAdvisor?: { firstName: string; lastName: string; email: string } | null;
}
```

- [ ] **Step 3: Add advisor display section**

Find where `advisorName` is currently displayed and replace/extend with:

```tsx
{/* อาจารย์ที่ปรึกษา */}
<div style={{ marginTop: 16 }}>
  <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 10 }}>
    อาจารย์ที่ปรึกษา
  </div>
  <AdvisorRow
    label="ที่ปรึกษาทั่วไป"
    advisor={profile.generalAdvisor}
    fallback={profile.advisorName}
  />
  <AdvisorRow
    label="ที่ปรึกษาโปรเจ็ค"
    advisor={profile.coopAdvisor}
  />
</div>
```

Add the `AdvisorRow` component above the main component:

```tsx
function AdvisorRow({
  label,
  advisor,
  fallback,
}: {
  label: string;
  advisor?: { firstName: string; lastName: string; email: string } | null;
  fallback?: string;
}) {
  const name = advisor
    ? `${advisor.firstName} ${advisor.lastName}`
    : (fallback || null);

  if (!name) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          อาจารย์ {name}
        </div>
        {advisor?.email && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{advisor.email}</div>
        )}
      </div>
      {advisor?.email && (
        <a
          href={`mailto:${advisor.email}`}
          style={{ padding: '6px 14px', background: '#eff6ff', color: '#2563eb', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid #bfdbfe' }}
        >
          ติดต่อ
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/S_ProfilePage.tsx
git commit -m "feat: S_ProfilePage shows both advisors with name, email, and contact link"
```

---

## Task 7: Final verification + CHANGELOG

- [ ] **Step 1: Run backend tests**

```bash
cd backend && npm test
```

Expected: same pass/fail as before.

- [ ] **Step 2: Frontend TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at top:

```markdown
## [2026-06-01] Teacher Types

### Added
- `Teacher.isCoopTeacher Boolean @default(false)` — เจ้าหน้าที่ toggle ได้จาก A_Teacher
- `GET /api/teacher/my-students` — อาจารย์ประจำวิชาสหกิจคืนนักศึกษาทั้งหมด; อาจารย์ปกติคืนเฉพาะ advisees
- badge "ประจำวิชาสหกิจ" ใน A_Teacher teacher list
- `AdvisorRow` component ใน S_ProfilePage — แสดงชื่อ + email + ปุ่มติดต่อ

### Changed
- `getMyProfile` (students): include `generalAdvisor` และ `coopAdvisor` details
- `T_Students.tsx`: ใช้ endpoint ตาม isCoopTeacher flag
- `S_ProfilePage.tsx`: แสดงอาจารย์ที่ปรึกษาทั้งสองคนพร้อม email ติดต่อ
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for teacher types feature"
```

---

## Self-Review

**Spec coverage:**
- [x] อาจารย์ประจำวิชาสหกิจ เห็นนักศึกษาทุกคน → Task 5 (isCoopTeacher endpoint)
- [x] อาจารย์ประจำวิชาสหกิจ จัดการนิเทศได้เหมือนเจ้าหน้าที่ → ใช้ existing T_SupervisionReview (already accessible to teachers)
- [x] เจ้าหน้าที่เลือก role → Task 4 (A_Teacher toggle)
- [x] อาจารย์ที่ปรึกษา (ดึงจาก Excel) → generalAdvisor (already done in import)
- [x] อาจารย์ที่ปรึกษาโปรเจ็ค (นักศึกษากรอกเอง) → coopAdvisor (already done in S_ProfilePage)
- [x] แสดงในหน้าข้อมูลนักศึกษา อาจารย์ ... email ติดต่อ → Task 6 (AdvisorRow)

**Type consistency:**
- `isCoopTeacher: boolean` in schema, Teacher type in frontend ✓
- `getMyStudents` returns `{ ok, data, meta }` — same shape as `/api/students` ✓
- `generalAdvisor: { firstName, lastName, email }` — same shape used in Tasks 3 and 6 ✓

**Notes for deployment:**
- Migration `add_teacher_is_coop_teacher` ต้อง run ก่อน server start
- อาจารย์ทุกคนเริ่มต้นเป็น `isCoopTeacher=false` (อาจารย์ปกติ) — staff ต้อง toggle ให้แต่ละคน
