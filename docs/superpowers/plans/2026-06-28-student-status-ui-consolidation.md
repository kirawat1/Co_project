# Student Status UI Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the triple-duplicated status display on `/student/gateway`, fold the standalone `/student/status-tracker` page into an expandable section on the Dashboard, and update sidebar navigation accordingly.

**Architecture:** Pure frontend (React + TypeScript) change across 4 existing files. No backend, no new components, no new tests (no Jest coverage for this UI-only change — verification is `tsc --noEmit` + manual browser walkthrough per task).

**Tech Stack:** React 19, TypeScript, Vite (Frontend/src/components)

## Global Constraints

- `tsconfig.app.json` has `noUnusedLocals: true` and `noUnusedParameters: true` — every import/const removed from JSX usage must also be deleted from its declaration, or `npx tsc --noEmit` fails the build.
- API calls must use relative paths (no `http://localhost:5000`) — not touched by this plan, but do not introduce any.
- Token is read via `localStorage.getItem("coop.token")` — already established in `S_Dashboard.tsx`, no change needed.
- Every change in this plan touches only the 4 files named below — no other file in `Frontend/src` references `/student/status-tracker` or imports `S_StatusTracker` (confirmed via repo-wide grep during design).

---

### Task 1: Remove duplicate status displays from Gateway

