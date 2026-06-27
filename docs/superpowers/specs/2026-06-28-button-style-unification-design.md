# Button Style Unification — Design Spec

## Problem

Buttons look different from page to page across the system. Root cause, confirmed by codebase audit:

- `src/components/S_Theme.tsx` is the app's real shared stylesheet — it's deliberately rendered once at the root (`App.tsx`) and again redundantly in `A_App.tsx`/`T_App.tsx` (comment: "ใช้ธีมเดียว" — "use one theme"), injecting a single `<style>` tag used by all three roles.
- It already defines `.btn` (primary) and `.btn-ico` fully, and has **dark-mode-only** (`[data-theme="dark"]`) overrides for `.btn-ghost`, `.btn-secondary`, `.btn-outline`, `.action-btn`, `.btn-delete`, `.btn-link` — but **no light-mode base rule for any of those six** exists in this file.
- Because the light-mode base is missing, ~10 different component files each invented their own local light-mode version of `.btn-ghost`/`.btn-secondary`/etc. inside per-component `<style>{...}</style>` blocks — with inconsistent colors, borders, and radii, and in most cases **no hover rule at all**.
- A handful of components (`ConfirmDialog`, `NotificationBell`, `Toast`, `StatusFilterChips`) use raw inline `style={{}}` with no class and no hover state whatsoever.
- ~20 buttons hardcode semantic colors (green=approve, red=reject, amber=send-back) via one-off `style={{background:'#10b981'}}`-type overrides on top of the generic `.btn` class, instead of using a named variant.
- No amber/warning button class exists anywhere yet.

## Goals

- One visual system for buttons across student/teacher/admin: consistent height, radius, padding, font-weight, and — critically — a visible hover state on every button (background/brightness shift), including the "outlined, white background" style the user specifically flagged.
- Preserve existing color *meaning*: blue = primary, green = approve/success, red = reject/delete, amber = pending/warning (amber is new — no prior convention).
- Centralize the fix in `S_Theme.tsx`, the file the codebase already treats as its single shared theme — not a new stylesheet.
- Minimize JSX changes. Most files already reference the right class name (`btn-secondary`, `btn-ghost`, etc.) — they just duplicate its definition locally. Deleting the duplicate and letting the centralized rule apply requires no JSX edit at all for those files.

## Non-goals

- No new Button React component / no migration of `<button>` to `<Button>`.
- No restructuring of unrelated layout/markup.
- Not fixing the harmless redundant double-mount of `<StudentTheme />` in `A_App.tsx`/`T_App.tsx` (same component, idempotent CSS, out of scope).

## Class taxonomy (all defined as self-contained classes — not modifiers requiring `.btn` to also be present, since most call sites use a single class name today)

Shared geometry across every variant below: `height: 44px; border-radius: 10px; padding: 0 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: filter .15s, background-color .15s, border-color .15s, transform .05s; white-space: nowrap;` (normalizes the existing 8px/12px radius split found across duplicate definitions).

Shared states added to every variant:
- `:hover` — see per-variant rule below (solid variants darken via `filter: brightness(.92)`; bordered/transparent variants gain a visible tint background — this is the direct fix for "hover ไม่ชัดว่าจะกด")
- `:active` — `filter: brightness(.85)` (solid) or `transform: scale(.98)` (bordered)
- `:disabled` — `opacity: .6; cursor: not-allowed; filter: none; pointer-events: none`
- `:focus-visible` — `outline: 2px solid var(--ios-blue); outline-offset: 2px` (keyboard accessibility)

| Class | Light-mode skin | Hover | Notes |
|---|---|---|---|
| `.btn` (+ alias `.btn-primary`) | `background: var(--ios-blue); color:#fff; border:0;` (already exists) | `filter: brightness(.92)` | Add `.btn-primary` as an alias selector so the few files already using that name need no JSX change |
| `.btn-secondary` | `background:#fff; color:#475569; border:1px solid #cbd5e1;` | `background:#f1f5f9` | The "outlined, white bg" style the user flagged |
| `.btn-ghost` | `background:transparent; color:#475569; border:1px solid transparent;` | `background:#f1f5f9` | More minimal than secondary — no visible border at rest |
| `.btn-outline` | `background:#fff; color:var(--ios-blue); border:1px solid var(--ios-blue);` | `background: rgba(10,132,255,.08)` | Brand-colored outline, used in letter/issue modals |
| `.btn-success` | `background:#10b981; color:#fff;` | `filter: brightness(.92)` | Approve actions |
| `.btn-danger` | `background:#dc2626; color:#fff;` | `filter: brightness(.92)` | Reject/delete actions. Absorbs `.btn-delete` (renamed) and standardizes the existing soft/pink `.btn-danger` instances in `A_Company.tsx`/`S_Company.tsx`/`T_StudentDetail.tsx` to solid, per user decision |
| `.btn-warning` | `background:#f59e0b; color:#fff;` | `filter: brightness(.92)` | **New** — pending/send-back actions, no prior class existed |
| `.action-btn` | same rule as `.btn-secondary` | same as `.btn-secondary` | Kept as a separate name since `A_DocT000.tsx`/`S_Dashboard.tsx` already use it; visually identical to secondary |
| `.btn-link` | `background:none; border:none; color:var(--ios-blue); height:auto; min-height:32px;` | `text-decoration: underline` | Inline text-style action, not a full tap target by design |
| `.btn-copy` | `background:#e2e8f0; color:#334155; border:none;` (existing) | `background:#cbd5e1` | Keep existing `.copied` success-state override as-is |
| `.close-btn` | `background:#f1f5f9; border:none; border-radius:50%; color:#64748b;` | `background:#e2e8f0` | Circular ✕ button |
| `.btn-ico`, `.btn-hamburger` | unchanged | unchanged | Already fully defined with working hover — no change needed beyond confirming shared transition timing |

