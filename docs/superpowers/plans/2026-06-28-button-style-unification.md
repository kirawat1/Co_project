# Button Style Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every button in the system look and behave consistently — same geometry, a visible hover state on every variant (including the "outlined, white background" style), same color meaning for primary/success/danger/warning — by centralizing all button CSS into the app's existing shared theme file and deleting the ~30 duplicate/inconsistent local copies scattered across components.

**Architecture:** `Frontend/src/components/S_Theme.tsx` already renders one global `<style>` tag for all three roles (student/teacher/admin) — it just has incomplete light-mode rules for several button classes. Task 1 fills in the missing rules there. Tasks 2-5 then delete the now-redundant local `<style>` block copies in each component file (className strings are untouched — they already reference the right names) and fix the handful of spots that need an actual className change. Task 6 sweeps for anything missed and does full visual verification.

**Tech Stack:** React 19 + TypeScript + Vite, CSS-in-JS via template-literal `<style>{...}</style>` blocks (no Tailwind config, no CSS Modules).

## Global Constraints

- Preserve existing color meaning: blue = primary, green = approve/success, red = reject/delete, amber = pending/warning.
- Centralize in `S_Theme.tsx` — no new stylesheet file, no new React `Button` component.
- Every button class is self-contained (not a modifier requiring `.btn` to also be present) since most call sites use a single class name today.
- Shared geometry for every variant: `height: 44px; border-radius: 10px; padding: 0 16px; font-weight: 700;` plus a visible `:hover`, `:active`, `:disabled`, and `:focus-visible` state.
- `.btn-danger` is standardized to solid (not the soft/pink style some files used) per explicit user decision.
- No JSX restructuring — only CSS rule deletions and a small number of one-line className edits.
- Verify with `npx tsc --noEmit` in `Frontend/` after every task, plus a manual browser pass per the final task.

---

### Task 1: Add canonical button CSS to `S_Theme.tsx`

**Files:**
- Modify: `Frontend/src/components/S_Theme.tsx:187-194` (light-mode `/* ===== BUTTONS ===== */` block)
- Modify: `Frontend/src/components/S_Theme.tsx:430-432` (delete redundant early dark-mode `.btn-ghost` duplicate)
- Modify: `Frontend/src/components/S_Theme.tsx:496-526` (dark-mode `/* ─── Buttons ─── */` block — rename `.btn-delete`→`.btn-danger`, add `.btn-success`/`.btn-warning` dark variants, add `.btn-link:hover`)
- Modify: `Frontend/src/components/S_Theme.tsx:540` (add `.close-btn:hover` dark rule next to existing `.close-btn`)

**Interfaces:**
- Produces: the canonical classes every later task relies on — `.btn`, `.btn-primary` (alias), `.btn-secondary`, `.btn-ghost`, `.btn-outline`, `.btn-success`, `.btn-danger`, `.btn-warning`, `.action-btn`, `.btn-copy`, `.close-btn`, `.btn-link`. Each is fully self-contained (geometry + skin + hover + active + disabled + focus-visible).

- [ ] **Step 1: Replace the light-mode buttons block**

In `Frontend/src/components/S_Theme.tsx`, find this exact text (lines 187-194):

```
  /* ===== BUTTONS ===== */
  .btn {
    height: 44px; border: 0; border-radius: 12px;
    background: var(--ios-blue); color: #fff; font-weight: 800;
    padding: 0 16px; cursor: pointer;
    box-shadow: 0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  .btn:disabled { filter: grayscale(.1) brightness(.95); opacity: .9; }
```

Replace it with:

```
  /* ===== BUTTONS =====
     Shared geometry across every variant (normalizes the previous 8px/12px radius split) */
  .btn, .btn-primary,
  .btn-secondary, .btn-ghost, .btn-outline,
  .btn-success, .btn-danger, .btn-warning,
  .action-btn, .btn-copy, .close-btn {
    height: 44px; border-radius: 10px;
    padding: 0 16px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    cursor: pointer; white-space: nowrap;
    transition: filter .15s, background-color .15s, border-color .15s, transform .05s;
  }
  .btn:disabled, .btn-primary:disabled,
  .btn-secondary:disabled, .btn-ghost:disabled, .btn-outline:disabled,
  .btn-success:disabled, .btn-danger:disabled, .btn-warning:disabled,
  .action-btn:disabled, .btn-copy:disabled, .close-btn:disabled {
    opacity: .6; cursor: not-allowed; filter: none !important; pointer-events: none;
  }
  .btn:focus-visible, .btn-primary:focus-visible,
  .btn-secondary:focus-visible, .btn-ghost:focus-visible, .btn-outline:focus-visible,
  .btn-success:focus-visible, .btn-danger:focus-visible, .btn-warning:focus-visible,
  .action-btn:focus-visible, .btn-copy:focus-visible, .close-btn:focus-visible,
  .btn-ico:focus-visible, .btn-link:focus-visible {
    outline: 2px solid var(--ios-blue); outline-offset: 2px;
  }

  /* ── Primary (solid brand blue) ── */
  .btn, .btn-primary {
    border: 0; background: var(--ios-blue); color: #fff; font-weight: 800;
    box-shadow: 0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  .btn:hover, .btn-primary:hover { filter: brightness(.92); }
  .btn:active, .btn-primary:active { filter: brightness(.85); }

  /* ── Secondary (outlined, white bg — the "ปุ่มกรอบสี พื้นหลังขาว" style) ── */
  .btn-secondary { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
  .btn-secondary:hover { background: #f1f5f9; }
  .btn-secondary:active { transform: scale(.98); }

  /* ── Ghost (minimal, no visible border at rest) ── */
  .btn-ghost { background: transparent; color: #475569; border: 1px solid transparent; }
  .btn-ghost:hover { background: #f1f5f9; }
  .btn-ghost:active { transform: scale(.98); }

  /* ── Outline (brand-colored border, used in letter/issue modals) ── */
  .btn-outline { background: #fff; color: var(--ios-blue); border: 1px solid var(--ios-blue); }
  .btn-outline:hover { background: rgba(10,132,255,.08); }
  .btn-outline:active { transform: scale(.98); }

  /* ── Success (solid green — approve actions) ── */
  .btn-success { background: #10b981; color: #fff; border: 0; }
  .btn-success:hover { filter: brightness(.92); }
  .btn-success:active { filter: brightness(.85); }

  /* ── Danger (solid red — reject/delete actions; absorbs old .btn-delete) ── */
  .btn-danger { background: #dc2626; color: #fff; border: 0; }
  .btn-danger:hover { filter: brightness(.92); }
  .btn-danger:active { filter: brightness(.85); }

  /* ── Warning (solid amber — pending/send-back actions; new, no prior class existed) ── */
  .btn-warning { background: #f59e0b; color: #fff; border: 0; }
  .btn-warning:hover { filter: brightness(.92); }
  .btn-warning:active { filter: brightness(.85); }

  /* ── Generic outlined action button (identical skin to secondary) ── */
  .action-btn { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
  .action-btn:hover { background: #f1f5f9; }
  .action-btn:active { transform: scale(.98); }

  /* ── Copy-to-clipboard utility button ── */
  .btn-copy { background: #e2e8f0; color: #334155; border: none; }
  .btn-copy:hover { background: #cbd5e1; }
  .btn-copy.copied { background: #d1fae5; color: #065f46; }

  /* ── Circular icon-style close button (✕) ── */
  .close-btn { background: #f1f5f9; border: none; border-radius: 50%; color: #64748b; }
  .close-btn:hover { background: #e2e8f0; }

  /* ── Inline text-style link action (not a full tap target by design) ── */
  .btn-link {
    background: none; border: none; color: var(--ios-blue);
    height: auto; min-height: 32px; padding: 0 4px; font-weight: 700; cursor: pointer;
    transition: text-decoration-color .15s;
  }
  .btn-link:hover { text-decoration: underline; }
  .btn-link:disabled { opacity: .6; cursor: not-allowed; text-decoration: none; }
```

- [ ] **Step 2: Delete the redundant early dark-mode `.btn-ghost` duplicate**

In the same file, find this exact text (currently around lines 430-432, in the "10. BUTTONS AND GHOST" section):

```
  /* 10. BUTTONS AND GHOST */
  [data-theme="dark"] .btn-ghost { background: #1e293b !important; color: #e2e8f0 !important; border-color: #475569 !important; }
  [data-theme="dark"] .btn-ghost:hover { background: #334155 !important; }
```

