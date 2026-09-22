import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "../utils/apiFetch";
import DateInput from "./DateInput";
import LoadMoreFooter from "./LoadMoreFooter";

/**
 * บันทึกการใช้งาน — ใครทำอะไรกับระบบ (เจ้าหน้าที่เท่านั้น)
 * ข้อมูลมาจาก middleware ที่บันทึกทุก request ที่เปลี่ยนข้อมูล + การเข้าสู่ระบบ
 */
type LogRow = {
    id: number;
    createdAt: string;
    userId: number | null;
    role: string | null;
    actorName: string | null;
    action: string;
    method: string;
    path: string;
    targetType: string | null;
    targetId: string | null;
    statusCode: number;
    ip: string | null;
    detail: string | null;
};

type Actor = { userId: number; name: string | null; role: string | null; count: number };

const ROLE_LABEL: Record<string, string> = { staff: "เจ้าหน้าที่", teacher: "อาจารย์", student: "นักศึกษา" };

// แท็บแยกดูตามสิทธิ์ · anonymous = ยังไม่ได้ล็อกอิน (เช่น เข้าสู่ระบบไม่ผ่าน)
type RoleCounts = { all: number; staff: number; teacher: number; student: number; anonymous: number };
const ROLE_TABS: { key: string; countKey: keyof RoleCounts; label: string; icon: string; color: string; bg: string }[] = [
    { key: "", countKey: "all", label: "ทั้งหมด", icon: "📋", color: "#1e293b", bg: "#f1f5f9" },
    { key: "staff", countKey: "staff", label: "เจ้าหน้าที่", icon: "🛠️", color: "#1d4ed8", bg: "#eff6ff" },
    { key: "teacher", countKey: "teacher", label: "อาจารย์", icon: "👨‍🏫", color: "#0f766e", bg: "#f0fdfa" },
    { key: "student", countKey: "student", label: "นักศึกษา", icon: "🎓", color: "#7c3aed", bg: "#f5f3ff" },
    { key: "anonymous", countKey: "anonymous", label: "ไม่ได้ล็อกอิน", icon: "🔒", color: "#b45309", bg: "#fffbeb" },
];
const PAGE_SIZE = 50;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad2 = (n: number) => String(n).padStart(2, "0");
function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function A_Logs() {
    const [rows, setRows] = useState<LogRow[]>([]);
    const [actors, setActors] = useState<Actor[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [retentionDays, setRetentionDays] = useState(365);
    const [downloading, setDownloading] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [roleCounts, setRoleCounts] = useState<RoleCounts>({ all: 0, staff: 0, teacher: 0, student: 0, anonymous: 0 });

    // ตัวกรอง
    const [q, setQ] = useState("");
    const [role, setRole] = useState("");
    const [userId, setUserId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [onlyFailed, setOnlyFailed] = useState(false);

    const queryString = useMemo(() => {
        const p = new URLSearchParams();
        if (q.trim()) p.set("q", q.trim());
        if (role) p.set("role", role);
        if (userId) p.set("userId", userId);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        if (onlyFailed) p.set("onlyFailed", "true");
        return p.toString();
    }, [q, role, userId, from, to, onlyFailed]);

    const fetchLogs = async (targetPage: number, append: boolean) => {
        setLoading(true);
        try {
            const p = new URLSearchParams(queryString);
            p.set("page", String(targetPage));
            p.set("limit", String(PAGE_SIZE));
            const res = await apiFetch(`/api/admin/logs?${p.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert(`โหลดบันทึกไม่สำเร็จ${data.message ? `: ${data.message}` : ""}`);
                return;
            }
            setRows((prev) => (append ? [...prev, ...data.data] : data.data));
            setTotal(data.meta?.total ?? 0);
            setRetentionDays(data.meta?.retentionDays ?? 365);
            if (data.meta?.roleCounts) setRoleCounts(data.meta.roleCounts);
            setPage(targetPage);
        } catch {
            alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setLoading(false);
        }
    };

    // โหลดใหม่เมื่อเปลี่ยนตัวกรอง (หน่วงเล็กน้อยระหว่างพิมพ์)
    useEffect(() => {
        const t = setTimeout(() => fetchLogs(1, false), 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryString]);

    // รายชื่อผู้ใช้ในตัวกรอง — เหลือเฉพาะคนในแท็บสิทธิ์ที่เลือก
    useEffect(() => {
        if (role === "anonymous") { setActors([]); return; }
        apiFetch(`/api/admin/logs/actors${role ? `?role=${role}` : ""}`)
            .then((r) => r.json())
            .then((d) => { if (d?.ok) setActors(d.actors || []); })
            .catch(() => { /* ตัวกรองรายชื่อไม่ใช่ของจำเป็น */ });
    }, [role]);

    const handleExport = async () => {
        setDownloading(true);
        try {
            const res = await apiFetch(`/api/admin/logs/export?${queryString}`);
            if (!res.ok) {
                const msg = await res.json().catch(() => ({}));
                alert(`ดาวน์โหลดไม่สำเร็จ${msg.message ? `: ${msg.message}` : ""}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `บันทึกการใช้งาน_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setDownloading(false);
        }
    };

    // ล้างเฉพาะแถบตัวกรอง — คงแท็บสิทธิ์ที่เลือกไว้
    const clearFilters = () => {
        setQ(""); setUserId(""); setFrom(""); setTo(""); setOnlyFailed(false);
    };

    const hasFilter = !!(q || userId || from || to || onlyFailed);
    const hasMore = rows.length < total;

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>📜 บันทึกการใช้งาน</h2>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        ใครทำอะไรกับระบบ — บันทึกทุกการเปลี่ยนแปลงข้อมูลและการเข้าสู่ระบบ · เก็บย้อนหลัง {retentionDays} วัน
                    </div>
                </div>
                <button className="btn" style={{ background: "#16a34a", color: "#fff" }} onClick={handleExport} disabled={downloading}>
                    {downloading ? "กำลังสร้างไฟล์..." : "📊 Export Excel"}
                </button>
            </div>

            <div className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input className="input" style={{ flex: "1 1 240px", minWidth: 180 }} placeholder="ค้นหา ชื่อผู้ทำ / การกระทำ / เส้นทาง"
                    value={q} onChange={(e) => setQ(e.target.value)} />

                <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ flex: "0 0 auto", width: 220 }}>
                    <option value="">{role ? `ทุกคนใน${ROLE_TABS.find((t) => t.key === role)?.label ?? ""}` : "ทุกคน"}</option>
                    {actors.map((a) => (
                        <option key={a.userId} value={a.userId}>{a.name || `ผู้ใช้ #${a.userId}`} ({a.count})</option>
                    ))}
                </select>

                <DateInput className="input" style={{ flex: "0 0 auto", width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} />
                <span style={{ color: "#94a3b8" }}>ถึง</span>
                <DateInput className="input" style={{ flex: "0 0 auto", width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} />

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                    <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
                    เฉพาะที่ไม่สำเร็จ
                </label>

                {hasFilter && (
                    <button className="btn-secondary" style={{ fontSize: 13 }} onClick={clearFilters}>ล้างตัวกรอง</button>
                )}
            </div>

            <div className="card">
                {/* แท็บแยกดูตามสิทธิ์ — ตัวเลขใช้ตัวกรองอื่นเดียวกับตาราง */}
                <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
                    {ROLE_TABS.map((t) => {
                        const active = role === t.key;
                        return (
                            <button
                                key={t.key || "all"}
                                role="tab"
                                aria-selected={active}
                                onClick={() => { setRole(t.key); setUserId(""); }}
                                style={{
                                    border: `1px solid ${active ? t.color : "#e2e8f0"}`,
                                    background: active ? t.bg : "#fff",
                                    color: active ? t.color : "#475569",
                                    fontWeight: active ? 700 : 500,
                                    borderRadius: 99, padding: "6px 14px", fontSize: 13, cursor: "pointer",
                                }}
                            >
                                {t.icon} {t.label} <span style={{ opacity: 0.75 }}>({(roleCounts[t.countKey] ?? 0).toLocaleString()})</span>
                            </button>
                        );
                    })}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                    แสดง {total.toLocaleString()} รายการ {loading && "· กำลังโหลด..."}
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                                <th style={th}>เวลา</th>
                                <th style={th}>ผู้ทำ</th>
                                <th style={th}>การกระทำ</th>
                                <th style={th}>เป้าหมาย</th>
                                <th style={th}>ผลลัพธ์</th>
                                <th style={th}>รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const failed = r.statusCode >= 400;
                                return (
                                    <tr key={r.id} style={{ borderTop: "1px solid #f1f5f9", background: failed ? "#fff7ed" : undefined }}>
                                        <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTime(r.createdAt)}</td>
                                        <td style={td}>
                                            <div>{r.actorName || "-"}</div>
                                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{ROLE_LABEL[r.role || ""] || r.role || "ไม่ได้ล็อกอิน"}</div>
                                        </td>
                                        <td style={td}>{r.action}</td>
                                        <td style={td}>{[r.targetType, r.targetId].filter(Boolean).join(" ") || "-"}</td>
                                        <td style={td}>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                                                background: failed ? "#fee2e2" : "#dcfce7", color: failed ? "#b91c1c" : "#15803d",
                                            }}>
                                                {failed ? `ไม่สำเร็จ ${r.statusCode}` : "สำเร็จ"}
                                            </span>
                                        </td>
                                        <td style={{ ...td, maxWidth: 360 }}>
                                            <div style={{ fontSize: 11, color: "#64748b" }}>{r.method} {r.path}</div>
                                            {r.detail && <div style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>{r.detail}</div>}
                                            {r.ip && <div style={{ fontSize: 11, color: "#cbd5e1" }}>IP {r.ip}</div>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && !loading && (
                                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>ไม่พบบันทึกตามเงื่อนไขที่เลือก</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <LoadMoreFooter
                    shownCount={rows.length}
                    total={total}
                    hasMore={hasMore}
                    onShowMore={() => fetchLogs(page + 1, true)}
                    sentinelRef={sentinelRef}
                    itemLabel="รายการ"
                />
            </div>
        </div>
    );
}

const th: CSSProperties = { padding: "10px", fontWeight: 700, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "10px", color: "#334155", verticalAlign: "top" };
