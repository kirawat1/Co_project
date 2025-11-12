// src/components/T_Dashboard.tsx
import { useMemo, useState, useEffect } from "react";
import type { StudentProfile, DocumentItem } from "./store";

const IOS_BLUE = "#0074B7";
const KS = "coop.student.profile.v1";
const KT = "coop.teacher.students"; // [{ studentId, name? }]
const KR_PREFIX = "coop.teacher.review.v1"; // per-teacher storage

// ===== Helpers =====
function loadAllStudents(): StudentProfile[] {
    try { return JSON.parse(localStorage.getItem(KS) || "[]"); } catch { return []; }
}
function loadTeacherStudentIds(): string[] {
    try {
        const raw = localStorage.getItem(KT);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map((x: any) => x.studentId ?? x.id).filter(Boolean) : [];
    } catch { return []; }
}
function getCurrentTeacherId(): string {
    const id = localStorage.getItem("coop.teacher.id");
    if (id) return id;
    try {
        const pf = JSON.parse(localStorage.getItem("coop.teacher.profile") || "{}");
        if (pf?.email) return `teacher:${String(pf.email).toLowerCase()}`;
    } catch { }
    return "teacher:unknown";
}
function reviewKey(teacherId: string) {
    return `${KR_PREFIX}.${teacherId}`;
}

type Cadence = "weekly" | "biweekly" | "monthly" | "custom";
type ReviewPlan = { cadence: Cadence; next: string; note?: string };

function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function addMonths(d: Date, n: number) {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
}
function advanceByCadence(from: Date, cadence: Cadence) {
    switch (cadence) {
        case "weekly": return addDays(from, 7);
        case "biweekly": return addDays(from, 14);
        case "monthly": return addMonths(from, 1);
        case "custom": default: return from; // custom ต้องแก้วันที่เอง
    }
}

// ===== Small UI bits =====
function IconWrap({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 12, background: "rgba(0,116,183,.10)", color: IOS_BLUE,
            }}
            aria-hidden
        >
            {children}
        </span>
    );
}
const StudentsIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);
const CalendarIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v4M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01M12 14h4" />
    </svg>
);