Dark-mode (`[data-theme="dark"]`) counterparts already exist for most of these in `S_Theme.tsx`; they'll be reconciled to the renamed/new classes (`.btn-delete` dark rule → `.btn-danger`) and `.btn-success`/`.btn-warning`/`.close-btn` get new dark variants added alongside.

## Migration scope

**A. `S_Theme.tsx`** — add the missing light-mode base rules above, the `.btn-primary` alias, the new `.btn-warning` class, the shared `:active`/`:disabled`/`:focus-visible` states, and reconcile dark-mode selectors (rename `.btn-delete` → `.btn-danger`, add dark variants for `.btn-success`/`.btn-warning`/`.close-btn`).

**B. Delete duplicate local `<style>` blocks** (className stays unchanged — zero JSX risk) in:
- `.btn`/`.btn-primary` duplicates: every file currently defining its own `.btn` (the ~41-file set from the original audit, e.g. `A_Dashboard.tsx`, `T_Requests.tsx`, `A_CoopApplications.tsx`, `S_Docs.tsx`, and others)
- `.btn-ghost` duplicates: `A_SupervisionManage.tsx`, `A_DocRequirements.tsx`, `A_DocT003Review.tsx`, `A_DocT002Review.tsx`, `A_CoopApplications.tsx`, `T_Requests.tsx`, `T_SupervisionReview.tsx`, `A_CriteriaPage.tsx`, `T_Students.tsx`, `T_StudentDetail.tsx`
- `.btn-secondary` duplicates: `LetterModalShared.tsx`, `S_Company.tsx`, `A_Company.tsx`, `S_Docs.tsx`, `S_Gateway.tsx`, `S_ProfilePage.tsx`, `T_Profile.tsx`, `S_Supervision.tsx`
- `.btn-outline` duplicates: `LetterModalShared.tsx`, the three `Issue*LetterModal.tsx` files, `S_DocsT002Form.tsx`, `S_DocsT003Form.tsx`
- `.btn-success` duplicates: `LetterModalShared.tsx`, `S_Gateway.tsx`
- `.btn-danger` duplicates: `A_Company.tsx`, `S_Company.tsx`, `T_StudentDetail.tsx`
- `.action-btn` duplicate: `A_DocT000.tsx`
- `.btn-copy` duplicates: `S_DocT008.tsx`, `S_DocT007.tsx`, `S_DocT005_006.tsx`
- `.close-btn` duplicate: `S_Dashboard.tsx`

**C. Small JSX edits** (className rename, one line each):
- `S_Gateway.tsx` — 4 occurrences of `className="btn-delete"` → `className="btn-danger"`

**D. Replace inline color overrides with semantic class** (drop the `style={{background:'#...'}}`, swap className to the matching variant):
- `T_Requests.tsx` — 3 buttons (green/amber/red → `btn-success`/`btn-warning`/`btn-danger`)
- Any other admin/teacher review screens found via grep for `style={{background:'#10b981'\|'#f59e0b'\|'#ef4444'\|'#dc2626'` near a `<button>` — cross-reference each hex against the palette above and swap to the matching class. A small number of genuinely bespoke one-off accent colors (e.g. a purple override in `S_Docs.tsx` that doesn't map to approve/reject/warn) may stay as a scoped inline accent — not every override needs to disappear, only the ones standing in for a semantic action.

**E. Add classes to currently classless buttons** (gain a real hover state for the first time):
- `ConfirmDialog.tsx` — cancel button → `.btn-secondary`/`.btn-ghost`; confirm button → `.btn-danger` or `.btn-success` depending on the dialog's `confirmColor` prop intent
- `NotificationBell.tsx` — `.btn-ico`
- `Toast.tsx` — dismiss button → `.btn-ico` or `.close-btn`
- `StatusFilterChips.tsx` — evaluate whether chips should get a dedicated pill-style hover or reuse `.btn-ghost`

## Verification

- `npx tsc --noEmit` in `Frontend/` — confirms no logic/type breakage (this is a CSS-only change plus a few className string edits).
- Manual browser pass: one page per role (student/teacher/admin) covering at minimum one instance each of primary, secondary, danger, success, warning, and an icon button — confirm hover visibly changes background/brightness on every one, confirm dark mode still looks correct, confirm disabled buttons don't show a hover effect.
- Spot-check that pages whose local `<style>` block was deleted still render their buttons with the same (or intentionally updated) appearance — no missing/unstyled buttons.