Replace it with just the section comment (the rule is redundant — section 13 below already defines `.btn-ghost` for dark mode):

```
  /* 10. BUTTONS AND GHOST — see section 13 "─── Buttons ───" below for the canonical dark-mode button rules */
```

- [ ] **Step 3: Update the dark-mode buttons section**

Find this exact text (in section 13, "─── Buttons ───"):

```
  [data-theme="dark"] .action-btn:hover { background: #334155 !important; }
  [data-theme="dark"] .btn-delete {
    background: rgba(220,38,38,.2) !important;
    border-color: rgba(220,38,38,.4) !important;
    color: #fca5a5 !important;
  }
  [data-theme="dark"] .btn-link { color: #60a5fa !important; }
```

Replace it with:

```
  [data-theme="dark"] .action-btn:hover { background: #334155 !important; }
  [data-theme="dark"] .btn-success { background: #059669 !important; color: #fff !important; }
  [data-theme="dark"] .btn-success:hover { filter: brightness(1.1) !important; }
  [data-theme="dark"] .btn-danger { background: #b91c1c !important; color: #fff !important; }
  [data-theme="dark"] .btn-danger:hover { filter: brightness(1.15) !important; }
  [data-theme="dark"] .btn-warning { background: #b45309 !important; color: #fff !important; }
  [data-theme="dark"] .btn-warning:hover { filter: brightness(1.15) !important; }
  [data-theme="dark"] .btn-link { color: #60a5fa !important; }
  [data-theme="dark"] .btn-link:hover { text-decoration: underline; }
```

- [ ] **Step 4: Add a dark-mode hover rule for `.close-btn`**

Find this exact text:

```
  [data-theme="dark"] .close-btn { background: #334155 !important; color: #94a3b8 !important; }
```

Replace it with:

