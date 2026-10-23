// หน้าต่างเขียน/แก้ไขประกาศ — ส่งถึงห้องไหน · ไฟล์/รูป/ลิงก์ · ปักหมุด · ตั้งเวลาเผยแพร่
import { BusyLabel } from "./Spinner";
import { useState, type CSSProperties } from "react";
import Modal from "./Modal";
import AutoTextarea from "./AutoTextarea";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import { GLOBAL_ROOM, roomMeta, yearLabel, type Ann, type AnnAttachment } from "../utils/announcements";

interface Props {
    initial: Ann | null;          // null = ประกาศใหม่
    years: string[];              // รอบที่เลือกได้ ("2/2569")
    year: string;                 // รอบเริ่มต้น
    room: string;                 // ห้องที่เปิดอยู่ (ประกาศใหม่ส่งถึงห้องนี้ก่อน)
    majorChoices: string[];       // หลักสูตรที่ประกาศได้
    canGlobal: boolean;           // ประกาศส่วนกลางได้ (เจ้าหน้าที่)
    onClose: () => void;
    onSaved: () => void;
}

// datetime-local ใช้เวลาท้องถิ่น "YYYY-MM-DDTHH:mm"
const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function AnnouncementEditor({ initial, years, year: year0, room, majorChoices, canGlobal, onClose, onSaved }: Props) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [body, setBody] = useState(initial?.body ?? "");
    const [year, setYear] = useState(initial?.year ?? year0);
    const [targets, setTargets] = useState<string[]>(
        initial ? initial.targetMajors : room === GLOBAL_ROOM ? [] : [room],
    );
    const [attachments, setAttachments] = useState<AnnAttachment[]>(initial?.attachments ?? []);
    const [pinned, setPinned] = useState(initial?.pinned ?? false);
    const [schedule, setSchedule] = useState(!!initial?.scheduled);
    const [publishAt, setPublishAt] = useState(initial?.publishAt && initial.scheduled ? toLocalInput(initial.publishAt) : "");
    const [linkDraft, setLinkDraft] = useState<string | null>(null);
    const [linkError, setLinkError] = useState("");
    const [saving, setSaving] = useState(false);
    const isGlobal = targets.length === 0;

    const toggleMajor = (m: string) => setTargets((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    const addFiles = (files: FileList | null, type: "file" | "image") => {
        if (!files) return;
        setAttachments((prev) => [...prev, ...Array.from(files).map((f) => ({ type, name: f.name, url: URL.createObjectURL(f), rawFile: f }))]);
    };
    const addLink = () => {
        const url = (linkDraft ?? "").trim();
        if (!/^https?:\/\//i.test(url)) { setLinkError("URL ต้องเริ่มต้นด้วย https:// หรือ http://"); return; }
        setAttachments((prev) => [...prev, { type: "link", name: url, url }]);
        setLinkDraft(null);
        setLinkError("");
    };

    const save = async () => {
        if (!title.trim()) return notify.warning("กรุณากรอกหัวข้อประกาศ");
        if (!canGlobal && isGlobal) return notify.warning("เลือกหลักสูตรที่จะประกาศอย่างน้อย 1 หลักสูตร");
        if (schedule && !publishAt) return notify.warning("เลือกวันเวลาเผยแพร่");
        if (schedule && new Date(publishAt) <= new Date()) return notify.warning("เวลาเผยแพร่ต้องเป็นเวลาในอนาคต");
        const when = schedule ? new Date(publishAt) : null;
        const form = new FormData();
        if (initial) form.append("id", initial.id);
        form.append("title", title.trim());
        form.append("body", body);
        // วันที่ของประกาศ = วันเผยแพร่ (ตั้งเวลา) · แก้ไขคงวันที่เดิม · ใหม่ = วันนี้
        form.append("date", when ? when.toISOString() : initial?.date ?? new Date().toISOString());
        form.append("year", year);
        form.append("targetMajors", JSON.stringify(targets));
        form.append("pinned", String(pinned));
        if (when) form.append("publishAt", when.toISOString());
        attachments.forEach((a) => { if (a.rawFile) form.append("attachments", a.rawFile); });
        const links = attachments.filter((a) => a.type === "link").map((a) => a.url);
        if (links.length) form.append("linkUrls", JSON.stringify(links));
        const keep = attachments.filter((a) => a.id).map((a) => a.id!);
        if (keep.length) form.append("keepFileIds", JSON.stringify(keep));

        setSaving(true);
        try {
            const res = await apiFetch("/api/announcements", { method: "POST", body: form });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.message || "บันทึกประกาศไม่สำเร็จ");
            notify.success(initial ? "แก้ไขประกาศแล้ว" : when ? "ตั้งเวลาเผยแพร่แล้ว — นักศึกษาจะเห็นและได้แจ้งเตือนเมื่อถึงเวลา" : "เผยแพร่ประกาศแล้ว — แจ้งเตือนนักศึกษาแล้ว");
            onSaved();
        } catch (e: any) {
            notify.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={initial ? "✏️ แก้ไขประกาศ" : "📢 ประกาศใหม่"} onClose={onClose} maxWidth={680} closeOnBackdropClick={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                    <div style={label}>ส่งถึง</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {canGlobal && (
                            <button type="button" onClick={() => setTargets([])} aria-pressed={isGlobal} style={{ ...pill, ...(isGlobal ? pillOn("#334155") : null) }}>
                                🌐 ทุกหลักสูตร (ส่วนกลาง)
                            </button>
                        )}
                        {majorChoices.map((m) => {
                            const meta = roomMeta(m);
                            const on = targets.includes(m);
                            return (
                                <button key={m} type="button" onClick={() => toggleMajor(m)} aria-pressed={on} style={{ ...pill, ...(on ? pillOn(meta.from) : null) }}>
                                    {meta.emoji} {m}
                                </button>
                            );
                        })}
                    </div>
                    <div style={hint}>{isGlobal ? "ขึ้นในทุกห้องของรอบนี้ · แจ้งเตือนนักศึกษาทุกหลักสูตรในรอบ" : `ขึ้นในห้อง ${targets.join(", ")} · แจ้งเตือนนักศึกษาหลักสูตรนั้นในรอบ`}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
                    <label>
                        <div style={label}>หัวข้อ</div>
                        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น กำหนดส่งเอกสาร T002" style={{ width: "100%" }} autoFocus />
                    </label>
                    <label>
                        <div style={label}>รอบ</div>
                        <select className="input" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "100%" }}>
                            {[...new Set([year, ...years])].map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
                        </select>
                    </label>
                </div>

                <label>
                    <div style={label}>รายละเอียด</div>
                    <AutoTextarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="รายละเอียดประกาศ..." style={{ width: "100%" }} />
                </label>

                <div>
                    <div style={label}>ไฟล์แนบ · รูปภาพ · ลิงก์</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <label style={smallBtn}>📄 ไฟล์<input type="file" hidden multiple onChange={(e) => addFiles(e.target.files, "file")} /></label>
                        <label style={smallBtn}>🖼️ รูปภาพ<input type="file" hidden multiple accept="image/*" onChange={(e) => addFiles(e.target.files, "image")} /></label>
                        <button type="button" style={smallBtn} onClick={() => { setLinkDraft(linkDraft === null ? "" : null); setLinkError(""); }}>🔗 ลิงก์</button>
                    </div>
                    {linkDraft !== null && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input className="input" type="url" autoFocus placeholder="https://..." value={linkDraft} onChange={(e) => { setLinkDraft(e.target.value); setLinkError(""); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} style={{ flex: 1 }} />
                            <button type="button" className="btn" onClick={addLink}>เพิ่ม</button>
                        </div>
                    )}
                    {linkError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{linkError}</div>}
                    {attachments.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                            {attachments.map((a, i) => (
                                <span key={i} style={attChip}>
                                    {a.type === "link" ? "🔗" : a.type === "image" ? "🖼️" : "📄"}
                                    <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                                    <button type="button" aria-label={`เอา ${a.name} ออก`} onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} style={xBtn}>×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
                    <label style={optionBox}>
                        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                        <span><b>📌 ปักหมุด</b><br /><span style={hint}>อยู่บนสุดของห้อง</span></span>
                    </label>
                    <div style={optionBox}>
                        <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} id="ann-schedule" />
                        <label htmlFor="ann-schedule" style={{ flex: 1 }}>
                            <b>⏰ ตั้งเวลาเผยแพร่</b><br />
                            {schedule
                                ? <input className="input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} style={{ marginTop: 6, width: "100%" }} />
                                : <span style={hint}>ไม่ติ๊ก = เผยแพร่และแจ้งเตือนทันที</span>}
                        </label>
                    </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                    <button type="button" className="btn-secondary" onClick={onClose}>ยกเลิก</button>
                    <button type="button" className="btn" disabled={saving} onClick={save}>
                        {saving ? <BusyLabel text="กำลังบันทึก…" /> : initial ? "บันทึก" : schedule ? "⏰ ตั้งเวลาเผยแพร่" : "📢 ประกาศ"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 };
const hint: CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 6 };
const pill: CSSProperties = { padding: "7px 14px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const pillOn = (c: string): CSSProperties => ({ background: c, borderColor: c, color: "#fff" });
const smallBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#334155" };
const attChip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 10px", borderRadius: 999, background: "#f1f5f9", fontSize: 12 };
const xBtn: CSSProperties = { border: "none", background: "#e2e8f0", borderRadius: 999, width: 20, height: 20, cursor: "pointer", lineHeight: "18px" };
const optionBox: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14 };
