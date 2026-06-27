# Student Status UI Consolidation — Design

## Problem

`/student/gateway` renders the student's coop application status **three times** on one page:
1. A custom 4-step indicator hand-rolled inside `S_Gateway.tsx` ([S_Gateway.tsx:278-307](../../../Frontend/src/components/S_Gateway.tsx))
2. The full `<S_StatusTracker />` component (phase grid + sub-steps + "next action" card) ([S_Gateway.tsx:357-360](../../../Frontend/src/components/S_Gateway.tsx))
3. A "สถานะคำร้อง" status card with icon + `StatusBadge` + comment box ([S_Gateway.tsx:362-397](../../../Frontend/src/components/S_Gateway.tsx))

Meanwhile `/student/status-tracker` is a standalone page whose only content is `<S_StatusTracker />`, reached via a sidebar nav item and a "ดูรายละเอียด →" button on the Dashboard's compact status card. The standalone page adds a navigation hop for something the student already partially sees elsewhere, and contributes to the Gateway page's redundancy because `S_StatusTracker` is reused there too.

## Goal

- Gateway shows status exactly once — just enough to know what's wrong and what to fix while filling the form.
- The full phase/sub-step/next-action view (`S_StatusTracker`) lives inside the Dashboard, expandable in place — no separate page, no extra navigation.
- Sidebar no longer links to a dedicated status page; the unread-notification badge and mark-as-read behavior move to the Dashboard nav item, since visiting Dashboard is now equivalent to visiting the old status page.

## Changes

### 1. `Frontend/src/components/S_Gateway.tsx`

Remove two of the three status displays, keep one:

- **Delete** the custom step-indicator block (`{/* ================= STEP INDICATOR ================= */}`, lines 278-307) — duplicates phase progress already shown elsewhere.
- **Delete** the `<S_StatusTracker status={currentStatus} lastComment={...} />` block (lines 357-360) and its now-unused import.
- **Keep** the "SECTION 1: สถานะคำร้อง" card (lines 362-397) unchanged — it already shows the current `StatusBadge` plus the teacher/staff comment when edits are required, which is exactly what's needed while editing the form. No new logic here.

Net effect: Gateway goes from 3 status displays to 1.

### 2. `Frontend/src/components/S_Dashboard.tsx`

Make the existing compact status card expandable instead of linking out:

- Add `const [statusExpanded, setStatusExpanded] = useState(false);`
- Add `const [lastComment, setLastComment] = useState<string>("");` and set it in `fetchData` from `profileRes.data?.coop?.teacherCheckComment || profileRes.data?.coop?.t000Comment`.
- Change the "ดูรายละเอียด →" button's `onClick` from `() => navigate("/student/status-tracker")` to `() => setStatusExpanded(v => !v)`, and flip its label to "ซ่อนรายละเอียด ↑" when `statusExpanded` is true.
- Import `S_StatusTracker` and render it conditionally right after the compact status card:
  ```tsx
  {statusExpanded && (
    <S_StatusTracker status={studentStatus} lastComment={lastComment} />
  )}
  ```
- `navigate` (from `useNavigate()`, line 150) is used nowhere else in this file — after the `onClick` change above it has zero remaining call sites, so remove both the `const navigate = useNavigate();` line and the `useNavigate` import.

### 3. `Frontend/src/components/S_App.tsx`

- Remove `<Route path="status-tracker" element={<StatusTraker ... />} />`.
- Remove the now-unused `import StatusTraker from "./S_StatusTracker";`.

### 4. `Frontend/src/components/S_Sidebar.tsx`

- Remove the `<NavItem to="/student/status-tracker" .../>` block entirely (label "สถานะสหกิจ").
- On the existing Dashboard `NavItem`:
  - Change `onClick={handleNav}` to `onClick={navAndRead}` (already defined in this file as `() => { handleNav(); markAllRead(); }`).
  - Add `count={(counts.STATUS_UPDATED ?? 0) + (counts.REQ_LETTER_ISSUED ?? 0) + (counts.PLACEMENT_LETTER_ISSUED ?? 0)}` (the same expression the removed NavItem used).

No other files reference `/student/status-tracker` or import `S_StatusTracker` besides `S_Gateway.tsx`, `S_Dashboard.tsx`, `S_Sidebar.tsx`, and `S_App.tsx` (confirmed via grep across `Frontend/src`) — no dangling references after these four edits.

## Data Flow

`S_StatusTracker` already takes `status: string` and `lastComment?: string` as props and contains all phase/sub-step/action logic — no changes needed inside that component. The only new data requirement is that `S_Dashboard.tsx` must fetch `teacherCheckComment`/`t000Comment` (already present in the `/api/students/me` response, just not currently read into Dashboard state).

## Error Handling

No new error paths. `S_StatusTracker` already defaults to phase 0 / generic action text for unrecognized status strings, and the comment fields are optional (`lastComment?: string`).

## Testing

No backend changes, so no new Jest tests. Verification is manual/browser:
1. Log in as a student with `status !== NOT_SUBMITTED` (any in-progress test account).
2. Open `/student/gateway` — confirm exactly one status display (the "สถานะคำร้อง" card), no step indicator, no phase grid.
3. Open `/student/dashboard` — confirm compact status card renders, click "ดูรายละเอียด →", confirm `S_StatusTracker` expands inline (phase grid + sub-steps + next-action), click again to collapse.
4. Confirm sidebar no longer shows a "สถานะสหกิจ" item, and the Dashboard nav item shows the red badge count + clears it (via `markAllRead`) on click, matching the old behavior.
5. `npx tsc --noEmit` clean (catches the route/import removals and any now-unused imports).
