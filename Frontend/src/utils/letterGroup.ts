// หนังสือรวมหลายคน (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ) — รายชื่อนักศึกษาในหนังสือฉบับเดียว
// ใช้ร่วมกันทั้ง PDF (jsPDF) และ Word/ตัวอย่าง (HTML) · น้อยกว่า 2 คน = หนังสือเดี่ยวแบบเดิมทุกอย่าง
import { thaiPrefix, toThaiDate } from "./docGeneratorUtils";

export interface LetterStudent {
    name: string;
    studentId: string;
    studyProgram?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
}

/** นักศึกษา (รูปแบบจาก API) → รายการในหนังสือ · วันฝึกจริง → วันที่กรอกในฟอร์ม */
export function toLetterStudent(s: any): LetterStudent {
    return {
        name: `${thaiPrefix(s?.prefix)}${s?.firstName || ""} ${s?.lastName || ""}`.trim(),
        studentId: s?.studentId || "",
        studyProgram: s?.studyProgram,
        startDate: s?.coop?.actualStartDate || s?.coopApplicationForm?.startDate || null,
        endDate: s?.coop?.actualEndDate || s?.coopApplicationForm?.endDate || null,
    };
}

// เอกสารจากขั้นหลัง (หนังสือที่ออกแล้ว ใบตอบรับ T002/T003) — ไม่แนบในหนังสือขอความอนุเคราะห์
// เดิมแนบทุกไฟล์ของนักศึกษา: พิมพ์ซ้ำแล้วหนังสือฉบับเก่าที่ลงนามติดมาในเล่มใหม่
const NOT_LETTER_ATTACHMENTS = new Set(["DISPATCH_LETTER", "PLACEMENT_LETTER", "CP-ACCEPTANCE", "ACCEPTANCE_FORM", "T002_FORM", "T003_FORM", "T003"]);

/** เอกสารของนักศึกษาที่แนบท้ายหนังสือขอความอนุเคราะห์ (หนังสือรวม = ทุกคนเรียงตามรายชื่อ) */
export function letterAttachmentDocs<T extends { path?: string | null; type?: string | null }>(students: { documents?: T[] | null }[]): T[] {
    return students.flatMap((s) => s.documents || []).filter((d) => !!d.path && !NOT_LETTER_ATTACHMENTS.has(d.type || ""));
}

export const isGroup = (list?: LetterStudent[] | null): list is LetterStudent[] => Array.isArray(list) && list.length > 1;

/** ทุกคนฝึกช่วงเดียวกัน → ใช้ประโยคช่วงเวลาเดียว · ต่างกัน → ใส่วันของแต่ละคนท้ายชื่อ */
export function sameDates(list: LetterStudent[]): boolean {
    const key = (s: LetterStudent) => `${toThaiDate(s.startDate || undefined)}|${toThaiDate(s.endDate || undefined)}`;
    return list.every((s) => key(s) === key(list[0]));
}

/** แถวรายชื่อในหนังสือ (PDF/Word วาดเป็นคอลัมน์ ชื่อ · นามสกุล · รหัสประจำตัว ตามหนังสือจริง) · dates = วันฝึกของคนนั้น เมื่อแต่ละคนฝึกไม่พร้อมกัน */
export interface StudentRow { no: number; name: string; studentId: string; dates?: string }

export function studentRows(list: LetterStudent[], opts: { withDates?: boolean } = {}): StudentRow[] {
    return list.map((s, i) => ({
        no: i + 1,
        name: s.name,
        studentId: s.studentId,
        ...(opts.withDates ? { dates: `${toThaiDate(s.startDate || undefined)} – ${toThaiDate(s.endDate || undefined)}` } : {}),
    }));
}