**Files:**
- Modify: `Frontend/src/components/S_Gateway.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — this task only deletes dead UI and its supporting dead code. `S_Gateway.tsx` keeps exporting `default function CoopRequestPage()` unchanged in signature.

- [ ] **Step 1: Remove the now-unused `S_StatusTracker` import**

In `Frontend/src/components/S_Gateway.tsx`, find this line near the top of the file:

```tsx
import S_StatusTracker from "./S_StatusTracker";
```

Delete it entirely.

- [ ] **Step 2: Remove the custom step-indicator data (`STEPS`/`currentStep`/`activeStep`)**

Find this block (just before the `return (` of the component):

```tsx
  // Step Indicator logic
  const STEPS = [
    { label: "ตรวจสอบคุณสมบัติ", statuses: ["NOT_SUBMITTED", "APPLYING", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED"] },
    { label: "ส่งเอกสาร T000", statuses: ["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED"] },
    { label: "รอหนังสือ & ตอบรับ", statuses: ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"] },
    { label: "ออกฝึกสหกิจ", statuses: ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"] },
  ];
  const currentStep = STEPS.findIndex((s) => s.statuses.includes(currentStatus));
  const activeStep = currentStep === -1 ? 0 : currentStep;

  return (
```

Replace it with just:

```tsx
  return (
```

(i.e. delete the comment and the three `const`/`let` declarations, keep `return (`).

- [ ] **Step 3: Remove the custom STEP INDICATOR JSX block**

Find this block (right after `<style>{PROFILE_CSS}</style>` at the top of the returned JSX):

```tsx
      <style>{PROFILE_CSS}</style>

      {/* ================= STEP INDICATOR ================= */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 15,
                  background: done ? "#22c55e" : active ? "#0074B7" : "rgba(100,116,139,.15)",
                  color: done || active ? "#fff" : "#94a3b8",
                  border: active ? "3px solid #bfdbfe" : "2px solid transparent",
                  transition: ".2s", flexShrink: 0,
                }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#0074B7" : done ? "#16a34a" : "#94a3b8", textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 3, margin: "0 4px", marginBottom: 20, background: done ? "#22c55e" : "rgba(100,116,139,.15)", transition: ".3s", borderRadius: 2 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ConfirmDialog for file delete */}
```

Replace it with:

```tsx
      <style>{PROFILE_CSS}</style>

      {/* ConfirmDialog for file delete */}
```

- [ ] **Step 4: Remove the embedded `<S_StatusTracker />` block**

Find this block (between the recruitment-period banner and "SECTION 1"):

```tsx
      {/* ================= STATUS TRACKER ================= */}
      {currentStatus !== "NOT_SUBMITTED" && (
        <S_StatusTracker status={currentStatus} lastComment={profile?.coop?.teacherCheckComment || profile?.coop?.t000Comment} />
      )}

      {/* ================= SECTION 1: สถานะคำร้อง ================= */}
```

Replace it with:

```tsx
      {/* ================= SECTION 1: สถานะคำร้อง ================= */}
```

- [ ] **Step 5: Verify with TypeScript and visually**

Run:
```bash
cd Frontend && npx tsc --noEmit
```
Expected: no output, exit code 0 (this confirms `STEPS`/`currentStep`/`activeStep`/`S_StatusTracker` are fully gone — `noUnusedLocals` would otherwise fail the build).

Then, with the dev servers running (use the `run-dev` skill if they're not already up), log in as a student whose `coop.status` is not `NOT_SUBMITTED` and open `/student/gateway`. Confirm:
- No 4-circle step indicator above the banner.
- No phase-grid/sub-step tracker card.
- Exactly one status display remains: the "สถานะคำร้อง" card with the colored background, icon, `StatusBadge`, and (if applicable) the red comment box.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/S_Gateway.tsx
git commit -m "fix: ลบ status display ที่ซ้ำซ้อนในหน้า Gateway เหลือไว้แค่การ์ดสถานะคำร้อง"
```

---

### Task 2: Make Dashboard's status card expandable with full S_StatusTracker

**Files:**
- Modify: `Frontend/src/components/S_Dashboard.tsx`

**Interfaces:**
- Consumes: `S_StatusTracker` component, exact signature `export default function S_StatusTracker({ status, lastComment }: { status: string; lastComment?: string })` (from `Frontend/src/components/S_StatusTracker.tsx` — unchanged by this plan).
- Produces: nothing new for later tasks — Task 3 only touches `S_App.tsx`/`S_Sidebar.tsx`, neither of which imports anything from `S_Dashboard.tsx`.

- [ ] **Step 1: Add the `S_StatusTracker` import and drop the now-unused `useNavigate` import**

Find:

```tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { IcAnnounce, IcDocs } from "./icons";
import StatusBadge from "./StatusBadge";
import { useNavigate } from "react-router-dom";
```

Replace with:

```tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { IcAnnounce, IcDocs } from "./icons";
import StatusBadge from "./StatusBadge";
import S_StatusTracker from "./S_StatusTracker";
```

(`useNavigate` is removed here because after Step 4 below, `navigate(...)` has zero call sites left in this file.)

- [ ] **Step 2: Add `lastComment` and `statusExpanded` state**

Find:

```tsx
export default function S_Dashboard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supervisions, setSupervisions] = useState<SupervisionAppt | null>(null);
  const [configs, setConfigs] = useState<Record<string, SystemConfig>>({});
  const [studentStatus, setStudentStatus] = useState<string>("NOT_SUBMITTED");
  const [studentMajor, setStudentMajor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const token = localStorage.getItem("coop.token");
```

Replace with:

```tsx
export default function S_Dashboard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supervisions, setSupervisions] = useState<SupervisionAppt | null>(null);
  const [configs, setConfigs] = useState<Record<string, SystemConfig>>({});
  const [studentStatus, setStudentStatus] = useState<string>("NOT_SUBMITTED");
  const [studentMajor, setStudentMajor] = useState<string>("");
  const [lastComment, setLastComment] = useState<string>("");
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const token = localStorage.getItem("coop.token");
```

- [ ] **Step 3: Fetch the teacher/staff comment alongside status**

Find:

```tsx
      const major = profileRes.data?.major || "";
      setStudentStatus(profileRes.data?.coop?.status || "NOT_SUBMITTED");
      setStudentMajor(major);
```

Replace with:

```tsx
      const major = profileRes.data?.major || "";
      setStudentStatus(profileRes.data?.coop?.status || "NOT_SUBMITTED");
      setLastComment(profileRes.data?.coop?.teacherCheckComment || profileRes.data?.coop?.t000Comment || "");
      setStudentMajor(major);
```

- [ ] **Step 4: Remove the unused `navigate` declaration**

Find:

```tsx
  const navigate = useNavigate();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูลภาพรวม...</div>;
```

Replace with:

```tsx
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูลภาพรวม...</div>;
```

- [ ] **Step 5: Wire the expand/collapse button and render `S_StatusTracker` inline**

Find:

```tsx
        <button onClick={() => navigate("/student/status-tracker")} style={{ padding:"8px 18px", background:"#eff6ff", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
          ดูรายละเอียด →
        </button>
      </div>

      {/* ===== COUNTDOWN ===== */}
```

Replace with:

```tsx
        <button onClick={() => setStatusExpanded((v) => !v)} style={{ padding:"8px 18px", background:"#eff6ff", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
          {statusExpanded ? "ซ่อนรายละเอียด ↑" : "ดูรายละเอียด →"}
        </button>
      </div>

      {statusExpanded && <S_StatusTracker status={studentStatus} lastComment={lastComment} />}

      {/* ===== COUNTDOWN ===== */}
```

- [ ] **Step 6: Verify with TypeScript and visually**

Run:
```bash
cd Frontend && npx tsc --noEmit
```
Expected: no output, exit code 0.

With dev servers running, log in as a student with `coop.status` not `NOT_SUBMITTED` and open `/student/dashboard`. Confirm:
- The compact status card renders as before, button now says "ดูรายละเอียด →".
- Clicking it expands the full `S_StatusTracker` (phase grid + sub-steps + next-action card) directly below, without navigating away from `/student/dashboard`.
- Button label flips to "ซ่อนรายละเอียด ↑"; clicking again collapses it.
- If the student's status has a teacher/staff comment (e.g. `EDITS_REQUIRED`), confirm it shows in the expanded tracker's "ต้องดำเนินการ" box.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/components/S_Dashboard.tsx
git commit -m "feat: ขยาย Dashboard ให้แสดง S_StatusTracker เต็มรูปแบบในหน้าเดียว (กดดูรายละเอียด/ซ่อน)"
```

---

### Task 3: Retire the standalone status-tracker route and sidebar link

**Files:**
- Modify: `Frontend/src/components/S_App.tsx`
- Modify: `Frontend/src/components/S_Sidebar.tsx`

**Interfaces:**
- Consumes: Task 2 must be complete first — Dashboard already provides the equivalent expandable view before this task removes the only other way to reach it.
- Produces: nothing — this is the final task in this plan.

- [ ] **Step 1: Remove the `status-tracker` route and its import from `S_App.tsx`**

In `Frontend/src/components/S_App.tsx`, find:

```tsx
import StatusTraker from "./S_StatusTracker";
```

Delete this line.

Then find:

```tsx
            <Route path="status-tracker" element={<StatusTraker status={profile?.coop?.status || "NOT_SUBMITTED"} />} />
```

Delete this line.

- [ ] **Step 2: Move the notification badge + mark-as-read behavior onto the Dashboard nav item in `S_Sidebar.tsx`**

In `Frontend/src/components/S_Sidebar.tsx`, find:

```tsx
        <NavItem to="/student/dashboard" label="Dashboard" icon={<IcDashboard />} end onClick={handleNav} />

        <NavItem to="/student/status-tracker" label="สถานะสหกิจ" onClick={navAndRead}
          count={(counts.STATUS_UPDATED ?? 0) + (counts.REQ_LETTER_ISSUED ?? 0) + (counts.PLACEMENT_LETTER_ISSUED ?? 0)}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />

        <NavItem to="/student/profile" label="ข้อมูลนักศึกษา" icon={<IcUser />} onClick={handleNav} />
```

Replace with:

```tsx
        <NavItem to="/student/dashboard" label="Dashboard" icon={<IcDashboard />} end onClick={navAndRead}
          count={(counts.STATUS_UPDATED ?? 0) + (counts.REQ_LETTER_ISSUED ?? 0) + (counts.PLACEMENT_LETTER_ISSUED ?? 0)} />

        <NavItem to="/student/profile" label="ข้อมูลนักศึกษา" icon={<IcUser />} onClick={handleNav} />
```

- [ ] **Step 3: Verify with TypeScript and visually**

Run:
```bash
cd Frontend && npx tsc --noEmit
```
Expected: no output, exit code 0 (confirms `StatusTraker` import removal didn't leave a dangling reference, and `IcDashboard`/`NavItem`/`counts`/`navAndRead` are all still valid in their existing scope — no new imports needed since `NavItem`'s `count` prop and `navAndRead` were already defined/used elsewhere in this file).

With dev servers running, log in as a student and confirm:
- Sidebar no longer shows a "สถานะสหกิจ" item.
- The "Dashboard" nav item shows a red badge with the unread count (test this with a test account/status transition that produces a nonzero `STATUS_UPDATED`/`REQ_LETTER_ISSUED`/`PLACEMENT_LETTER_ISSUED` count — or skip the nonzero-count visual if no such test data is available, and instead confirm via the Network tab that `POST /api/notifications/mark-all-read` fires when clicking "Dashboard").
- Clicking "Dashboard" navigates there and clears the badge.
- Navigating directly to `/student/status-tracker` in the browser URL bar now falls through to the catch-all/redirect behavior already defined for unknown student routes (no crash).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/S_App.tsx Frontend/src/components/S_Sidebar.tsx
git commit -m "refactor: ลบหน้า status-tracker เดี่ยวออกจาก routing/sidebar ย้าย badge แจ้งเตือนไปไว้ที่ปุ่ม Dashboard"
```

---

### Task 4: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing
- Produces: nothing — documentation only

- [ ] **Step 1: Add a CHANGELOG entry**

At the top of `CHANGELOG.md` (above the most recent existing entry), add:

```markdown
## [2026-06-28] UI: รวม status display ของนักศึกษา ลด UI ซ้ำซ้อน

### Changed
- **`S_Gateway.tsx`**: ลบ status display ที่ซ้ำซ้อน 2 ใน 3 จุด (custom step indicator + embedded `S_StatusTracker`) เหลือไว้แค่การ์ด "สถานะคำร้อง" จุดเดียว
- **`S_Dashboard.tsx`**: การ์ดสถานะแบบย่อกดปุ่ม "ดูรายละเอียด →" แล้วขยายแสดง `S_StatusTracker` เต็มรูปแบบ (phase + sub-step + next action) ในหน้าเดียวกัน แทนการลิงก์ไปหน้าใหม่
- **`S_App.tsx` / `S_Sidebar.tsx`**: ลบหน้า `/student/status-tracker` แบบเดี่ยวและ sidebar item "สถานะสหกิจ" — badge แจ้งเตือน + mark-as-read ย้ายไปอยู่ที่ปุ่ม "Dashboard" แทน

### Verified
- `npx tsc --noEmit` ผ่าน (เคลียร์ import/const ที่ไม่ใช้แล้วทั้งหมดตาม `noUnusedLocals`)
- ทดสอบจริงในเบราว์เซอร์: Gateway เหลือสถานะเดียว, Dashboard ขยาย/ย่อ tracker ได้ในหน้าเดียว, sidebar ไม่มี "สถานะสหกิจ" แล้ว, badge แจ้งเตือนย้ายไปปุ่ม Dashboard ถูกต้อง
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: เพิ่ม CHANGELOG entry สำหรับการรวม status UI ของนักศึกษา"
```
