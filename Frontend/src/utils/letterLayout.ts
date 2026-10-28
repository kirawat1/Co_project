// Frontend/src/utils/letterLayout.ts
// รูปแบบหนังสือราชการตามหนังสือจริงที่ใช้อยู่ (เลขที่ 811 ขอความอนุเคราะห์ · 893 ส่งตัว · 1215 ขอนิเทศ)
// ตัวเลขวัดจากไฟล์สแกน หน่วย มม. จากขอบกระดาษ A4 — ใช้ร่วมกันทั้ง PDF (pdfLetter.ts) และ Word (docGeneratorUtils.ts)
// ไฟล์นี้ไม่พึ่งเบราว์เซอร์ (เทสต์ได้ใน Node)

export const LETTER = {
  left: 26,             // ขอบซ้ายข้อความ
  right: 190,           // ขอบขวาข้อความ (ขอบกระดาษขวา 2 ซม.)
  emblemTop: 17,        // ตราสัญลักษณ์มหาวิทยาลัย กึ่งกลางคอลัมน์ข้อความ
  emblemHeight: 40,     // ตราสูง 4 ซม. (วัดเฉพาะตัวตรา ไม่รวมขอบว่างของไฟล์รูป)
  headerY: 50,          // เส้นฐานบรรทัด "ที่ อว" = บรรทัดแรกของที่อยู่ (อยู่ข้างตรา)
  addressX: 140,        // ที่อยู่มหาวิทยาลัย ชิดซ้ายที่ 14 ซม.
  line: 7.5,            // ระยะบรรทัด 16pt
  dateX: 108,           // วันที่เริ่มกลางคอลัมน์ (ไม่จัดกึ่งกลาง)
  listX: [46.5, 87, 112.5, 140.5], // รายชื่อนักศึกษา: ลำดับ+ชื่อ · นามสกุล · "รหัสประจำตัว" · รหัส
  signX: 135,           // กึ่งกลางคำลงท้าย ชื่อ และตำแหน่งผู้ลงนาม
  signGap: 26,          // คำลงท้าย → ชื่อผู้ลงนาม (ที่ว่างให้ลงนามจริง)
  footerLastY: 283.4,   // เส้นฐานบรรทัดสุดท้ายของส่วนติดต่อ (บรรทัดอื่นต่อขึ้นไป · 3 บรรทัด → บรรทัดแรก ≈ 270)
  footerLine: 6.8,
  footerSize: 14,
  bodyBottom: 258,      // ข้อความต้องจบก่อนส่วนติดต่อ (ส่วนติดต่อ 4 บรรทัดของหนังสือขอนิเทศเริ่ม ≈ 259)
  nextPageTop: 25,
} as const;

export const COLUMN_CENTER = (LETTER.left + LETTER.right) / 2;
export const ADDRESS_LINES = ["มหาวิทยาลัยขอนแก่น", "123 ถนนมิตรภาพ", "อำเภอเมืองขอนแก่น", "จังหวัดขอนแก่น 40002"];
export const CONTACT_LINES = ["วิทยาลัยการคอมพิวเตอร์", "โทรศัพท์ 0 4300 9700 ต่อ 50523", "Email: wijika@kku.ac.th"];
export const DRAFTER = "ผู้ร่าง/พิมพ์: วิจิตรา ขจร";
export const REPLY_TO = "วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น 40002 หรือ E-mail: wijika@kku.ac.th";

/** ย่อหน้า: ขอความอนุเคราะห์/ขอนิเทศ 2 ซม. · ส่งตัว 2.5 ซม. (ตามตัวอย่างแต่ละแบบ) */
export const INDENT = { request: 20, placement: 25, supervision: 20 } as const;

