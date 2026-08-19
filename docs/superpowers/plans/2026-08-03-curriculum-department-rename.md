# Curriculum/Department Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all "สาขาวิชา" (major/department codes CS/IT/AI/CYB/GIS) references throughout the system with "หลักสูตร" (curriculum), using the already-existing `studyProgram` field (`normal`/`special` = ภาคปกติ/ภาคพิเศษ) as the canonical value.

**Architecture:** The DB already has `Student.studyProgram (StudyProgram? enum normal|special)` that captures ภาคปกติ/ภาคพิเศษ. The `Student.major` field (CS/IT/AI/CYB/GIS) is deprecated as a display/input field — kept in DB for historical records but no longer shown or edited. Every UI touch-point that showed "สาขาวิชา" + dept code now shows "หลักสูตร" + ภาคปกติ/ภาคพิเศษ from `studyProgram`. No schema migration is needed.

**Tech Stack:** React 19 + TypeScript (Frontend), Express + Prisma + MySQL (Backend)

## Global Constraints

- **No DB migration required** — `Student.major` stays in schema (historical data), `Student.studyProgram` enum `normal|special` already exists
- **Canonical display map:** `{ normal: "ภาคปกติ", special: "ภาคพิเศษ" }` — use this exact dict everywhere; name the const `CURRICULUM_TH`
- **Label:** "หลักสูตร" everywhere (not "ภาคการศึกษา", not "รูปแบบการศึกษา", not "หลักสูตร/ภาคการศึกษา")
- **No new API endpoints** — use existing `/api/students`, `/api/teacher`, etc.
- **TypeScript strict mode** — `noUnusedLocals: true`; remove unused variables or the build fails
- **Run `npx tsc --noEmit` from `Frontend/` after every task** before committing; fix all errors before proceeding
- **CHANGELOG.md** must be updated in the final task

---

## Files Modified

| File | Change |
|------|--------|
| `Frontend/src/components/A_Students.tsx` | Remove major filter/column/detail row; remove `dynamicMajors` fetch |
| `Frontend/src/components/A_StudentEditModal.tsx` | Remove `major` form field and `majors` prop |
| `Frontend/src/components/S_ProfilePage.tsx` | Replace "สาขาวิชา" view row + edit select with "หลักสูตร" (studyProgram) |
| `Frontend/src/components/S_Gateway.tsx` | Change "สาขาวิชา:" → "หลักสูตร:" showing studyProgram |
| `Frontend/src/components/T_Students.tsx` | Replace major filter/column with studyProgram curriculum filter/column |
| `Frontend/src/components/T_StudentDetail.tsx` | Swap "สาขาวิชา" row with "หลักสูตร" (studyProgram); remove "รูปแบบการศึกษา" row |
| `Frontend/src/components/A_Teacher.tsx` | Replace MAJOR_TH dict + filter with CURRICULUM_TH; update form options |
| `Frontend/src/components/T_Profile.tsx` | Replace "สาขาวิชา" select (dynamic from DB) with hardcoded ภาคปกติ/ภาคพิเศษ |
| `Frontend/src/components/A_CriteriaPage.tsx` | Replace active management UI with deprecation notice |
| `backend/controllers/studentImportController.js` | Remove major column processing; set `major: null` in upserts |
| `CHANGELOG.md` | Add entry for this change |

---

## Task 1: Admin Student List — A_Students.tsx + A_StudentEditModal.tsx

**Files:**
- Modify: `Frontend/src/components/A_Students.tsx`
- Modify: `Frontend/src/components/A_StudentEditModal.tsx`

**What changes in A_Students.tsx:**
1. Remove `LEGACY_MAJOR_TH` const (~line 86–90)
2. Remove `dynamicMajors` state (~line 135)
3. Remove `filterMajors` state and remove `setFilterMajors([])` from `resetFilters` (~lines 140, 248)
4. Remove the majors fetch block inside `fetchData` (~lines 200–212, the `resMajors` block)
5. Remove the `<FilterBox title="สาขาวิชา" ...>` JSX block (~lines 408–413)
6. Remove `"สาขา"` entry from the table headers array (currently 7 columns → 6)
7. Adjust `colSpan` on the empty-state `<td>` from `7` → `6` (~line 442)
8. Remove `<td style={td} data-label="สาขา">` table cell in `filtered.map` (~line 455)
9. In the student detail panel: remove `<InfoRow label="สาขาวิชา" ...>` row (~line 618)
10. Remove the `majors={dynamicMajors}` prop on `<A_StudentEditModal>` usage

