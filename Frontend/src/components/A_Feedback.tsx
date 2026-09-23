import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "../utils/apiFetch";
import { fmtDateTime } from "../utils/dateFormat";
import { notify } from "../utils/notify";

/**
 * เรื่องที่ผู้ใช้แจ้งเข้ามาจากปุ่ม "แจ้งปัญหา" (เจ้าหน้าที่เท่านั้น)
 * แต่ละเรื่องมีบริบทตอนแจ้ง (หน้าไหน สถานะสหกิจอะไร เบราว์เซอร์อะไร)
 * และมีปุ่มลัดไปดูบันทึกการใช้งานของผู้แจ้งช่วงเวลานั้น
 */
type Status = "NEW" | "IN_PROGRESS" | "RESOLVED";
interface Feedback {
    id: number;
    kind: "BUG" | "SUGGEST";
    message: string;
    status: Status;
    staffReply: string | null;
    pagePath: string | null;
    contextNote: string | null;
    userAgent: string | null;
    imagePath: string | null;
    createdAt: string;
    handledName: string | null;
    handledAt: string | null;
    reporterName: string;
    reporterRole: string;
    reporterUserId: number;
}

const STATUS_TH: Record<Status, { label: string; bg: string; color: string }> = {
    NEW: { label: "ใหม่", bg: "#fef9c3", color: "#854d0e" },
    IN_PROGRESS: { label: "กำลังดู", bg: "#e0f2fe", color: "#0369a1" },
    RESOLVED: { label: "แก้ไขแล้ว", bg: "#dcfce7", color: "#166534" },
};
const ROLE_TH: Record<string, string> = { student: "นักศึกษา", teacher: "อาจารย์", staff: "เจ้าหน้าที่" };
const TABS: { key: Status | "all"; label: string }[] = [
    { key: "NEW", label: "ใหม่" },
    { key: "IN_PROGRESS", label: "กำลังดู" },
    { key: "RESOLVED", label: "แก้ไขแล้ว" },
    { key: "all", label: "ทั้งหมด" },
];

// ลิงก์ไปบันทึกการใช้งานของผู้แจ้ง ช่วงวันที่แจ้ง — ใช้ตามรอยว่าตอนนั้นเกิดอะไรขึ้นจริง
function logLink(f: Feedback) {
    const day = new Date(f.createdAt);
    const iso = new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return `/admin/logs?userId=${f.reporterUserId}&from=${iso}&to=${iso}`;
}

