# Project Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง 4 project-specific skills ที่ช่วยให้ Claude ทำงานถูกต้องใน Co-op Management System — run-dev, add-feature, migrate-db, verify-feature

**Architecture:** แต่ละ skill เป็นไฟล์ SKILL.md ใน `.claude/skills/<name>/` ใช้ frontmatter format เดียวกับ `playwright-cli` ที่มีอยู่แล้ว Skills เป็น step-by-step checklists ที่ Claude ต้องทำตามครบทุกข้อ

**Tech Stack:** Claude Code skill system, Markdown frontmatter, PowerShell (Windows)

---

## File Structure

```
.claude/skills/
├── playwright-cli/          ← existing, อย่าแตะ
│   └── SKILL.md
├── run-dev/                 ← Task 1 (สร้างใหม่)
│   └── SKILL.md
├── add-feature/             ← Task 2 (สร้างใหม่)
│   └── SKILL.md
├── migrate-db/              ← Task 3 (สร้างใหม่)
│   └── SKILL.md
└── verify-feature/          ← Task 4 (สร้างใหม่)
    └── SKILL.md
```

---

## Task 1: Skill `run-dev`

**Files:**
- Create: `.claude/skills/run-dev/SKILL.md`

- [ ] **Step 1: สร้างไดเรกทอรีและเขียน SKILL.md**

สร้างไฟล์ `.claude/skills/run-dev/SKILL.md` ด้วยเนื้อหาต่อไปนี้:

```markdown
---
name: run-dev
description: Start or restart the Co-op dev environment (backend port 5000 + frontend port 5173). Use when running servers, verifying features in browser, or recovering from a crash.
---

# Run Dev Environment — ระบบสหกิจศึกษา KKU

Use this skill whenever you need to start or restart the development servers for this project.

## Checklist

Work through every step in order. Do not skip steps.

### 1. ตรวจ ports ว่างหรือไม่

- [ ] ตรวจ port 5000 (backend):
  ```powershell
  netstat -ano | findstr :5000
  ```
  ถ้ามี process → จด PID แล้ว kill:
  ```powershell
  taskkill /PID <PID> /F
  ```

- [ ] ตรวจ port 5173 (frontend):
  ```powershell
  netstat -ano | findstr :5173
  ```
  ถ้ามี process → kill เหมือนกัน

### 2. Start Backend

- [ ] รัน backend ใน background terminal:
  ```powershell
  cd C:\xampp\htdocs\Co_project\backend
  npm run dev
  ```
  รอจนเห็น log: `Server started on port 5000`

- [ ] ถ้าเห็น error `JWT_SECRET is not set` → ตรวจ `backend/.env` ว่ามี `JWT_SECRET=...`
- [ ] ถ้าเห็น error DB connection → ตรวจ XAMPP MySQL กำลังรันอยู่

### 3. Start Frontend

- [ ] รัน frontend ใน background terminal:
  ```powershell
  cd C:\xampp\htdocs\Co_project\Frontend
  npm run dev
  ```
  รอจนเห็น Vite log: `Local: http://localhost:5173/`

### 4. Verify

- [ ] เปิด `http://localhost:5173` ใน browser — ต้องโหลดหน้า login ได้
- [ ] ตรวจ browser console ไม่มี startup error สีแดง
- [ ] ถ้าทุกอย่างปกติ → แจ้ง user ว่า dev environment พร้อมใช้แล้ว
```

- [ ] **Step 2: ตรวจสอบไฟล์ถูกสร้าง**

```powershell
Get-Content "C:\xampp\htdocs\Co_project\.claude\skills\run-dev\SKILL.md" | Select-Object -First 5
```

Expected output: บรรทัดแรกต้องเป็น `---`

- [ ] **Step 3: Commit**

```powershell
git add .claude/skills/run-dev/SKILL.md
git commit -m "feat: add run-dev skill for starting dev environment"
```

---

## Task 2: Skill `add-feature`

**Files:**
- Create: `.claude/skills/add-feature/SKILL.md`

- [ ] **Step 1: สร้างไดเรกทอรีและเขียน SKILL.md**

สร้างไฟล์ `.claude/skills/add-feature/SKILL.md` ด้วยเนื้อหาต่อไปนี้:

```markdown
---
name: add-feature
description: Checklist for adding any new feature (endpoint, component, or full-stack change) to the Co-op system. Enforces controller/route/component patterns and ensures CHANGELOG is updated.
---

