# Status Display Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม S_StatusTracker (horizontal phase stepper + sub-steps + action card) และ StatusFilterChips (count chips กรองตาราง) เพื่อให้นักศึกษาเห็น journey ของตัวเองได้ชัด และเจ้าหน้าที่/อาจารย์กรองนักศึกษาตามกลุ่มสถานะได้เร็ว

**Architecture:** สร้าง 2 shared components ใหม่ — `S_StatusTracker.tsx` (pure presentational, รับ status string แล้ว map เป็น phase/sub-step/action) และ `StatusFilterChips.tsx` (รับ students array แล้ว count per group, emit filter event) — แล้วนำไปใส่ใน S_Dashboard, S_Gateway, A_Students, T_Students

**Tech Stack:** React 19 + TypeScript, inline styles (ตาม pattern โปรเจกต์)

---

## Current State

| File | What matters |
|---|---|
| `Frontend/src/components/S_Dashboard.tsx` | มี `status-banner` div (~line 188) แสดง StatusBadge + hint text — จะ **แทนที่** ด้วย S_StatusTracker |
| `Frontend/src/components/S_Gateway.tsx` | เพิ่ม S_StatusTracker ด้านบน (นักศึกษาที่ยื่นแล้วเห็นสถานะ) |
| `Frontend/src/components/A_Students.tsx` | มี `filterStatuses: string[]` state (~line 138) + filter logic (~line 275) — เพิ่ม StatusFilterChips ที่ setFilterStatuses ให้ |
| `Frontend/src/components/T_Students.tsx` | โครงสร้างคล้าย A_Students — เพิ่ม StatusFilterChips เหมือนกัน |
| `Frontend/src/components/StatusBadge.tsx` | มี STATUS_CONFIG ครบทุก status แล้ว — นำ label/icon มาใช้ใน S_StatusTracker ได้ |

---

## File Map

| Action | Path |
|---|---|
| Create | `Frontend/src/components/S_StatusTracker.tsx` |
| Create | `Frontend/src/components/StatusFilterChips.tsx` |
| Modify | `Frontend/src/components/S_Dashboard.tsx` |
| Modify | `Frontend/src/components/S_Gateway.tsx` |
| Modify | `Frontend/src/components/A_Students.tsx` |
| Modify | `Frontend/src/components/T_Students.tsx` |

---

## Task 1: S_StatusTracker.tsx — Student Timeline Component

**Files:**
- Create: `Frontend/src/components/S_StatusTracker.tsx`

- [ ] **Step 1: Create S_StatusTracker.tsx**

Create `Frontend/src/components/S_StatusTracker.tsx` with the full implementation:

```tsx
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

// ── Phase definitions ─────────────────────────────────────────────

type SubStep = {
  key: string;
  label: string;
  statuses: string[];         // statuses ที่ถือว่า sub-step นี้ "กำลังดำเนินการหรือผ่านแล้ว"
  doneStatuses: string[];     // statuses ที่ถือว่า sub-step นี้ "เสร็จแล้ว"
};

type Phase = {
  id: number;
  label: string;
  icon: string;
  subSteps: SubStep[];
  entryStatuses: string[];    // statuses ที่ทำให้อยู่ใน phase นี้
};

const PHASES: Phase[] = [
  {
    id: 1,
    label: "ยื่นคำร้อง",
    icon: "📋",
    entryStatuses: ["NOT_SUBMITTED", "APPLYING", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED"],
    subSteps: [
      { key: "submit", label: "ยื่นคำร้องขอสหกิจ", statuses: ["APPLYING", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED"], doneStatuses: ["QUALIFIED"] },
    ],
  },
  {
    id: 2,
    label: "เอกสาร T000",
    icon: "📄",
    entryStatuses: ["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"],
    subSteps: [
      { key: "t000", label: "2.1 อัปโหลดเอกสาร T000", statuses: ["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"], doneStatuses: ["DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"] },
      { key: "req_letter", label: "2.2 หนังสือขอความอนุเคราะห์", statuses: ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"], doneStatuses: ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"] },
      { key: "acceptance", label: "2.3 ใบตอบรับ (Acceptance)", statuses: ["WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"], doneStatuses: ["ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"] },
    ],
  },
  {
    id: 3,
    label: "ออกฝึกสหกิจ",
    icon: "🚀",
    entryStatuses: ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"],
    subSteps: [
      { key: "t002", label: "3.1 T002 แบบแจ้งรายละเอียดงาน", statuses: ["T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"], doneStatuses: ["T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"] },
      { key: "t003", label: "3.2 T003 โครงร่างรายงาน", statuses: ["T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"], doneStatuses: ["PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"] },
      { key: "supervision", label: "3.3 นัดหมายนิเทศสหกิจ", statuses: ["PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"], doneStatuses: ["COMPLETED"] },
      { key: "t005t006", label: "3.4 แบบประเมิน T005 / T006", statuses: ["LETTER_UPLOADED", "COMPLETED"], doneStatuses: ["COMPLETED"] },
      { key: "t007", label: "3.5 แบบประเมินสถานประกอบการ T007", statuses: ["COMPLETED"], doneStatuses: ["COMPLETED"] },
    ],
  },
  {
    id: 4,
    label: "รายงาน T008",
    icon: "📚",
    entryStatuses: [],           // ไม่มี status เฉพาะ ยกเว้นกรณีอัปโหลด T008 แล้ว
    subSteps: [
      { key: "t008", label: "4. อัปโหลดเล่มรายงานสหกิจ T008", statuses: [], doneStatuses: [] },
    ],
  },
];

// ── Action messages ───────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { text: string; link?: string; linkText?: string; isWarning?: boolean }> = {
  NOT_SUBMITTED:              { text: "กรอกข้อมูลและยื่นคำร้องขอเข้าร่วมโครงการ", link: "/student/gateway", linkText: "ยื่นคำร้อง" },
  APPLYING:                   { text: "รอเจ้าหน้าที่ตรวจสอบคุณสมบัติ (1-3 วันทำการ)" },
  APPLICATION_EDITS_REQUIRED: { text: "ต้องแก้ไขใบสมัคร — ดูความคิดเห็นและส่งใหม่", link: "/student/gateway", linkText: "ไปแก้ไข", isWarning: true },
  QUALIFICATION_FAILED:       { text: "คุณสมบัติไม่ผ่านเกณฑ์ กรุณาติดต่อเจ้าหน้าที่", isWarning: true },
  QUALIFIED:                  { text: "ผ่านคุณสมบัติแล้ว รอเจ้าหน้าที่ตรวจเอกสาร T000" },
  WAITING_FOR_STAFF_CHECK:    { text: "รอเจ้าหน้าที่ตรวจเอกสาร T000 (1-3 วันทำการ)" },
  EDITS_REQUIRED:             { text: "ต้องแก้ไขเอกสาร T000 — ดูความคิดเห็นจากเจ้าหน้าที่", link: "/student/docs", linkText: "ไปแก้ไข", isWarning: true },
  DOCS_APPROVED:              { text: "เอกสาร T000 ผ่านแล้ว รอเจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์" },
  REQ_LETTER_ISSUED:          { text: "ออกหนังสือขอความอนุเคราะห์แล้ว รอบริษัทตอบรับ" },
  WAITING_FOR_PLACEMENT_LETTER: { text: "รอใบตอบรับจากบริษัท" },
  WAITING_FOR_STAFF_CHECK_LETTER: { text: "รอเจ้าหน้าที่ตรวจใบตอบรับ" },
  ACCEPTANCE_CHECKED:         { text: "ตรวจใบตอบรับแล้ว รอออกหนังสือส่งตัว" },
  PLACEMENT_LETTER_ISSUED:    { text: "ได้รับหนังสือส่งตัวแล้ว 🎉 เตรียมตัวออกปฏิบัติงาน" },
  INTERNSHIP_STARTED:         { text: "กำลังฝึกสหกิจ — ส่งเอกสาร T002 แบบแจ้งรายละเอียดงาน", link: "/student/docs-t002", linkText: "ไปหน้า T002" },
  T002_SUBMITTED:             { text: "รออาจารย์ตรวจสอบ T002" },
  T002_EDITS_REQUIRED:        { text: "ต้องแก้ไข T002 — แบบแจ้งรายละเอียดงานและที่พัก", link: "/student/docs-t002", linkText: "ไปแก้ไข", isWarning: true },
  T003_SUBMITTED:             { text: "รออาจารย์ตรวจสอบ T003 โครงร่างรายงาน" },
  T003_EDITS_REQUIRED:        { text: "ต้องแก้ไข T003 — โครงร่างรายงานสหกิจ", link: "/student/docs-t003", linkText: "ไปแก้ไข", isWarning: true },
  PENDING_TEACHER:            { text: "รออาจารย์เลือกวันนัดหมายนิเทศ", link: "/student/supervision", linkText: "ดูการนิเทศ" },
  TEACHER_REJECTED:           { text: "ต้องแก้ไขวันนัดหมายนิเทศ", link: "/student/supervision", linkText: "ไปแก้ไข", isWarning: true },
  DATE_CONFIRMED:             { text: "วันนิเทศได้รับการยืนยัน รอเจ้าหน้าที่ออกหนังสือนิเทศ" },
  LETTER_UPLOADED:            { text: "หนังสือนิเทศอนุมัติแล้ว เตรียมพร้อมรับการนิเทศ" },
  COMPLETED:                  { text: "การนิเทศเสร็จสิ้น ✅ ดำเนินการส่งเล่มรายงาน T008 ต่อไป", link: "/student/doc-t008", linkText: "ไปหน้า T008" },
};

// ── Helper: หาว่า status อยู่ Phase ไหน ─────────────────────────

function getCurrentPhaseIndex(status: string): number {
  for (let i = 0; i < PHASES.length; i++) {
    if (PHASES[i].entryStatuses.includes(status)) return i;
  }
  return 0;
}

// ── Component ─────────────────────────────────────────────────────

interface Props {
  status: string;
  lastComment?: string;
}

export default function S_StatusTracker({ status, lastComment }: Props) {
  const navigate = useNavigate();
  const currentPhaseIdx = getCurrentPhaseIndex(status);
  const currentPhase = PHASES[currentPhaseIdx];
  const action = ACTION_CONFIG[status] ?? { text: "ดำเนินการตามขั้นตอนที่กำหนด" };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── Horizontal Phase Stepper ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e2e8f0" }}>
        {PHASES.map((phase, idx) => {
          const isDone = idx < currentPhaseIdx;
          const isActive = idx === currentPhaseIdx;
          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "center", flex: idx < PHASES.length - 1 ? 1 : 0 }}>
              {/* Phase bubble */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: isDone ? "#16a34a" : isActive ? "#2563eb" : "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, boxShadow: isActive ? "0 0 0 4px #bfdbfe" : "none",
                  transition: "all .2s",
                }}>
                  {isDone ? "✅" : phase.icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "#16a34a" : isActive ? "#2563eb" : "#94a3b8", textAlign: "center", lineHeight: 1.3 }}>
                  {phase.label}
                </span>
              </div>
              {/* Connector line */}
              {idx < PHASES.length - 1 && (
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: idx < currentPhaseIdx ? "#16a34a" : "#e2e8f0", margin: "0 4px", marginBottom: 20 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active Phase Sub-steps ── */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e2e8f0", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {currentPhase.icon} ขั้นตอนที่ {currentPhase.id}: {currentPhase.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {currentPhase.subSteps.map((step) => {
            const isDone = step.doneStatuses.includes(status);
            const isActive = !isDone && step.statuses.includes(status);
            return (
              <div key={step.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 10,
                background: isDone ? "#f0fdf4" : isActive ? "#eff6ff" : "#f8fafc",
                border: `1px solid ${isDone ? "#bbf7d0" : isActive ? "#bfdbfe" : "#e2e8f0"}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {isDone ? "✅" : isActive ? "▶" : "○"}
                </span>
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isDone ? "#16a34a" : isActive ? "#1e40af" : "#94a3b8" }}>
                  {step.label}
                </span>
                {isDone && <span style={{ marginLeft: "auto", fontSize: 11, color: "#16a34a", fontWeight: 600 }}>เสร็จแล้ว</span>}
                {isActive && <span style={{ marginLeft: "auto", fontSize: 11, color: "#2563eb", fontWeight: 600 }}>ดำเนินการอยู่</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Action Card ── */}
      <div style={{
        background: action.isWarning ? "#fff7ed" : "#eff6ff",
        border: `1px solid ${action.isWarning ? "#fed7aa" : "#bfdbfe"}`,
        borderRadius: 16, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: action.isWarning ? "#9a3412" : "#1e40af", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>
            {action.isWarning ? "⚠️ ต้องดำเนินการ" : "▶ ขั้นตอนถัดไป"}
          </div>
          <div style={{ fontSize: 14, color: action.isWarning ? "#7c2d12" : "#1e3a8a", fontWeight: 600 }}>
            {action.text}
          </div>
          {lastComment && action.isWarning && (
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 4, fontStyle: "italic" }}>
              💬 "{lastComment}"
            </div>
          )}
        </div>
        {action.link && (
          <button
            onClick={() => navigate(action.link!)}
            style={{ padding: "8px 18px", background: action.isWarning ? "#ea580c" : "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {action.linkText} →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/S_StatusTracker.tsx
git commit -m "feat: S_StatusTracker — horizontal phase stepper with sub-steps and action card"
```

---

## Task 2: StatusFilterChips.tsx — Staff/Teacher Filter Chips

**Files:**
- Create: `Frontend/src/components/StatusFilterChips.tsx`

- [ ] **Step 1: Create StatusFilterChips.tsx**

Create `Frontend/src/components/StatusFilterChips.tsx`:

```tsx
import type { CSSProperties } from "react";

// Status groups mapping
export const STATUS_GROUPS: Record<string, { label: string; icon: string; color: string; bg: string; statuses: string[] }> = {
  ALL: {
    label: "ทั้งหมด", icon: "📋", color: "#334155", bg: "#f1f5f9",
    statuses: [],
  },
  PENDING_REVIEW: {
    label: "รอตรวจสอบ", icon: "⏳", color: "#92400e", bg: "#fef9c3",
    statuses: ["APPLYING", "WAITING_FOR_STAFF_CHECK", "T002_SUBMITTED", "T003_SUBMITTED", "DATE_CONFIRMED", "WAITING_FOR_STAFF_CHECK_LETTER"],
  },
  NEEDS_EDIT: {
    label: "ต้องแก้ไข", icon: "📝", color: "#9a3412", bg: "#fff7ed",
    statuses: ["APPLICATION_EDITS_REQUIRED", "EDITS_REQUIRED", "T002_EDITS_REQUIRED", "T003_EDITS_REQUIRED", "TEACHER_REJECTED"],
  },
  IN_PROGRESS: {
    label: "กำลังดำเนินการ", icon: "🔄", color: "#1e40af", bg: "#eff6ff",
    statuses: ["QUALIFIED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED", "PENDING_TEACHER", "LETTER_UPLOADED"],
  },
  INTERNSHIP: {
    label: "ฝึกสหกิจ", icon: "🚀", color: "#4338ca", bg: "#e0e7ff",
    statuses: ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED"],
  },
  COMPLETED: {
    label: "เสร็จสิ้น", icon: "✅", color: "#166534", bg: "#dcfce7",
    statuses: ["COMPLETED"],
  },
};

interface Props {
  students: { coop?: { status?: string } | null }[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function StatusFilterChips({ students, activeFilter, onFilterChange }: Props) {
  // Count per group
  const counts: Record<string, number> = { ALL: students.length };
  for (const groupKey of Object.keys(STATUS_GROUPS)) {
    if (groupKey === "ALL") continue;
    const group = STATUS_GROUPS[groupKey];
    counts[groupKey] = students.filter(s => group.statuses.includes(s.coop?.status ?? "")).length;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {Object.entries(STATUS_GROUPS).map(([key, group]) => {
        const count = counts[key] ?? 0;
        const isActive = activeFilter === key;
        if (key !== "ALL" && count === 0) return null; // ซ่อน group ที่มี 0
        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all .15s", border: "none",
              background: isActive ? group.color : group.bg,
              color: isActive ? "#fff" : group.color,
              boxShadow: isActive ? `0 2px 8px ${group.color}40` : "none",
            }}
          >
            <span>{group.icon}</span>
            <span>{group.label}</span>
            <span style={{
              background: isActive ? "rgba(255,255,255,.25)" : `${group.color}20`,
              borderRadius: 99, padding: "1px 7px", fontSize: 12,
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/StatusFilterChips.tsx
git commit -m "feat: StatusFilterChips — count chips for filtering students by status group"
```

---

## Task 3: Integrate S_StatusTracker into S_Dashboard

**Files:**
- Modify: `Frontend/src/components/S_Dashboard.tsx`

**Background:**
S_Dashboard มี status-banner div (~line 188–208) แสดง StatusBadge + hint text จาก `STATUS_HINT` map. ต้องแทนที่ด้วย `<S_StatusTracker>`.

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/S_Dashboard.tsx` lines 46–60 (state declarations) และ lines 140–210 (status section + STATUS_HINT).

- [ ] **Step 2: Add import**

เพิ่ม import ที่ top ของไฟล์:
```tsx
import S_StatusTracker from "./S_StatusTracker";
```

- [ ] **Step 3: Remove STATUS_HINT and replace status-banner**

Find `const STATUS_HINT: Record<...>` map (ประมาณ 20 lines) และ div `className="status-banner"` ที่ตามมา แล้วแทนที่ด้วย:

```tsx
<S_StatusTracker status={studentStatus} />
```

**Note:** `studentStatus` state ยังคงใช้อยู่เหมือนเดิม ไม่ต้องเปลี่ยน fetch logic.

- [ ] **Step 4: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/S_Dashboard.tsx
git commit -m "feat: S_Dashboard replaces status-banner with S_StatusTracker"
```

---

## Task 4: Integrate S_StatusTracker into S_Gateway

**Files:**
- Modify: `Frontend/src/components/S_Gateway.tsx`

**Background:**
S_Gateway แสดง step indicator เดิมอยู่ (`STEPS` array + step indicator JSX). นักศึกษาที่ยื่นแล้ว (status ไม่ใช่ NOT_SUBMITTED) ควรเห็น `<S_StatusTracker>` ด้านบน section 1 (สถานะคำร้อง).

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/S_Gateway.tsx` lines 239–260 (บริเวณ step indicator) และหา JSX ของ step indicator เพื่อแทนที่.

- [ ] **Step 2: Add import**

```tsx
import S_StatusTracker from "./S_StatusTracker";
```

- [ ] **Step 3: Add S_StatusTracker before Section 1**

Find JSX `{/* ================= SECTION 1: สถานะคำร้อง ================= */}` แล้วเพิ่มก่อน:

```tsx
{/* Status Tracker — แสดงเฉพาะเมื่อยื่นแล้ว */}
{currentStatus !== "NOT_SUBMITTED" && (
  <S_StatusTracker status={currentStatus} lastComment={profile?.coop?.comment} />
)}
```

**Note:** `currentStatus` ดึงจาก `profile?.coop?.status || "NOT_SUBMITTED"` ซึ่งมีอยู่แล้ว. `profile?.coop?.comment` เป็น comment ล่าสุดจากเจ้าหน้าที่.

- [ ] **Step 4: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/S_Gateway.tsx
git commit -m "feat: S_Gateway adds S_StatusTracker above status section"
```

---

## Task 5: Integrate StatusFilterChips into A_Students

**Files:**
- Modify: `Frontend/src/components/A_Students.tsx`

**Background:**
A_Students มี `filterStatuses: string[]` state (~line 138) และ filter logic `filterStatuses.includes(st)` (~line 275). ต้องเพิ่ม `<StatusFilterChips>` ที่ setFilterStatuses โดยแปลง group key เป็น statuses array.

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/A_Students.tsx` lines 130–145 (state) และ lines 260–290 (filter logic) และ lines 300–360 (JSX header section).

- [ ] **Step 2: Add import**

```tsx
import StatusFilterChips, { STATUS_GROUPS } from "./StatusFilterChips";
```

- [ ] **Step 3: Add activeStatusGroup state**

หลัง `const [filterStatuses, setFilterStatuses] = useState<string[]>([]);` เพิ่ม:
```tsx
const [activeStatusGroup, setActiveStatusGroup] = useState<string>("ALL");
```

- [ ] **Step 4: Add handleStatusGroupChange function**

ก่อน `return (`:
```tsx
const handleStatusGroupChange = (group: string) => {
  setActiveStatusGroup(group);
  setFilterStatuses(group === "ALL" ? [] : STATUS_GROUPS[group]?.statuses ?? []);
};
```

- [ ] **Step 5: Add StatusFilterChips to JSX**

Find JSX header section (บริเวณ dropdown filters / period selector). เพิ่ม `<StatusFilterChips>` ด้านบน filter row:

```tsx
<StatusFilterChips
  students={items}
  activeFilter={activeStatusGroup}
  onFilterChange={handleStatusGroupChange}
/>
```

- [ ] **Step 6: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/components/A_Students.tsx
git commit -m "feat: A_Students adds StatusFilterChips for status group filtering"
```

---

## Task 6: Integrate StatusFilterChips into T_Students

**Files:**
- Modify: `Frontend/src/components/T_Students.tsx`

**Background:**
T_Students มีโครงสร้างคล้าย A_Students — ต้องทำเหมือนกัน Task 5 แต่กับไฟล์นี้.

- [ ] **Step 1: Read the file**

Read `Frontend/src/components/T_Students.tsx` lines 106–145 (state) และหา JSX header section.

- [ ] **Step 2: Add import**

```tsx
import StatusFilterChips, { STATUS_GROUPS } from "./StatusFilterChips";
```

- [ ] **Step 3: Add activeStatusGroup state**

```tsx
const [activeStatusGroup, setActiveStatusGroup] = useState<string>("ALL");
const [statusGroupFilter, setStatusGroupFilter] = useState<string[]>([]);
```

- [ ] **Step 4: Add handleStatusGroupChange**

```tsx
const handleStatusGroupChange = (group: string) => {
  setActiveStatusGroup(group);
  setStatusGroupFilter(group === "ALL" ? [] : STATUS_GROUPS[group]?.statuses ?? []);
};
```

- [ ] **Step 5: Apply filter to allStudents**

Find where `allStudents` is filtered to produce the displayed list. Add status group filter:

```tsx
// เพิ่มใน useMemo/filter ของ allStudents:
const filtered = allStudents.filter(s => {
  if (statusGroupFilter.length > 0) {
    const st = s.coop?.status ?? "";
    if (!statusGroupFilter.includes(st)) return false;
  }
  // ... existing search/period filters ...
  return true;
});
```

**If T_Students doesn't have a useMemo filter yet**, add one:
```tsx
const displayStudents = useMemo(() => {
  if (statusGroupFilter.length === 0) return allStudents;
  return allStudents.filter(s => statusGroupFilter.includes(s.coop?.status ?? ""));
}, [allStudents, statusGroupFilter]);
```
And use `displayStudents` in the JSX table map instead of `allStudents`.

- [ ] **Step 6: Add StatusFilterChips to JSX**

ด้านบน scope indicator text (หรือด้านบน table):
```tsx
<StatusFilterChips
  students={allStudents}
  activeFilter={activeStatusGroup}
  onFilterChange={handleStatusGroupChange}
/>
```

- [ ] **Step 7: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/components/T_Students.tsx
git commit -m "feat: T_Students adds StatusFilterChips for status group filtering"
```

---

## Task 7: Final verification + CHANGELOG

- [ ] **Step 1: Frontend TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Backend tests (no changes)**

```bash
cd backend && npm test
```

Expected: same pass/fail as before.

- [ ] **Step 3: Update CHANGELOG.md**

Add at top:

```markdown
## [2026-06-03] Status Display Redesign

### Added
- `S_StatusTracker.tsx` — horizontal phase stepper (4 phases), sub-steps ของเฟสปัจจุบัน, action card "ต้องทำอะไรตอนนี้" พร้อมลิงก์ไปหน้าที่เกี่ยวข้อง
- `StatusFilterChips.tsx` — chips แสดงจำนวนนักศึกษาต่อกลุ่มสถานะ (รอตรวจ / ต้องแก้ไข / ดำเนินการ / ฝึกสหกิจ / เสร็จสิ้น) กดแล้ว filter ตาราง

### Changed
- `S_Dashboard.tsx`: แทนที่ status-banner เดิมด้วย `S_StatusTracker`
- `S_Gateway.tsx`: เพิ่ม `S_StatusTracker` ด้านบน section สถานะ
- `A_Students.tsx`: เพิ่ม `StatusFilterChips` ด้านบนตาราง
- `T_Students.tsx`: เพิ่ม `StatusFilterChips` ด้านบนตาราง
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for status display redesign"
```

---

## Self-Review

**Spec coverage:**
- [x] Student timeline (4 phases) → Task 1 (PHASES array)
- [x] Sub-steps per phase → Task 1 (subSteps in each Phase)
- [x] "ต้องทำอะไรต่อ" action card → Task 1 (ACTION_CONFIG + action card JSX)
- [x] Revision status แสดงชื่อเอกสาร → Task 1 (ACTION_CONFIG per status)
- [x] Staff/teacher filter chips → Task 2 (StatusFilterChips)
- [x] Count per group → Task 2 (counts calculation)
- [x] Student dashboard uses tracker → Task 3
- [x] Gateway uses tracker → Task 4
- [x] A_Students uses chips → Task 5
- [x] T_Students uses chips → Task 6

**Type consistency:**
- `STATUS_GROUPS` exported from StatusFilterChips → imported in A_Students + T_Students (Tasks 5, 6) ✓
- `S_StatusTracker` props: `status: string, lastComment?: string` — used in Tasks 3, 4 ✓
- `StatusFilterChips` props: `students`, `activeFilter`, `onFilterChange` — used in Tasks 5, 6 ✓