// ===== Chart (เหมือน A_Dashboard) =====
function LineChart({
    data,
    height = 240,
    stroke = IOS_BLUE,
}: {
    data: { key: string; label: string; value: number | string; color?: string }[];
    height?: number;
    stroke?: string;
}) {
    const values = data.map(d => Number(d.value) || 0);
    const max = Math.max(1, ...values);
    const P = { top: 16, right: 16, bottom: 36, left: 36 };
    const W = 720, H = height, innerW = W - P.left - P.right, innerH = H - P.top - P.bottom;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((d, i) => {
        const x = P.left + i * stepX;
        const v = Number(d.value) || 0;
        const y = P.top + (innerH - (v / max) * innerH);
        return { x, y, v, label: d.label, color: d.color || stroke };
    });
    const poly = points.map(p => `${p.x},${p.y}`).join(" ");

    const yTicks = 4;
    const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = P.top + (innerH / yTicks) * i;
        const val = Math.round(max - (max / yTicks) * i);
        return { y, val };
    });
    const total = values.reduce((a, b) => a + b, 0);

    return (
        <div style={{ width: "100%" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
                <rect x={0} y={0} width={W} height={H} fill="#fff" rx="12" />
                {gridLines.map((g, i) => (
                    <g key={`grid-${i}`}>
                        <line x1={P.left} x2={W - P.right} y1={g.y} y2={g.y} stroke="rgba(0,0,0,.06)" />
                        <text x={P.left - 8} y={g.y + 4} textAnchor="end" fontSize="11" fill="#6b7280">{g.val}</text>
                    </g>
                ))}
                <line x1={P.left} y1={H - P.bottom} x2={W - P.right} y2={H - P.bottom} stroke="rgba(0,0,0,.2)" />
                <line x1={P.left} y1={P.top} x2={P.left} y2={H - P.bottom} stroke="rgba(0,0,0,.2)" />

                <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={`M ${P.left},${H - P.bottom} L ${poly} L ${W - P.right},${H - P.bottom} Z`} fill="url(#areaFill)" />
                <polyline points={poly} fill="none" stroke={stroke} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

                {points.map((p, i) => {
                    const pct = total ? Math.round((p.v / total) * 100) : 0;
                    return (
                        <g key={`pt-${i}`}>
                            <circle cx={p.x} cy={p.y} r={5} fill={p.color} stroke="#fff" strokeWidth={1.5}>
                                <title>{`${p.label}: ${p.v}${total ? ` (${pct}%)` : ""}`}</title>
                            </circle>
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="12" fontWeight={700} fill="#111827">{p.v}</text>
                            <text x={p.x} y={H - P.bottom + 18} textAnchor="middle" fontSize="12" fill="#6b7280">{p.label}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
function ChartLegend({
    data, title = "สรุปสถานะเอกสาร (เฉพาะ Advisees)",
}: {
    data: { label: string; value: number | string; color: string }[];
    title?: string;
}) {
    const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
    return (
        <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{title}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {data.map((d) => {
                    const v = Number(d.value) || 0;
                    const pct = total ? Math.round((v / total) * 100) : 0;
                    return (
                        <div key={d.label} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", border: "1px solid rgba(0,0,0,.06)",
                            borderRadius: 12, background: "#fff",
                        }}>
                            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 9999, background: d.color, display: "inline-block" }} />
                            <div style={{ flex: 1, color: "#374151", fontWeight: 700 }}>{d.label}</div>
                            <div style={{ fontWeight: 900, minWidth: 32, textAlign: "right" }}>{v}</div>
                            <div style={{ color: "#6b7280", fontSize: 12, marginLeft: 6 }}>{pct}%</div>
                        </div>
                    );
                })}
                <div style={{
                    marginTop: 6, padding: "10px 12px", border: "1px dashed rgba(0,0,0,.08)",
                    borderRadius: 12, color: "#374151", display: "flex", justifyContent: "space-between",
                    fontWeight: 800,
                }}>
                    <span>รวมทั้งหมด</span><span>{total}</span>
                </div>
            </div>
        </div>
    );
}

// ===== Main: T_Dashboard =====
export default function T_Dashboard() {
    const teacherId = getCurrentTeacherId();

    // รายชื่อ advisees
    const allStudents = loadAllStudents();
    const ids = loadTeacherStudentIds();
    const advisees = useMemo(() => {
        return ids.length ? allStudents.filter(s => ids.includes(s.studentId)) : allStudents;
    }, [allStudents, ids]);

    // สถิติเอกสารเฉพาะ advisees
    const docStats = useMemo(() => {
        const counters = { waiting: 0, under: 0, approved: 0, rejected: 0 } as Record<string, number>;
        advisees.forEach(s => (s.docs || []).forEach(d => {
            const k = d.status === "under-review" ? "under" : d.status;
            counters[k] = (counters[k] || 0) + 1;
        }));
        return counters;
    }, [advisees]);

    const chartData = [
        { key: "waiting", label: "รอส่ง", value: docStats.waiting, color: "#9CA3AF" },
        { key: "under", label: "รอพิจารณา", value: docStats.under, color: IOS_BLUE },
        { key: "approved", label: "ผ่าน", value: docStats.approved, color: "#10B981" },
        { key: "rejected", label: "ไม่ผ่าน", value: docStats.rejected, color: "#EF4444" },
    ];

    // แผน review ต่อ student
    const [plans, setPlans] = useState<Record<string, ReviewPlan>>({});
    useEffect(() => {
        try {
            const raw = localStorage.getItem(reviewKey(teacherId));
            setPlans(raw ? JSON.parse(raw) : {});
        } catch { setPlans({}); }
    }, [teacherId]);

    function savePlans(next: Record<string, ReviewPlan>) {
        setPlans(next);
        localStorage.setItem(reviewKey(teacherId), JSON.stringify(next));
    }
    function updatePlan(studentId: string, patch: Partial<ReviewPlan>) {
        const cur = plans[studentId] || { cadence: "weekly" as Cadence, next: new Date().toISOString().slice(0, 10) };
        const next = { ...plans, [studentId]: { ...cur, ...patch } };
        savePlans(next);
    }
    function checkToday(studentId: string) {
        const cur = plans[studentId];
        if (!cur) return;
        const base = new Date();
        const adv = advanceByCadence(base, cur.cadence);
        updatePlan(studentId, { next: adv.toISOString().slice(0, 10) });
    }

    // Upcoming list
    const upcoming = useMemo(() => {
        const items = advisees
            .map(s => ({ s, plan: plans[s.studentId] }))
            .filter(x => !!x.plan)
            .map(x => ({
                studentId: x.s.studentId,
                name: `${x.s.firstName} ${x.s.lastName}`.trim(),
                next: x.plan!.next,
                cadence: x.plan!.cadence,
            }))
            .sort((a, b) => (a.next || "").localeCompare(b.next || ""));
        return items.slice(0, 8);
    }, [advisees, plans]);

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            {/* ===== Cards: จำนวน Advisees + จำนวนงานรอพิจารณา (เฉพาะ Advisees) ===== */}
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <h2 style={{ marginTop: 8, marginLeft: 18 }}>ภาพรวมที่ปรึกษา</h2>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 250px))",
                        gap: 30, justifyContent: "start", marginLeft: 50,
                    }}
                >
                    <div className="card" style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                            <IconWrap><StudentsIcon /></IconWrap>
                            <div style={{ color: "#6b7280", fontWeight: 800, fontSize: 17, marginLeft: 5 }}>จำนวนนักศึกษาในที่ปรึกษา</div>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, marginLeft: 60 }}>{advisees.length}</div>
                    </div>

                    <div className="card" style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                            <IconWrap><CalendarIcon /></IconWrap>
                            <div style={{ color: "#6b7280", fontWeight: 800, fontSize: 17, marginLeft: 5 }}>รายการกำหนดตรวจ</div>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, marginLeft: 60 }}>{Object.keys(plans).length}</div>
                    </div>
                </div>
            </section>

            {/* ===== สถานะเอกสารของ Advisees ===== */}
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <h2 style={{ marginTop: 8, marginLeft: 18 }}>สถานะเอกสาร (เฉพาะ Advisees)</h2>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 320px) 1fr",
                        gap: 16, alignItems: "start",
                        marginTop: 10, marginLeft: 70, marginBottom: 10,
                    }}
                >
                    <ChartLegend data={chartData} />
                    <div style={{ minWidth: 0, marginTop: 40 }}>
                        <LineChart data={chartData} />
                    </div>
                </div>
            </section>

            {/* ===== Upcoming ===== */}
            <section className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 8, marginLeft: 18 }}>กำหนดถัดไป (ใกล้ถึง)</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 280px))", gap: 12, marginLeft: 50, marginTop: 8 }}>
                    {upcoming.map(u => (
                        <div key={u.studentId} className="card" style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,.06)", background: "#fff" }}>
                            <div style={{ fontWeight: 900 }}>{u.studentId}</div>
                            <div style={{ color: "#374151" }}>{u.name}</div>
                            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>รอบ: <b>{labelOfCadence(u.cadence)}</b></div>
                            <div style={{ marginTop: 4, fontSize: 12, color: "#111827" }}>ครั้งถัดไป: <b>{fmtDate(u.next)}</b></div>
                        </div>
                    ))}
                    {upcoming.length === 0 && (
                        <div style={{ color: "#6b7280", marginLeft: 18 }}>— ยังไม่มีรายการ —</div>
                    )}
                </div>
            </section>

            <style>{`
        .btn.ghost{ background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08); border-radius:10px; padding:10px 14px; font-weight:700 }
        .btn.ghost:hover{ background:#f8fafc; border-color:#c7d2fe; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14) }
        .cell-ellipsis{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }
        @media (max-width: 1024px){
          .line-wrap svg{ height: 280px !important; }
        }
      `}</style>
        </div>
    );
}

// ===== Utils =====
function labelOfCadence(c: Cadence) {
    switch (c) {
        case "weekly": return "ทุกสัปดาห์";
        case "biweekly": return "ทุก 2 สัปดาห์";
        case "monthly": return "ทุกเดือน";
        case "custom": return "กำหนดเอง";
        default: return c;
    }
}
function fmtDate(iso?: string) {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
