// ประกาศของนักศึกษา — ห้องเรียนของตัวเอง (รอบ × หลักสูตร) + ประกาศส่วนกลาง · server เลือกห้องให้เอง
import { LoadingBlock } from "./Spinner";
import { useEffect, useState, type CSSProperties } from "react";
import AnnouncementCard from "./AnnouncementCard";
import { fetchStream, roomMeta, yearLabel, seenIds, markSeen, GLOBAL_ROOM, type Ann, type AnnViewer } from "../utils/announcements";

export default function S_Announcements() {
    const [list, setList] = useState<Ann[]>([]);
    const [viewer, setViewer] = useState<AnnViewer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [fresh, setFresh] = useState<Set<string>>(new Set());
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        fetchStream()
            .then(({ list, viewer }) => {
                setList(list ?? []);
                setViewer(viewer ?? null);
                // ป้าย "ใหม่" = ยังไม่เคยเห็นบนเครื่องนี้ · เห็นแล้วจำไว้ (ป้ายยังแสดงจนออกจากหน้านี้)
                const seen = seenIds();
                setFresh(new Set((list ?? []).filter((a) => !seen.has(a.id)).map((a) => a.id)));
                markSeen((list ?? []).map((a) => a.id));
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const major = viewer?.majors?.[0] || null;
    const meta = roomMeta(major || GLOBAL_ROOM);

    return (
        <div className="page" style={{ padding: "8px 4px 40px", maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...banner, background: `linear-gradient(135deg, ${meta.from}, ${meta.to})` }}>
                <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>📢 ประกาศสหกิจศึกษา</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{meta.emoji} {major ? `หลักสูตร ${major}` : "ประกาศส่วนกลาง"}</div>
                <div style={{ opacity: 0.9, marginTop: 4 }}>{yearLabel(viewer?.year)}{major ? " · รวมประกาศส่วนกลาง" : " · ยังไม่ระบุหลักสูตร"}</div>
            </div>

            {loading ? <LoadingBlock text="กำลังโหลด…" style={empty} />
                : error ? <div style={{ ...empty, color: "#b91c1c" }}>⚠️ {error}</div>
                : !viewer?.year ? <div style={empty}>ยังไม่มีรอบสหกิจของคุณ — ประกาศจะขึ้นเมื่อเจ้าหน้าที่เปิดรอบของหลักสูตร</div>
                : list.length === 0 ? <div style={empty}>📭 ยังไม่มีประกาศในรอบนี้</div>
                : list.map((a) => <AnnouncementCard key={a.id} a={a} isNew={fresh.has(a.id)} onPreviewImage={setPreview} />)}

            {preview && (
                <div role="dialog" onClick={() => setPreview(null)} style={previewBackdrop}>
                    <img src={preview} alt="" style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 12 }} />
                </div>
            )}
        </div>
    );
}

const banner: CSSProperties = { borderRadius: 18, padding: "20px 24px 26px", color: "#fff", boxShadow: "0 4px 14px rgba(15,23,42,0.12)" };
const empty: CSSProperties = { padding: 40, textAlign: "center", color: "#64748b", background: "#fff", borderRadius: 14, border: "1px dashed #cbd5e1" };
const previewBackdrop: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out" };
