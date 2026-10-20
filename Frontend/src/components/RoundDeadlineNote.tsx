// กำหนดส่งของขั้นหนึ่งในรอบที่หน้าเลือกอยู่ — แสดงอย่างเดียว ตั้งที่หน้ารอบสหกิจ (ปฏิทินของรอบ) ที่เดียว
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { deadlineStatus, entryText, legacyText, type StepKey, type Tone } from "../utils/deadlines";
import type { CalendarData } from "./A_RoundDeadlines";

interface Props {
    stepKey: StepKey;
    periodId: string; // ค่าตัวกรองรอบของหน้า ("all" / "none" = ยังไม่ได้เลือกรอบเดียว)
}

export default function RoundDeadlineNote({ stepKey, periodId }: Props) {
    const [data, setData] = useState<CalendarData | null>(null);
    const [failed, setFailed] = useState(false);
    const single = /^\d+$/.test(periodId);

    useEffect(() => {
        setData(null);
        setFailed(false);
        if (!single) return;
        let cancelled = false;
        axios.get(`/api/admin/coop-periods/${periodId}/deadlines`)
            .then(r => { if (!cancelled) setData(r.data); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [periodId]);

    const link = <Link to="/admin/coop-period" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>ตั้งที่หน้ารอบสหกิจ →</Link>;

    if (!single) return <div style={wrap}><span style={muted}>เลือกรอบเดียวเพื่อดูกำหนดส่งของรอบนั้น</span>{link}</div>;
    if (failed) return <div style={wrap}><span style={muted}>โหลดกำหนดส่งไม่สำเร็จ</span>{link}</div>;
    if (!data) return <div style={wrap}><span style={muted}>⏳ กำลังโหลดกำหนดส่ง...</span></div>;

    return (
        <div style={wrap}>
            <div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>กำหนดส่งรอบ {data.period.semester}/{data.period.academicYear}:</span>
                {data.majors.length === 0 && <span style={muted}>ยังไม่มีหลักสูตรในรอบนี้</span>}
                {data.majors.map(m => {
                    const e = m.deadlines?.[stepKey];
                    if (!e) return <span key={m.major} style={item}><b>{m.major}</b> ใช้ค่าเดิม: {legacyText(data.legacy[m.major]?.[stepKey])}</span>;
                    const s = deadlineStatus({ due: e.due, mode: e.mode, closed: e.closed });
                    return (
                        <span key={m.major} style={item}>
                            <b>{m.major}</b> {entryText(e)}
                            <span style={{ ...pill, ...toneStyle[s.tone] }}>{s.text}</span>
                        </span>
                    );
                })}
            </div>
            {link}
        </div>
    );
}

/** ป้ายในแถวรายการตรวจ — จาก API (row.deadline): ส่งช้า / เลยกำหนดยังไม่ส่ง */
export interface DeadlineFlags { due: string | null; late: boolean; overdueNotSubmitted: boolean }
export function DeadlineFlagBadge({ flags }: { flags?: DeadlineFlags | null }) {
    if (!flags || (!flags.late && !flags.overdueNotSubmitted)) return null;
    const style = flags.late ? toneStyle.warn : toneStyle.closed;
    return (
        <span style={{ ...pill, ...style, display: "inline-block", marginTop: 4 }} title={flags.due ? `กำหนดส่งของรอบ: ${flags.due}` : undefined}>
            {flags.late ? "⏰ ส่งช้า" : "⛔ เลยกำหนด ยังไม่ส่ง"}
        </span>
    );
}

const wrap: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 13 };
const muted: CSSProperties = { color: "#64748b", fontSize: 13 };
const item: CSSProperties = { color: "#334155", fontSize: 13 };
const pill: CSSProperties = { marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap" };
const toneStyle: Record<Tone, CSSProperties> = {
    ok: { background: "#dcfce7", color: "#166534" },
    warn: { background: "#fef3c7", color: "#92400e" },
    closed: { background: "#fee2e2", color: "#991b1b" },
    info: { background: "#f1f5f9", color: "#475569" },
};
