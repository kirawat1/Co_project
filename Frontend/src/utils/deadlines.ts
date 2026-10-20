// ปฏิทินของรอบ — กำหนดส่งของแต่ละขั้น (ตรงกับ backend/utils/deadlines.js)
//   ค่าวิทยาลัย = ค่าตั้งต้นของรอบ · แถวหลักสูตร = ค่าที่ใช้จริง
//   HARD = เลยกำหนดส่งครั้งแรกไม่ได้ · SOFT = ส่งได้แต่ติดป้ายส่งช้า · closed = ปิดรับชั่วคราว
import { daysLeft } from "./deadline";
import { fmtDate } from "./dateFormat";

export type StepKey = "T000" | "T002" | "T003" | "T005_T006" | "T007" | "T008";
export type StepMode = "HARD" | "SOFT";
export interface DeadlineEntry { due: string | null; mode?: StepMode; closed?: boolean }
export type Deadlines = Partial<Record<StepKey, DeadlineEntry>>;

export const STEP_KEYS: StepKey[] = ["T000", "T002", "T003", "T005_T006", "T007", "T008"];
// ส่งในระบบ (เลือกโหมด/ปิดชั่วคราว/ขยายเวลาได้) — T005–T008 เป็นฟอร์มนอกระบบ แสดงวันอย่างเดียว
export const MODE_STEPS: StepKey[] = ["T000", "T002", "T003"];
export const STEP_LABEL: Record<StepKey, string> = {
    T000: "T000 เอกสารสมัคร",
    T002: "T002 รายละเอียดงาน",
    T003: "T003 โครงร่างรายงาน",
    T005_T006: "T005/T006 แบบประเมิน",
    T007: "T007 แบบประเมิน",
    T008: "T008 เล่มรายงาน",
};

export type Tone = "ok" | "warn" | "closed" | "info";

/** ป้ายสถานะของกำหนดส่ง ณ ตอนนี้ (เวลาไทย) */
export function deadlineStatus(
    w: { due: string | null; mode?: StepMode; closed?: boolean; canSubmit?: boolean },
    now = new Date(),
): { text: string; tone: Tone } {
    if (w.closed) return { text: "ปิดรับชั่วคราว", tone: "closed" };
    if (!w.due) return { text: "ไม่มีกำหนด", tone: "info" };
    const n = daysLeft(w.due, now);
    if (n >= 0) return { text: n === 0 ? "วันสุดท้าย" : `เหลือ ${n} วัน`, tone: n <= 3 ? "warn" : "ok" };
    if (w.mode === "SOFT") return { text: "เลยกำหนด · ส่งช้าได้", tone: "warn" };
    if (w.canSubmit) return { text: "เลยกำหนด · ขยายเวลาแล้ว", tone: "warn" };
    return { text: "ปิดแล้ว", tone: "closed" };
}

const canon = (e?: DeadlineEntry | null) => (e ? JSON.stringify([e.due || null, e.mode || null, e.closed === true]) : null);

/** ค่าของขั้นนี้ในหลักสูตรต่างจากค่าวิทยาลัยหรือไม่ (ไฮไลต์ช่อง) */
export function differsFromCollege(row?: DeadlineEntry | null, college?: DeadlineEntry | null): boolean {
    return canon(row) !== canon(college);
}

/** บันทึกค่าวิทยาลัย → หลักสูตรที่ควรติ๊กไว้ก่อน = ทุกขั้นที่เปลี่ยนครั้งนี้ ยังเท่าค่าวิทยาลัยเดิม (ยังไม่ได้ปรับเอง) */
export function suggestApplyTo(oldCollege: Deadlines, newCollege: Deadlines, rows: { major: string; deadlines: Deadlines | null }[]): string[] {
    const changed = STEP_KEYS.filter((k) => canon(oldCollege?.[k]) !== canon(newCollege?.[k]));
    if (!changed.length) return [];
    return rows
        .filter((r) => changed.every((k) => canon(r.deadlines?.[k]) === canon(oldCollege?.[k])))
        .map((r) => r.major);
}

// ค่าเดิมใน SystemConfig ที่หลักสูตรใช้อยู่ (รอบยังไม่ตั้งขั้นนั้น) — ช่วงรับเอกสาร T000–T003 / กำหนดส่งแบบฟอร์ม T005–T008
export type LegacyWindow = { isOpen: boolean; startDate: string | null; endDate: string | null } | null;
export type LegacyForm = { deadline: string } | null;

/** ข้อความสั้นของค่าที่ตั้งไว้ */
export function entryText(e?: DeadlineEntry | null): string {
    if (!e) return "—";
    const parts = [e.due ? fmtDate(e.due) : "ไม่มีวัน"];
    if (e.mode === "SOFT") parts.push("ส่งช้าได้");
    if (e.closed) parts.push("ปิดชั่วคราว");
    return parts.join(" · ");
}

/** ขั้นในไทม์ไลน์ของนักศึกษา (GET /api/coop/round-deadlines) */
export interface TimelineStep {
    stepKey: StepKey | "APPLY" | "SUPERVISION";
    label?: string;
    startDate?: string | null;
    due: string | null;
    isOpen?: boolean;
    mode?: StepMode;
    closed?: boolean;
    canSubmit?: boolean;
    late?: boolean;
    submittedAt?: string | null;
    extensionUntil?: string | null;
}

/** ป้ายของขั้นในไทม์ไลน์ — ส่งแล้ว (ทัน/ช้า) · ยังไม่ส่ง = ป้ายกำหนดส่ง · ยื่นคำร้อง = เปิด/ปิด · ช่วงนิเทศ = ไม่มีป้าย */
export function timelineStatus(s: TimelineStep, now = new Date()): { text: string; tone: Tone } | null {
    if (s.stepKey === "SUPERVISION") return null;
    if (s.stepKey === "APPLY") return s.isOpen ? { text: "เปิดรับอยู่", tone: "ok" } : { text: "ปิดแล้ว", tone: "info" };
    if (s.submittedAt) {
        const day = new Date(s.submittedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
        return s.due && day > s.due ? { text: "ส่งแล้ว (ช้า)", tone: "warn" } : { text: "ส่งแล้ว", tone: "ok" };
    }
    return deadlineStatus({ due: s.due, mode: s.mode, closed: s.closed, canSubmit: s.canSubmit }, now);
}

/** ขยายเวลารายคน (StudentCoop.deadlineExtensions) เป็นข้อความสั้น */
export function extensionSummary(ext?: Partial<Record<StepKey, string>> | null): string {
    if (!ext) return "";
    return MODE_STEPS.filter((k) => ext[k]).map((k) => `${k} ถึง ${fmtDate(ext[k]!)}`).join(" · ");
}

/** ข้อความของค่าเดิม */
export function legacyText(l?: LegacyWindow | LegacyForm): string {
    if (!l) return "ไม่มีกำหนด";
    if ("deadline" in l) return `ส่งภายใน ${fmtDate(l.deadline)}`;
    if (!l.isOpen) return "ปิดระบบอยู่";
    if (l.startDate || l.endDate) return `${l.startDate ? fmtDate(l.startDate) : "…"} – ${l.endDate ? fmtDate(l.endDate) : "…"}`;
    return "เปิดตลอด";
}
