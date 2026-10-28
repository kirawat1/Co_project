// Frontend/src/utils/docGeneratorUtils.ts
// เนื้อหาหนังสือราชการของวิทยาลัยการคอมพิวเตอร์ มข. (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ) + สร้างไฟล์ Word (.doc)
// เนื้อหาสร้างครั้งเดียวเป็น LetterModel แล้ววาดเป็น Word (ไฟล์นี้) หรือ PDF (pdfLetter.ts) — สองแบบข้อความตรงกันเสมอ
// รูปแบบหน้ากระดาษตามหนังสือจริงเลขที่ 811/893/1215 (ค่าตำแหน่งใน letterLayout.ts)
import { isGroup, sameDates, studentRows, type LetterStudent, type StudentRow } from "./letterGroup";
import {
  LETTER, ADDRESS_LINES, CONTACT_LINES, DRAFTER, REPLY_TO, INDENT,
  splitThaiName, companyPhrase, type Run,
} from "./letterLayout";

const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function toThaiDate(dateStr?: string | Date): string {
  if (!dateStr) return "....................";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "....................";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** "วันอังคารที่ 2 กันยายน 2568" (วันนิเทศในหนังสือขอนิเทศ) */
export function toThaiDateWithDay(dateStr?: string | Date): string {
  const d = dateStr ? new Date(dateStr) : null;
  if (!d || isNaN(d.getTime())) return "วัน................ที่ ....................";
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${toThaiDate(d)}`;
}

export function thaiPrefix(prefix?: string): string {
  if (prefix === "MR") return "นาย";
  if (prefix === "MS") return "นางสาว";
  return prefix || "";
}

/**
 * อาจารย์ผู้นิเทศในหนังสือขอนิเทศ: อาจารย์หลัก + อาจารย์นิเทศร่วม
 * coTeacherName เก็บเป็นข้อความคั่นจุลภาค (มีคำนำหน้าแล้ว) เช่น "ผศ.ดร.ก ข, อ.ค ง"
 */
export function supervisionSupervisorNames(appt: any): string[] {
  const names: string[] = [];
  const t = appt?.teacher;
  if (t?.firstName) names.push(`${thaiPrefix(t.prefix)}${t.firstName} ${t.lastName || ""}`.trim());
  for (const n of String(appt?.coTeacherName || "").split(",").map(s => s.trim()).filter(Boolean)) {
    if (!names.includes(n)) names.push(n);
  }
  return names;
}

/** "A", "A และ B", "A, B และ C" (ชื่อมีช่องว่างอยู่แล้ว คั่นด้วยจุลภาคให้แยกคนออก) */
export function joinThaiNames(names: string[], fallback = "อาจารย์ผู้นิเทศ"): string {
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} และ ${names[names.length - 1]}`;
}

/** เวลานิเทศจากวันที่ยืนยัน (มีเวลาอยู่ในตัว) → "13.30 น." ตามเวลาท้องถิ่น */
export function supervisionTimeText(dateValue?: string | Date | null): string | undefined {
  if (!dateValue) return undefined;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return undefined;
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")} น.`;
}

/**
 * เลขที่หนังสือเก็บเป็นตัวเลขล้วน เช่น "660301.26.6.2/1234"
 * คำนำหน้า "ที่ อว" อยู่ในเทมเพลตหนังสือ — ตัดออกเผื่อข้อมูลเก่าหรือผู้ใช้พิมพ์ซ้ำมา
 * ไม่งั้นจะได้ "ที่ อว อว 660301..."
 */
export function normalizeDocNumber(docNumber?: string): string {
  if (!docNumber) return "";
  return docNumber.trim().replace(/^(?:ที่\s*)?(?:อว\.?\s*)/, "").trim();
}

/**
 * ชื่อหลักสูตรภาษาไทยในหนังสือ — student.major เป็นรหัสสาขา (CS/AI) ห้ามพิมพ์ลงหนังสือตรงๆ
 * majorNameTh มาจาก backend (CoopCriteria.nameTh) · ไม่มี → ใช้ major ถ้าเป็นภาษาไทย · ไม่งั้นค่าเริ่มต้นเดิม
 */
export function letterMajorName(student: any, fallback = "วิทยาการคอมพิวเตอร์"): string {
  if (student?.majorNameTh) return student.majorNameTh;
  const raw = String(student?.major || "").trim();
  return /[฀-๿]/.test(raw) ? raw : fallback;
}

/**
 * ชื่อสาขาภาษาไทยในแบบฟอร์มของนักศึกษา (T000/T003/หนังสือยินยอมผู้ปกครอง) — majorNameTh มาจาก /api/students/me
 * ไม่มีชื่อไทยใน criteria → ใช้ค่าที่เก็บไว้ (ดีกว่าเว้นว่างในแบบฟอร์ม)
 */
export function formMajorName(profile: any, fallback: string): string {
  return profile?.majorNameTh || String(profile?.major || "").trim() || fallback;
}

export function studyProgramLabel(sp?: string | null): string {
  const v = (sp || "").toLowerCase();
  if (v === "normal") return "ภาคปกติ";
  if (v === "special") return "ภาคพิเศษ";
  return "";
}

// ── เนื้อหาหนังสือ (ใช้ร่วม Word/PDF) ───────────────────────────────

/** ส่วนของเนื้อหาหนังสือตามลำดับ · gap = เว้นครึ่งบรรทัด · para indent 0 = ต่อจากรายชื่อ (ไม่ย่อหน้า) */
export type LetterBlock =
  | { kind: "label"; label: string; text: string }
  | { kind: "attachments"; items: { text: string; count: number }[] }
  | { kind: "para"; runs: Run[]; indent: number }
  | { kind: "students"; rows: StudentRow[] }
  | { kind: "gap" };

export interface LetterModel {
  docNumber: string;
  dateText: string;
  blocks: LetterBlock[];
  deanName: string;
  deanPosition: string;
  contact: string[];
}

const t = (text: string): Run => ({ text });
const b = (text: string): Run => ({ text, bold: true });

/** นักศึกษาคนเดียว = แถวเดียว · หนังสือรวม = ทุกคน (วันฝึกต่างกัน → วันท้ายชื่อแต่ละคน) */
function rowsOf(single: { studentName: string; studentId: string }, group: LetterStudent[] | null, withDates: boolean): StudentRow[] {
  return group ? studentRows(group, { withDates }) : [{ no: 1, name: single.studentName, studentId: single.studentId }];
}

export interface DispatchLetterOpts {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  major?: string | null;
  majorNameTh?: string | null;
  companyName: string;
  companyContact?: string;   // ผู้ติดต่อ เช่น "คุณบูรนันท์ สุวรรณปรีชา Human Resources Specialist"
  startDate: string;
  endDate: string;
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[]; // หนังสือรวมหลายคน (บริษัทเดียวกัน) — ไม่ส่ง/คนเดียว = หนังสือเดี่ยว
}

// ── 1. หนังสือขอความอนุเคราะห์ (ตัวอย่างเลขที่ 811) ──
export function dispatchLetterModel(o: DispatchLetterOpts): LetterModel {
  const group = isGroup(o.students) ? o.students : null;
  const same = group ? sameDates(group) : true;
  // major เป็นรหัสสาขา (CS/AI) — ต้องใช้ชื่อหลักสูตรภาษาไทยจริงของนักศึกษา ไม่ใช่ค่าคงที่
  const majorName = formMajorName({ major: o.major, majorNameTh: o.majorNameTh }, "วิทยาการคอมพิวเตอร์");
  const from = toThaiDate(group ? group[0].startDate || undefined : o.startDate);
  const to = toThaiDate(group ? group[0].endDate || undefined : o.endDate);
  const rows = rowsOf(o, group, !same);
  return {
    docNumber: o.docNumber, dateText: toThaiDate(o.docDate), deanName: o.deanName, deanPosition: o.deanPosition, contact: CONTACT_LINES,
    blocks: [
      { kind: "gap" },
      { kind: "label", label: "เรื่อง", text: "ขอความอนุเคราะห์พิจารณานักศึกษาเข้าร่วมปฏิบัติงานสหกิจศึกษา" },
      // ผู้รับ = ผู้ติดต่อ (ชื่อ + ตำแหน่ง) ไม่ต่อท้ายชื่อบริษัท (เดิม Word ต่อชื่อบริษัทจนล้นเป็น 2 บรรทัด)
      { kind: "label", label: "เรียน", text: o.companyContact || `กรรมการผู้จัดการ${companyPhrase(o.companyName)}` },
      { kind: "attachments", items: [
        { text: "1. รายละเอียดโครงการสหกิจศึกษา", count: 1 },
        { text: "2. ประวัตินักศึกษาและใบแสดงผลการเรียน", count: rows.length },
        { text: "3. แบบฟอร์มตอบรับนักศึกษาเข้าปฏิบัติงานในหน่วยงาน", count: 1 },
      ] },
      { kind: "gap" },
      { kind: "para", indent: INDENT.request, runs: [
        t(`ตามที่ ${o.companyName} ได้เข้าร่วมโครงการสหกิจศึกษากับมหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ และยินดีรับนักศึกษาหลักสูตร${majorName} เข้าปฏิบัติงานสหกิจศึกษากับบริษัทของท่าน ซึ่งมีกำหนดช่วงเวลาปฏิบัติงาน`),
        same ? b(` ระหว่างวันที่ ${from} ถึงวันที่ ${to}`) : t("ตามที่ระบุท้ายรายชื่อนักศึกษาแต่ละคน"),
        t(` นั้น ในการนี้ ทางวิทยาลัยการคอมพิวเตอร์ จึงใคร่ขอให้ท่านพิจารณานักศึกษาเข้าร่วมโครงการสหกิจศึกษากับทาง${companyPhrase(o.companyName)} จำนวน ${rows.length} คน ดังมีรายชื่อต่อไปนี้`),
      ] },
      { kind: "students", rows },
      { kind: "gap" },
      { kind: "para", indent: INDENT.request, runs: [
        t("จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ในการรับนักศึกษาเข้าร่วมโครงการสหกิจศึกษา หากผลการพิจารณาเป็นประการใด กรุณาแจ้งผลกลับมายัง"),
        { text: REPLY_TO, bold: true, underline: true },
        t(" ด้วยจักขอบคุณยิ่ง"),
      ] },
    ],
  };
}

export interface PlacementLetterOpts {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  major: string;               // ชื่อหลักสูตรภาษาไทย (letterMajorName)
  companyName: string;
  companyRecipient?: string;   // เช่น "ผู้อำนวยการอุทยานวิทยาศาสตร์ มหาวิทยาลัยขอนแก่น"
  startDate: string;
  endDate: string;
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[];  // หนังสือรวมหลายคน — วันฝึกต่างกันได้ (ใส่ท้ายชื่อแต่ละคน)
}

// ── 2. หนังสือส่งตัว (ตัวอย่างเลขที่ 893) ──
export function placementLetterModel(o: PlacementLetterOpts): LetterModel {
  const group = isGroup(o.students) ? o.students : null;
  const same = group ? sameDates(group) : true;
  const from = toThaiDate(group ? group[0].startDate || undefined : o.startDate);
  const to = toThaiDate(group ? group[0].endDate || undefined : o.endDate);
  const accepted = `ตามแบบตอบรับนักศึกษาปฏิบัติงานสหกิจศึกษา ที่ทาง${companyPhrase(o.companyName)} ยินดีรับนักศึกษาหลักสูตร${o.major} วิทยาลัยการคอมพิวเตอร์ เข้ารับการปฏิบัติงานทางด้าน${o.major}`;
  const period: Run[] = same
    ? [t("ในระหว่าง"), { text: `วันที่ ${from} ถึงวันที่ ${to}`, underline: true }]
    : [t("ตามช่วงเวลาที่ระบุท้ายรายชื่อข้างต้น")];
  const rest = t(" และขอความอนุเคราะห์จากท่านตรวจสอบรายงานผลการปฏิบัติงานของนักศึกษาสหกิจศึกษา และส่งกลับมายัง วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ภายหลังครบกำหนดระยะเวลาการปฏิบัติงานของนักศึกษา ภายใน 10 วัน เพื่อวิทยาลัยการคอมพิวเตอร์จักได้ดำเนินการประเมินผลการปฏิบัติงานสหกิจศึกษานักศึกษาดังกล่าวต่อไป ทั้งนี้ ใคร่ขอขอบพระคุณหน่วยงานของท่าน ที่ได้อนุเคราะห์ให้นักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษาในครั้งนี้ หวังเป็นอย่างยิ่งว่าจะได้รับความอนุเคราะห์จากท่านอีกในโอกาสต่อไป");
  const send = "ในการนี้ มหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ ใคร่ขอส่งตัวนักศึกษาปฏิบัติงานสหกิจศึกษาดังกล่าว เข้ารับการปฏิบัติงาน";
  const content: LetterBlock[] = group
    ? [
        { kind: "para", indent: INDENT.placement, runs: [t(`${accepted} จำนวน ${group.length} คน ดังมีรายชื่อต่อไปนี้`)] },
        { kind: "students", rows: studentRows(group, { withDates: !same }) },
        { kind: "para", indent: INDENT.placement, runs: [t(send), ...period, rest] },
      ]
    : [{ kind: "para", indent: INDENT.placement, runs: [t(`${accepted} จำนวน 1 คน คือ ${o.studentName} รหัสประจำตัว ${o.studentId} ${send}`), ...period, rest] }];
  return {
    docNumber: o.docNumber, dateText: toThaiDate(o.docDate), deanName: o.deanName, deanPosition: o.deanPosition, contact: CONTACT_LINES,
    blocks: [
      { kind: "gap" },
      { kind: "label", label: "เรื่อง", text: "ขอส่งตัวนักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษา" },
      { kind: "label", label: "เรียน", text: o.companyRecipient || `ผู้จัดการ${companyPhrase(o.companyName)}` },
      { kind: "gap" },
      ...content,
      { kind: "gap" },
      { kind: "para", indent: INDENT.placement, runs: [t("จึงเรียนมาเพื่อโปรดทราบ")] },
    ],
  };
}

export interface SupervisionLetterOpts {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  major?: string | null;
  majorNameTh?: string | null;
  companyName: string;
  companyRecipient?: string;  // เช่น "คุณคณิน ก้องเสนาะ Talent Acquisition Supervisor"
  supervisorNames: string[];  // อาจารย์นิเทศหลัก + ร่วม
  visitDate: string;
  visitTime?: string;         // เช่น "13.30 น."
  online?: boolean;           // นิเทศออนไลน์ (ไม่ใช่ = ณ สถานประกอบการ)
  onlineLink?: string | null;
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[]; // หนังสือรวมของกลุ่มนิเทศ (บริษัท/วันเดียวกัน)
}

// ── 3. หนังสือขอนิเทศ (ตัวอย่างเลขที่ 1215) ──
export function supervisionLetterModel(o: SupervisionLetterOpts): LetterModel {
  const group = isGroup(o.students) ? o.students : null;
  // major เป็นรหัสสาขา (CS/AI) — ต้องใช้ชื่อหลักสูตรภาษาไทยจริงของนักศึกษา ไม่ใช่ค่าคงที่
  const majorName = letterMajorName({ major: o.major, majorNameTh: o.majorNameTh });
  const where = o.online ? "ในรูปแบบออนไลน์" : " ณ สถานประกอบการ";
  const link = o.online && o.onlineLink ? ` (ลิงก์เข้าร่วม: ${o.onlineLink})` : "";
  const visit: Run[] = [
    t(`เข้าปฏิบัติงานสหกิจศึกษากับทาง${companyPhrase(o.companyName)} นั้น ในการนี้ สาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอเข้านิเทศนักศึกษาปฏิบัติงานสหกิจศึกษาในหน่วยงานของท่าน เพื่อแนะนำแนวทางการจัดทำรายงานสหกิจศึกษาและรับทราบปัญหาอุปสรรคของนักศึกษา${where} โดยนิเทศงาน `),
    b(`ใน${toThaiDateWithDay(o.visitDate)} เวลา ${o.visitTime || "13.30 น."}`),
    t(`${link} โดยมีอาจารย์ผู้นิเทศงานคือ ${joinThaiNames(o.supervisorNames)}`),
  ];
  const intro = `ตามที่ท่านให้ความอนุเคราะห์รับนักศึกษาสาขาวิชา${majorName} `;
  // หนังสือรวม: ย่อหน้าแนะนำ → รายชื่อ → ต่อประโยคเดิมไม่ย่อหน้า (ตามตัวอย่าง)
  const content: LetterBlock[] = group
    ? [
        { kind: "para", indent: INDENT.supervision, runs: [t(`${intro}จำนวน ${group.length} คน ดังมีรายชื่อต่อไปนี้`)] },
        { kind: "students", rows: studentRows(group) },
        { kind: "para", indent: 0, runs: visit },
      ]
    : [{ kind: "para", indent: INDENT.supervision, runs: [t(`${intro}จำนวน 1 คน คือ ${o.studentName} รหัสประจำตัว ${o.studentId} `), ...visit] }];
  return {
    docNumber: o.docNumber, dateText: toThaiDate(o.docDate), deanName: o.deanName, deanPosition: o.deanPosition,
    contact: [`สาขาวิชา${majorName}`, ...CONTACT_LINES],
    blocks: [
      { kind: "gap" },
      { kind: "label", label: "เรื่อง", text: "ขอเข้านิเทศงานนักศึกษาปฏิบัติงานสหกิจศึกษา" },
      { kind: "label", label: "เรียน", text: o.companyRecipient || "เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล" },
      { kind: "gap" },
      ...content,
      { kind: "gap" },
      { kind: "para", indent: INDENT.supervision, runs: [t(`สาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอขอบคุณท่านที่ให้ความอนุเคราะห์เข้านิเทศงาน และร่วมประเมินเบื้องต้นและแจ้งลักษณะการมอบหมายงานของนักศึกษาในครั้งนี้ด้วย จักขอบพระคุณยิ่ง`)] },
      { kind: "gap" },
      { kind: "para", indent: INDENT.supervision, runs: [t("จึงเรียนมาเพื่อโปรดทราบ")] },
    ],
  };
}

// ── Word / ตัวอย่างในหน้าต่าง (HTML) ──────────────────────────────

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mm = (n: number) => `${+n.toFixed(2)}mm`;
const TEXT_W = LETTER.right - LETTER.left;   // 164 มม.

const SHARED_LETTER_CSS = `
    p { margin: 0; }
    .center { text-align: center; }
    table { border-collapse: collapse; }
    td { vertical-align: top; padding: 0; }
    .gap { font-size: 8pt; }
    .body { text-align: justify; text-justify: inter-cluster; }
    .sig-block { margin-top: 12pt; margin-left: ${mm(2 * (LETTER.signX - LETTER.left) - TEXT_W)}; text-align: center; }
    .footer-table td { vertical-align: bottom; font-size: ${LETTER.footerSize}pt; }
    u { text-decoration: underline; }
`;

// บรรทัดว่างคั่นตอน (ครึ่งบรรทัด) — บรรทัดว่างเต็มทุกตอนทำให้หนังสือคนเดียวล้นไปหน้า 2 ใน Word
const GAP = `<p class="gap">&nbsp;</p>`;
// ช่องวางตราในหัวหนังสือ — createWordBlob/createPreviewBlob ใส่รูปจริง (Word อ้างไฟล์ใน MHTML · ตัวอย่างใช้ data URI)
const EMBLEM_SLOT = "<!--LETTER-EMBLEM-->";

/**
 * หัวหนังสือ: ตารางแถวเดียว "ที่ อว" | ตรา | ว่าง | ที่อยู่ 2 บรรทัดแรก — ชิดล่างทั้งแถว "ที่ อว" จึงอยู่ระดับบรรทัดแรกของที่อยู่ข้างตรา
 * ที่อยู่ 2 บรรทัดหลังอยู่ใต้ตาราง ชิดซ้ายที่ 14 ซม. · วันที่เริ่มกลางคอลัมน์
 */
function headerHtml(docNumber: string, dateText: string): string {
  const addrIndent = mm(LETTER.addressX - LETTER.left);
  return `<table style="width:${mm(TEXT_W)}">
  <tr>
    <td style="width:60mm;vertical-align:bottom"><p>ที่ อว ${esc(normalizeDocNumber(docNumber))}</p><p>&nbsp;</p></td>
    <td style="width:44mm;text-align:center">${EMBLEM_SLOT}</td>
    <td style="width:${mm(LETTER.addressX - LETTER.left - 104)}"></td>
    <td style="width:${mm(LETTER.right - LETTER.addressX)};vertical-align:bottom"><p>${ADDRESS_LINES[0]}</p><p>${ADDRESS_LINES[1]}</p></td>
  </tr>
</table>
<p style="margin-left:${addrIndent}">${ADDRESS_LINES[2]}</p>
<p style="margin-left:${addrIndent}">${ADDRESS_LINES[3]}</p>
<p style="margin-left:${mm(LETTER.dateX - LETTER.left)}">${esc(dateText)}</p>`;
}

function runsHtml(runs: Run[]): string {
  return runs.map((r) => {
    let h = esc(r.text);
    if (r.underline) h = `<u>${h}</u>`;
    if (r.bold) h = `<b>${h}</b>`;
    return h;
  }).join("");
}

// สิ่งที่ส่งมาด้วย: หัวข้อ 2.5 ซม. · รายการ → "จำนวน" ที่ 14 ซม.
function attachmentsHtml(items: { text: string; count: number }[]): string {
  const rows = items.map((it, i) => `  <tr>
    <td style="width:25mm" nowrap>${i === 0 ? "<b>สิ่งที่ส่งมาด้วย</b>" : ""}</td>
    <td style="width:${mm(LETTER.addressX - LETTER.left - 25)}">${esc(it.text)}</td>
    <td style="width:${mm(LETTER.right - LETTER.addressX)}">จำนวน&nbsp;&nbsp;&nbsp;${it.count}&nbsp;&nbsp;&nbsp;ชุด</td>
  </tr>`);
  return `<table style="width:${mm(TEXT_W)}">\n${rows.join("\n")}\n</table>`;
}

// รายชื่อเป็นคอลัมน์ตามหนังสือจริง: เยื้อง | ลำดับ+ชื่อ | นามสกุล | "รหัสประจำตัว" | รหัส · วันฝึกรายคนอยู่บรรทัดถัดไปใต้นามสกุล
function studentTableHtml(rows: StudentRow[]): string {
  const x = LETTER.listX;
  const w = [x[0] - LETTER.left, x[1] - x[0], x[2] - x[1], x[3] - x[2], LETTER.right - x[3]].map(mm);
  const tr = rows.map((r) => {
    const [given, family] = splitThaiName(r.name);
    // มีบรรทัดวันฝึก → แถวชื่อ "ไปกับแถวถัดไป" (Word) ไม่ให้วันฝึกแยกไปอีกหน้า
    const c = (html: string) => (r.dates ? `<p style="page-break-after:avoid">${html}</p>` : html);
    const main = `  <tr><td style="width:${w[0]}">${c("&nbsp;")}</td><td style="width:${w[1]}">${c(`${r.no}. ${esc(given)}`)}</td><td style="width:${w[2]}">${c(esc(family))}</td><td style="width:${w[3]}">${c("รหัสประจำตัว")}</td><td style="width:${w[4]}">${c(esc(r.studentId))}</td></tr>`;
    return r.dates ? `${main}\n  <tr><td></td><td></td><td colspan="3">(${esc(r.dates)})</td></tr>` : main;
  });
  return `<table style="width:${mm(TEXT_W)}">\n${tr.join("\n")}\n</table>`;
}

// ส่วนลงนาม: ทุกย่อหน้า "ไปกับย่อหน้าถัดไป" (Word) — ไม่ขาดกลางช่องลงนาม · ที่ว่างลงนาม 2 บรรทัดเต็ม + ครึ่งบรรทัด ≈ 2.6 ซม. ตามตัวอย่าง
function signatureBlockHtml(deanName: string, deanPosition: string): string {
  const p = (html: string, cls = "") => `<p${cls} style="page-break-after:avoid">${html}</p>`;
  return `<div class="sig-block">
  ${p("ขอแสดงความนับถือ")}
  ${p("&nbsp;")}${p("&nbsp;")}${p("&nbsp;", ' class="gap"')}
  ${p(`(${esc(deanName)})`)}
  ${p(esc(deanPosition))}
</div>`;
}

/**
 * ส่วนติดต่อ: ตารางลอยยึดตำแหน่งบนหน้ากระดาษ (ท้ายกระดาษหน้าที่หนังสือจบ เหมือนหนังสือจริง ไม่ต่อท้ายลายเซ็น)
 * ข้อความเนื้อหาไหลอ้อมตาราง → ยาวถึงตรงนั้นขึ้นหน้าใหม่เอง · ตัวอย่างในเบราว์เซอร์ไม่รู้จัก mso- จึงแสดงต่อท้ายตามปกติ
 */
// ยึดบรรทัดสุดท้ายไว้ที่ LETTER.footerLastY: บรรทัด 14pt ใน Word สูง ≈ 6.6 มม. เส้นฐานต่ำกว่าขอบบนบรรทัด ≈ 5.1 มม.
// (วัดด้วย Word: ตารางเริ่มต่ำไป ส่วนติดต่อ 4 บรรทัดล้นขอบล่างไปหน้า 2)
const footerTableTop = (lines: number) => +(LETTER.footerLastY - (lines - 1) * 6.6 - 5.1).toFixed(1);
function contactFooterHtml(lines: string[]): string {
  return `<table class="footer-table" style="width:${mm(TEXT_W)};mso-table-anchor-vertical:page;mso-table-anchor-horizontal:margin;mso-table-left:0;mso-table-top:${footerTableTop(lines.length)}mm;mso-table-lspace:0;mso-table-rspace:0;mso-padding-alt:0">
  <tr style="page-break-inside:avoid">
    <td style="width:110mm">
      ${lines.map((l) => `<p>${esc(l)}</p>`).join("\n      ")}
    </td>
    <td style="width:54mm;text-align:right">
      <p style="text-align:right">${DRAFTER}</p>
    </td>
  </tr>
</table>`;
}

/** LetterModel → HTML ของเนื้อหาหนังสือ (ใส่ใน createWordBlob / createPreviewBlob) */
export function renderLetterHtml(m: LetterModel): string {
  const blocks = m.blocks.map((blk) => {
    switch (blk.kind) {
      case "gap": return GAP;
      case "label": return `<p><b>${blk.label}</b>&nbsp;&nbsp;${esc(blk.text)}</p>`;
      case "attachments": return attachmentsHtml(blk.items);
      case "students": return studentTableHtml(blk.rows);
      case "para": return `<p class="body"${blk.indent ? ` style="text-indent:${mm(blk.indent)}"` : ""}>${runsHtml(blk.runs)}</p>`;
    }
  });
  return [headerHtml(m.docNumber, m.dateText), ...blocks, signatureBlockHtml(m.deanName, m.deanPosition), contactFooterHtml(m.contact)].join("\n");
}

export const buildDispatchLetterHtml = (o: DispatchLetterOpts) => renderLetterHtml(dispatchLetterModel(o));
export const buildPlacementLetterHtml = (o: PlacementLetterOpts) => renderLetterHtml(placementLetterModel(o));
export const buildSupervisionLetterHtml = (o: SupervisionLetterOpts) => renderLetterHtml(supervisionLetterModel(o));

/** สร้าง full HTML string สำหรับตัวอย่างในหน้าต่าง */
function buildFullHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light">
  <style>
    :root { color-scheme: light !important; }
    html { background: #ffffff !important; }
    body {
      font-family: "TH Sarabun New", "TH SarabunPSK", Sarabun, sans-serif;
      font-size: 16pt;
      line-height: 1.5;
      background: #ffffff !important;
      color: #000000 !important;
      margin: 40px 60px;
    }
    ${SHARED_LETTER_CSS}
    .footer-table { margin-top: 24pt; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** ตราสัญลักษณ์มหาวิทยาลัย (ไฟล์ระบบคีย์ KRUT) สำหรับหัวหนังสือ — ขนาดเป็น pt */
export interface LetterEmblem { data: Uint8Array; mime: string; widthPt: number; heightPt: number }

/** ขนาดตราบนหนังสือ: สูง 4 ซม. ตามหนังสือจริง (รูปที่ตัดขอบว่างแล้ว) คงสัดส่วน */
export function emblemSizePt(naturalWidth: number, naturalHeight: number): { widthPt: number; heightPt: number } {
  const heightPt = (LETTER.emblemHeight * 72) / 25.4;
  return { widthPt: (naturalWidth / naturalHeight) * heightPt, heightPt };
}

const emblemExt = (e: LetterEmblem) => (/png/i.test(e.mime) ? "png" : "jpg");

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ตรากลางช่องหัวหนังสือ · width/height ของ <img> เป็น px (96 dpi) ส่วน style เป็น pt ที่ Word ใช้จริง
// บรรทัดว่างเล็กใต้ตรา: แถวหัวหนังสือสูงกว่าตราเล็กน้อย ข้อความที่ชิดล่างจึงลงมาตรงหนังสือจริง ("ที่ อว" ≈ 5 ซม. จากขอบบน)
function emblemParagraph(src: string, e: LetterEmblem): string {
  const px = (pt: number) => Math.round((pt * 4) / 3);
  return `<p class="center emblem" style="margin:0"><img src="${src}" width="${px(e.widthPt)}" height="${px(e.heightPt)}" style="width:${e.widthPt.toFixed(1)}pt;height:${e.heightPt.toFixed(1)}pt" alt="ตราสัญลักษณ์มหาวิทยาลัย"></p>${GAP}`;
}

/** ใส่ตราลงช่องในหัวหนังสือ (ไม่มีตรา = ช่องว่าง) */
const placeEmblem = (bodyHtml: string, emblemHtml: string) => bodyHtml.replace(EMBLEM_SLOT, emblemHtml);

/** สร้าง Blob สำหรับ preview ในเบราว์เซอร์ — มีตรา = ใส่เป็น data URI (iframe ของ blob อ้างไฟล์ด้วย path ไม่ได้) */
export function createPreviewBlob(bodyHtml: string, emblem?: LetterEmblem | null): Blob {
  const img = emblem ? emblemParagraph(`data:${emblem.mime};base64,${bytesToBase64(emblem.data)}`, emblem) : "";
  return new Blob([buildFullHtml(placeEmblem(bodyHtml, img))], { type: "text/html; charset=utf-8" });
}

/**
 * สร้าง Word-compatible HTML Blob (.doc)
 * Word อ่านขนาด/ขอบกระดาษจาก @page ที่ตั้งชื่อ + div ของ section เท่านั้น (@page เปล่าถูกข้าม → ขอบ 1 นิ้วทุกด้าน)
 * ขอบตามหนังสือจริง: บน 1.7 (ตราอยู่ชิดบน) ซ้าย 2.6 ขวา 2 ล่าง 1 ซม. (ส่วนติดต่อเป็นตารางลอยยึดท้ายกระดาษ)
 * ย่อหน้าเล็กท้ายเอกสาร = ย่อหน้าที่ Word ต้องมีหลังตารางสุดท้าย (ไม่งั้น Word เติมย่อหน้าขนาดปกติจนล้นหน้า)
 * มีตรา → ไฟล์ MHTML (แบบ "Single File Web Page" ของ Word) ฝังรูปในไฟล์
 */
export function createWordBlob(bodyHtml: string, emblem?: LetterEmblem | null): Blob {
  const pageMargin = `${LETTER.emblemTop / 10}cm ${(210 - LETTER.right) / 10}cm 1cm ${LETTER.left / 10}cm`;
  const body = placeEmblem(bodyHtml, emblem ? emblemParagraph(`emblem.${emblemExt(emblem)}`, emblem) : "");
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <meta name="color-scheme" content="light only">
  <style>
    :root { color-scheme: light only; }
    @page WordSection1 { size: 21cm 29.7cm; margin: ${pageMargin}; mso-header-margin: 1cm; mso-footer-margin: 0.8cm; }
    div.WordSection1 { page: WordSection1; }
    html, body {
      font-family: "TH Sarabun New", "TH SarabunPSK", Sarabun, sans-serif;
      font-size: 16pt;
      line-height: 1.5;
      background: #ffffff !important;
      color: #000000 !important;
    }
    ${SHARED_LETTER_CSS}
  </style>
</head>
<body><div class="WordSection1">${body}
<p style="font-size:1pt;line-height:1pt;margin:0">&nbsp;</p></div></body>
</html>`;
  if (!emblem) return new Blob(["﻿", doc], { type: "application/msword" });
  return new Blob([wordMhtml(doc, emblem)], { type: "application/msword" });
}

// MHTML: ส่วน HTML + ส่วนรูป อ้างกันด้วย Content-Location (รูปใน <img src="emblem.png"> ชี้ไปส่วนที่สอง)
function wordMhtml(html: string, emblem: LetterEmblem): string {
  const boundary = "----=_NextPart_COOP_LETTER";
  const wrap = (b64: string) => b64.replace(/.{76}/g, "$&\r\n");
  return [
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "Content-Location: file:///C:/letter.htm",
    "",
    wrap(bytesToBase64(new TextEncoder().encode(html))),
    "",
    `--${boundary}`,
    `Content-Type: ${emblem.mime}`,
    "Content-Transfer-Encoding: base64",
    `Content-Location: file:///C:/emblem.${emblemExt(emblem)}`,
    "",
    wrap(bytesToBase64(emblem.data)),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