**What changes in A_StudentEditModal.tsx:**
1. Remove `majors: Record<string, string>;` from the `Props` interface (~line 18)
2. Remove `majors` from the function parameters destructuring
3. Remove `major: student.major ?? "",` from the initial `form` state (~line 31)
4. Remove the entire `<Field label="สาขาวิชา">` block including its `<select>` (~lines 115–120)

- [ ] **Step 1: Edit A_Students.tsx — remove LEGACY_MAJOR_TH**

Delete these lines in `Frontend/src/components/A_Students.tsx`:
```ts
// เก็บไว้เผื่อเป็น Fallback สำหรับข้อมูลเก่าในระบบ
const LEGACY_MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};
```

- [ ] **Step 2: Edit A_Students.tsx — remove dynamicMajors state and filterMajors state**

Remove these two state declarations:
```ts
const [dynamicMajors, setDynamicMajors] = useState<Record<string, string>>({});
```
```ts
const [filterMajors, setFilterMajors] = useState<string[]>([]);
```

- [ ] **Step 3: Edit A_Students.tsx — remove majors fetch block**

Inside `fetchData`, remove this entire block (keep the rest of fetchData):
```ts
const resMajors = await fetch("/api/admin/majors", {
  headers: { Authorization: `Bearer ${token}` }
});
if (resMajors.ok) {
  const dataMajors = await resMajors.json();
  if (dataMajors.ok) {
    const majorDict: Record<string, string> = { ...LEGACY_MAJOR_TH };
    dataMajors.majors.forEach((m: string) => {
      majorDict[m] = m;
    });
    setDynamicMajors(majorDict);
  }
}
```

- [ ] **Step 4: Edit A_Students.tsx — remove filterMajors from resetFilters and filtered useMemo**

In `resetFilters`, remove:
```ts
setFilterMajors([]);
```

In `filtered` useMemo, remove this condition line (keep the `&&` for the remaining conditions):
```ts
(filterMajors.length === 0 || filterMajors.includes(s.major ?? "")) &&
```

Also remove `filterMajors` from the useMemo dependency array: change `[items, filterMajors, filterCurriculums, filterStatuses]` → `[items, filterCurriculums, filterStatuses]`

- [ ] **Step 5: Edit A_Students.tsx — remove FilterBox for สาขาวิชา**

Remove this JSX block:
```tsx
<FilterBox
  title="สาขาวิชา"
  items={Object.keys(dynamicMajors).length > 0 ? dynamicMajors : LEGACY_MAJOR_TH}
  values={filterMajors}
  onChange={setFilterMajors}
/>
```

- [ ] **Step 6: Edit A_Students.tsx — remove สาขา column from table**

In the table headers array, remove `"สาขา"`:
```ts
// Before:
{["รหัส", "ชื่อ–นามสกุล", "อีเมล", "สาขา", "หลักสูตร", "สถานะ", "รายละเอียด"].map(...)}

// After:
{["รหัส", "ชื่อ–นามสกุล", "อีเมล", "หลักสูตร", "สถานะ", "รายละเอียด"].map(...)}
```

Change empty-state `<td colSpan={7}` → `<td colSpan={6}`.

Remove the data cell:
```tsx
<td style={td} data-label="สาขา">{LEGACY_MAJOR_TH[s.major ?? ""] ?? s.major ?? "-"}</td>
```

- [ ] **Step 7: Edit A_Students.tsx — remove สาขาวิชา InfoRow from detail panel**

In the student detail modal/panel, remove:
```tsx
<InfoRow label="สาขาวิชา" value={LEGACY_MAJOR_TH[student.major || ""] || student.major} />
```
The `<InfoRow label="หลักสูตร" ...>` row immediately below it stays as-is.

- [ ] **Step 8: Edit A_Students.tsx — remove majors prop from A_StudentEditModal usage**

Find where `<A_StudentEditModal>` is rendered and remove the `majors={dynamicMajors}` prop:
```tsx
// Before:
<A_StudentEditModal student={editStudent} majors={dynamicMajors} onClose={...} onSaved={...} />

// After:
<A_StudentEditModal student={editStudent} onClose={...} onSaved={...} />
```