```
  [data-theme="dark"] .close-btn { background: #334155 !important; color: #94a3b8 !important; }
  [data-theme="dark"] .close-btn:hover { background: #475569 !important; }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0 (this is a template-literal string change, so compilation should be unaffected, but confirms no stray syntax error broke the file).

- [ ] **Step 6: Manual visual spot-check**

Start the dev server if not already running (`run-dev` skill), open `http://localhost:5173` in a browser, log in as any role, and confirm: primary buttons still look the same (solid blue) but now visibly darken on hover; any visible `.btn-secondary`/`.btn-ghost` button on that page now shows a light-grey hover fill.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/components/S_Theme.tsx
git commit -m "feat: เพิ่ม canonical button CSS (hover/active/disabled/focus) ใน S_Theme.tsx"
```

---

### Task 2: Delete duplicate button CSS — student-role and shared modal files

**Files (each: read first to confirm current line numbers, then delete only the named selectors from the existing `<style>{...}</style>` block — leave every other rule in that block untouched):**

- `Frontend/src/components/S_Gateway.tsx` (~line 585 `.btn`, plus `.btn-delete`, `.btn-delete:hover`, `.btn-link`, `.btn-link:hover`, `.btn-success`, `.btn-success:hover`, `.btn-secondary`, `.btn-secondary:hover` in the same block) — delete all of these. Keep `.input`, `.input:focus`, `.file-list`, `.file-item`, `.action-row`, `.modal-backdrop`, `.modal-card`.
- `Frontend/src/components/LetterModalShared.tsx` (~line 34 `.btn`, plus `.btn-secondary`, `.btn-outline`, `.btn-success` in the same block) — delete all of these. Keep `.input`, `.modal-backdrop`, `.modal-card`, the media query.
- `Frontend/src/components/S_ProfilePage.tsx` (~lines 719-722: `.btn`, `.btn:hover`, `.btn-secondary`, `.btn-secondary:hover`) — delete all four.
- `Frontend/src/components/S_Supervision.tsx` (~lines 488-497: `.btn`, `.btn:hover:not(:disabled)`, `.btn:disabled`, `.btn-primary`, `.btn-secondary`, `.btn-secondary:hover`) — delete all of these. Keep `.card`, `.input`, `.input:focus`, `.input:disabled`.
- `Frontend/src/components/S_Docs.tsx` (~lines 639-643: `.btn-primary`, `.btn-primary:hover`, `.btn-secondary`, `.btn-secondary:hover` — no bare `.btn` in this file) — delete all four. Leave `.btn-close`/`.btn-close:hover` untouched (different class, not part of this unification).
- `Frontend/src/components/S_Company.tsx` (~lines 225-244: `.btn-primary`, `.btn-primary:hover`, `.btn-copy`, `.btn-copy:hover`, `.btn-copy.copied`, plus a separate `.btn-danger` rule elsewhere in the same style block — grep within the file for `.btn-danger` if not immediately visible) — delete all of these.
- `Frontend/src/components/S_DocT007.tsx` (~lines 130-149: `.btn`, `.btn-primary`, `.btn-primary:hover`, `.btn-copy`, `.btn-copy:hover`, `.btn-copy.copied`) — delete all of these. Keep `.content h4`/`.content p`, `.url-container`, `.url-text`.
- `Frontend/src/components/S_DocT008.tsx` (~lines 138-146: `.btn`, `.btn:hover`, `.btn-copy`, `.btn-copy:hover`, `.btn-copy.copied`) — delete all of these. Keep `.content h4`/`.content p`, `.url-container`, `.url-text`.
- `Frontend/src/components/S_DocT005_006.tsx` (find and delete the local `.btn-copy`, `.btn-copy:hover`, `.btn-copy.copied` rule — this is the student doc-t005-006 page, distinct from `A_DocT005_006.tsx` which is handled in Task 4).
- `Frontend/src/components/S_DocsT002Form.tsx` (find and delete the local `.btn-outline`, `.btn-outline:hover` rule).
- `Frontend/src/components/S_DocsT003Form.tsx` (find and delete the local `.btn-outline`, `.btn-outline:hover` rule).
- `Frontend/src/components/S_Dashboard.tsx` (find and delete the local `.close-btn` rule — confirm no `.close-btn:hover` exists locally; if it does, delete that too).
- Files matching `Frontend/src/components/Issue*LetterModal.tsx` (3 files — run `ls Frontend/src/components/Issue*LetterModal.tsx` to list them) — each defines a local `.btn-outline`, `.btn-outline:hover` rule; delete it from each.
- `Frontend/src/components/loginpage.tsx` (~lines 532-533: `.btn`, `.btn:disabled`) — delete both. Keep `.label`, `.input`, `.input:focus`, `.remember`, `.alert`, `.footnote`, the media queries.

**Interfaces:**
- Consumes: the canonical classes produced by Task 1 — no JSX className changes in this task (every file already references the right name).

- [ ] **Step 1: Delete the duplicate rules listed above, file by file**

For each file, Read it, locate the `<style>{...}</style>` block, and remove exactly the selectors named above (and their immediate `:hover`/`:disabled`/`.copied` sub-rules where listed) using the Edit tool. Do not touch any other CSS in the same block.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0.

- [ ] **Step 3: Manual visual spot-check**

In the browser, log in as a student, visit `/student/gateway` (uses `S_Gateway.tsx`) and `/student/profile` (uses `S_ProfilePage.tsx`). Confirm buttons still render with the correct color/skin (now coming from `S_Theme.tsx`) and that hovering shows a visible background change.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/S_Gateway.tsx Frontend/src/components/LetterModalShared.tsx Frontend/src/components/S_ProfilePage.tsx Frontend/src/components/S_Supervision.tsx Frontend/src/components/S_Docs.tsx Frontend/src/components/S_Company.tsx Frontend/src/components/S_DocT007.tsx Frontend/src/components/S_DocT008.tsx Frontend/src/components/S_DocT005_006.tsx Frontend/src/components/S_DocsT002Form.tsx Frontend/src/components/S_DocsT003Form.tsx Frontend/src/components/S_Dashboard.tsx Frontend/src/components/Issue*LetterModal.tsx Frontend/src/components/loginpage.tsx
git commit -m "refactor: ลบ CSS ปุ่มที่ซ้ำซ้อนในไฟล์ฝั่งนักศึกษา (ใช้ S_Theme.tsx เป็น single source)"
```

---

### Task 3: Delete duplicate button CSS — teacher-role files, plus semantic-class swap in `T_Requests.tsx`

