// ประกาศแบบห้องเรียน: เลือกรอบ → การ์ดห้อง (ส่วนกลาง + หลักสูตร) → สตรีมของห้อง
// ใช้ทั้งเจ้าหน้าที่ / อาจารย์ประจำวิชา (โพสต์ได้ตามสิทธิ์) และอาจารย์ทั่วไป (อ่านอย่างเดียว) — server บอกสิทธิ์ผ่าน canPost/canEdit
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate } from "../utils/dateFormat";
import { notify, askConfirm } from "../utils/notify";
import {
    GLOBAL_ROOM, roomMeta, yearLabel, fetchRooms, fetchStream, setPinned, deleteAnnouncement,
    type Ann, type AnnRoom, type AnnViewer,
} from "../utils/announcements";
import AnnouncementCard from "./AnnouncementCard";
import AnnouncementEditor from "./AnnouncementEditor";

const ROOM_KEY = "coop.annRoom"; // จำรอบ/ห้องที่เปิดล่าสุด (ต่อเครื่อง)

export default function AnnouncementRooms() {
    const [years, setYears] = useState<string[]>([]);
    const [year, setYear] = useState("");
    const [rooms, setRooms] = useState<AnnRoom[]>([]);
    const [viewer, setViewer] = useState<AnnViewer | null>(null);
    const [room, setRoom] = useState<string | null>(null);
    const [list, setList] = useState<Ann[]>([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState<{ initial: Ann | null } | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    // รอบ: จากรอบสหกิจ (เริ่มที่รอบที่เปิดอยู่/ล่าสุด) + รอบที่มีประกาศเก่า
    useEffect(() => {
        (async () => {
            const res = await apiFetch("/api/admin/coop-periods").then((r) => r.json()).catch(() => null);
            const periods: any[] = res?.periods ?? [];
            const fromPeriods = periods
                .slice()
                .sort((a, b) => Number(b.academicYear) - Number(a.academicYear) || Number(b.semester) - Number(a.semester))
                .map((p) => `${p.semester}/${p.academicYear}`);
            const active = periods.find((p) => p.isActive || p.majors?.some((m: any) => m.isActive));
            let saved: { year?: string; room?: string } = {};
            try { saved = JSON.parse(localStorage.getItem(ROOM_KEY) || "{}"); } catch { /* ignore */ }
            const first = saved.year && fromPeriods.includes(saved.year) ? saved.year : active ? `${active.semester}/${active.academicYear}` : fromPeriods[0] || "";
            setYears(fromPeriods);
            setYear(first);
            if (saved.room && saved.year === first) setRoom(saved.room);
        })();
    }, []);

    const loadRooms = useCallback(async () => {
        if (!year) return;
        try {
            const r = await fetchRooms(year);
            setRooms(r.rooms ?? []);
            setViewer(r.viewer ?? null);
            setYears((prev) => [...new Set([...prev, ...(r.years ?? [])])]);
        } catch (e: any) { notify.error(e.message); }
    }, [year]);

    const loadStream = useCallback(async () => {
        if (!year || !room) return;
        setLoading(true);
        try { setList((await fetchStream(year, room)).list ?? []); }
        catch (e: any) { notify.error(e.message); }
        finally { setLoading(false); }
    }, [year, room]);

    useEffect(() => { setLoading(true); loadRooms().finally(() => setLoading(false)); }, [loadRooms]);
    useEffect(() => { loadStream(); }, [loadStream]);
    useEffect(() => { try { localStorage.setItem(ROOM_KEY, JSON.stringify({ year, room })); } catch { /* ignore */ } }, [year, room]);

    const refresh = () => { loadRooms(); loadStream(); };
    const current = rooms.find((r) => r.room === room) || null;
    const canPostHere = !!current?.canPost;
    const writeMajors = viewer?.kind === "staff"
        ? rooms.filter((r) => r.room !== GLOBAL_ROOM).map((r) => r.room)
        : (viewer?.writeMajors ?? []);

    const togglePin = async (a: Ann) => {
        try { await setPinned(a.id, !a.pinned); refresh(); } catch (e: any) { notify.error(e.message); }
    };
    const remove = async (a: Ann) => {
        if (!(await askConfirm(`ลบประกาศ "${a.title}"? ลบแล้วกู้คืนไม่ได้`, { confirmLabel: "ลบประกาศ", danger: true }))) return;
        try { await deleteAnnouncement(a.id); notify.success("ลบประกาศแล้ว"); refresh(); } catch (e: any) { notify.error(e.message); }
    };

    const yearTabs = (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {years.map((y) => (
                <button key={y} type="button" onClick={() => { setYear(y); setRoom(null); }} aria-pressed={y === year}
                    style={{ ...tab, ...(y === year ? tabOn : null) }}>
                    {yearLabel(y)}
                </button>
            ))}
        </div>
    );

    return (
        <div className="page" style={{ padding: "8px 4px 40px", maxWidth: 1100, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>📢 ประกาศ</h1>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                        {room ? "สตรีมของห้อง · ประกาศส่วนกลางขึ้นทุกห้อง" : "เลือกรอบ แล้วเลือกห้องของหลักสูตร"}
                    </div>
                </div>
                {yearTabs}
            </header>

            {!room ? (
                /* ── การ์ดห้อง ── */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                    {loading && !rooms.length ? <div style={empty}>กำลังโหลด...</div> : rooms.map((r) => {
                        const m = roomMeta(r.room);
                        const n = r.room === GLOBAL_ROOM ? r.count : r.ownCount;
                        return (
                            <button key={r.room} type="button" onClick={() => setRoom(r.room)} style={roomCard}>
                                <div style={{ ...roomBanner, background: `linear-gradient(135deg, ${m.from}, ${m.to})` }}>
                                    <span style={{ fontSize: 28 }} aria-hidden>{m.emoji}</span>
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontSize: 18, fontWeight: 800 }}>{m.label}</div>
                                        <div style={{ fontSize: 12, opacity: 0.85 }}>{yearLabel(year)}</div>
                                    </div>
                                </div>
                                <div style={{ padding: "12px 16px", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>
                                        {n} ประกาศ{r.room !== GLOBAL_ROOM ? " ของหลักสูตร" : ""}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>
                                        {r.latest ? `ล่าสุด ${fmtDate(r.latest)}` : "ยังไม่มีประกาศ"}
                                        {r.pinned ? ` · 📌 ${r.pinned}` : ""}{r.scheduled ? ` · ⏰ ${r.scheduled}` : ""}
                                    </div>
                                    {!r.canPost && <div style={{ fontSize: 11, color: "#94a3b8" }}>อ่านอย่างเดียว</div>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                /* ── สตรีมของห้อง ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 820, margin: "0 auto" }}>
                    {(() => {
                        const m = roomMeta(room);
                        return (
                            <div style={{ ...streamBanner, background: `linear-gradient(135deg, ${m.from}, ${m.to})` }}>
                                <button type="button" onClick={() => setRoom(null)} style={backBtn}>← ทุกห้อง</button>
                                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 18 }}>{m.emoji} {m.label}</div>
                                <div style={{ opacity: 0.9, marginTop: 4 }}>{yearLabel(year)}{room !== GLOBAL_ROOM ? " · รวมประกาศส่วนกลาง" : " · ขึ้นในทุกห้อง"}</div>
                            </div>
                        );
                    })()}

                    {canPostHere && (
                        <button type="button" style={composer} onClick={() => setEditor({ initial: null })}>
                            <span style={composerAvatar} aria-hidden>📢</span>
                            <span style={{ color: "#64748b" }}>ประกาศอะไรให้{room === GLOBAL_ROOM ? "นักศึกษาทุกหลักสูตร" : `นักศึกษา ${room}`}…</span>
                        </button>
                    )}

                    {loading ? <div style={empty}>กำลังโหลด...</div>
                        : list.length === 0 ? <div style={empty}>📭 ยังไม่มีประกาศในห้องนี้</div>
                        : list.map((a) => (
                            <AnnouncementCard key={a.id} a={a} showRooms={viewer?.kind === "staff" || viewer?.kind === "coop"}
                                onEdit={(x) => setEditor({ initial: x })} onDelete={remove} onTogglePin={togglePin} onPreviewImage={setPreview} />
                        ))}
                </div>
            )}

            {editor && (
                <AnnouncementEditor
                    initial={editor.initial}
                    years={years}
                    year={year}
                    room={room || GLOBAL_ROOM}
                    majorChoices={writeMajors}
                    canGlobal={viewer?.kind === "staff"}
                    onClose={() => setEditor(null)}
                    onSaved={() => { setEditor(null); refresh(); }}
                />
            )}
            {preview && (
                <div role="dialog" onClick={() => setPreview(null)} style={previewBackdrop}>
                    <img src={preview} alt="" style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 12 }} />
                </div>
            )}
        </div>
    );
}

const tab: CSSProperties = { padding: "8px 14px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const tabOn: CSSProperties = { background: "#0f172a", borderColor: "#0f172a", color: "#fff" };
const empty: CSSProperties = { padding: 40, textAlign: "center", color: "#64748b", background: "#fff", borderRadius: 14, border: "1px dashed #cbd5e1" };
const roomCard: CSSProperties = { padding: 0, borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff", cursor: "pointer", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", textAlign: "left" };
const roomBanner: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "22px 16px", color: "#fff", minHeight: 90 };
const streamBanner: CSSProperties = { borderRadius: 18, padding: "18px 24px 26px", color: "#fff", boxShadow: "0 4px 14px rgba(15,23,42,0.12)" };
const backBtn: CSSProperties = { background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 999, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const composer: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: "#e2e8f0", background: "#fff", cursor: "text", fontSize: 14, textAlign: "left", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" };
const composerAvatar: CSSProperties = { width: 36, height: 36, borderRadius: 999, background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center" };
const previewBackdrop: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out" };