- [ ] **Step 9: Edit A_StudentEditModal.tsx — remove majors prop and major form field**

Remove `majors: Record<string, string>;` from Props interface.

Remove `majors` from the function destructuring parameter.

Remove `major: student.major ?? "",` from the initial form state object.

Remove the Field block:
```tsx
<Field label="สาขาวิชา">
  <select style={input} value={form.major} onChange={e => update("major", e.target.value)}>
    <option value="">-</option>
    {Object.keys(majors).map(m => <option key={m} value={m}>{majors[m]}</option>)}
  </select>
</Field>
```

- [ ] **Step 10: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```
Expected: no output (zero errors). Fix any errors before proceeding.

- [ ] **Step 11: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/A_Students.tsx Frontend/src/components/A_StudentEditModal.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: admin student list — remove สาขาวิชา(major), standardize หลักสูตร(studyProgram)"
```

---

## Task 2: Student Self-Profile — S_ProfilePage.tsx + S_Gateway.tsx

**Files:**
- Modify: `Frontend/src/components/S_ProfilePage.tsx`
- Modify: `Frontend/src/components/S_Gateway.tsx`

**What changes in S_ProfilePage.tsx:**
- **View mode:** Remove the `<Info label="สาขาวิชา" value={profile.major || "-"} />` row. Change `<Info label="รูปแบบการศึกษา" ...>` label to `"หลักสูตร"`.
- **Edit mode:** Remove the "สาขาวิชา" `<select>` div entirely. Change label `"รูปแบบการศึกษา"` → `"หลักสูตร"`. Remove `major` from edit form state (`form.major`). Remove `majorOptions` state and its fetch if it becomes unused after this removal.

**What changes in S_Gateway.tsx:**
- Change `<span className="label">สาขาวิชา:</span>` → `<span className="label">หลักสูตร:</span>`
- Change the value from `{profile.major || "-"}` to a studyProgram display using a local mapping object.

- [ ] **Step 1: Edit S_ProfilePage.tsx — view mode label changes**

Find and remove this line in view mode section (roughly line 390):
```tsx
<Info label="สาขาวิชา" value={profile.major || "-"} />
```

Change the next line's label from `"รูปแบบการศึกษา"` to `"หลักสูตร"`:
```tsx
// Before:
<Info label="รูปแบบการศึกษา" value={studyProgramMapToUI[profile.studyProgram as string] || profile.studyProgram || "-"} />

// After:
<Info label="หลักสูตร" value={studyProgramMapToUI[profile.studyProgram as string] || profile.studyProgram || "-"} />
```

- [ ] **Step 2: Edit S_ProfilePage.tsx — remove สาขาวิชา edit select**

In the edit mode section (~line 562–568), remove this entire div block:
```tsx
<div>
  <label className="label">สาขาวิชา</label>
  <select className="input" value={form.major || ""} onChange={(e) => setForm({ ...form, major: e.target.value })}>
    <option value="">-- เลือกสาขาวิชา --</option>
    {majorOptions.map((major) => (<option key={major} value={major}>{major}</option>))}
  </select>
</div>
```

- [ ] **Step 3: Edit S_ProfilePage.tsx — rename รูปแบบการศึกษา in edit mode**

Change the remaining studyProgram edit label (~line 571):
```tsx
// Before:
<label className="label">รูปแบบการศึกษา</label>

// After:
<label className="label">หลักสูตร</label>
```

- [ ] **Step 4: Edit S_ProfilePage.tsx — remove unused major state and majorOptions**

Remove `major: form.major` from the form state (or the entire `major` key) in the `form` state object, since we removed the UI that drives it.

Check if `majorOptions` state and its fetch call are now unreferenced. If so, remove:
- The `majorOptions` state declaration
- The `useEffect` or fetch call that populates `majorOptions`
- Any import of it if applicable

- [ ] **Step 5: Edit S_Gateway.tsx — replace สาขาวิชา with หลักสูตร**

Near the top of the file (before the component), add:
```ts
const CURRICULUM_DISPLAY: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
  ภาคปกติ: "ภาคปกติ",
  ภาคพิเศษ: "ภาคพิเศษ",
};
```