**Files:**
- `Frontend/src/components/T_Profile.tsx` (~lines 290-306: `.btn`, `.btn:hover`, `.btn-secondary`, `.btn-secondary:hover`) — delete all four. Keep `.info-grid-single`, `.info-row`, `.label`, `.value`, `.email-pill`, `.input`, `.input:focus`, `.form-grid`, `.action-row`, `.modal-backdrop`, `.modal-card`.
- `Frontend/src/components/T_Requests.tsx` (~lines 366-374: `.btn`, `.btn:hover:not(:disabled)`, `.btn-ghost`, `.btn-ghost:hover:not(:disabled)`) — delete all four. Keep `.input`, `.input:focus`, `.modal-backdrop`, `.modal-card-split`, the media query.
- `Frontend/src/components/T_SupervisionReview.tsx` (~lines 527-535: `.btn`, `.btn:hover:not(:disabled)`, `.btn:disabled`, `.btn-ghost`, `.btn-ghost:hover`) — delete all five.
- `Frontend/src/components/T_Students.tsx` (find and delete the local `.btn-ghost`, `.btn-ghost:hover` rule — no bare `.btn` in this file).
- `Frontend/src/components/T_StudentDetail.tsx` (~lines 415-420: `.btn-primary`, `.btn-primary:hover`, `.btn-ghost`, `.btn-ghost:hover`, `.btn-danger`, `.btn-danger:hover`) — delete all six.

**Interfaces:**
- Consumes: canonical classes from Task 1.
- Produces: nothing new — this task's `T_Requests.tsx` className swap is consumed only by itself (no other task depends on it).

- [ ] **Step 1: Delete duplicate rules**

Same procedure as Task 2 Step 1, applied to the files above.

- [ ] **Step 2: Replace inline color overrides with semantic classes in `T_Requests.tsx`**

In `Frontend/src/components/T_Requests.tsx`, find the three approve/send-back/reject buttons (originally around lines 337-340 per the design audit — confirm exact location by reading the file, search for `style={{background:`):

```tsx
<button className="btn" style={{ background: '#10b981' }} ...>...</button>
...
<button className="btn" style={{ background: '#f59e0b' }} ...>...</button>
...
<button className="btn" style={{ background: '#ef4444' }} ...>...</button>
```

Replace each with the matching semantic class and drop the inline `style` override entirely:

```tsx
<button className="btn-success" ...>...</button>
...
<button className="btn-warning" ...>...</button>
...
<button className="btn-danger" ...>...</button>
```

