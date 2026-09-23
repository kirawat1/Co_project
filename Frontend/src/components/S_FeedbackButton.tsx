import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";

/**
 * ปุ่มแจ้งปัญหา — ลอยมุมขวาล่างของหน้านักศึกษา
 * ส่งบริบทไปด้วยอัตโนมัติ (หน้าที่เปิดอยู่ + สถานะสหกิจ) เพราะผู้แจ้งมักเขียนสั้น
 * เช่น "กดไม่ได้" ถ้าไม่มีบริบท เจ้าหน้าที่จะตามเรื่องต่อไม่ได้
 */
type Kind = "BUG" | "SUGGEST";
interface MyFeedback {
    id: number;
    kind: Kind;
    message: string;
    status: "NEW" | "IN_PROGRESS" | "RESOLVED";
    staffReply: string | null;
    pagePath: string | null;
    createdAt: string;
}

const STATUS_TH: Record<MyFeedback["status"], { label: string; bg: string; color: string }> = {
    NEW: { label: "ส่งแล้ว รอเจ้าหน้าที่", bg: "#fef9c3", color: "#854d0e" },
    IN_PROGRESS: { label: "เจ้าหน้าที่กำลังดู", bg: "#e0f2fe", color: "#0369a1" },
    RESOLVED: { label: "แก้ไขแล้ว", bg: "#dcfce7", color: "#166534" },
};

const MAX_IMAGE_MB = 8;