Find (~line 392):
```tsx
<div className="info-row"><span className="label">สาขาวิชา:</span><span className="value">{profile.major || "-"} (ปี {profile.year || "-"})</span></div>
```
Replace with:
```tsx
<div className="info-row"><span className="label">หลักสูตร:</span><span className="value">{CURRICULUM_DISPLAY[profile.studyProgram as string] || profile.studyProgram || "-"} (ปี {profile.year || "-"})</span></div>
```

- [ ] **Step 6: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```
Expected: no output. Fix all errors.

- [ ] **Step 7: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/S_ProfilePage.tsx Frontend/src/components/S_Gateway.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: student profile — replace สาขาวิชา(major) with หลักสูตร(studyProgram)"
```

---

## Task 3: Teacher Student Views — T_Students.tsx + T_StudentDetail.tsx

**Files:**
- Modify: `Frontend/src/components/T_Students.tsx`
- Modify: `Frontend/src/components/T_StudentDetail.tsx`

**What changes in T_Students.tsx:**
1. Remove `LEGACY_MAJOR_TH` dict (~lines 75–79)
2. Remove `dynamicMajors` state (~line 120) and its fetch from `fetchData` (~lines 162–174)
3. Remove `filterMajor` state (~line 121); replace with `filterCurriculum` state (default `"all"`)
4. Add `const CURRICULUM_TH: Record<string, string> = { normal: "ภาคปกติ", special: "ภาคพิเศษ" };` at top
5. In `filteredStudents` useMemo: change `s.major === filterMajor` → `filterCurriculum === "all" || s.studyProgram === filterCurriculum`
6. Replace the major `<select>` filter with a studyProgram `<select>` filter
7. Table header "สาขาวิชา" → "หลักสูตร"
8. Table cell: replace `displayMajor` (from major) with `CURRICULUM_TH[s.studyProgram || ""] || s.studyProgram || "-"`
9. In the inline student modal: change InfoRow "สาขาวิชา" (showing major) → "หลักสูตร" showing `studyProgram`; remove separate "รูปแบบการศึกษา" row (merge into above)

**What changes in T_StudentDetail.tsx:**
1. Add `const CURRICULUM_TH: Record<string, string> = { normal: "ภาคปกติ", special: "ภาคพิเศษ" };`
2. Change `<InfoRow label="สาขาวิชา" value={student.major || "-"} />` → `<InfoRow label="หลักสูตร" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram || "-"} />`
3. Remove `<InfoRow label="รูปแบบการศึกษา" value={student.studyProgram || "-"} />`

- [ ] **Step 1: Edit T_Students.tsx — remove LEGACY_MAJOR_TH and add CURRICULUM_TH**

Remove:
```ts
const LEGACY_MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};
```

Add in its place:
```ts
const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};
```

- [ ] **Step 2: Edit T_Students.tsx — replace dynamicMajors + filterMajor states**

Remove:
```ts
const [dynamicMajors, setDynamicMajors] = useState<Record<string, string>>({});
const [filterMajor, setFilterMajor] = useState<string>("all");
```
Add:
```ts
const [filterCurriculum, setFilterCurriculum] = useState<string>("all");
```

- [ ] **Step 3: Edit T_Students.tsx — remove majors fetch from fetchData**

Inside `fetchData`, remove the entire `/api/admin/majors` fetch block:
```ts
const resMajors = await fetch("/api/admin/majors", {
  headers: { Authorization: `Bearer ${token}` }
});
if (resMajors.ok) {
  const dataMajors = await resMajors.json();
  if (dataMajors.ok) {
    const majorDict: Record<string, string> = { ...LEGACY_MAJOR_TH };
    dataMajors.majors.forEach((m: string) => {
      majorDict[m] = m;
    });
    setDynamicMajors(majorDict);
  }
}
```

- [ ] **Step 4: Edit T_Students.tsx — update filteredStudents useMemo**

Change the filter from:
```ts
const matchMajor = filterMajor === "all" || s.major === filterMajor;
```
To:
```ts
const matchCurriculum = filterCurriculum === "all" || s.studyProgram === filterCurriculum;
```
Update the return condition accordingly: replace `matchMajor` with `matchCurriculum`.
Update the useMemo dependency array: replace `filterMajor` with `filterCurriculum`.

- [ ] **Step 5: Edit T_Students.tsx — replace major filter select**

