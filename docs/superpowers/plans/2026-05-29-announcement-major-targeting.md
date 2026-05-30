# Announcement Major Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to target announcements at specific majors or all majors, auto-filter for students, and redesign both UIs in a Google Classroom-style card stream.

**Architecture:** Add `targetMajors Json` to the `Announcement` schema. Backend filters announcements by `?major=` query param at the application level (parse JSON array, check inclusion). Staff UI gains a major-selector in the modal and target badges on cards. Students get auto-filtering in the Dashboard (top 3) plus a new dedicated `S_Announcements` page for the full stream.

**Tech Stack:** Prisma + MySQL (migration), Express, React 19 + TypeScript

---

## Current State (read before coding)

| File | What matters |
|---|---|
| `backend/prisma/schema.prisma` | `Announcement` model around line 318 — no `targetMajors` field |
| `backend/controllers/announcementController.js` | `getAnnouncements` filters by `year` only; `addOrUpdateAnnouncement` saves `title/body/date/year/linkUrl/files` |
| `backend/routes/announcementRoutes.js` | 3 routes: GET `/`, POST `/`, DELETE `/:id` |
| `backend/routes/adminRoutes.js` | Import pattern at top, `ADMIN_ROLES = ['admin','teacher','staff']`, `STAFF_ONLY = ['admin','staff']` |
| `Frontend/src/components/A_Announcements.tsx` | Staff UI — modal form + card list. `Announcement` type, `save()` sends FormData |
| `Frontend/src/components/S_Dashboard.tsx` | Calls `GET /api/announcements` (no major filter), calls `GET /api/students/me` to get profile |
| `Frontend/src/components/S_Sidebar.tsx` | NavLink list — add "ประกาศ" entry before COOP PROCESS section |
| `Frontend/src/components/S_App.tsx` | `<Routes>` block lines 97–113 — add `announcements` route |
| `backend/__tests__/announcementController.test.js` | Has `getAnnouncements` and `addOrUpdateAnnouncement` describe blocks |

---

