// Frontend/src/utils/pdfLetter.ts
// วาดหนังสือราชการด้วย jsPDF ตามรูปแบบใน letterLayout.ts (ตัวอย่าง 811/893/1215) — ใช้กับหนังสือทั้ง 3 แบบ
// y ทุกตัวเป็นเส้นฐานบรรทัด (มม.) · ฟังก์ชันวาดคืนเส้นฐานของบรรทัดสุดท้ายที่วาด
import { jsPDF } from "jspdf";
import { normalizeDocNumber, type LetterEmblem, type LetterModel } from "./docGeneratorUtils";
import { LETTER, COLUMN_CENTER, ADDRESS_LINES, DRAFTER, layoutRuns, justifyLine, splitThaiName, type Run } from "./letterLayout";
import type { StudentRow } from "./letterGroup";

const FONT = "Sarabun";
const PT_TO_MM = 25.4 / 72;
let fontCache: Promise<[string, string]> | null = null;

const fontBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดฟอนต์ไม่ได้: ${url}`);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
};

/** หน้ากระดาษ A4 หน่วย มม. + ฟอนต์ TH Sarabun New (โหลดครั้งเดียว ใช้ซ้ำตอนออกหลายฉบับ) */
export async function newLetterDoc(): Promise<jsPDF> {
  fontCache ||= Promise.all([fontBase64("/fonts/THSarabunNew.ttf"), fontBase64("/fonts/THSarabunNew Bold.ttf")]);
  let fonts: [string, string];
  try { fonts = await fontCache; } catch (e) { fontCache = null; throw e; }
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("THSarabunNew.ttf", fonts[0]);
  doc.addFileToVFS("THSarabunNew Bold.ttf", fonts[1]);
  doc.addFont("THSarabunNew.ttf", FONT, "normal");
  doc.addFont("THSarabunNew Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
  doc.setFontSize(16);
  return doc;
}

const setBold = (doc: jsPDF, bold: boolean) => doc.setFont(FONT, bold ? "bold" : "normal");
const width = (doc: jsPDF, t: string, bold = false) => { setBold(doc, bold); return doc.getTextWidth(t); };

/** ข้อความยาวเกินหน้า → หน้าใหม่ (คืนเส้นฐานที่จะวาด) */
function room(doc: jsPDF, y: number, need = 0): number {
  if (y + need <= LETTER.bodyBottom) return y;
  doc.addPage();
  setBold(doc, false); doc.setFontSize(16);
  return LETTER.nextPageTop;
}

/** หัวหนังสือ: ตรากลางคอลัมน์ · "ที่ อว" ซ้าย + ที่อยู่ขวาระดับเดียวกัน (ข้างตรา) · วันที่เริ่มกลางคอลัมน์ → คืนเส้นฐานวันที่ */
export function drawHeader(doc: jsPDF, docNumber: string, dateText: string, emblem: LetterEmblem | null): number {
  if (emblem) {
    const w = emblem.widthPt * PT_TO_MM, h = emblem.heightPt * PT_TO_MM;
    doc.addImage(emblem.data, "PNG", COLUMN_CENTER - w / 2, LETTER.emblemTop, w, h, undefined, "FAST");
  }
  setBold(doc, false); doc.setFontSize(16);
  doc.text(`ที่ อว ${normalizeDocNumber(docNumber)}`, LETTER.left, LETTER.headerY);
  ADDRESS_LINES.forEach((l, i) => doc.text(l, LETTER.addressX, LETTER.headerY + i * LETTER.line));
  const y = LETTER.headerY + (ADDRESS_LINES.length - 1) * LETTER.line + 8;
  doc.text(dateText, LETTER.dateX, y);
  return y;
}

/** "เรื่อง"/"เรียน" ตัวหนา + ข้อความ (ยาวเกินบรรทัด → บรรทัดถัดไปเยื้องตรงข้อความ) */
export function drawLabelled(doc: jsPDF, y: number, label: string, text: string): number {
  setBold(doc, true);
  doc.text(label, LETTER.left, y);
  const x = LETTER.left + width(doc, label, true) + 2.5;
  return drawRuns(doc, y, [{ text }], { x, justify: false });
}

/** ย่อหน้า: ตัดคำภาษาไทย · จัดชิดสองข้าง · ตัวหนา/ขีดเส้นใต้เฉพาะช่วง · ล้นหน้า → หน้าใหม่ */
export function drawRuns(doc: jsPDF, y: number, runs: Run[], opts: { x?: number; indent?: number; justify?: boolean } = {}): number {
  const x0 = opts.x ?? LETTER.left;
  const lines = layoutRuns(runs, LETTER.right - x0, (t, b) => width(doc, t, b), opts.indent ?? 0);
  lines.forEach((line, li) => {
    if (li > 0) y += LETTER.line;
    y = room(doc, y);
    const lx = x0 + (li === 0 ? opts.indent ?? 0 : 0);
    const items = opts.justify === false ? line.items : justifyLine(line, li === lines.length - 1);
    let ul: [number, number] | null = null;
    const endUnderline = () => { if (ul) { doc.setLineWidth(0.25); doc.line(ul[0], y + 1.1, ul[1], y + 1.1); ul = null; } };
    for (const it of items) {
      setBold(doc, it.bold);
      doc.text(it.text, lx + it.x, y);
      if (it.underline) ul = ul ? [ul[0], lx + it.x + it.w] : [lx + it.x, lx + it.x + it.w];
      else endUnderline();
    }
    endUnderline();
  });
  setBold(doc, false);
  return y;
}

/** รายชื่อนักศึกษาแบบคอลัมน์ตามตัวอย่าง: "1. นายก  ข  รหัสประจำตัว  650000000" (ชื่อยาว → คอลัมน์ถัดไปขยับตาม) */
export function drawStudentRows(doc: jsPDF, y: number, rows: StudentRow[]): number {
  setBold(doc, false);
  rows.forEach((r, i) => {
    if (i > 0) y += LETTER.line;
    y = room(doc, y, r.dates ? LETTER.line : 0); // ชื่อกับบรรทัดวันฝึกของคนเดียวกันอยู่หน้าเดียวกัน
    const [given, family] = splitThaiName(r.name);
    const cells = [`${r.no}. ${given}`, family, "รหัสประจำตัว", r.studentId];
    let x: number = LETTER.listX[0];
    cells.forEach((c, ci) => {
      x = Math.max(x, LETTER.listX[ci]);
      doc.text(c, x, y);
      x += width(doc, c) + 3;
    });
    if (r.dates) { y = room(doc, y + LETTER.line); doc.text(`(${r.dates})`, LETTER.listX[1], y); }
  });
  return y;
}

/** คำลงท้าย + ที่ว่างลงนาม + ชื่อ/ตำแหน่ง (กึ่งกลางที่ signX) — ไม่พอที่ก่อนส่วนติดต่อ → หน้าใหม่ทั้งก้อน */
export function drawSignature(doc: jsPDF, y: number, deanName: string, deanPosition: string): number {
  let top = y;
  if (top + LETTER.signGap + LETTER.line > LETTER.bodyBottom) { doc.addPage(); top = 40; }
  setBold(doc, false); doc.setFontSize(16);
  doc.text("ขอแสดงความนับถือ", LETTER.signX, top, { align: "center" });
  doc.text(`(${deanName})`, LETTER.signX, top + LETTER.signGap, { align: "center" });
  doc.text(deanPosition, LETTER.signX, top + LETTER.signGap + LETTER.line, { align: "center" });
  return top + LETTER.signGap + LETTER.line;
}

const GAP_MM = 3.7;      // บรรทัดว่างครึ่งบรรทัด (ตรงกับ GAP ของ Word)
const PARA_GAP_MM = 4.2; // ย่อหน้าสุดท้าย → คำลงท้าย (ตรงกับ margin-top ของ .sig-block ใน Word)

/** วาดหนังสือทั้งฉบับจาก LetterModel (เนื้อหาเดียวกับ Word) — หน้าเดียวจบ หรือหลายหน้าเมื่อรายชื่อยาว */
export function renderLetterPdf(doc: jsPDF, m: LetterModel, emblem: LetterEmblem | null) {
  let y = drawHeader(doc, m.docNumber, m.dateText, emblem);
  for (const blk of m.blocks) {
    switch (blk.kind) {
      case "gap": y += GAP_MM; break;
      case "label": y = drawLabelled(doc, room(doc, y + LETTER.line), blk.label, blk.text); break;
      case "attachments":
        blk.items.forEach((it, i) => {
          y = room(doc, y + LETTER.line);
          if (i === 0) { setBold(doc, true); doc.text("สิ่งที่ส่งมาด้วย", LETTER.left, y); setBold(doc, false); }
          doc.text(it.text, LETTER.left + 25, y);
          doc.text(`จำนวน   ${it.count}   ชุด`, LETTER.addressX, y);
        });
        break;
      case "students": y = drawStudentRows(doc, y + LETTER.line, blk.rows); break;
      case "para": y = drawRuns(doc, y + LETTER.line, blk.runs, { indent: blk.indent }); break;
    }
  }
  drawSignature(doc, y + LETTER.line + PARA_GAP_MM, m.deanName, m.deanPosition);
  drawContactFooter(doc, m.contact);
}

/** ส่วนติดต่อท้ายกระดาษ (หน้าที่ลงนาม) · ผู้ร่าง/พิมพ์ ชิดขวาบรรทัดสุดท้าย */
export function drawContactFooter(doc: jsPDF, lines: string[]) {
  setBold(doc, false); doc.setFontSize(LETTER.footerSize);
  const first = LETTER.footerLastY - (lines.length - 1) * LETTER.footerLine;
  lines.forEach((l, i) => doc.text(l, LETTER.left, first + i * LETTER.footerLine));
  doc.text(DRAFTER, LETTER.right, LETTER.footerLastY, { align: "right" });
  doc.setFontSize(16);
}
