import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CalendarEvent } from "./SupervisionCalendar";
import { fmtDate } from "../utils/dateFormat";

/**
 * ตารางนิเทศเรียงตามวัน-เวลา — ใครนิเทศ เมื่อไหร่ ใครเป็นผู้นิเทศ
 * ทุก role ดูได้ (ข้อมูลชุดเดียวกับปฏิทิน) · ปุ่ม export Excel เปิดให้เฉพาะเจ้าหน้าที่/อาจารย์ประจำวิชา
 */
interface Props {
    events: CalendarEvent[];
    canExport?: boolean;
    exportUrl?: string;           // เช่น /api/admin/supervisions/export?coopPeriodId=3
    title?: string;
}

const dayOf = (ev: CalendarEvent) => ev.date || String(ev.confirmedDate || "").slice(0, 10);
const timeOf = (ev: CalendarEvent) => (ev.start && ev.end ? `${ev.start}-${ev.end} น.` : "-");

export default function SupervisionScheduleTable({ events, canExport = false, exportUrl, title = "🗓️ ตารางนิเทศ (เรียงตามวัน)" }: Props) {
    const [q, setQ] = useState("");
    const [downloading, setDownloading] = useState(false);

    const rows = useMemo(() => {
        const keyword = q.trim().toLowerCase();
        return [...events]
            .filter((ev) => {
                if (!keyword) return true;
                return [ev.studentName, ev.studentId, ev.companyName, ev.teacherName, ev.coTeacherName]
                    .some((v) => String(v || "").toLowerCase().includes(keyword));
            })
            .sort((a, b) => {
                const d = dayOf(a).localeCompare(dayOf(b));
                return d !== 0 ? d : String(a.start || "").localeCompare(String(b.start || ""));
            });
    }, [events, q]);

    const handleExport = async () => {
        if (!exportUrl) return;
        setDownloading(true);
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
                const msg = await res.json().catch(() => ({}));
                alert(`❌ ดาวน์โหลดไม่สำเร็จ${msg.message ? `: ${msg.message}` : ""}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ตารางนิเทศ_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            alert("❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setDownloading(false);
        }
    };

    let lastDay = "";

    return (
        <div className="card" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>{title}</h3>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{rows.length} รายการที่ยืนยันวันแล้ว</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        className="input"
                        style={{ minWidth: 220 }}
                        placeholder="ค้นหา ชื่อ / บริษัท / อาจารย์"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    {canExport && exportUrl && (
                        <button className="btn" style={{ background: "#16a34a", color: "#fff" }} onClick={handleExport} disabled={downloading}>
                            {downloading ? "กำลังสร้างไฟล์..." : "📊 Export Excel"}
                        </button>
                    )}
                </div>
            </div>

            {rows.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>ยังไม่มีนิเทศที่ยืนยันวัน</div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                                <th style={th}>วันที่</th>
                                <th style={th}>ช่วง</th>
                                <th style={th}>เวลา</th>
                                <th style={th}>นักศึกษา</th>
                                <th style={th}>บริษัท</th>
                                <th style={th}>อาจารย์ผู้นิเทศ</th>
                                <th style={th}>รูปแบบ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((ev) => {
                                const day = dayOf(ev);
                                const newDay = day !== lastDay;
                                lastDay = day;
                                return (
                                    <tr key={ev.id} style={{ borderTop: newDay ? "2px solid #cbd5e1" : "1px solid #f1f5f9" }}>
                                        <td style={td}>{newDay ? fmtDate(day) : ""}</td>
                                        <td style={td}>{ev.session || "-"}</td>
                                        <td style={{ ...td, whiteSpace: "nowrap" }}>{timeOf(ev)}</td>
                                        <td style={td}>
                                            <div>{ev.studentName}</div>
                                            {ev.studentId && <div style={{ fontSize: 11, color: "#94a3b8" }}>{ev.studentId}</div>}
                                        </td>
                                        <td style={td}>{ev.companyName || "-"}</td>
                                        <td style={td}>
                                            <div>{ev.teacherName || "-"}</div>
                                            {ev.coTeacherName && <div style={{ fontSize: 11, color: "#0f766e" }}>ร่วม: {ev.coTeacherName}</div>}
                                        </td>
                                        <td style={td}>{ev.type === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const th: CSSProperties = { padding: "10px", fontWeight: 700, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "10px", color: "#334155", verticalAlign: "top" };
