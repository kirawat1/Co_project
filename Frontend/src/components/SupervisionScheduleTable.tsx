import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CalendarEvent } from "./SupervisionCalendar";
import { fmtDate } from "../utils/dateFormat";
import { apiFetch } from "../utils/apiFetch";

/**
 * ตารางนิเทศเรียงตามวัน-เวลา — ใครนิเทศ เมื่อไหร่ ใครเป็นผู้นิเทศ
 * ทุก role ดูได้ (ข้อมูลชุดเดียวกับปฏิทิน) · ปุ่ม export Excel เปิดให้เฉพาะเจ้าหน้าที่/อาจารย์ประจำวิชา
 */
interface Props {
    events: CalendarEvent[];
    canExport?: boolean;
    exportUrl?: string;           // เส้นทางฐาน เช่น /api/admin/supervisions/export (รอบสหกิจต่อท้ายให้เอง)
    title?: string;
    notice?: string;              // เช่น โหลดข้อมูลละเอียดไม่สำเร็จ แสดงข้อมูลสำรอง
}

interface CoopPeriod { id: number; academicYear: string; semester: number; isActive?: boolean }

const periodLabel = (p: CoopPeriod) => `ปีการศึกษา ${p.academicYear} ภาค ${p.semester}${p.isActive ? " (เปิดรับสมัคร)" : ""}`;

const dayOf = (ev: CalendarEvent) => ev.date || String(ev.confirmedDate || "").slice(0, 10);
const timeOf = (ev: CalendarEvent) => (ev.start && ev.end ? `${ev.start}-${ev.end} น.` : "-");

export default function SupervisionScheduleTable({ events, canExport = false, exportUrl, title = "🗓️ ตารางนิเทศ (เรียงตามวัน)", notice }: Props) {
    const [q, setQ] = useState("");
    const [downloading, setDownloading] = useState(false);
    // รอบสหกิจสำหรับไฟล์ export — ค่าเริ่มต้นคือรอบล่าสุด (API เรียงปีการศึกษา/ภาคจากใหม่ไปเก่า)
    const [periods, setPeriods] = useState<CoopPeriod[]>([]);
    const [periodId, setPeriodId] = useState<number | "all">("all");

    useEffect(() => {
        if (!canExport || !exportUrl) return;
        let alive = true;
        apiFetch("/api/admin/coop-periods")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!alive) return;
                const list: CoopPeriod[] = Array.isArray(data?.periods) ? data.periods : [];
                setPeriods(list);
                if (list.length) setPeriodId(list[0].id);
            })
            // โหลดรายชื่อรอบไม่ได้ก็ยัง export ได้ (จะได้ทุกรอบ) — ไม่ต้องขวางการใช้งาน
            .catch(() => { if (alive) setPeriods([]); });
        return () => { alive = false; };
    }, [canExport, exportUrl]);

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
            const sep = exportUrl.includes("?") ? "&" : "?";
            const reqUrl = periodId === "all" ? exportUrl : `${exportUrl}${sep}coopPeriodId=${periodId}`;
            const res = await fetch(reqUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
                const msg = await res.json().catch(() => ({}));
                alert(`❌ ดาวน์โหลดไม่สำเร็จ${msg.message ? `: ${msg.message}` : ""}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            // ใส่รอบสหกิจไว้ในชื่อไฟล์ จะได้แยกออกเวลาดาวน์โหลดหลายรอบ
            const chosen = periods.find((p) => p.id === periodId);
            const tag = chosen ? `${chosen.academicYear}-${chosen.semester}` : "ทุกรอบ";
            a.download = `ตารางนิเทศ_${tag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
                    {canExport && exportUrl && periods.length > 0 && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                            รอบสหกิจ
                            <select
                                className="input"
                                style={{ minWidth: 190 }}
                                value={periodId}
                                onChange={(e) => setPeriodId(e.target.value === "all" ? "all" : Number(e.target.value))}
                            >
                                {periods.map((p) => <option key={p.id} value={p.id}>{periodLabel(p)}</option>)}
                                <option value="all">ทุกรอบ</option>
                            </select>
                        </label>
                    )}
                    {canExport && exportUrl && (
                        <button className="btn" style={{ background: "#16a34a", color: "#fff" }} onClick={handleExport} disabled={downloading}>
                            {downloading ? "กำลังสร้างไฟล์..." : "📊 Export Excel"}
                        </button>
                    )}
                </div>
            </div>

            {notice && (
                <div role="status" style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 13 }}>
                    ⚠️ {notice}
                </div>
            )}
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
