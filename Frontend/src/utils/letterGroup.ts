// หนังสือรวมหลายคน (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ) — รายชื่อนักศึกษาในหนังสือฉบับเดียว
// ใช้ร่วมกันทั้ง PDF (jsPDF) และ Word/ตัวอย่าง (HTML) · น้อยกว่า 2 คน = หนังสือเดี่ยวแบบเดิมทุกอย่าง
import { thaiPrefix, toThaiDate, studyProgramLabel } from "./docGeneratorUtils";

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

/** บรรทัดรายชื่อ: "1. นายก ข  รหัสประจำตัว 650000001  ภาคปกติ  (1 มิถุนายน 2569 – 30 กันยายน 2569)" */
export function studentLines(list: LetterStudent[], opts: { withDates?: boolean; withProgram?: boolean } = {}): string[] {
    return list.map((s, i) => {
        const parts = [`${i + 1}. ${s.name}`, `รหัสประจำตัว ${s.studentId}`];
        const sp = opts.withProgram ? studyProgramLabel(s.studyProgram || undefined) : "";
        if (sp) parts.push(sp);
        let line = parts.join("   ");
        if (opts.withDates) line += `   (${toThaiDate(s.startDate || undefined)} – ${toThaiDate(s.endDate || undefined)})`;
        return line;
    });
}

/** รายชื่อแบบ HTML (Word/ตัวอย่าง) — ย่อหน้าเดียวกับเนื้อหา */
export function studentListHtml(list: LetterStudent[], opts: { withDates?: boolean; withProgram?: boolean } = {}): string {
    return studentLines(list, opts).map((l) => `<p style="margin-left:36pt">${l.replace(/ {3}/g, "&nbsp;&nbsp;&nbsp;")}</p>`).join("\n");
}
