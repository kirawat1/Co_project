# Design: Project Skills สำหรับระบบสหกิจศึกษา KKU

> วันที่: 2026-05-30  
> Approach: 4 skills แยกตาม pain point (step-by-step checklist)  
> Location: `.claude/skills/<skill-name>/SKILL.md`

---

## ภาพรวม

ระบบสหกิจศึกษา KKU (Co-op Management System) มี pain points 4 อย่างที่ Claude ทำผิดพลาดบ่อย:

1. ไม่รู้วิธี start/restart dev environment
2. ไม่ทำตาม pattern ของโปรเจกต์เมื่อเพิ่ม feature ใหม่
3. ทำ Prisma migration ผิดขั้นตอน
4. Claim "done" โดยไม่ได้ verify ใน browser จริง

แต่ละ skill แก้ pain point เดียว มี trigger ชัดเจน และเป็น step-by-step checklist ที่ Claude ต้องทำตามครบทุกข้อ

---

## Skill 1: `run-dev`

**Path:** `.claude/skills/run-dev/SKILL.md`

**Trigger:** เมื่อ Claude ต้องการรัน server, ตรวจสอบ feature ใน browser, หรือ restart หลัง crash

### Checklist Steps

**ตรวจ ports:**
1. ตรวจว่า port 5000 (backend) และ 5173 (frontend) ว่างหรือไม่
   - ถ้า occupied → ระบุ process แล้ว kill ก่อน

**Start servers:**
2. `cd backend && npm run dev` — รอจน log บอก "Server started on port 5000"
3. `cd Frontend && npm run dev` — รอจน Vite log แสดง Local URL

**Verify:**
4. ตรวจ `http://localhost:5173` ใน browser เปิดได้
5. ตรวจ console ไม่มี startup error (JWT_SECRET missing, DB connection failed)

---

## Skill 2: `add-feature`

**Path:** `.claude/skills/add-feature/SKILL.md`

**Trigger:** เมื่อเพิ่ม endpoint ใหม่, component ใหม่, หรือ feature ที่ต้องแก้ทั้ง backend และ frontend

### Checklist Steps

**Backend:**
1. สร้าง/แก้ controller ใน `backend/controllers/` — async function พร้อม try/catch ทุก function
2. เพิ่ม route ใน `backend/routes/` — `verifyToken` ก่อน `verifyRole` เสมอ
3. ตรวจว่า route mount ถูก path ใน `server.js` แล้ว

**Frontend:**
4. สร้าง component ใน `Frontend/src/components/` — ตั้งชื่อตาม prefix (`A_`, `T_`, `S_`)
5. ใช้ relative path เสมอ (`/api/...`) ไม่ใส่ `http://localhost:5000`
6. Unwrap pagination response ถ้า endpoint คืน `{ data: [], meta: {} }`:
   ```ts
   const arr = Array.isArray(data) ? data : (data?.data ?? []);
   ```

**Finishing:**
7. อัปเดต `CHANGELOG.md` ทุกครั้ง
8. Invoke `verify-feature` skill ก่อน claim "done"

---

## Skill 3: `migrate-db`

**Path:** `.claude/skills/migrate-db/SKILL.md`

**Trigger:** เมื่อแก้ `backend/prisma/schema.prisma` หรือต้องการเปลี่ยน DB structure

### Checklist Steps

**ก่อน migrate:**
1. ตรวจว่า `backend/.env` มี `DATABASE_URL` ถูกต้อง
2. ตรวจ schema ที่แก้ว่า field names เป็น camelCase ตาม Prisma convention
3. ถ้าเพิ่ม `NOT NULL` column ในตารางที่มีข้อมูลอยู่แล้ว — ต้องกำหนด `@default(...)` หรือมีแผน backfill

**Migrate:**
4. `cd backend && npx prisma migrate dev --name <ชื่อ-migration>` — dev environment
5. ตรวจ output ว่าไม่มี error หรือ destructive change ที่ไม่ได้ตั้งใจ
6. ตรวจ `backend/prisma/migrations/` ว่ามีไฟล์ใหม่ถูกสร้าง

**หลัง migrate:**
7. Restart backend server (port 5000 อาจ cache schema เก่า)
8. ทดสอบ endpoint ที่เกี่ยวข้องด้วย request จริง

**หมายเหตุ Production:** ใช้ `npx prisma migrate deploy` ไม่ใช่ `migrate dev`

---

## Skill 4: `verify-feature`

**Path:** `.claude/skills/verify-feature/SKILL.md`

**Trigger:** ก่อน claim ว่า feature เสร็จ, ก่อน commit, หรือเมื่อ `superpowers:verification-before-completion` ถูก invoke

### Checklist Steps

**Build check:**
1. `cd Frontend && npx tsc --noEmit` — ต้องไม่มี TypeScript error
2. ตรวจ backend log ไม่มี unhandled error หลัง restart

**API check:**
3. เรียก endpoint ที่แก้ด้วย request จริง (ผ่าน browser หรือ curl) พร้อม Authorization header
4. ตรวจ response format ตรงกับที่ frontend expect (`{ ok: true, data: ... }`)

**Browser check:**
5. เปิด `http://localhost:5173` — login ด้วย role ที่เกี่ยวข้อง (student/teacher/staff)
6. ทำ golden path ของ feature จริง ๆ ใน browser
7. เปิด DevTools Console — ต้องไม่มี unhandled error หรือ 401/500 network error

**Finishing:**
8. ถ้าผ่านทั้งหมด → บอก user ว่า verified พร้อม evidence (screenshot หรือ log output)
9. ถ้าไม่ผ่าน → แก้ก่อน ห้าม claim done

---

## Implementation Plan

Skills ทั้ง 4 จะอยู่ที่ `.claude/skills/<name>/SKILL.md` ในโปรเจกต์

```
.claude/skills/
├── run-dev/
│   └── SKILL.md
├── add-feature/
│   └── SKILL.md
├── migrate-db/
│   └── SKILL.md
└── verify-feature/
    └── SKILL.md
```

แต่ละ skill ใช้ format เดียวกับ `playwright-cli` ที่มีอยู่แล้วในโปรเจกต์
