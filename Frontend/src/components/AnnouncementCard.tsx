// การ์ดประกาศ 1 รายการ (สไตล์สตรีมห้องเรียน) — ใช้ทั้งหน้าเจ้าหน้าที่/อาจารย์/นักศึกษา
import { useState, type CSSProperties } from "react";
import { fmtDate } from "../utils/dateFormat";
import { GLOBAL_ROOM, roomMeta, type Ann } from "../utils/announcements";

interface Props {
    a: Ann;
    isNew?: boolean;
    showRooms?: boolean;            // แสดงว่าส่งถึงหลักสูตรไหน (หน้าเจ้าหน้าที่)
    onEdit?: (a: Ann) => void;
    onDelete?: (a: Ann) => void;
    onTogglePin?: (a: Ann) => void;
    onPreviewImage?: (url: string) => void;
}

const safeHref = (url: string) => (/^https?:\/\//i.test(url) || url.startsWith("/uploads/") ? url : undefined);
const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`;
};

export default function AnnouncementCard({ a, isNew, showRooms, onEdit, onDelete, onTogglePin, onPreviewImage }: Props) {
    const [expanded, setExpanded] = useState(false);
    const body = a.body || "";
    const long = body.length > 320;
    const images = a.attachments.filter((x) => x.type === "image");
    const others = a.attachments.filter((x) => x.type !== "image");
    // ตัวอักษรในวงกลม — ข้ามสระนำภาษาไทย (เ แ โ ใ ไ) ไม่งั้น "เจ้าหน้าที่" ได้ "เ"
    const initial = (a.author || "").trim().replace(/^[เแโใไ]/, "").charAt(0);
    const rooms = a.targetMajors.length ? a.targetMajors : [GLOBAL_ROOM];

    return (
        <article style={{ ...card, ...(a.pinned ? pinnedCard : null), ...(a.scheduled ? scheduledCard : null) }}>
            <header style={head}>
                <div style={avatar} aria-hidden>{a.author ? initial : "📢"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{a.author || "ประกาศ"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        {a.scheduled && a.publishAt ? `⏰ เผยแพร่ ${fmtDateTime(a.publishAt)}` : fmtDate(a.date)}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isNew && <span style={{ ...badge, background: "#dc2626", color: "#fff" }}>ใหม่</span>}
                    {a.pinned && <span style={{ ...badge, background: "#fef3c7", color: "#92400e" }}>📌 ปักหมุด</span>}
                    {a.scheduled && <span style={{ ...badge, background: "#ede9fe", color: "#5b21b6" }}>ตั้งเวลาไว้</span>}
                </div>
            </header>

            <h3 style={title}>{a.title}</h3>
            {body && (
                <div style={bodyStyle}>
                    {long && !expanded ? `${body.slice(0, 320)}…` : body}
                    {long && (
                        <button type="button" style={linkBtn} onClick={() => setExpanded((v) => !v)}>
                            {expanded ? "ย่อ" : "อ่านเพิ่ม"}
                        </button>
                    )}
                </div>
            )}

            {images.length > 0 && (
                <div style={imageGrid}>
                    {images.map((img, i) => (
                        <button key={i} type="button" style={thumbBtn} onClick={() => onPreviewImage ? onPreviewImage(img.url) : window.open(img.url, "_blank")} title={img.name}>
                            <img src={img.url} alt={img.name} style={thumb} />
                        </button>
                    ))}
                </div>
            )}
            {others.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {others.map((at, i) => (
                        <a key={i} href={safeHref(at.url)} target="_blank" rel="noopener noreferrer" style={chip}>
                            <span aria-hidden>{at.type === "link" ? "🔗" : "📄"}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{at.name}</span>
                        </a>
                    ))}
                </div>
            )}

            {(showRooms || a.canEdit) && (
                <footer style={foot}>
                    {showRooms && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                            {rooms.map((r) => {
                                const m = roomMeta(r);
                                return <span key={r} style={{ ...roomChip, color: m.from, borderColor: m.from }}>{m.emoji} {r === GLOBAL_ROOM ? "ทุกหลักสูตร" : r}</span>;
                            })}
                        </div>
                    )}
                    {a.canEdit && (
                        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                            {onTogglePin && <button type="button" style={actBtn} onClick={() => onTogglePin(a)}>{a.pinned ? "เลิกปักหมุด" : "📌 ปักหมุด"}</button>}
                            {onEdit && <button type="button" style={actBtn} onClick={() => onEdit(a)}>แก้ไข</button>}
                            {onDelete && <button type="button" style={{ ...actBtn, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => onDelete(a)}>ลบ</button>}
                        </div>
                    )}
                </footer>
            )}
        </article>
    );
}

const card: CSSProperties = { background: "#fff", borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" };
const pinnedCard: CSSProperties = { borderColor: "#fcd34d", boxShadow: "0 0 0 1px #fde68a inset" };
const scheduledCard: CSSProperties = { borderStyle: "dashed", borderColor: "#c4b5fd", background: "#faf5ff" };
const head: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 };
const avatar: CSSProperties = { width: 36, height: 36, borderRadius: 999, background: "#e0e7ff", color: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 };
const badge: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" };
const title: CSSProperties = { margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#0f172a" };
const bodyStyle: CSSProperties = { fontSize: 14, color: "#334155", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const linkBtn: CSSProperties = { marginLeft: 6, background: "none", border: "none", color: "#2563eb", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 };
const imageGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginTop: 10 };
const thumbBtn: CSSProperties = { padding: 0, borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", borderRadius: 10, overflow: "hidden", cursor: "zoom-in", background: "#f8fafc", aspectRatio: "4 / 3" };
const thumb: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "#f8fafc", borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", color: "#1e293b", fontSize: 13, textDecoration: "none" };
const foot: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" };
const roomChip: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", background: "#fff" };
const actBtn: CSSProperties = { fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", color: "#334155", cursor: "pointer" };