## File Map

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/controllers/announcementController.js` |
| Modify | `backend/routes/adminRoutes.js` |
| Modify | `backend/__tests__/announcementController.test.js` |
| Modify | `Frontend/src/components/A_Announcements.tsx` |
| Modify | `Frontend/src/components/S_Dashboard.tsx` |
| Create | `Frontend/src/components/S_Announcements.tsx` |
| Modify | `Frontend/src/components/S_Sidebar.tsx` |
| Modify | `Frontend/src/components/S_App.tsx` |

---

## Task 1: Schema — Add targetMajors to Announcement

**Files:**
- Modify: `backend/prisma/schema.prisma` (~line 318)

- [ ] **Step 1: Edit schema**

Find the `Announcement` model and add one field after `linkUrl`:

```prisma
model Announcement {
  id           String    @id @default(uuid())
  title        String
  body         String?   @db.Text
  date         DateTime
  year         String
  linkUrl      String?
  targetMajors Json      @default("[]")
  files        AnnFile[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @default(now()) @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_announcement_target_majors
```

Expected: `✔ Generated Prisma Client` and migration file created.

- [ ] **Step 3: Verify**

```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log(typeof p.announcement.findMany)"
```

Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add targetMajors to Announcement schema"
```

---

## Task 2: Backend — Filter by major + save targetMajors + /majors endpoint

**Files:**
- Modify: `backend/controllers/announcementController.js`
- Modify: `backend/routes/adminRoutes.js`
- Test: `backend/__tests__/announcementController.test.js`

- [ ] **Step 1: Write failing tests**

In `backend/__tests__/announcementController.test.js`, add to the `getAnnouncements` describe block:

```js
test('200 – major filter returns all-major + matching announcements', async () => {
  const fakeList = [
    { id: '1', title: 'All', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: [], files: [] },
    { id: '2', title: 'CS only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS'], files: [] },
    { id: '3', title: 'IT only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['IT'], files: [] },
  ];
  prisma.announcement.findMany.mockResolvedValue(fakeList);

  const req = { query: { major: 'CS' } };
  const res = makeRes();

  await getAnnouncements(req, res);

  const body = res.json.mock.calls[0][0];
  expect(body.ok).toBe(true);
  expect(body.list).toHaveLength(2); // All + CS only, not IT only
  expect(body.list.map(a => a.id)).toEqual(expect.arrayContaining(['1', '2']));
  expect(body.list.map(a => a.id)).not.toContain('3');
});

test('200 – no major param returns all announcements', async () => {
  const fakeList = [
    { id: '1', title: 'All', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: [], files: [] },
    { id: '2', title: 'CS only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS'], files: [] },
  ];
  prisma.announcement.findMany.mockResolvedValue(fakeList);

  const req = { query: {} };
  const res = makeRes();

  await getAnnouncements(req, res);

  const body = res.json.mock.calls[0][0];
  expect(body.list).toHaveLength(2);
});
```

And add to `addOrUpdateAnnouncement` describe block:

```js
test('200 – saves targetMajors when provided', async () => {
  const created = { id: 'new', title: 'Test', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS','IT'], files: [] };
  prisma.announcement.create.mockResolvedValue(created);

  const req = {
    body: { title: 'Test', date: '2026-05-29', year: '1/2569', targetMajors: JSON.stringify(['CS','IT']) },
    files: [],
  };
  const res = makeRes();

  await addOrUpdateAnnouncement(req, res);

  expect(prisma.announcement.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ targetMajors: ['CS', 'IT'] }),
    })
  );
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=announcementController
```

Expected: new tests FAIL.

- [ ] **Step 3: Update announcementController.js**

Replace the entire `getAnnouncements` function:

```js
const getAnnouncements = async (req, res) => {
  try {
    const year = req.query.year;
    const major = req.query.major; // optional — student sends their major

    const list = await prisma.announcement.findMany({
      where: year ? { year } : {},
      orderBy: { date: "desc" },
      include: { files: true },
    });

    // Application-level major filter: [] means all, otherwise check inclusion
    const filtered = major
      ? list.filter(a => {
          const targets = Array.isArray(a.targetMajors) ? a.targetMajors : [];
          return targets.length === 0 || targets.includes(major);
        })
      : list;

    const mapped = filtered.map(a => ({
      ...a,
      attachments: [
        ...(a.files.map(f => ({
          type: f.mime.startsWith("image/") ? "image" : "file",
          name: f.name,
          url: `/uploads/${f.path}`,
        }))),
        ...(a.linkUrl ? (() => {
          try { return JSON.parse(a.linkUrl).map(l => ({ type: "link", name: l, url: l })); }
          catch { return []; }
        })() : [])
      ]
    }));

    res.json({ ok: true, list: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};
```

Update `addOrUpdateAnnouncement` — add `targetMajors` to the destructure and both `create`/`update` calls:

```js
const addOrUpdateAnnouncement = async (req, res) => {
  try {
    const { id, title, body, date, year, linkUrls, keepFileIds, targetMajors: rawTargetMajors } = req.body;
    const files = req.files || [];

    if (!title || !date || !year)
      return res.status(400).json({ ok: false, message: "ข้อมูลไม่ครบ" });

    // parse targetMajors — FormData sends it as a JSON string
    let targetMajors = [];
    if (rawTargetMajors) {
      try { targetMajors = JSON.parse(rawTargetMajors); } catch { targetMajors = []; }
    }

    const annFiles = files.map(f => ({
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mime: f.mimetype,
      path: f.filename,
    }));

    const sharedData = {
      title,
      body,
      date: new Date(date),
      year,
      linkUrl: linkUrls ? JSON.stringify(JSON.parse(linkUrls)) : undefined,
      targetMajors,
    };

    if (id) {
      const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });

      for (const f of ann.files) {
        if (!keepFileIds?.includes(f.id)) {
          const filePath = path.join("uploads", f.path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          await prisma.annFile.delete({ where: { id: f.id } });
        }
      }

      const updated = await prisma.announcement.update({
        where: { id },
        data: { ...sharedData, files: { create: annFiles } },
        include: { files: true },
      });
      return res.json({ ok: true, announcement: updated });
    } else {
      const ann = await prisma.announcement.create({
        data: { ...sharedData, files: { create: annFiles } },
        include: { files: true },
      });
      return res.json({ ok: true, announcement: ann });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};
```

- [ ] **Step 4: Add /students/majors endpoint in adminRoutes.js**

Read `backend/routes/adminRoutes.js`. Find where `criteriaController` routes are. Add after the existing criteria routes:

```js
// GET /api/admin/students/majors — distinct majors for announcement targeting
router.get('/students/majors', verifyToken, verifyRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const rows = await prisma.student.findMany({
      where: { major: { not: null } },
      select: { major: true },
      distinct: ['major'],
      orderBy: { major: 'asc' },
    });
    res.json({ ok: true, majors: rows.map(r => r.major).filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
});
```

Add `prisma` import at the top of `adminRoutes.js` if not already there:
```js
const prisma = require('../config/prismaClient');
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=announcementController
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/announcementController.js backend/routes/adminRoutes.js backend/__tests__/announcementController.test.js
git commit -m "feat: announcement major filter, targetMajors save, /admin/students/majors endpoint"
```

---

## Task 3: A_Announcements.tsx — Add major targeting UI

**Files:**
- Modify: `Frontend/src/components/A_Announcements.tsx`

**Background:**  
The component has a `Announcement` type, state variables for the form, a `save()` function that builds FormData, and a card list. Need to:
1. Add `targetMajors: string[]` to the `Announcement` type
2. Add `availableMajors: string[]` state (loaded from API)
3. Add `targetMajors: string[]` form state
4. Fetch available majors on mount
5. Add targeting section to modal
6. Send `targetMajors` in FormData
7. Show target badges on cards

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/A_Announcements.tsx` lines 1–30 (type definitions and state).

- [ ] **Step 2: Update Announcement type**

Find `type Announcement` and add `targetMajors: string[]`:

```ts
type Announcement = {
  id: string;
  title: string;
  body?: string;
  date: string;
  year: string;
  attachments: AnnouncementAttachment[];
  targetMajors: string[];  // ADD
};
```

- [ ] **Step 3: Add state variables**

Inside `export default function A_Announcements()`, after the existing state declarations, add:

```ts
const [availableMajors, setAvailableMajors] = useState<string[]>([]);
const [targetMajors, setTargetMajors] = useState<string[]>([]); // [] = ทุกสาขา
```

- [ ] **Step 4: Fetch available majors on mount**

Add a `fetchMajors` function and call it in `useEffect`:

```ts
const fetchMajors = async () => {
  try {
    const res = await axios.get("/api/admin/students/majors", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.data.ok) setAvailableMajors(res.data.majors);
  } catch { /* silent — majors list is best-effort */ }
};
```

Update the first `useEffect` to also call `fetchMajors`:
```ts
useEffect(() => { fetchPeriods(); fetchMajors(); }, []);
```

- [ ] **Step 5: Update resetForm and openEditModal**

Add `targetMajors` reset in `resetForm`:
```ts
const resetForm = () => {
  setTitle(""); setBody(""); setDate(new Date().toISOString().slice(0, 10));
  setAttachments([]); setEditingId(null); setModalOpen(false);
  setTargetMajors([]);  // ADD
};
```

Add `targetMajors` population in `openEditModal`:
```ts
const openEditModal = (a: Announcement) => {
  setEditingId(a.id);
  setTitle(a.title);
  setBody(a.body || "");
  setDate(a.date);
  setAttachments(a.attachments || []);
  setTargetMajors(a.targetMajors || []);  // ADD
  setModalOpen(true);
};
```

- [ ] **Step 6: Update save() to send targetMajors**

Inside `save()`, after `form.append("year", selectedPeriod)`, add:

```ts
form.append("targetMajors", JSON.stringify(targetMajors));
```

- [ ] **Step 7: Add targeting section to modal JSX**

In the modal form, after the `rowGrid` div (date + year grid), add this section before the attachment section:

```tsx
{/* ส่งถึง */}
<div style={inputGroup}>
  <label style={labelStyle}>ส่งถึง</label>
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
      <input
        type="radio"
        checked={targetMajors.length === 0}
        onChange={() => setTargetMajors([])}
      />
      <span>ทุกสาขา</span>
    </label>
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
      <input
        type="radio"
        checked={targetMajors.length > 0}
        onChange={() => setTargetMajors(availableMajors.length > 0 ? [availableMajors[0]] : [])}
      />
      <span>เลือกสาขา</span>
    </label>
    {targetMajors.length > 0 && availableMajors.length > 0 && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 24 }}>
        {availableMajors.map(m => (
          <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, background: targetMajors.includes(m) ? "#eff6ff" : "#f8fafc", border: `1px solid ${targetMajors.includes(m) ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, padding: "4px 12px" }}>
            <input
              type="checkbox"
              checked={targetMajors.includes(m)}
              onChange={e => setTargetMajors(prev =>
                e.target.checked ? [...prev, m] : prev.filter(x => x !== m)
              )}
            />
            {m}
          </label>
        ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 8: Add target badges to cards**

In the card JSX, in the `annMeta` div (after `badgeYear` span), add:

```tsx
{/* Target badge */}
{a.targetMajors && a.targetMajors.length === 0 ? (
  <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>ทุกสาขา</span>
) : (
  a.targetMajors?.map(m => (
    <span key={m} style={{ background: "#eff6ff", color: "#2563eb", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{m}</span>
  ))
)}
```

- [ ] **Step 9: Also update fetchAnnouncements mapping to include targetMajors**

In the `fetchAnnouncements` function, update the `.map()` to preserve `targetMajors`:

```ts
setItems(
  res.data.list.map((a: any) => ({
    ...a,
    targetMajors: a.targetMajors || [],  // ADD
    attachments: [
      // ... existing mapping unchanged
    ]
  }))
);
```

- [ ] **Step 10: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add Frontend/src/components/A_Announcements.tsx
git commit -m "feat: A_Announcements adds major targeting UI"
```

---

## Task 4: S_Dashboard.tsx — Add major filter + "ดูทั้งหมด" link

**Files:**
- Modify: `Frontend/src/components/S_Dashboard.tsx`

**Background:**  
`S_Dashboard` already calls `/api/students/me` (line 87) and gets the profile response. The `profileRes.data.major` is the student's major. Need to:
1. Extract `major` from the profile response
2. Pass `?major=<major>` to the announcements API
3. Show only 3 announcements
4. Add "ดูทั้งหมด →" link

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/S_Dashboard.tsx` lines 46–100 to understand the `fetchData` function and `announcements` state.

- [ ] **Step 2: Add studentMajor state**

After `const [studentStatus, setStudentStatus] = useState<string>("NOT_SUBMITTED");`, add:
```ts
const [studentMajor, setStudentMajor] = useState<string>("");
```

- [ ] **Step 3: Update fetchData — extract major + filter announcements**

In `fetchData`, replace the announcements fetch (currently around line 59):

```ts
// 4. ดึงโปรไฟล์นักศึกษา (major + สถานะ)
const profileRes = await axios.get("/api/students/me", {
  headers: { Authorization: `Bearer ${token}` }
});
const major = profileRes.data?.major || "";
setStudentStatus(profileRes.data?.coop?.status || "NOT_SUBMITTED");
setStudentMajor(major);

// 1. ดึงประกาศ — filter ตาม major
const majorParam = major ? `&major=${encodeURIComponent(major)}` : "";
const annRes = await axios.get(`/api/announcements?${majorParam}`);
if (annRes.data?.ok && Array.isArray(annRes.data.list)) {
  setAnnouncements(annRes.data.list);
} else {
  setAnnouncements([]);
}
```

Note: Remove the OLD separate `/api/students/me` call if it exists (around line 87) to avoid duplicate calls — merge into one call above.

- [ ] **Step 4: Update announcements display — limit 3 + add link**

Find the announcement rendering section (around line 208 where `ข่าวประกาศล่าสุด` appears). Update the header to add a link and limit to 3 items:

```tsx
{/* ================= ANNOUNCEMENTS ================= */}
<section className="dash-section">
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <h2 className="dash-section-title">
      <IcAnnounce />
      ข่าวประกาศล่าสุด
    </h2>
    <a href="/student/announcements" style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
      ดูทั้งหมด →
    </a>
  </div>
  {announcements.length === 0 ? (
    <div className="dash-empty">ไม่มีประกาศในขณะนี้</div>
  ) : (
    announcements.slice(0, 3).map((a) => (   // limit to 3
      <div
        key={a.id}
        className="dash-ann-item"
        onClick={() => setSelectedAnn(a)}
      >
        <span className="dash-ann-title">{a.title}</span>
        <span className="dash-ann-date">{new Date(a.date).toLocaleDateString('th-TH', { dateStyle: 'short' })}</span>
      </div>
    ))
  )}
</section>
```

- [ ] **Step 5: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/S_Dashboard.tsx
git commit -m "feat: S_Dashboard filters announcements by student major, shows top 3"
```

---

## Task 5: S_Announcements.tsx — New dedicated announcement page

**Files:**
- Create: `Frontend/src/components/S_Announcements.tsx`

**Background:**  
New standalone page for students showing all filtered announcements in a Classroom-style card stream. Fetches student profile to get major, then fetches all announcements filtered by that major.

- [ ] **Step 1: Create S_Announcements.tsx**

Create `Frontend/src/components/S_Announcements.tsx` with the following content:

```tsx
import { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

interface Announcement {
  id: string;
  title: string;
  body?: string;
  date: string;
  year: string;
  targetMajors: string[];
  attachments: { type: string; name: string; url: string }[];
}

export default function S_Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const profileRes = await axios.get("/api/students/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const major = profileRes.data?.major || "";
        const majorParam = major ? `?major=${encodeURIComponent(major)}` : "";
        const res = await axios.get(`/api/announcements${majorParam}`);
        if (res.data.ok) {
          setItems(res.data.list.map((a: any) => ({
            ...a,
            targetMajors: a.targetMajors || [],
            attachments: a.attachments || [],
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  return (
    <div style={page}>
      <h1 style={pageTitle}>📢 ประกาศสหกิจศึกษา</h1>

      {loading ? (
        <div style={emptyBox}>กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div style={emptyBox}>ไม่มีประกาศในขณะนี้</div>
      ) : (
        <div style={stream}>
          {items.map(a => (
            <article key={a.id} style={card} onClick={() => setSelected(a)}>
              <div style={cardTop}>
                <span style={cardTitle}>{a.title}</span>
                <span style={cardDate}>
                  {new Date(a.date).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                </span>
              </div>
              {a.body && (
                <p style={cardBody}>
                  {a.body.length > 180 ? a.body.slice(0, 180) + "..." : a.body}
                </p>
              )}
              {a.attachments.length > 0 && (
                <div style={chipRow}>
                  {a.attachments.map((at, i) => (
                    <span
                      key={i}
                      style={chip}
                      onClick={e => { e.stopPropagation(); window.open(at.url, "_blank"); }}
                    >
                      {at.type === "link" ? "🔗" : at.type === "image" ? "🖼️" : "📄"}{" "}
                      <span style={chipText}>{at.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={overlay} onClick={() => setSelected(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{selected.title}</h2>
              <button style={closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={modalBody}>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                📅 {new Date(selected.date).toLocaleDateString("th-TH", { dateStyle: "long" })}
              </p>
              {selected.body && (
                <p style={{ color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 20 }}>
                  {selected.body}
                </p>
              )}
              {selected.attachments.length > 0 && (
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 8 }}>ไฟล์แนบ</p>
                  <div style={chipRow}>
                    {selected.attachments.map((at, i) => (
                      <a
                        key={i}
                        href={at.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...chip, textDecoration: "none" }}
                      >
                        {at.type === "link" ? "🔗" : at.type === "image" ? "🖼️" : "📄"}{" "}
                        <span style={chipText}>{at.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const page: CSSProperties = { padding: "40px", marginLeft: "65px", backgroundColor: "#f8fafc", minHeight: "100vh" };
const pageTitle: CSSProperties = { fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 24 };
const stream: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const card: CSSProperties = { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, cursor: "pointer", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const cardTop: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 };
const cardTitle: CSSProperties = { fontWeight: 700, fontSize: 17, color: "#0f172a", flex: 1 };
const cardDate: CSSProperties = { fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" };
const cardBody: CSSProperties = { color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" };
const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const chip: CSSProperties = { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 };
const chipText: CSSProperties = { color: "#334155", fontWeight: 500 };
const emptyBox: CSSProperties = { textAlign: "center", padding: "80px 0", color: "#94a3b8", fontSize: 15, backgroundColor: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0" };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modal: CSSProperties = { background: "#fff", borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto" };
const modalHead: CSSProperties = { padding: "24px 24px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalBody: CSSProperties = { padding: 24 };
const closeBtn: CSSProperties = { background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer" };
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/S_Announcements.tsx
git commit -m "feat: S_Announcements page — student announcement stream filtered by major"
```

---

## Task 6: Routing + Sidebar — Wire up the new page

**Files:**
- Modify: `Frontend/src/components/S_Sidebar.tsx`
- Modify: `Frontend/src/components/S_App.tsx`

- [ ] **Step 1: Add NavLink to S_Sidebar.tsx**

Read `Frontend/src/components/S_Sidebar.tsx`. Find the nav section. After the `ข้อมูลบริษัท` NavLink and before the `ยื่นคำร้องสหกิจ` NavLink, add:

```tsx
<NavLink
  to="/student/announcements"
  className={({ isActive }) => "item" + (isActive ? " active" : "")}
  onClick={handleNav}
>
  <span className="ico">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  </span>
  <span className="text">ประกาศ</span>
</NavLink>
```

- [ ] **Step 2: Add import + Route in S_App.tsx**

Read `Frontend/src/components/S_App.tsx`. Add import at the top with other imports:

```tsx
import S_Announcements from "./S_Announcements";
```

Add route inside `<Routes>` block (after the `company` route):

```tsx
<Route path="announcements" element={<S_Announcements />} />
```

- [ ] **Step 3: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/S_Sidebar.tsx Frontend/src/components/S_App.tsx
git commit -m "feat: add announcements route and sidebar link for students"
```

---

## Task 7: Final verification + CHANGELOG

- [ ] **Step 1: Run backend tests**

```bash
cd backend && npm test
```

Expected: All existing tests pass + 3 new announcement tests pass. 1 pre-existing failure (adminDocController) unchanged.

- [ ] **Step 2: Frontend type check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Update CHANGELOG.md**

Add at top of `CHANGELOG.md`:

```markdown
## [2026-05-29] Announcement Major Targeting

### Added
- `Announcement` schema: `targetMajors Json @default("[]")` — `[]` หมายถึงทุกสาขา, `["CS","IT"]` หมายถึงเฉพาะสาขาที่ระบุ
- `GET /api/admin/students/majors` — distinct majors จาก Student table สำหรับ dropdown ในฟอร์มประกาศ
- `S_Announcements.tsx` — หน้าประกาศแยก สำหรับนักศึกษา แสดง stream แบบ Classroom (filter ตาม major อัตโนมัติ)
- เมนู "ประกาศ" ใน Student Sidebar → `/student/announcements`

### Changed
- `GET /api/announcements?major=<major>` — กรองประกาศตาม major ฝั่ง server ([] = ทุกสาขา)
- `POST /api/announcements` — รับ `targetMajors` (JSON array) และบันทึกลง DB
- `A_Announcements.tsx` — modal เพิ่ม targeting section (ทุกสาขา / เลือกสาขา + checkbox), การ์ดแสดง badge สาขา
- `S_Dashboard.tsx` — ดึงประกาศ filter ตาม `student.major`, แสดง 3 ล่าสุด + ลิงก์ "ดูทั้งหมด →"
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for announcement major targeting"
```

---

## Self-Review

**Spec coverage:**
- [x] Staff announces to specific majors or all → Task 2 (backend) + Task 3 (UI)
- [x] Majors from Student table (distinct) → Task 2 (`/admin/students/majors`)
- [x] Students see only their major + all-major → Task 2 (filter) + Task 4 (major param)
- [x] Dashboard shows 3 + "ดูทั้งหมด" link → Task 4
- [x] Dedicated `S_Announcements` page → Task 5
- [x] Sidebar nav + route → Task 6
- [x] Classroom-style card stream → Task 3 (staff) + Task 5 (student)

**Type consistency:**
- `Announcement.targetMajors: string[]` defined in both `A_Announcements.tsx` and `S_Announcements.tsx` ✓
- `fetchMajors` → `/api/admin/students/majors` → `ADMIN_ROLES` guard ✓
- FormData sends `targetMajors` as JSON string → backend parses with `JSON.parse` ✓
- `a.targetMajors || []` fallback everywhere ✓
