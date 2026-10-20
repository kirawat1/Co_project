// ไทม์ไลน์กำหนดส่งของรอบนักศึกษา (ปฏิทินของรอบ) — หน้าแรกนักศึกษา
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate } from "../utils/dateFormat";
import { timelineStatus, type TimelineStep, type Tone } from "../utils/deadlines";

const STEP_ROUTE: Record<string, string> = {
    T000: "/student/docs", T002: "/student/docs-t002", T003: "/student/docs-t003",
    SUPERVISION: "/student/supervision", T005_T006: "/student/doc-t005-006", T007: "/student/doc-t007", T008: "/student/doc-t008",
};

export default function S_RoundTimeline() {
    const [data, setData] = useState<{ period: { academicYear: string; semester: number } | null; steps: TimelineStep[] } | null>(null);

    useEffect(() => {
        apiFetch("/api/coop/round-deadlines")
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d?.ok) setData(d); })
            .catch(() => {});
    }, []);

    if (!data?.period || !data.steps.length) return null;
    const shown = data.steps.filter(s => s.due || s.startDate);
    if (!shown.length) return null;

    return (
        <div className="dash-card" style={{ marginBottom: 20 }}>
            <div className="dash-title">📆 กำหนดส่งของรอบคุณ · เทอม {data.period.semester}/{data.period.academicYear}</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {shown.map(s => {
                    const status = timelineStatus(s);
                    const when = s.startDate && s.due ? `${fmtDate(s.startDate)} – ${fmtDate(s.due)}` : s.due ? `ภายใน ${fmtDate(s.due)}` : `ตั้งแต่ ${fmtDate(s.startDate)}`;
                    const route = STEP_ROUTE[s.stepKey];
                    return (
                        <div key={s.stepKey} style={row}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                                    {route ? <Link to={route} style={{ color: "inherit", textDecoration: "none" }}>{s.label}</Link> : s.label}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    {when}
                                    {s.extensionUntil && ` · ขยายให้ถึง ${fmtDate(s.extensionUntil)}`}
                                    {s.submittedAt && ` · ส่งเมื่อ ${fmtDate(s.submittedAt)}`}
                                </div>
                            </div>
                            {status && <span style={{ ...pill, ...toneStyle[status.tone] }}>{status.text}</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const row: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "1px solid #eef2f7", flexWrap: "wrap" };
const pill: CSSProperties = { fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" };
const toneStyle: Record<Tone, CSSProperties> = {
    ok: { background: "#dcfce7", color: "#166534" },
    warn: { background: "#fef3c7", color: "#92400e" },
    closed: { background: "#fee2e2", color: "#991b1b" },
    info: { background: "#f1f5f9", color: "#475569" },
};