export default function S_FeedbackButton({ coopStatus }: { coopStatus?: string | null }) {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<Kind>("BUG");
    const [message, setMessage] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [mine, setMine] = useState<MyFeedback[]>([]);

    // โหลดเรื่องที่เคยแจ้งตอนเปิดกล่อง — ผู้ใช้จะได้เห็นว่าที่แจ้งไปแล้วคืบหน้าแค่ไหน
    useEffect(() => {
        if (!open) return;
        apiFetch("/api/feedback/me")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setMine(Array.isArray(d?.data) ? d.data : []))
            .catch(() => setMine([]));
    }, [open, done]);

    const close = () => {
        setOpen(false);
        setError("");
        setDone(false);
    };

    const pickImage = (file: File | null) => {
        if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
            setError(`ไฟล์ใหญ่เกิน ${MAX_IMAGE_MB} MB กรุณาย่อรูปก่อน`);
            return;
        }
        setError("");
        setImage(file);
    };

    const submit = async () => {
        if (message.trim().length < 5) {
            setError("ช่วยเล่ารายละเอียดอีกนิด (อย่างน้อย 5 ตัวอักษร)");
            return;
        }
        setSending(true);
        setError("");
        try {
            const form = new FormData();
            form.append("kind", kind);
            form.append("message", message.trim());
            form.append("pagePath", location.pathname);
            if (coopStatus) form.append("contextNote", coopStatus);
            if (image) form.append("image", image);

            const res = await apiFetch("/api/feedback", { method: "POST", body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setError(data.message || "ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่");
                return;
            }
            setMessage("");
            setImage(null);
            setDone(true);
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} style={fab} title="แจ้งปัญหาการใช้งาน">
                🐛 แจ้งปัญหา
            </button>

            {open && (
                <div style={overlay} onClick={close}>
                    <div style={panel} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <h3 style={{ margin: 0, fontSize: 18 }}>แจ้งปัญหา / ข้อเสนอแนะ</h3>
                            <button type="button" onClick={close} style={closeBtn} aria-label="ปิด">✕</button>
                        </div>
                        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b" }}>
                            เจออะไรผิดปกติบอกได้เลย ระบบจะแนบหน้าที่คุณเปิดอยู่ไปให้เจ้าหน้าที่ด้วย
                        </p>

                        {done ? (
                            <div style={{ ...noteBox, background: "#dcfce7", color: "#166534" }}>
                                ✅ ส่งเรื่องเรียบร้อย ขอบคุณที่ช่วยแจ้ง เจ้าหน้าที่จะตอบกลับผ่านแจ้งเตือนในระบบ
                                <div style={{ marginTop: 10 }}>
                                    <button type="button" style={ghostBtn} onClick={() => setDone(false)}>แจ้งเรื่องอื่นอีก</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    {([["BUG", "🐛 ใช้งานไม่ได้"], ["SUGGEST", "💡 ข้อเสนอแนะ"]] as [Kind, string][]).map(([k, label]) => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setKind(k)}
                                            style={{ ...kindBtn, ...(kind === k ? kindBtnOn : {}) }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <label htmlFor="fb-message" style={label}>เกิดอะไรขึ้น</label>
                                <textarea
                                    id="fb-message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={kind === "BUG"
                                        ? "เช่น กดส่งใบตอบรับแล้วขึ้นว่าไฟล์ใหญ่เกิน ทั้งที่ไฟล์ 2 MB"
                                        : "เช่น อยากให้แจ้งเตือนทางอีเมลตอนเจ้าหน้าที่ตรวจเอกสารเสร็จ"}
                                    rows={4}
                                    maxLength={2000}
                                    style={textarea}
                                />

                                <label htmlFor="fb-image" style={label}>แนบภาพหน้าจอ (ถ้ามี)</label>
                                <input
                                    id="fb-image"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => pickImage(e.target.files?.[0] || null)}
                                    style={{ fontSize: 13, marginBottom: 10 }}
                                />
                                {image && <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 10 }}>📎 {image.name}</div>}

                                <div style={ctxBox}>
                                    ระบบจะส่งไปด้วย: หน้า <b>{location.pathname}</b>
                                    {coopStatus ? <> · สถานะสหกิจ <b>{coopStatus}</b></> : null}
                                </div>

                                {error && <div role="alert" style={{ ...noteBox, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                                    <button type="button" style={ghostBtn} onClick={close}>ยกเลิก</button>
                                    <button type="button" style={sendBtn} onClick={submit} disabled={sending}>
                                        {sending ? "กำลังส่ง..." : "ส่งเรื่อง"}
                                    </button>
                                </div>
                            </>
                        )}

                        {mine.length > 0 && (
                            <div style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>เรื่องที่เคยแจ้ง</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                                    {mine.map((f) => (
                                        <div key={f.id} style={mineItem}>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                                <span style={{ ...statusChip, background: STATUS_TH[f.status].bg, color: STATUS_TH[f.status].color }}>
                                                    {STATUS_TH[f.status].label}
                                                </span>
                                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                                    {new Date(f.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{f.message}</div>
                                            {f.staffReply && (
                                                <div style={replyBox}><b>เจ้าหน้าที่:</b> {f.staffReply}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

const fab: CSSProperties = {
    position: "fixed", right: 18, bottom: 18, zIndex: 900,
    padding: "10px 16px", borderRadius: 999, border: "none",
    background: "#0f766e", color: "#fff", fontWeight: 700, fontSize: 14,
    boxShadow: "0 6px 18px rgba(15,118,110,0.35)", cursor: "pointer",
};
const overlay: CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 950,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const panel: CSSProperties = {
    background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 520,
    maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
};
const closeBtn: CSSProperties = { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" };
const label: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 };
const textarea: CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1",
    fontSize: 14, fontFamily: "inherit", resize: "vertical", marginBottom: 12, boxSizing: "border-box",
};
const kindBtn: CSSProperties = {
    flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1",
    background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const kindBtnOn: CSSProperties = { borderColor: "#0f766e", background: "#ecfdf5", color: "#0f766e" };
const ctxBox: CSSProperties = {
    fontSize: 12, color: "#64748b", background: "#f8fafc",
    border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
};
const noteBox: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.6 };
const ghostBtn: CSSProperties = {
    padding: "9px 16px", borderRadius: 10, border: "1px solid #e2e8f0",
    background: "#f8fafc", color: "#334155", fontWeight: 600, cursor: "pointer",
};
const sendBtn: CSSProperties = {
    padding: "9px 20px", borderRadius: 10, border: "none",
    background: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer",
};
const mineItem: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" };
const statusChip: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 };
const replyBox: CSSProperties = {
    marginTop: 6, fontSize: 12.5, color: "#0f766e", background: "#f0fdfa",
    borderRadius: 8, padding: "6px 10px",
};