export default function A_Feedback() {
    const [tab, setTab] = useState<Status | "all">("NEW");
    const [q, setQ] = useState("");
    const [rows, setRows] = useState<Feedback[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({ all: 0, NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 });
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<number | null>(null);
    const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<number | null>(null);
    const [error, setError] = useState("");

    const query = useMemo(() => {
        const p = new URLSearchParams();
        if (tab !== "all") p.set("status", tab);
        if (q.trim()) p.set("q", q.trim());
        p.set("limit", "50");
        return p.toString();
    }, [tab, q]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await apiFetch(`/api/admin/feedback?${query}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setError(data.message || "ดึงรายการไม่สำเร็จ");
                return;
            }
            setRows(data.data || []);
            setCounts(data.meta?.counts || {});
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => { load(); }, [load]);

    const update = async (id: number, body: { status?: Status; staffReply?: string }) => {
        setSaving(id);
        try {
            const res = await apiFetch(`/api/admin/feedback/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                notify.error(`❌ ${data.message || "บันทึกไม่สำเร็จ"}`);
                return;
            }
            await load();
        } catch {
            notify.error("❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setSaving(null);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a" }}>🐛 เรื่องที่ผู้ใช้แจ้ง</h1>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                    ปัญหาและข้อเสนอแนะจากปุ่ม "แจ้งปัญหา" พร้อมหน้าที่ผู้แจ้งเปิดอยู่ตอนนั้น
                </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{ ...tabBtn, ...(tab === t.key ? tabBtnOn : {}) }}
                    >
                        {t.label} <span style={{ opacity: 0.75 }}>({counts[t.key] ?? 0})</span>
                    </button>
                ))}
                <input
                    className="input"
                    type="search"
                    placeholder="ค้นหาข้อความ / หน้า"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ minWidth: 220, marginLeft: "auto" }}
                />
                <button className="btn" style={ghostBtn} onClick={load}>🔄 รีเฟรช</button>
            </div>

            {error && <div role="alert" style={errorBox}>❌ {error}</div>}

            {loading ? (
                <div style={emptyBox}>กำลังโหลด...</div>
            ) : rows.length === 0 ? (
                <div style={emptyBox}>ยังไม่มีเรื่องในหมวดนี้</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {rows.map((f) => {
                        const open = openId === f.id;
                        const st = STATUS_TH[f.status];
                        return (
                            <div key={f.id} style={card}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ ...chip, background: st.bg, color: st.color }}>{st.label}</span>
                                    <span style={{ ...chip, background: "#f1f5f9", color: "#475569" }}>
                                        {f.kind === "BUG" ? "🐛 ปัญหาการใช้งาน" : "💡 ข้อเสนอแนะ"}
                                    </span>
                                    <b style={{ fontSize: 14, color: "#0f172a" }}>{f.reporterName}</b>
                                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                                        {ROLE_TH[f.reporterRole] || f.reporterRole} · {fmtDateTime(f.createdAt)}
                                    </span>
                                    <button style={{ ...ghostBtn, marginLeft: "auto" }} onClick={() => setOpenId(open ? null : f.id)}>
                                        {open ? "ย่อ" : "ดูรายละเอียด"}
                                    </button>
                                </div>

                                <div style={{ marginTop: 10, fontSize: 14.5, color: "#1e293b", whiteSpace: "pre-wrap" }}>{f.message}</div>

                                <div style={{ marginTop: 8, fontSize: 12.5, color: "#64748b" }}>
                                    หน้า <b>{f.pagePath || "-"}</b>
                                    {f.contextNote ? <> · สถานะตอนแจ้ง <b>{f.contextNote}</b></> : null}
                                </div>

                                {f.staffReply && !open && (
                                    <div style={replyShown}><b>ตอบแล้ว:</b> {f.staffReply}</div>
                                )}

                                {open && (
                                    <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                                        {f.imagePath && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={fieldLabel}>ภาพหน้าจอที่แนบมา</div>
                                                <a href={`/uploads/${f.imagePath}`} target="_blank" rel="noreferrer">
                                                    <img src={`/uploads/${f.imagePath}`} alt="ภาพหน้าจอจากผู้แจ้ง"
                                                        style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, border: "1px solid #e2e8f0" }} />
                                                </a>
                                            </div>
                                        )}

                                        <div style={fieldLabel}>เบราว์เซอร์ / อุปกรณ์</div>
                                        <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all", marginBottom: 12 }}>{f.userAgent || "-"}</div>

                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                                            <a className="btn" style={ghostBtn} href={logLink(f)}>📋 ดูบันทึกการใช้งานของผู้แจ้งวันนั้น</a>
                                            {f.pagePath && <a className="btn" style={ghostBtn} href={f.pagePath}>↗ เปิดหน้าที่แจ้ง</a>}
                                        </div>

                                        <div style={fieldLabel}>ตอบกลับผู้แจ้ง</div>
                                        <textarea
                                            value={replyDraft[f.id] ?? f.staffReply ?? ""}
                                            onChange={(e) => setReplyDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                                            rows={3}
                                            placeholder="เช่น แก้ไขแล้ว ลองอัปโหลดใหม่อีกครั้งได้เลย"
                                            style={textarea}
                                        />

                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <button
                                                className="btn"
                                                style={primaryBtn}
                                                disabled={saving === f.id}
                                                onClick={() => update(f.id, { staffReply: replyDraft[f.id] ?? f.staffReply ?? "", status: "RESOLVED" })}
                                            >
                                                {saving === f.id ? "กำลังบันทึก..." : "✅ ตอบกลับและปิดเรื่อง"}
                                            </button>
                                            <button
                                                className="btn"
                                                style={ghostBtn}
                                                disabled={saving === f.id}
                                                onClick={() => update(f.id, { staffReply: replyDraft[f.id] ?? f.staffReply ?? "", status: "IN_PROGRESS" })}
                                            >
                                                บันทึกและกำลังดูอยู่
                                            </button>
                                            {f.status !== "NEW" && (
                                                <button className="btn" style={ghostBtn} disabled={saving === f.id} onClick={() => update(f.id, { status: "NEW" })}>
                                                    กลับเป็นเรื่องใหม่
                                                </button>
                                            )}
                                        </div>

                                        {f.handledName && (
                                            <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                                                ล่าสุดโดย {f.handledName}{f.handledAt ? ` · ${fmtDateTime(f.handledAt)}` : ""}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const card: CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 };
const chip: CSSProperties = { fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 };
const tabBtn: CSSProperties = {
    padding: "7px 14px", borderRadius: 999, border: "1px solid #e2e8f0",
    background: "#fff", color: "#475569", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
};
const tabBtnOn: CSSProperties = { background: "#0f766e", borderColor: "#0f766e", color: "#fff" };
const ghostBtn: CSSProperties = {
    padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
    background: "#f8fafc", color: "#334155", fontSize: 13, fontWeight: 600,
    cursor: "pointer", textDecoration: "none", display: "inline-block",
};
const primaryBtn: CSSProperties = {
    padding: "8px 18px", borderRadius: 10, border: "none",
    background: "#0f766e", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
};
const textarea: CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1",
    fontSize: 14, fontFamily: "inherit", resize: "vertical", marginBottom: 10, boxSizing: "border-box",
};
const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 };
const replyShown: CSSProperties = {
    marginTop: 10, fontSize: 13, color: "#0f766e", background: "#f0fdfa",
    borderRadius: 8, padding: "8px 12px",
};
const emptyBox: CSSProperties = { padding: 40, textAlign: "center", color: "#94a3b8", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 };
const errorBox: CSSProperties = { padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", marginBottom: 12, fontSize: 14 };