/** "นายณรงค์ฤทธิ์ พาอามาศ" → ["นายณรงค์ฤทธิ์", "พาอามาศ"] (ตัดที่ช่องว่างแรก · ไม่มีนามสกุล → ช่องสองว่าง) */
export function splitThaiName(full: string): [string, string] {
  const s = (full || "").trim().replace(/\s+/g, " ");
  const i = s.indexOf(" ");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

/** ชื่อบริษัทในประโยค "ทางบริษัท …" / "ผู้จัดการบริษัท …" — ชื่อขึ้นต้นด้วย "บริษัท" อยู่แล้วไม่เติมซ้ำ (เดิมได้ "บริษัท บริษัท …") */
export function companyPhrase(name: string): string {
  const n = (name || "").trim();
  return /^บริษัท/.test(n) ? n : `บริษัท ${n}`;
}

// ── ตัดบรรทัดภาษาไทย ─────────────────────────────────────────────
// jsPDF ตัดบรรทัดที่ช่องว่างเท่านั้น ภาษาไทยไม่เว้นวรรคระหว่างคำ → บรรทัดสั้นยาวไม่เท่ากันมาก
// ตัดตามคำด้วย Intl.Segmenter แล้วจัดชิดสองข้างแบบ Word (Thai Distributed) ให้ขอบขวาตรงเหมือนหนังสือจริง

export interface Run { text: string; bold?: boolean; underline?: boolean }
export interface LaidItem { text: string; bold: boolean; underline: boolean; x: number; w: number }
export interface LaidLine { items: LaidItem[]; width: number; avail: number }

// คำที่ตัวตัดคำแยกเป็นหลายคำแต่ห้ามขึ้นบรรทัดใหม่กลางคำ (เดิมได้ "สห" / "กิจศึกษา")
const KEEP_WHOLE = /(สหกิจศึกษา|ภูมิสารสนเทศศาสตร์)/;

/** แยกเป็นคำ (ช่องว่างเป็นชิ้นของตัวเอง) — ไม่มี Intl.Segmenter → แยกเฉพาะที่ช่องว่าง */
export function segmentThai(text: string): string[] {
  const S = (Intl as any).Segmenter;
  const words = (part: string): string[] => S
    ? Array.from(new S("th", { granularity: "word" }).segment(part) as Iterable<{ segment: string }>, (s) => s.segment)
    : part.split(/(\s+)/).filter(Boolean);
  return text.split(KEEP_WHOLE).flatMap((part, i) => (i % 2 ? [part] : part ? words(part) : []));
}

/** แยกระดับตัวอักษรที่แสดงผล (สระ/วรรณยุกต์ติดพยัญชนะ) — ใช้กับคำที่ยาวเกินบรรทัด เช่น URL */
function graphemes(text: string): string[] {
  const S = (Intl as any).Segmenter;
  if (S) return Array.from(new S("th", { granularity: "grapheme" }).segment(text) as Iterable<{ segment: string }>, (s) => s.segment);
  return Array.from(text);
}

/**
 * จัดข้อความหลายช่วง (ตัวหนา/ขีดเส้นใต้ปนกัน) เป็นบรรทัด กว้าง width · บรรทัดแรกเยื้อง firstIndent
 * measure(text, bold) = ความกว้างข้อความ (หน่วยเดียวกับ width) · ช่องว่างหัว/ท้ายบรรทัดถูกตัดทิ้ง
 */
export function layoutRuns(runs: Run[], width: number, measure: (t: string, bold: boolean) => number, firstIndent = 0): LaidLine[] {
  type Tok = { text: string; bold: boolean; underline: boolean; w: number; space: boolean };
  const toks: Tok[] = [];
  for (const r of runs) {
    const bold = !!r.bold, underline = !!r.underline;
    for (const t of segmentThai(r.text)) {
      const prev = toks[toks.length - 1];
      const same = prev && prev.bold === bold && prev.underline === underline && !prev.space;
      // ไม่ตัดบรรทัดหลังวงเล็บเปิด/ก่อนวงเล็บปิดและเครื่องหมาย (เดิมได้ "จำกัด (" / "มหาชน)")
      if (same && (/^[(\[“"']+$/.test(prev.text) || /^[)\]”"',.:;!?]+$/.test(t))) {
        prev.text += t; prev.w = measure(prev.text, bold);
        continue;
      }
      toks.push({ text: t, bold, underline, w: measure(t, bold), space: /^\s+$/.test(t) });
    }
  }
  const lines: LaidLine[] = [];
  let cur: Tok[] = [], curW = 0;
  const avail = () => width - (lines.length === 0 ? firstIndent : 0);
  const flush = () => {
    while (cur.length && cur[cur.length - 1].space) curW -= cur.pop()!.w;
    let x = 0;
    lines.push({ items: cur.map((t) => { const it = { text: t.text, bold: t.bold, underline: t.underline, x, w: t.w }; x += t.w; return it; }), width: curW, avail: avail() });
    cur = []; curW = 0;
  };
  for (const tok of toks) {
    if (tok.space && cur.length === 0) continue;
    if (curW + tok.w <= avail() || tok.space) { cur.push(tok); curW += tok.w; continue; }
    if (cur.length) flush();
    if (tok.w <= avail()) { cur.push(tok); curW = tok.w; continue; }
    // คำเดียวยาวเกินบรรทัด → ตัดระดับตัวอักษร
    for (const g of graphemes(tok.text)) {
      const w = measure(g, tok.bold);
      if (curW + w > avail() && cur.length) flush();
      cur.push({ ...tok, text: g, w }); curW += w;
    }
  }
  if (cur.length) flush();
  return lines;
}

/**
 * ตำแหน่งจัดชิดสองข้าง: เพิ่มช่องไฟให้บรรทัดเต็มความกว้าง (บรรทัดสุดท้ายของย่อหน้าชิดซ้าย)
 * ช่องไฟส่วนใหญ่ลงที่ช่องว่างระหว่างวลี (น้ำหนัก 6) ส่วนรอยต่อคำไทยที่ติดกันได้นิดเดียว (น้ำหนัก 1)
 * — แบ่งเท่ากันทุกรอยต่อทำให้คำไทยดูถูกเว้นวรรคกลางคำ ("ตรวจ สอบ รายงาน")
 * ช่องว่างเหลือเกิน 35% ของบรรทัด (มีคำยาวมากขึ้นบรรทัดใหม่) → ชิดซ้าย ไม่ยืดจนห่างผิดตา
 */
export function justifyLine(line: LaidLine, isLast: boolean): LaidItem[] {
  const extra = line.avail - line.width;
  const n = line.items.length;
  if (isLast || n < 2 || extra <= 0 || extra > line.avail * 0.35) return line.items;
  const isSpace = (i: number) => /^\s+$/.test(line.items[i].text);
  const weights: number[] = line.items.map((_, i) => (i === 0 ? 0 : isSpace(i) || isSpace(i - 1) ? 6 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let shift = 0;
  return line.items.map((it, i) => {
    shift += (extra * weights[i]) / total;
    return { ...it, x: it.x + shift };
  });
}

// ── ตราสัญลักษณ์มหาวิทยาลัย ─────────────────────────────────────
/**
 * กรอบของตัวตราในรูป (ตัดขอบว่างโปร่งใส/ขาวรอบรูป) — ไฟล์ที่อัปโหลดมีขอบว่างมาก ตราจริงเลยเล็กกว่าที่ตั้งไว้
 * rgba = ข้อมูลพิกเซล RGBA เรียงแถว · ไม่มีพิกเซลที่มองเห็นเลย → ทั้งรูป
 */
export function trimBox(rgba: ArrayLike<number>, w: number, h: number): { x: number; y: number; w: number; h: number } {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] > 16 && !(rgba[i] > 240 && rgba[i + 1] > 240 && rgba[i + 2] > 240)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