# Add Feature — ระบบสหกิจศึกษา KKU

Use this skill whenever adding a new backend endpoint, frontend component, or any feature that touches both backend and frontend.

## Checklist

Work through every step in order. Do not skip steps.

### Backend

- [ ] **Controller** — สร้าง/แก้ไฟล์ใน `backend/controllers/`
  - ทุก async function ต้องมี try/catch:
    ```js
    exports.myFn = async (req, res) => {
      try {
        // logic
        res.json({ ok: true, data });
      } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาด' });
      }
    };
    ```

- [ ] **Route** — เพิ่ม route ใน `backend/routes/` ที่เหมาะสม
  - `verifyToken` ต้องมาก่อน `verifyRole` เสมอ:
    ```js
    router.get('/endpoint', verifyToken, verifyRole('staff'), controller.myFn);
    ```
  - Role names ใช้ lowercase: `student`, `teacher`, `staff`

- [ ] **Route Mount** — ตรวจใน `backend/server.js` ว่า route ถูก mount ที่ path ถูกต้องแล้ว
  - `/api/coop/*` → coopRoutes (student supervision อยู่ที่นี่)
  - `/api/admin/*` → adminRoutes
  - `/api/students/*` → studentRoutes
  - ดู CLAUDE.md section "Routing Architecture" ถ้าไม่แน่ใจ

### Frontend

- [ ] **Component** — สร้างไฟล์ใน `Frontend/src/components/`
  - ตั้งชื่อตาม prefix:
    - `A_*.tsx` = Admin/Staff
    - `T_*.tsx` = Teacher
    - `S_*.tsx` = Student

- [ ] **API calls** — ใช้ relative path เสมอ:
  ```ts
  // ✓ ถูก
  const res = await axios.get('/api/students', {
    headers: { Authorization: `Bearer ${token}` }
  });

  // ✗ ผิด — ห้ามใส่ hostname
  const res = await axios.get('http://localhost:5000/api/students', ...);
  ```
  Token อยู่ที่: `localStorage.getItem("coop.token")`

- [ ] **Pagination unwrap** — ถ้า endpoint คืน `{ data: [], meta: {} }` ต้อง unwrap:
  ```ts
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  ```

### Finishing

- [ ] **CHANGELOG.md** — เพิ่ม entry ใน `CHANGELOG.md` ที่ root ของโปรเจกต์
  - Format: `## [วันที่] — [ชื่อ feature]` พร้อมอธิบาย 1-2 บรรทัด

- [ ] **Verify** — Invoke `verify-feature` skill ก่อน claim "done"
```

- [ ] **Step 2: ตรวจสอบไฟล์ถูกสร้าง**

```powershell
Get-Content "C:\xampp\htdocs\Co_project\.claude\skills\add-feature\SKILL.md" | Select-Object -First 5
```

Expected output: บรรทัดแรกต้องเป็น `---`

- [ ] **Step 3: Commit**

```powershell
git add .claude/skills/add-feature/SKILL.md
git commit -m "feat: add add-feature skill for backend+frontend development pattern"
```

---

## Task 3: Skill `migrate-db`

**Files:**
- Create: `.claude/skills/migrate-db/SKILL.md`

- [ ] **Step 1: สร้างไดเรกทอรีและเขียน SKILL.md**

สร้างไฟล์ `.claude/skills/migrate-db/SKILL.md` ด้วยเนื้อหาต่อไปนี้:

```markdown
---
name: migrate-db
description: Safe Prisma migration checklist for the Co-op system. Use whenever schema.prisma is modified or DB structure needs to change.
---

# Database Migration — ระบบสหกิจศึกษา KKU

Use this skill whenever you modify `backend/prisma/schema.prisma` or need to change the database structure.