(Keep every other prop — `onClick`, `disabled`, children, etc. — exactly as-is; only the `className` and `style` attributes change.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0.

- [ ] **Step 4: Manual visual spot-check**

Log in as a teacher, visit `/teacher/requests`. Confirm the approve button is solid green, the send-back button is solid amber, the reject button is solid red, and all three show a visible darken-on-hover.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/T_Profile.tsx Frontend/src/components/T_Requests.tsx Frontend/src/components/T_SupervisionReview.tsx Frontend/src/components/T_Students.tsx Frontend/src/components/T_StudentDetail.tsx
git commit -m "refactor: ลบ CSS ปุ่มที่ซ้ำซ้อนในไฟล์ฝั่งอาจารย์ และเปลี่ยนปุ่มอนุมัติ/ส่งกลับ/ปฏิเสธใน T_Requests.tsx ให้ใช้ class ความหมาย"
```

---

### Task 4: Delete duplicate button CSS — admin-role files

**Files:**
- `Frontend/src/components/A_DocT003Review.tsx` (~lines 443-453: `.btn`, `.btn:hover:not(:disabled)`, `.btn-ghost`, `.btn-ghost:hover:not(:disabled)`) — delete all four.
- `Frontend/src/components/A_DocT002Review.tsx` (~lines 426-435: same four selectors) — delete all four.
- `Frontend/src/components/A_CoopPeriod.tsx` (~lines 239-242: `.btn`, `.btn:hover`) — delete both. Keep `.input`, `.input:focus`.
- `Frontend/src/components/A_DocRequirements.tsx` (~lines 181-186: `.btn`, `.btn:hover`, `.btn-ghost`, `.btn-ghost:hover`) — delete all four.
- `Frontend/src/components/A_DocT000.tsx` (~lines 620-626: `.btn`, `.btn:hover`) — delete both. Also find and delete the separate `.action-btn` rule used elsewhere in this same file (grep within the file for `.action-btn`).
- `Frontend/src/components/A_CoopApplications.tsx` (~lines 392-399: `.btn`, `.btn:hover:not(:disabled)`, `.btn-ghost`, `.btn-ghost:hover:not(:disabled)`) — delete all four.
- `Frontend/src/components/A_SupervisionManage.tsx` (~lines 572-584: `.btn`, `.btn:hover:not(:disabled)`, `.btn:disabled`, `.btn-ghost`, `.btn-ghost:hover`) — delete all five.
- `Frontend/src/components/A_Settings.tsx` (~lines 261-262: `.btn`, `.btn:hover`) — delete both. Keep `.card`, `.input-text`, `.input-text:focus`.
- `Frontend/src/components/A_CriteriaPage.tsx` (~lines 117-122: `.btn`, `.btn:hover`, `.btn-ghost`, `.btn-ghost:hover`) — delete all four.
- `Frontend/src/components/A_DocT007.tsx` (~lines 107-113: `.btn`, `.btn:disabled`, `.btn-primary`, `.btn-primary:hover:not(:disabled)`) — delete all four.
- `Frontend/src/components/A_DocT008.tsx` (~lines 156-162: same four selectors) — delete all four.
- `Frontend/src/components/A_DocT005_006.tsx` (~lines 132-138: same four selectors) — delete all four.
- `Frontend/src/components/A_Company.tsx` (find and delete the local `.btn-secondary` and `.btn-danger` rules, plus their `:hover` sub-rules).

**Interfaces:**
- Consumes: canonical classes from Task 1.

- [ ] **Step 1: Delete duplicate rules**

Same procedure as Task 2 Step 1, applied to the files above.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0.

- [ ] **Step 3: Manual visual spot-check**

Log in as staff, visit `/admin/coop-applications` and `/admin/company`. Confirm buttons render correctly and show a visible hover state.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/A_DocT003Review.tsx Frontend/src/components/A_DocT002Review.tsx Frontend/src/components/A_CoopPeriod.tsx Frontend/src/components/A_DocRequirements.tsx Frontend/src/components/A_DocT000.tsx Frontend/src/components/A_CoopApplications.tsx Frontend/src/components/A_SupervisionManage.tsx Frontend/src/components/A_Settings.tsx Frontend/src/components/A_CriteriaPage.tsx Frontend/src/components/A_DocT007.tsx Frontend/src/components/A_DocT008.tsx Frontend/src/components/A_DocT005_006.tsx Frontend/src/components/A_Company.tsx
git commit -m "refactor: ลบ CSS ปุ่มที่ซ้ำซ้อนในไฟล์ฝั่งเจ้าหน้าที่/แอดมิน"
```

---

### Task 5: Add real classes to currently classless shared buttons, and rename `btn-delete` → `btn-danger` usages

**Files:**
- `Frontend/src/components/S_Gateway.tsx` — rename the 4 occurrences of `className="btn-delete"` to `className="btn-danger"` (the local `.btn-delete` CSS rule was already deleted in Task 2; this JSX rename makes those buttons pick up the canonical `.btn-danger` from `S_Theme.tsx`).
- `Frontend/src/components/ConfirmDialog.tsx` — cancel button (currently raw inline `style={{border:'1px solid var(--border,...)', background:'var(--hover-bg,#f3f4f6)'}}`, no hover): remove the inline `style` object, add `className="btn-secondary"`. Confirm button (currently raw inline `style={{background: confirmColor}}`, no hover, where `confirmColor` is a prop): remove the inline `style`, and set `className` conditionally — if the component's `confirmColor` prop is a red/danger-ish value use `className="btn-danger"`, otherwise `className="btn-success"` (read the component's prop usage to confirm which call sites pass which intent before deciding).
- `Frontend/src/components/NotificationBell.tsx` — add `className="btn-ico"` to the bell `<button>`, remove the now-redundant inline `background:'none', border:'none'` (keep any inline color-by-count logic that isn't about background/border).
- `Frontend/src/components/Toast.tsx` — add `className="close-btn"` to the dismiss `<button>`, remove its inline background/border style.
- `Frontend/src/components/StatusFilterChips.tsx` — add `className="btn-ghost"` to each chip `<button>` (read the file first — if chips already use inline `style` for the *selected* state's color, keep that conditional logic and only add `btn-ghost` for the unselected/default look, so the existing selected-state visual isn't lost).

**Interfaces:**
- Consumes: canonical classes from Task 1, and the `.btn-danger` rename target this task itself performs in `S_Gateway.tsx`.

- [ ] **Step 1: Rename `btn-delete` → `btn-danger` in `S_Gateway.tsx`**

Read the file, find all 4 occurrences of `className="btn-delete"` (or `className={...btn-delete...}` if templated), replace with `className="btn-danger"`.

- [ ] **Step 2: Add classes to `ConfirmDialog.tsx`**

Read the file fully first to see how `confirmColor` is used by callers, then make the edits described above.

- [ ] **Step 3: Add classes to `NotificationBell.tsx`, `Toast.tsx`, `StatusFilterChips.tsx`**

Read each file, make the edits described above.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0.

- [ ] **Step 5: Manual visual spot-check**

Trigger a confirm dialog (e.g. a delete action anywhere in the admin pages), trigger a toast (e.g. save an edit), and check the notification bell — confirm all three now show a visible hover state where they previously had none.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/S_Gateway.tsx Frontend/src/components/ConfirmDialog.tsx Frontend/src/components/NotificationBell.tsx Frontend/src/components/Toast.tsx Frontend/src/components/StatusFilterChips.tsx
git commit -m "feat: เพิ่ม class ปุ่มให้ ConfirmDialog/NotificationBell/Toast/StatusFilterChips ที่ไม่มี hover state มาก่อน"
```

---

### Task 6: Final sweep for missed inline overrides, and full cross-role verification

**Files:**
- Any file discovered by the grep in Step 1 below (not knowable in advance — this step exists specifically to catch what the prior audits missed).

**Interfaces:**
- Consumes: the complete canonical class set from Task 1.

- [ ] **Step 1: Grep for remaining semantic-color inline overrides on buttons**

Run from `Frontend/`:
```bash
grep -rn "style={{.*background.*#10b981\|style={{.*background.*#f59e0b\|style={{.*background.*#ef4444\|style={{.*background.*#dc2626" src/components/
```
For each match found (besides the ones already handled in Task 3), open the file, confirm it's a button standing in for an approve/warning/reject action, and swap to the matching `btn-success`/`btn-warning`/`btn-danger` class, dropping the inline override — same pattern as Task 3 Step 2. If a match is a genuinely bespoke accent color with no semantic meaning (e.g. a one-off purple), leave it as-is.

- [ ] **Step 2: Grep for any remaining local `.btn`-family CSS rule definitions**

Run from `Frontend/`:
```bash
grep -rln "\.btn\(-secondary\|-ghost\|-outline\|-success\|-danger\|-warning\|-primary\|-copy\)\? *{" src/components/ | grep -v S_Theme.tsx
```
Any file listed here besides the ones already cleaned up in Tasks 2-4 still has a duplicate local definition — delete it the same way as before.

- [ ] **Step 3: Full TypeScript check**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no output / exit code 0.

- [ ] **Step 4: Full browser verification — light mode**

Start the dev server (`run-dev` skill if not already running). For each role (student, teacher, admin), log in and visit at least one page with each button variant present: primary, secondary, ghost, danger, success, warning, icon-only. For every button: hover and confirm a visible background/brightness change; confirm any `disabled` button shows no hover effect; confirm focus via Tab key shows a visible outline.

- [ ] **Step 5: Full browser verification — dark mode**

Toggle dark mode (the moon/sun icon button) and repeat Step 4's checks on the same pages — confirm every variant still has correct colors and a visible hover state in dark mode.

- [ ] **Step 6: Commit any final fixes found in Steps 1-2**

```bash
git add Frontend/src/components/
git commit -m "fix: ปิดช่องโหว่ปุ่มที่ยังหลงเหลือ inline override หรือ CSS ซ้ำ จากการ sweep รอบสุดท้าย"
```
(Skip this step entirely if Steps 1-2 found nothing to fix.)