Find the `<select>` that filters by major (~line 268–273):
```tsx
<select className="input soft" style={{ width: 'auto' }} value={filterMajor} onChange={e => setFilterMajor(e.target.value)}>
  <option value="all">🎓 ทุกสาขาวิชา</option>
  {Object.entries(dynamicMajors).map(([key, label]) => (
    <option key={key} value={key}>{label}</option>
  ))}
</select>
```
Replace with:
```tsx
<select className="input soft" style={{ width: 'auto' }} value={filterCurriculum} onChange={e => setFilterCurriculum(e.target.value)}>
  <option value="all">📚 ทุกหลักสูตร</option>
  <option value="normal">ภาคปกติ</option>
  <option value="special">ภาคพิเศษ</option>
</select>
```

- [ ] **Step 6: Edit T_Students.tsx — update table header and cell**

Change table header:
```tsx
// Before:
<th>สาขาวิชา</th>
// After:
<th>หลักสูตร</th>
```

Find `const displayMajor = dynamicMajors[s.major || ""] || s.major || "-";` and replace with:
```ts
const displayCurriculum = CURRICULUM_TH[s.studyProgram || ""] || s.studyProgram || "-";
```

Change the table cell:
```tsx
// Before:
<td data-label="สาขาวิชา">{displayMajor}</td>
// After:
<td data-label="หลักสูตร">{displayCurriculum}</td>
```

- [ ] **Step 7: Edit T_Students.tsx — update inline modal detail rows**

In the inline modal section (~line 425–445), find:
```tsx
<InfoRow label="สาขาวิชา" value={displayMajor} />
<InfoRow label="รูปแบบการศึกษา" value={student.studyProgram || "-"} />
```
Replace with a single row:
```tsx
<InfoRow label="หลักสูตร" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram || "-"} />
```

- [ ] **Step 8: Edit T_StudentDetail.tsx — update labels**

At the top of `T_StudentDetail.tsx`, add:
```ts
const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};
```

Find (~line 254):
```tsx
<InfoRow label="สาขาวิชา" value={student.major || "-"} />
<InfoRow label="รูปแบบการศึกษา" value={student.studyProgram || "-"} />
```
Replace both lines with:
```tsx
<InfoRow label="หลักสูตร" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram || "-"} />
```

- [ ] **Step 9: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```
Expected: no output. Fix all errors.

- [ ] **Step 10: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/T_Students.tsx Frontend/src/components/T_StudentDetail.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: teacher student views — replace สาขาวิชา(major) with หลักสูตร(studyProgram)"
```

---

## Task 4: Teacher Profile Pages — A_Teacher.tsx + T_Profile.tsx

**Files:**
- Modify: `Frontend/src/components/A_Teacher.tsx`
- Modify: `Frontend/src/components/T_Profile.tsx`

**Context:** Teacher's `major` field (stored as a free-text string) is changing from dept codes (CS/IT/AI/CYB/GIS) to curriculum codes (`normal`/`special`). The `Teacher` model in Prisma still uses a free-text `String?` for `major`, so no schema change is needed — we just change what values the UI sends.

**What changes in A_Teacher.tsx:**
1. Replace `MAJOR_TH` dict with `CURRICULUM_TH = { normal: "ภาคปกติ", special: "ภาคพิเศษ" }`
2. Remove `majorOptions` state (~line 44) and the `fetchMajors` function (~lines 79–85); remove `fetchMajors()` call from `useEffect` (~line 87)
3. Replace `majorDict` useMemo (which built display names from `majorOptions`) with simple reference to `CURRICULUM_TH`
4. Update `filtered` useMemo to use `CURRICULUM_TH` keys for filtering
5. Change `<FilterBox title="สาขาวิชา" ...>` → `<FilterBox title="หลักสูตร" items={CURRICULUM_TH} ...>`
6. Change table cell "สาขา": replace `MAJOR_TH[t.major] || t.major || "-"` with `CURRICULUM_TH[t.major as string] || t.major || "-"`
7. In the edit and create forms: change `"-- เลือกสาขาวิชา --"` option to `"-- เลือกหลักสูตร --"` and change options list from dynamic `majorOptions` to hardcoded ภาคปกติ/ภาคพิเศษ

**What changes in T_Profile.tsx:**
1. Change display label "สาขาวิชา" → "หลักสูตร" in view mode
2. Change edit form: remove dynamic `majorOptions` select, replace with hardcoded ภาคปกติ/ภาคพิเศษ select
3. Remove `majorOptions` state and its fetch call