## Checklist

Work through every step in order. Do not skip steps.

### ก่อน Migrate

- [ ] ตรวจ `backend/.env` มี `DATABASE_URL` ถูกต้อง:
  ```powershell
  Get-Content "C:\xampp\htdocs\Co_project\backend\.env" | Select-String "DATABASE_URL"
  ```
  Expected: `DATABASE_URL="mysql://root:@localhost:3306/coop_db"`

- [ ] ตรวจ schema ที่แก้:
  - Field names เป็น camelCase (เช่น `studentId`, ไม่ใช่ `student_id`)
  - ถ้าเพิ่ม `NOT NULL` column ในตารางที่มีข้อมูลอยู่แล้ว → ต้องมี `@default(...)` หรือทำ backfill ก่อน
  - Enum values ตรงกับ code ที่อ้างถึง

### Migrate

- [ ] รัน migrate dev:
  ```powershell
  cd C:\xampp\htdocs\Co_project\backend
  npx prisma migrate dev --name <ชื่อ-migration>
  ```
  ตั้งชื่อ migration ให้สื่อความหมาย เช่น `add-coopperiod-filter` หรือ `add-criteria-table`

- [ ] ตรวจ output — ต้องไม่มี:
  - `Error:` หรือ `failed`
  - Destructive change ที่ไม่ได้ตั้งใจ (เช่น `DROP TABLE` โดยไม่ได้ตั้งใจ)

- [ ] ตรวจว่ามีไฟล์ migration ใหม่:
  ```powershell
  Get-ChildItem "C:\xampp\htdocs\Co_project\backend\prisma\migrations\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  ```

### หลัง Migrate

- [ ] Restart backend server (schema cache อาจค้างอยู่ที่ process เก่า)

- [ ] ทดสอบ endpoint ที่เกี่ยวข้องด้วย request จริง — ตรวจว่า response ไม่มี Prisma error

- [ ] Commit migration files:
  ```powershell
  git add backend/prisma/migrations/
  git add backend/prisma/schema.prisma
  git commit -m "feat: migrate db — <อธิบาย>"
  ```

## หมายเหตุ Production

**ใช้ `npx prisma migrate deploy` ไม่ใช่ `npx prisma migrate dev`**

`migrate dev` สร้าง migration file ใหม่ — ใช้ใน development เท่านั้น  
`migrate deploy` apply migrations ที่มีอยู่แล้ว — ใช้ใน production
```

- [ ] **Step 2: ตรวจสอบไฟล์ถูกสร้าง**

```powershell
Get-Content "C:\xampp\htdocs\Co_project\.claude\skills\migrate-db\SKILL.md" | Select-Object -First 5
```

Expected output: บรรทัดแรกต้องเป็น `---`

- [ ] **Step 3: Commit**

```powershell
git add .claude/skills/migrate-db/SKILL.md
git commit -m "feat: add migrate-db skill for safe Prisma migrations"
```

---

## Task 4: Skill `verify-feature`

**Files:**
- Create: `.claude/skills/verify-feature/SKILL.md`

- [ ] **Step 1: สร้างไดเรกทอรีและเขียน SKILL.md**

สร้างไฟล์ `.claude/skills/verify-feature/SKILL.md` ด้วยเนื้อหาต่อไปนี้:

```markdown
---
name: verify-feature
description: Verification checklist before claiming a feature is done. Run TypeScript check, API test, and browser golden path. Never claim "done" without passing all steps.
---

# Verify Feature — ระบบสหกิจศึกษา KKU

Use this skill before claiming any feature is complete, before committing, or when `superpowers:verification-before-completion` is invoked.

**ห้าม claim "done" จนกว่าจะผ่านทุก step**

## Checklist

Work through every step in order. Do not skip steps.

### Build Check

- [ ] TypeScript check — ต้องไม่มี error:
  ```powershell
  cd C:\xampp\htdocs\Co_project\Frontend
  npx tsc --noEmit
  ```
  Expected: ไม่มี output (หรือ exit code 0)  
  ถ้ามี error → แก้ก่อนดำเนินต่อ

