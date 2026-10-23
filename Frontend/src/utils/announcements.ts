// ประกาศแบบห้องเรียน — ห้อง = รอบ × หลักสูตร · "ส่วนกลาง" (GLOBAL) = ประกาศถึงทุกหลักสูตร ขึ้นทุกห้องของรอบนั้น
// ใครเห็นอะไร server ตัดสินเอง (นักศึกษาส่ง year/room ไปก็ไม่มีผล)
import { apiFetch } from "./apiFetch";

export const GLOBAL_ROOM = "GLOBAL";

export interface AnnAttachment {
    id?: string;
    type: "link" | "file" | "image";
    name: string;
    url: string;
    rawFile?: File;
}

export interface Ann {
    id: string;
    title: string;
    body?: string | null;
    date: string;
    year: string;
    targetMajors: string[];
    pinned: boolean;
    publishAt: string | null;
    scheduled: boolean;
    createdAt?: string;
    author: string | null;
    canEdit: boolean;
    attachments: AnnAttachment[];
}

export interface AnnRoom {
    room: string;
    count: number;
    ownCount: number;
    pinned: number;
    scheduled: number;
    latest: string | null;
    canPost: boolean;
}

export interface AnnViewer {
    kind: "staff" | "coop" | "teacher" | "student" | "none";
    year?: string | null;
    majors?: string[] | null;
    writeMajors?: string[] | null;
}

async function getJson(url: string) {
    const res = await apiFetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.message || "โหลดประกาศไม่สำเร็จ");
    return data;
}

export async function fetchRooms(year: string): Promise<{ rooms: AnnRoom[]; viewer: AnnViewer; years: string[] }> {
    return getJson(`/api/announcements/rooms?${new URLSearchParams({ year })}`);
}

/** ห้องเดียว (เจ้าหน้าที่/อาจารย์) · ไม่ส่ง = ห้องของนักศึกษาเอง */
export async function fetchStream(year?: string, room?: string): Promise<{ list: Ann[]; viewer: AnnViewer }> {
    const q = new URLSearchParams();
    if (year) q.set("year", year);
    if (room) q.set("room", room);
    const qs = q.toString();
    return getJson(`/api/announcements${qs ? `?${qs}` : ""}`);
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
    const res = await apiFetch(`/api/announcements/${id}/pin`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "ปักหมุดไม่สำเร็จ");
}

export async function deleteAnnouncement(id: string): Promise<void> {
    const res = await apiFetch(`/api/announcements/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "ลบไม่สำเร็จ");
}

// ── หน้าตาห้อง ───────────────────────────────────────────────
const PALETTE = [
    ["#2563eb", "#1d4ed8"], ["#7c3aed", "#6d28d9"], ["#0891b2", "#0e7490"],
    ["#059669", "#047857"], ["#ea580c", "#c2410c"], ["#db2777", "#be185d"],
];
const EMOJI: Record<string, string> = { CS: "💻", AI: "🤖", IT: "🖧", GIS: "🗺️", CYB: "🛡️" };

export function roomMeta(room: string): { label: string; emoji: string; from: string; to: string } {
    if (room === GLOBAL_ROOM) return { label: "ส่วนกลาง", emoji: "🌐", from: "#334155", to: "#1e293b" };
    let h = 0;
    for (const ch of room) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [from, to] = PALETTE[h % PALETTE.length];
    return { label: `หลักสูตร ${room}`, emoji: EMOJI[room] || "🎓", from, to };
}

/** "2/2569" → "เทอม 2/2569" */
export const yearLabel = (y?: string | null) => (y ? `เทอม ${y}` : "ยังไม่มีรอบ");

/** ตัวเลือกในรายการรอบ — แบบเดียวกับหน้าอื่น ("2/2569" → "เทอม 2 / 2569") */
export const yearOptionLabel = (y: string) => { const [s, a] = y.split("/"); return `เทอม ${s} / ${a}`; };

/** จัดรอบ ("2/2569") เป็นกลุ่มตามปีการศึกษา ปีใหม่สุดก่อน เทอมมากก่อน (ไม่ซ้ำ) — สำหรับ <optgroup> */
export function groupYears(years: string[]): [string, string[]][] {
    const groups = new Map<string, Set<string>>();
    for (const y of years) {
        const academicYear = y.split("/")[1] || "";
        if (!groups.has(academicYear)) groups.set(academicYear, new Set());
        groups.get(academicYear)!.add(y);
    }
    const term = (y: string) => Number(y.split("/")[0]) || 0;
    return [...groups.entries()]
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([academicYear, set]) => [academicYear, [...set].sort((x, z) => term(z) - term(x))]);
}

// ── ป้าย "ใหม่" ฝั่งนักศึกษา (จำต่อเครื่อง) ───────────────────────
const seenKey = () => `coop.annSeen.${localStorage.getItem("coop.userId") || "anon"}`;

export function seenIds(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || "[]")); } catch { return new Set(); }
}

export function markSeen(ids: string[]): void {
    try {
        const all = [...new Set([...seenIds(), ...ids])].slice(-500);
        localStorage.setItem(seenKey(), JSON.stringify(all));
    } catch { /* ignore */ }
}