- [ ] **Step 1: Edit A_Teacher.tsx — replace MAJOR_TH with CURRICULUM_TH**

Replace:
```ts
const MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
  CYB: "ความมั่นคงปลอดภัยไซเบอร์",
  AI: "ปัญญาประดิษฐ์",
};
```
With:
```ts
const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};
```

- [ ] **Step 2: Edit A_Teacher.tsx — remove majorOptions state and fetchMajors**

Remove:
```ts
const [majorOptions, setMajorOptions] = useState<string[]>([]);
```

Remove the entire `fetchMajors` function:
```ts
const fetchMajors = async () => {
  try {
    const res = await fetch("/api/admin/majors", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setMajorOptions(data.majors);
  } catch {}
};
```

In `useEffect`, remove `, fetchMajors()` from the call: change `useEffect(() => { fetchData(); fetchMajors(); }, []);` → `useEffect(() => { fetchData(); }, []);`

- [ ] **Step 3: Edit A_Teacher.tsx — replace majorDict useMemo with CURRICULUM_TH**

Remove the `majorDict` useMemo:
```ts
const majorDict = useMemo(() => {
  const dict: Record<string, string> = {};
  majorOptions.forEach(m => dict[m] = MAJOR_TH[m] ? `${MAJOR_TH[m]} (${m})` : m);
  return dict;
}, [majorOptions]);
```

In the `filtered` useMemo, the filter condition is `filterMajor.includes(t.major || "")`. This still works correctly since we changed the stored values to `normal`/`special` going forward. Keep as-is.

- [ ] **Step 4: Edit A_Teacher.tsx — update FilterBox**

Change:
```tsx
<FilterBox title="สาขาวิชา" items={majorDict} values={filterMajor} onChange={setFilterMajor} />
```
To:
```tsx
<FilterBox title="หลักสูตร" items={CURRICULUM_TH} values={filterMajor} onChange={setFilterMajor} />
```

- [ ] **Step 5: Edit A_Teacher.tsx — update table cell**

Find the table cell for "สาขา" (~line 264–267):
```tsx
<td style={td} data-label="สาขา">
  <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: t.major ? "#f0f9ff" : "#f1f5f9", color: t.major ? "#0369a1" : "#64748b" }}>
    {MAJOR_TH[t.major] || t.major || "-"}
  </span>
</td>
```
Replace `MAJOR_TH[t.major]` with `CURRICULUM_TH[t.major as string]`:
```tsx
<td style={td} data-label="หลักสูตร">
  <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: t.major ? "#f0f9ff" : "#f1f5f9", color: t.major ? "#0369a1" : "#64748b" }}>
    {CURRICULUM_TH[t.major as string] || t.major || "-"}
  </span>
</td>
```
Also change `data-label="สาขา"` → `data-label="หลักสูตร"` and the table header entry `"สาขา"` → `"หลักสูตร"`.

- [ ] **Step 6: Edit A_Teacher.tsx — update edit and create form major select**

Find the teacher edit modal (and create modal) section where teacher `major` is selected. Look for `-- เลือกสาขาวิชา --` placeholder. Replace the dynamic options with hardcoded curriculum options:

```tsx
// Before (in both edit and create forms):
<option value="">-- เลือกสาขาวิชา --</option>
{majorOptions.map((major) => (
  <option key={major} value={major}>{major}</option>
))}

// After:
<option value="">-- เลือกหลักสูตร --</option>
<option value="normal">ภาคปกติ</option>
<option value="special">ภาคพิเศษ</option>
```

Also change any `<label>สาขาวิชา</label>` in the form to `<label>หลักสูตร</label>`.

- [ ] **Step 7: Edit T_Profile.tsx — update view mode label**

Find (~line 220):
```tsx
<span className="label">สาขาวิชา</span>
```
Change to:
```tsx
<span className="label">หลักสูตร</span>
```

Also update the displayed value. If `displayMajor` is computed from `MAJOR_TH[profile.major] || profile.major`, update it to use `CURRICULUM_TH`:

Add near top of the file:
```ts
const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};
```

Change where `displayMajor` is computed to:
```ts
const displayMajor = CURRICULUM_TH[profile.major as string] || profile.major || "-";
```