- [ ] ตรวจ backend log หลัง restart — ต้องไม่มี unhandled error หรือ warning สีแดง

### API Check

- [ ] เรียก endpoint ที่เพิ่ง implement ด้วย request จริง พร้อม Authorization header:
  ```powershell
  # ตัวอย่าง: ดึง token ก่อน แล้วเรียก endpoint
  $token = "ใส่ JWT token ที่ได้จาก login"
  Invoke-RestMethod -Uri "http://localhost:5000/api/YOUR_ENDPOINT" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Method GET
  ```

- [ ] ตรวจ response format ตรงตาม contract:
  - Success: `{ ok: true, data: ... }`
  - Error: `{ ok: false, message: "..." }`
  - Status codes: 401 = token หมดอายุ, 403 = สิทธิ์ไม่พอ, 404 = ไม่พบข้อมูล

### Browser Check

- [ ] เปิด `http://localhost:5173` — ถ้า server ยังไม่รัน invoke `run-dev` skill ก่อน

- [ ] Login ด้วย role ที่เกี่ยวข้องกับ feature:
  - Student features → login เป็น student
  - Teacher features → login เป็น teacher
  - Admin/Staff features → login เป็น staff

- [ ] ทำ golden path ของ feature จริง ๆ ใน browser ตามลำดับ:
  1. เปิดหน้าที่เกี่ยวข้อง
  2. ทำ action หลักของ feature
  3. ตรวจผลลัพธ์ตรงกับที่คาดหวัง

- [ ] เปิด DevTools Console (F12) — ต้องไม่มี:
  - Error สีแดง (unhandled exceptions)
  - Network request ที่ return 401 หรือ 500

### Finishing

- [ ] ถ้าผ่านทั้งหมด → แจ้ง user:
  > "✓ Verified: [อธิบาย feature] ทำงานถูกต้อง — TypeScript clean, API response ถูก, browser golden path ผ่าน"

- [ ] ถ้าไม่ผ่าน step ใด → แก้ปัญหาก่อน แล้วรัน checklist นี้ใหม่ตั้งแต่ต้น ห้าม claim done
```

- [ ] **Step 2: ตรวจสอบไฟล์ถูกสร้าง**

```powershell
Get-Content "C:\xampp\htdocs\Co_project\.claude\skills\verify-feature\SKILL.md" | Select-Object -First 5
```

Expected output: บรรทัดแรกต้องเป็น `---`

- [ ] **Step 3: Commit**

```powershell
git add .claude/skills/verify-feature/SKILL.md
git commit -m "feat: add verify-feature skill for pre-done verification checklist"
```

---

## Task 5: ตรวจสอบ Skills ทั้งหมด

- [ ] **Step 1: ตรวจโครงสร้างไฟล์ครบถ้วน**

```powershell
Get-ChildItem "C:\xampp\htdocs\Co_project\.claude\skills\" -Recurse -Filter "SKILL.md" | Select-Object FullName
```

Expected output ต้องมีทั้ง 5 บรรทัด:
```
...playwright-cli\SKILL.md
...run-dev\SKILL.md
...add-feature\SKILL.md
...migrate-db\SKILL.md
...verify-feature\SKILL.md
```

- [ ] **Step 2: ตรวจ frontmatter ของแต่ละ skill มี name และ description**

```powershell
foreach ($skill in @("run-dev", "add-feature", "migrate-db", "verify-feature")) {
  $path = "C:\xampp\htdocs\Co_project\.claude\skills\$skill\SKILL.md"
  $content = Get-Content $path | Select-Object -First 4
  Write-Host "=== $skill ===" -ForegroundColor Cyan
  $content | ForEach-Object { Write-Host $_ }
}
```

Expected: แต่ละ skill มี `name:` และ `description:` ใน frontmatter

- [ ] **Step 3: Final commit หากมีการแก้ไขเพิ่มเติม**

```powershell
git status
# ถ้ามีการแก้ไข:
git add .claude/skills/
git commit -m "fix: correct skill frontmatter or content"
```
