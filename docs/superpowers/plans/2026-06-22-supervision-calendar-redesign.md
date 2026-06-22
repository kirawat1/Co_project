# Supervision Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `SupervisionCalendar.tsx` (shared by admin/staff, teacher, and student supervision pages) into a stats-strip + filter-chips + split grid/agenda layout, and plumb through the company name and online-meeting link that the new agenda rows need to display.

**Architecture:** One presentational React component (`SupervisionCalendar.tsx`) is rewritten in place — same props shape (`events`, `title`), extended with two new optional `CalendarEvent` fields (`companyName`, `onlineLink`). One backend endpoint (`getSupervisionCalendar`) is extended to supply those two fields (the other two endpoints already return them via Prisma `include`, just need their frontend `.map()` calls updated to pass them through).

**Tech Stack:** Express + Prisma (backend), React 19 + TypeScript (frontend), Jest (backend tests).

## Global Constraints

- Component props interface stays backward compatible: `companyName`/`onlineLink` are optional fields, so existing callers that don't pass them still type-check.
- No new files — this is a single-component rewrite plus two small mapping edits and one backend edit. (Per spec: "ไม่ต้องแก้ตาราง/รายการด้านล่าง calendar ในแต่ละหน้า" — scope is `SupervisionCalendar.tsx` + the 3 callers' data wiring only.)
- Stats strip numbers and the calendar grid's per-day highlighting both reflect the active type filter (ALL/ONLINE/ONSITE); only the agenda list additionally narrows by selected day. This is an explicit decision (not in the spec verbatim) made to keep the stats and the grid visually consistent with whatever the user is currently filtering — see Task 4 rationale.
- Month navigation (prev/next/"today") resets the selected day but does **not** reset the active type filter (explicit decision from the spec's Error Handling section).
- No frontend unit tests are added for `SupervisionCalendar.tsx` (presentational component, no existing test infra for it — verify via `tsc --noEmit` + manual browser check per project convention). The one backend logic change gets a Jest test update.

---

### Task 1: Backend — `getSupervisionCalendar` returns `companyName` and `onlineLink`

**Files:**
- Modify: `backend/controllers/supervisionController.js:509-536`
- Test: `backend/__tests__/supervisionController.test.js:304-358`

**Interfaces:**
- Produces: `GET /api/coop/supervision/calendar` response shape changes from `{ ok, events: [{ id, confirmedDate, studentId, studentName, type, status }] }` to the same shape plus `companyName: string | null` and `onlineLink: string | null` on each event. `S_Supervision.tsx` consumes this directly with no mapping (Task 3 covers it).

- [ ] **Step 1: Update the existing test to expect the new fields**

Open `backend/__tests__/supervisionController.test.js` and replace the `describe('getSupervisionCalendar', ...)` block (lines 304-358) with:

```js
describe('getSupervisionCalendar', () => {
  test('200 — returns events with correct shape', async () => {
    const confirmedDate = new Date('2024-04-10');
    const appointments = [
      {
        id: 7,
        confirmedDate,
        supervisionType: 'ONSITE',
        status: 'DATE_CONFIRMED',
        onlineLink: null,
        student: {
          studentId: 'CS001', firstName: 'ก', lastName: 'ข',
          coop: { company: { name: 'บริษัท เอบีซี จำกัด' } },
        },
      },
      {
        id: 8,
        confirmedDate: new Date('2024-04-15'),
        supervisionType: 'ONLINE',
        status: 'LETTER_UPLOADED',
        onlineLink: 'https://meet.google.com/abc-defg',
        student: {
          studentId: 'CS002', firstName: 'จ', lastName: 'ฉ',
          coop: null,
        },
      },
    ];
    prisma.supervisionAppointment.findMany.mockResolvedValue(appointments);

    const res = makeRes();
    await getSupervisionCalendar({}, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      events: [
        {
          id: 7,
          confirmedDate,
          studentId: 'CS001',
          studentName: 'ก ข',
          type: 'ONSITE',
          status: 'DATE_CONFIRMED',
          companyName: 'บริษัท เอบีซี จำกัด',
          onlineLink: null,
        },
        {
          id: 8,
          confirmedDate: new Date('2024-04-15'),
          studentId: 'CS002',
          studentName: 'จ ฉ',
          type: 'ONLINE',
          status: 'LETTER_UPLOADED',
          companyName: null,
          onlineLink: 'https://meet.google.com/abc-defg',
        },
      ],
    });

    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confirmedDate: { not: null },
          status: { in: expect.arrayContaining(['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED']) },
        }),
      })
    );
  });

  test('500 — DB error returns server error', async () => {
    prisma.supervisionAppointment.findMany.mockRejectedValue(new Error('DB crash'));

    const res = makeRes();
    await getSupervisionCalendar({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest __tests__/supervisionController.test.js -t "getSupervisionCalendar" --verbose`
Expected: FAIL — the first test fails because the actual `events` objects are missing `companyName`/`onlineLink` keys (real output has only the original 6 keys).

- [ ] **Step 3: Implement the controller change**

In `backend/controllers/supervisionController.js`, replace lines 509-536 (the entire `exports.getSupervisionCalendar` function) with:

```js
exports.getSupervisionCalendar = async (_req, res) => {
    try {
        const appointments = await prisma.supervisionAppointment.findMany({
            where: {
                confirmedDate: { not: null },
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] }
            },
            include: {
                student: {
                    select: {
                        studentId: true, firstName: true, lastName: true,
                        coop: { select: { company: { select: { name: true } } } }
                    }
                }
            },
            orderBy: { confirmedDate: 'asc' }
        });

        const events = appointments.map(a => ({
            id: a.id,
            confirmedDate: a.confirmedDate,
            studentId: a.student.studentId,
            studentName: `${a.student.firstName} ${a.student.lastName}`,
            type: a.supervisionType,
            status: a.status,
            companyName: a.student.coop?.company?.name ?? null,
            onlineLink: a.onlineLink ?? null,
        }));

        res.json({ ok: true, events });
    } catch (err) {
        console.error("Get Calendar Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลปฏิทินได้" });
    }
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest __tests__/supervisionController.test.js -t "getSupervisionCalendar" --verbose`
Expected: PASS (2/2 in this describe block)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && npm test`
Expected: all suites pass (217 tests passed before this change; expect 217 still, since no tests were added or removed, only one existing test's assertions changed)

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/supervisionController.js backend/__tests__/supervisionController.test.js
git commit -m "feat: include company name and online link in supervision calendar API"
```

---

### Task 2: Frontend — wire `companyName`/`onlineLink` into `A_SupervisionManage.tsx`

**Files:**
- Modify: `Frontend/src/components/A_SupervisionManage.tsx:47-69` (interface), `:332-344` (mapping)

**Interfaces:**
- Consumes: nothing from Task 1 directly (this file calls `/api/admin/supervisions` → `getAllSupervisions`, which already returns `onlineLink` via Prisma's default `include` behavior — see spec's Data Flow section).
- Produces: `calendarEvents` (passed into `<SupervisionCalendar events={calendarEvents} .../>` at line 416) now carries `companyName` and `onlineLink` on every event, matching the `CalendarEvent` interface extended in Task 4.

- [ ] **Step 1: Add `onlineLink` to the `Supervision` interface**

In `Frontend/src/components/A_SupervisionManage.tsx`, replace lines 47-69:

```ts
interface Supervision {
    id: number;
    studentId: number;
    teacherId: number;
    coopPeriodId?: number;
    proposedDates: string;
    supervisionType: "ONLINE" | "ONSITE";
    confirmedDate: string | null;
    coTeacherName?: string | null;
    status: SupervisionStatus;
    officialLetterPath: string | null;
    onlineLink?: string | null;
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        coopPeriodId?: number;
        coop: {
            company: { name: string; address: string; };
            coopPeriodId?: number; // 🟢 เพิ่มบรรทัดนี้เพื่อให้ TypeScript เข้าถึงได้
        };
    };
    teacher: Teacher;
}
```

- [ ] **Step 2: Update the `calendarEvents` mapping**

Replace lines 332-344:

```ts
    // แปลง supervisions → CalendarEvent (เฉพาะที่ยืนยันวันแล้ว)
    const calendarEvents = useMemo<CalendarEvent[]>(() =>
        supervisions
            .filter(s => s.confirmedDate && ["DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"].includes(s.status))
            .map(s => ({
                id: s.id,
                confirmedDate: s.confirmedDate!,
                studentId: s.student.studentId,
                studentName: `${s.student.firstName} ${s.student.lastName}`,
                type: s.supervisionType,
                status: s.status,
                companyName: s.student.coop?.company?.name,
                onlineLink: s.onlineLink ?? null,
            })),
        [supervisions]
    );
```

- [ ] **Step 3: Verify with the TypeScript compiler**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no errors mentioning `A_SupervisionManage.tsx` (the component prop type for `CalendarEvent` won't fully match until Task 4 extends it — if `tsc` errors about `companyName`/`onlineLink` not existing on `CalendarEvent`, that's expected at this point; re-run after Task 4 to confirm it clears. Note this in your task report rather than treating it as a blocker.)

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/A_SupervisionManage.tsx
git commit -m "feat: pass company name and online link into admin supervision calendar"
```

---

### Task 3: Frontend — wire `companyName`/`onlineLink` into `T_SupervisionReview.tsx`

**Files:**
- Modify: `Frontend/src/components/T_SupervisionReview.tsx:209-221`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this file calls `/api/teacher/supervisions` → `getSupervisionsForTeacher`, which already returns `onlineLink` via Prisma's default `include` behavior). The file's existing `SupervisionAppt` interface (line 15) already declares `onlineLink: string | null` — no interface change needed here.
- Produces: `calendarEvents` (passed into `<SupervisionCalendar events={calendarEvents} .../>` at line 269) now carries `companyName` and `onlineLink`.

- [ ] **Step 1: Update the `calendarEvents` mapping**

In `Frontend/src/components/T_SupervisionReview.tsx`, replace lines 209-221:

```ts
    const calendarEvents = useMemo<CalendarEvent[]>(() =>
        supervisions
            .filter(s => s.confirmedDate && ["DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"].includes(s.status))
            .map(s => ({
                id: s.id,
                confirmedDate: s.confirmedDate!,
                studentId: s.student.studentId,
                studentName: `${s.student.firstName} ${s.student.lastName}`,
                type: s.supervisionType,
                status: s.status,
                companyName: s.student.coop?.company?.name,
                onlineLink: s.onlineLink,
            })),
        [supervisions]
    );
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `cd Frontend && npx tsc --noEmit`
Expected: same caveat as Task 2 Step 3 — `CalendarEvent` isn't extended yet, so this may still show a type error referencing `T_SupervisionReview.tsx` until Task 4 lands. Confirm no *other* errors appear.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/T_SupervisionReview.tsx
git commit -m "feat: pass company name and online link into teacher supervision calendar"
```

---

### Task 4: Rewrite `SupervisionCalendar.tsx`

**Files:**
- Modify: `Frontend/src/components/SupervisionCalendar.tsx` (entire file, 242 lines → full rewrite)

**Interfaces:**
- Consumes: `CalendarEvent[]` where each event optionally carries `companyName?: string` and `onlineLink?: string | null` (now actually populated thanks to Tasks 1-3).
- Produces: same exported `CalendarEvent` interface (extended) and same default export signature `SupervisionCalendar({ events, title })` — no caller besides Tasks 2/3's already-updated call sites needs to change.

**Design recap (from the approved spec):** stats strip (4 cards: total this month / online / onsite / today) → filter chips (ALL/ONLINE/ONSITE, client-side) → split view (calendar grid left, chronological agenda right) → legend. Clicking a day narrows the agenda to that day; a "ดูทั้งเดือน" link clears it. Stats and the grid's day-highlighting both reflect the active filter; only day-selection additionally narrows the agenda (see Global Constraints). Below ~768px the split view stacks vertically.

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `Frontend/src/components/SupervisionCalendar.tsx` with:

```tsx
import React, { useState, useMemo } from "react";
import type { CSSProperties } from "react";

export interface CalendarEvent {
    id: number;
    confirmedDate: string; // ISO datetime
    studentName: string;
    studentId?: string;
    type: "ONLINE" | "ONSITE";
    status?: string;
    companyName?: string | null;
    onlineLink?: string | null;
}

interface Props {
    events: CalendarEvent[];
    title?: string;
}

type FilterType = "ALL" | "ONLINE" | "ONSITE";

const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                   "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")} น.`;
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}
function fmtDateShort(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1}`;
}
function dayKeyOf(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function AgendaItem({ ev }: { ev: CalendarEvent }) {
    const isOnline = ev.type === "ONLINE";
    return (
        <div style={agendaItemStyle}>
            <div style={{ ...agendaIconStyle, background: isOnline ? "#dbeafe" : "#fef3c7" }}>
                {isOnline ? "🌐" : "🏢"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={agendaNameStyle}>{ev.studentName}</div>
                <div style={agendaCompanyStyle}>{ev.companyName || "-"}</div>
                {isOnline && (
                    ev.onlineLink ? (
                        <a href={ev.onlineLink} target="_blank" rel="noopener noreferrer" style={agendaLinkStyle}>
                            🔗 {ev.onlineLink}
                        </a>
                    ) : (
                        <div style={agendaNoLinkStyle}>ยังไม่ระบุลิงก์</div>
                    )
                )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={agendaDateStyle}>{fmtDateShort(ev.confirmedDate)}</div>
                <div style={agendaTimeStyle}>{fmtTime(ev.confirmedDate)}</div>
            </div>
        </div>
    );
}

export default function SupervisionCalendar({ events, title = "📅 ปฏิทินนิเทศสหกิจ" }: Props) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"
    const [filterType, setFilterType] = useState<FilterType>("ALL");

    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    // กรองตามประเภทที่เลือก (ทั้งหมด / ออนไลน์ / ออนไซต์) — ใช้เป็นฐานทั้ง grid, stats, และ agenda
    const filteredEvents = useMemo(
        () => filterType === "ALL" ? events : events.filter(ev => ev.type === filterType),
        [events, filterType]
    );

    // map eventsByDay: "YYYY-MM-DD" → CalendarEvent[] (จาก filteredEvents)
    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        filteredEvents.forEach(ev => {
            if (!ev.confirmedDate) return;
            const key = dayKeyOf(ev.confirmedDate);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        });
        return map;
    }, [filteredEvents]);

    // เฉพาะนัดหมายในเดือนที่กำลังดู เรียงตามเวลา ascending
    const monthEvents = useMemo(() => {
        return filteredEvents
            .filter(ev => {
                const d = new Date(ev.confirmedDate);
                return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
            })
            .sort((a, b) => new Date(a.confirmedDate).getTime() - new Date(b.confirmedDate).getTime());
    }, [filteredEvents, viewYear, viewMonth]);

    const stats = useMemo(() => {
        const online = monthEvents.filter(ev => ev.type === "ONLINE").length;
        const onsite = monthEvents.filter(ev => ev.type === "ONSITE").length;
        const todayCount = monthEvents.filter(ev => dayKeyOf(ev.confirmedDate) === todayKey).length;
        return { total: monthEvents.length, online, onsite, todayCount };
    }, [monthEvents, todayKey]);

    const agendaEvents = selectedDay
        ? monthEvents.filter(ev => dayKeyOf(ev.confirmedDate) === selectedDay)
        : monthEvents;

    // สร้าง grid วันในเดือน
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sunday
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (number | null)[] = Array(firstDay).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
        setSelectedDay(null);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
        setSelectedDay(null);
    };
    const goToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDay(null);
    };

    return (
        <div style={calendarWrap}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button style={navBtn} onClick={prevMonth}>‹</button>
                    <span style={{ fontWeight:700, fontSize:15, minWidth:160, textAlign:"center" }}>
                        {MONTHS_TH[viewMonth]} {viewYear + 543}
                    </span>
                    <button style={navBtn} onClick={nextMonth}>›</button>
                    <button style={{ ...navBtn, fontSize:11, padding:"4px 8px" }} onClick={goToday}>
                        วันนี้
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <div className="svcal-stats" style={statsRowStyle}>
                <div style={statCardStyle}>
                    <div style={{ ...statValueStyle, color:"#0f172a" }}>{stats.total}</div>
                    <div style={statLabelStyle}>นัดหมายเดือนนี้</div>
                </div>
                <div style={{ ...statCardStyle, background:"#eff6ff", borderColor:"#bfdbfe" }}>
                    <div style={{ ...statValueStyle, color:"#2563eb" }}>{stats.online}</div>
                    <div style={{ ...statLabelStyle, color:"#1d4ed8" }}>🌐 ออนไลน์</div>
                </div>
                <div style={{ ...statCardStyle, background:"#fffbeb", borderColor:"#fde68a" }}>
                    <div style={{ ...statValueStyle, color:"#d97706" }}>{stats.onsite}</div>
                    <div style={{ ...statLabelStyle, color:"#b45309" }}>🏢 ออนไซต์</div>
                </div>
                <div style={{ ...statCardStyle, background:"#f0fdf4", borderColor:"#bbf7d0" }}>
                    <div style={{ ...statValueStyle, color:"#16a34a", fontSize:14 }}>วันนี้</div>
                    <div style={{ ...statLabelStyle, color:"#15803d" }}>
                        {stats.todayCount > 0 ? `มี ${stats.todayCount} นัด` : "ไม่มีนัด"}
                    </div>
                </div>
            </div>

            {/* Filter chips */}
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                {([["ALL","ทั้งหมด"],["ONLINE","🌐 ออนไลน์"],["ONSITE","🏢 ออนไซต์"]] as [FilterType,string][]).map(([key,label]) => (
                    <button
                        key={key}
                        onClick={() => setFilterType(key)}
                        style={{
                            ...filterChipStyle,
                            background: filterType === key ? "#0f172a" : "#f1f5f9",
                            color: filterType === key ? "#fff" : "#64748b",
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Split: calendar grid + agenda */}
            <div className="svcal-split" style={splitRowStyle}>
                {/* Grid column */}
                <div className="svcal-grid-col" style={{ flex: "1.1 1 0" }}>
                    <div style={gridStyle}>
                        {DAYS_TH.map(d => (
                            <div key={d} style={dayHeader}>{d}</div>
                        ))}
                        {calendarDays.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} />;
                            const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                            const dayEvents = eventsByDay.get(key) ?? [];
                            const isToday = key === todayKey;
                            const isSelected = key === selectedDay;
                            const hasEvents = dayEvents.length > 0;

                            let bg = "#fff";
                            let border = "1px solid #f1f5f9";
                            let numColor = "#334155";
                            let numWeight: number | string = 600;

                            if (isSelected) {
                                bg = "#e0f2fe"; border = "2px solid #0ea5e9";
                            } else if (isToday && hasEvents) {
                                bg = "#fef3c7"; border = "2px solid #f59e0b";
                                numColor = "#92400e"; numWeight = 800;
                            } else if (isToday) {
                                bg = "#fef9c3"; border = "2px solid #eab308";
                                numColor = "#b45309"; numWeight = 800;
                            } else if (hasEvents) {
                                bg = "#f0fdf4"; border = "2px solid #22c55e";
                                numColor = "#166534"; numWeight = 700;
                            }

                            return (
                                <div
                                    key={key}
                                    onClick={() => (hasEvents || isToday) ? setSelectedDay(isSelected ? null : key) : undefined}
                                    style={{
                                        ...dayCell,
                                        background: bg,
                                        border,
                                        cursor: (hasEvents || isToday) ? "pointer" : "default",
                                    }}
                                >
                                    <div style={{ fontWeight: numWeight, color: numColor, fontSize: 13 }}>
                                        {day}
                                    </div>
                                    {hasEvents && (
                                        <div style={dayCellCountStyle}>{dayEvents.length} คน</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div style={{ display:"flex", gap:14, marginTop:10, fontSize:12, color:"#64748b", flexWrap:"wrap" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ width:14, height:14, borderRadius:4, background:"#f0fdf4", border:"2px solid #22c55e", display:"inline-block" }} />
                            มีนิเทศ
                        </span>
                        <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ width:14, height:14, borderRadius:4, background:"#fef9c3", border:"2px solid #eab308", display:"inline-block" }} />
                            วันนี้
                        </span>
                        <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ width:14, height:14, borderRadius:4, background:"#e0f2fe", border:"2px solid #0ea5e9", display:"inline-block" }} />
                            เลือก
                        </span>
                    </div>
                </div>

                {/* Agenda column */}
                <div className="svcal-agenda-col" style={{ flex: "1 1 0", display:"flex", flexDirection:"column", gap:8, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#334155" }}>
                            📋 {selectedDay ? `รายการวันที่ ${fmtDate(selectedDay + "T00:00:00")}` : `รายการนัดหมายเดือนนี้ (${monthEvents.length})`}
                        </div>
                        {selectedDay && (
                            <button onClick={() => setSelectedDay(null)} style={resetLinkStyle}>
                                ดูทั้งเดือน
                            </button>
                        )}
                    </div>

                    {agendaEvents.length === 0 ? (
                        <div style={{ color:"#94a3b8", fontSize:13, padding:"12px 0" }}>
                            {selectedDay ? "ไม่มีนิเทศในวันที่เลือก" : "ไม่มีนัดหมายในเดือนนี้"}
                        </div>
                    ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto" }}>
                            {agendaEvents.map(ev => <AgendaItem key={ev.id} ev={ev} />)}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .svcal-split { flex-direction: column !important; }
                    .svcal-stats { flex-wrap: wrap !important; }
                }
            `}</style>
        </div>
    );
}

const calendarWrap: CSSProperties = {
    background:"#fff", borderRadius:16, padding:20,
    boxShadow:"0 4px 6px -1px rgba(0,0,0,0.05)", border:"1px solid #f1f5f9"
};
const navBtn: CSSProperties = {
    background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:6,
    padding:"4px 12px", cursor:"pointer", fontSize:16, fontWeight:700, color:"#475569"
};
const statsRowStyle: CSSProperties = {
    display:"flex", gap:8, marginBottom:12
};
const statCardStyle: CSSProperties = {
    flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8,
    padding:10, textAlign:"center", minWidth:90
};
const statValueStyle: CSSProperties = {
    fontSize:18, fontWeight:800
};
const statLabelStyle: CSSProperties = {
    fontSize:10, color:"#64748b", marginTop:2
};
const filterChipStyle: CSSProperties = {
    border:"none", borderRadius:8, padding:"5px 12px", fontSize:11,
    fontWeight:600, cursor:"pointer"
};
const splitRowStyle: CSSProperties = {
    display:"flex", gap:16
};
const gridStyle: CSSProperties = {
    display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4
};
const dayHeader: CSSProperties = {
    textAlign:"center", padding:"6px 0", fontSize:12,
    fontWeight:700, color:"#64748b", background:"#f8fafc", borderRadius:6
};
const dayCell: CSSProperties = {
    minHeight:52, padding:"6px 8px", borderRadius:8,
    transition:"all 0.15s", userSelect:"none"
};
const dayCellCountStyle: CSSProperties = {
    fontSize:10, color:"#166534", fontWeight:700, marginTop:3
};
const resetLinkStyle: CSSProperties = {
    background:"none", border:"none", color:"#2563eb", fontSize:11,
    fontWeight:600, cursor:"pointer", padding:0
};
const agendaItemStyle: CSSProperties = {
    display:"flex", alignItems:"flex-start", gap:10,
    padding:"10px 12px", background:"#f8fafc",
    border:"1px solid #e2e8f0", borderRadius:8
};
const agendaIconStyle: CSSProperties = {
    width:30, height:30, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:14, flexShrink:0
};
const agendaNameStyle: CSSProperties = {
    fontWeight:700, color:"#0f172a", fontSize:12,
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaCompanyStyle: CSSProperties = {
    fontSize:10, color:"#64748b", marginTop:1,
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaLinkStyle: CSSProperties = {
    fontSize:10, color:"#2563eb", marginTop:3, display:"block",
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaNoLinkStyle: CSSProperties = {
    fontSize:10, color:"#94a3b8", marginTop:3
};
const agendaDateStyle: CSSProperties = {
    fontWeight:700, color:"#16a34a", fontSize:12
};
const agendaTimeStyle: CSSProperties = {
    fontSize:10, color:"#64748b"
};
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `cd Frontend && npx tsc --noEmit`
Expected: no errors. This should also resolve the deferred type-check caveats from Task 2 Step 3 and Task 3 Step 2.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/SupervisionCalendar.tsx
git commit -m "feat: redesign supervision calendar with stats strip, filters, and agenda view"
```

---

### Task 5: Manual verification across all 3 pages

**Files:** none (verification only)

**Interfaces:** none — this task only exercises the work from Tasks 1-4.

- [ ] **Step 1: Start the dev environment**

Use the project's `run-dev` skill, or manually:
```bash
cd backend && npm run dev
```
and in a second terminal:
```bash
cd Frontend && npm run dev
```
Expected: backend on port 5000, frontend on port 5173, no startup errors.

- [ ] **Step 2: Verify the admin/staff page**

Log in as a staff/admin user, navigate to the supervision management page (renders `A_SupervisionManage.tsx`). Confirm:
- Stats strip shows correct totals for the current month.
- Filter chips (ทั้งหมด/🌐 ออนไลน์/🏢 ออนไซต์) narrow both the day highlighting in the grid and the agenda list.
- Clicking a highlighted day narrows the agenda to that day; "ดูทั้งเดือน" returns to the full month.
- An online appointment with a saved link renders a clickable `🔗 ...` line that opens in a new tab; one without a link shows "ยังไม่ระบุลิงก์".
- An onsite appointment shows its company name (or "-" if none).
- Browser console (F12) has no red errors, no failed network requests.

- [ ] **Step 3: Verify the teacher page**

Log in as a teacher, navigate to the supervision review page (`T_SupervisionReview.tsx`). Repeat the same checks as Step 2, scoped to the teacher's own students.

- [ ] **Step 4: Verify the student page**

Log in as a student, navigate to the supervision page (`S_Supervision.tsx`). Repeat the same checks as Step 2 (this view shows everyone's confirmed dates, per the existing `title` prop text "วันที่ยืนยันแล้วทั้งหมด").

- [ ] **Step 5: Verify responsive layout**

In any of the 3 pages, narrow the browser window below ~768px (or use DevTools device toolbar). Confirm the grid and agenda stack vertically instead of overlapping/squeezing, and the stats strip wraps instead of overflowing.

- [ ] **Step 6: Update CHANGELOG.md**

Add an entry to `CHANGELOG.md` (top of file, following the existing format) describing the redesign: stats strip, filters, split grid/agenda layout, company name + online link now shown per appointment, and the one backend field addition.

- [ ] **Step 7: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for supervision calendar redesign"
```