- [ ] **Step 8: Edit T_Profile.tsx — update edit form major select**

Find (~lines 293–308):
```tsx
<div style={{ gridColumn: 'span 2' }}>
  <label className="label">สาขาวิชา</label>
  <select
    className="input"
    value={form.major || ""}
    onChange={(e) => setForm({ ...form, major: e.target.value })}
    style={{ appearance: 'none', ... }}
  >
    <option value="">-- เลือกสาขาวิชา --</option>
    {majorOptions.map((major) => (
      <option key={major} value={major}>{major}</option>
    ))}
  </select>
</div>
```
Change the label and replace `majorOptions.map(...)` with hardcoded options:
```tsx
<div style={{ gridColumn: 'span 2' }}>
  <label className="label">หลักสูตร</label>
  <select
    className="input"
    value={form.major || ""}
    onChange={(e) => setForm({ ...form, major: e.target.value })}
    style={{ appearance: 'none', background: '#fff url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 12px center', backgroundSize: '12px' }}
  >
    <option value="">-- เลือกหลักสูตร --</option>
    <option value="normal">ภาคปกติ</option>
    <option value="special">ภาคพิเศษ</option>
  </select>
</div>
```

- [ ] **Step 9: Edit T_Profile.tsx — remove majorOptions state and fetch**

Find and remove the `majorOptions` state declaration and its fetch call (likely a `useEffect` or function that calls `/api/admin/majors`).

- [ ] **Step 10: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```
Expected: no output. Fix all errors.

- [ ] **Step 11: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/A_Teacher.tsx Frontend/src/components/T_Profile.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: teacher pages — replace สาขาวิชา(dept codes) with หลักสูตร(ภาคปกติ/ภาคพิเศษ)"
```

---

## Task 5: Deprecate Criteria Page — A_CriteriaPage.tsx

**Files:**
- Modify: `Frontend/src/components/A_CriteriaPage.tsx`

**Context:** `A_CriteriaPage` managed a dynamic list of major codes (CS, IT, AI, GIS, CYB) that students could apply for. Since the system no longer uses dept codes, this page is obsolete. Replace its content with a deprecation notice. Keep the component so no routing breaks.

- [ ] **Step 1: Replace A_CriteriaPage.tsx content with deprecation notice**

Replace the entire file with:
```tsx
export default function A_CriteriaPage() {
  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 800, color: "#1e293b" }}>
          ⚙️ จัดการหลักสูตรสหกิจศึกษา
        </h2>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 4, marginBottom: 24 }}>
          ระบบได้เปลี่ยนมาใช้ "หลักสูตร" แทน "สาขาวิชา" แล้ว
        </div>
        <div style={{ padding: 20, background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
            📋 หลักสูตรที่ใช้งานในระบบ (คงที่)
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { code: "normal", label: "ภาคปกติ" },
              { code: "special", label: "ภาคพิเศษ" },
            ].map(({ code, label }) => (
              <div
                key={code}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 24px", minWidth: 160 }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 1 }}>
                  หลักสูตร
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>รหัส: {code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
cd C:\xampp\htdocs\Co_project\Frontend
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add Frontend/src/components/A_CriteriaPage.tsx
git -C C:\xampp\htdocs\Co_project commit -m "feat: criteria page — replace major management with หลักสูตร deprecation notice"
```

---

## Task 6: Backend Import — studentImportController.js

**Files:**
- Modify: `backend/controllers/studentImportController.js`

**Context:** The Excel import reads column `'สาขาวิชา / แผนกการศึกษา'` and maps CS/IT/AI/GIS/CYB codes into `Student.major`. Since `major` is deprecated, this column is now ignored — we stop writing major in upserts. The `'ภาคการศึกษา (ปกติ/พิเศษ)'` → `studyProgram` mapping is already correct and stays unchanged.

- [ ] **Step 1: Remove MAJOR_NAME_TO_CODE, KNOWN_MAJOR_CODES, and mapMajor from studentImportController.js**

Remove these lines (~lines 23–44):
```js
const MAJOR_NAME_TO_CODE = {
  'วิทยาการคอมพิวเตอร์': 'CS',
  'เทคโนโลยีสารสนเทศ': 'IT',
  'ภูมิสารสนเทศศาสตร์': 'GIS',
  'ความมั่นคงปลอดภัยไซเบอร์': 'CYB',
  'ปัญญาประดิษฐ์': 'AI',
  'วิทยาการข้อมูลและปัญญาประดิษฐ์': 'AI',
};
const KNOWN_MAJOR_CODES = new Set(['CS', 'IT', 'GIS', 'CYB', 'AI']);

function mapMajor(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { code: null, unrecognized: false };
  if (MAJOR_NAME_TO_CODE[trimmed]) return { code: MAJOR_NAME_TO_CODE[trimmed], unrecognized: false };
  const upper = trimmed.toUpperCase();
  if (KNOWN_MAJOR_CODES.has(upper)) return { code: upper, unrecognized: false };
  return { code: trimmed, unrecognized: true };
}
```

- [ ] **Step 2: Remove mapMajor usage in importStudents**

Find (~line 135–138):
```js
const { code: major, unrecognized: majorUnrecognized } = mapMajor(row['สาขาวิชา / แผนกการศึกษา']);
if (majorUnrecognized) {
  errorRows.push({ row: i + 2, email, reason: `ไม่รู้จักสาขาวิชา "${major}" — บันทึกค่าดิบไว้ตามที่กรอก กรุณาตรวจสอบ/แก้ไขในหน้าแก้ไขนักศึกษา` });
}
```
Remove all three lines entirely.

- [ ] **Step 3: Remove major from upsert calls**

In the `prisma.student.upsert` call (~line 204–216):

Remove `major` from the `update` object:
```js
// Before:
update: {
  prefix, firstName, lastName, firstNameEn, lastNameEn,
  year, major, phone, email, gpa, advisorName, studyProgram,
  generalAdvisorId,
},
// After:
update: {
  prefix, firstName, lastName, firstNameEn, lastNameEn,
  year, phone, email, gpa, advisorName, studyProgram,
  generalAdvisorId,
},
```

Remove `major` from the `create` object:
```js
// Before:
create: {
  studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
  year, major, phone, email, gpa,
  advisorName, generalAdvisorId: generalAdvisorId ?? null, studyProgram,
  userId: user.id,
},
// After:
create: {
  studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
  year, phone, email, gpa,
  advisorName, generalAdvisorId: generalAdvisorId ?? null, studyProgram,
  userId: user.id,
},
```

- [ ] **Step 4: Verify backend still starts**

```powershell
cd C:\xampp\htdocs\Co_project\backend
node -e "require('./controllers/studentImportController.js'); console.log('OK');"
```
Expected: prints `OK` with no error.

- [ ] **Step 5: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add backend/controllers/studentImportController.js
git -C C:\xampp\htdocs\Co_project commit -m "feat: import controller — stop writing deprecated major field, keep studyProgram mapping"
```

---

## Task 7: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

Prepend a new entry to `CHANGELOG.md`:
```markdown
## [2026-08-03] — หลักสูตร/ภาคการศึกษา: แทนที่สาขาวิชา (CS/IT/AI/CYB/GIS) ด้วยหลักสูตร (ภาคปกติ/ภาคพิเศษ)

- ยกเลิกการแสดง/แก้ไข field `major` (CS/IT/AI) ทั่วทั้งระบบ (ยังคงอยู่ใน DB เป็น historical data)
- เปลี่ยน label "สาขาวิชา" → "หลักสูตร" ทุกหน้า (A_Students, A_StudentEditModal, S_ProfilePage, S_Gateway, T_Students, T_StudentDetail, A_Teacher, T_Profile)
- ใช้ field `studyProgram` (enum `normal`/`special` = ภาคปกติ/ภาคพิเศษ) เป็นค่าหลักสำหรับ "หลักสูตร"
- A_Teacher และ T_Profile: เปลี่ยน options สาขาวิชาอาจารย์เป็น ภาคปกติ/ภาคพิเศษ
- A_CriteriaPage: เปลี่ยนจากหน้าจัดการสาขาวิชาเป็น notice แสดงหลักสูตรที่ใช้ในระบบ
- studentImportController.js: ไม่นำเข้า field `major` จากคอลัมน์ Excel อีกต่อไป
```

- [ ] **Step 2: Commit**

```powershell
git -C C:\xampp\htdocs\Co_project add CHANGELOG.md
git -C C:\xampp\htdocs\Co_project commit -m "docs: CHANGELOG for หลักสูตร/curriculum-department rename"
```
