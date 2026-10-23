// Frontend/src/utils/docGeneratorUtils.ts
// สร้างไฟล์ Word (.doc) ตามรูปแบบหนังสือราชการของวิทยาลัยการคอมพิวเตอร์ มข.
import { isGroup, sameDates, studentListHtml, type LetterStudent } from "./letterGroup";

const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
];

export function toThaiDate(dateStr?: string | Date): string {
  if (!dateStr) return "....................";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "....................";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
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

const SHARED_LETTER_CSS = `
    p { margin: 0; }
    .center { text-align: center; }
    .right { text-align: right; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; padding: 0 4px; }
    .gap { font-size: 8pt; }
    .sig-block { margin-top: 20pt; text-align: center; }
    .footer-table { margin-top: 30pt; width: 100%; }
    .footer-table td { vertical-align: bottom; font-size: 12pt; }
    u { text-decoration: underline; }
`;

// บรรทัดว่างคั่นตอน (ครึ่งบรรทัด) — บรรทัดว่างเต็มทุกตอนทำให้หนังสือคนเดียวล้นไปหน้า 2 ใน Word
const GAP = `<p class="gap">&nbsp;</p>`;

// ส่วนลงนาม: ทุกย่อหน้า "ไปกับย่อหน้าถัดไป" (Word) — ลงนามกับส่วนติดต่อย้ายหน้าไปด้วยกัน ไม่ขาดกลางช่องลงนาม
// เว้นที่ว่าง 3 บรรทัดเต็มให้คณบดีลงนามจริง
function signatureBlockHtml(deanName: string, deanPosition: string): string {
  const p = (html: string) => `<p style="page-break-after:avoid">${html}</p>`;
  return `<div class="sig-block">
  ${p("ขอแสดงความนับถือ")}
  ${p("&nbsp;")}${p("&nbsp;")}${p("&nbsp;")}
  ${p(`(${deanName})`)}
  ${p(deanPosition)}
</div>`;
}

// ส่วนติดต่อท้ายหนังสือ — แถวเดียวห้ามแยกหน้า (เดิม Word ตัดครึ่งแถวไปหน้าถัดไป)
function contactFooterHtml(lines: string[]): string {
  return `<table class="footer-table">
  <tr style="page-break-inside:avoid">
    <td style="width:60%">
      ${lines.map((l) => `<p>${l}</p>`).join("\n      ")}
    </td>
    <td style="text-align:right">
      <p>ผู้ร่าง/พิมพ์: วิจิตรา ขจร</p>
    </td>
  </tr>
</table>`;
}

const CONTACT_LINES = ["วิทยาลัยการคอมพิวเตอร์", "โทรศัพท์ 0 4300 9700 ต่อ 50523", "Email: wijika@kku.ac.th"];

/** สร้าง full HTML string (ใช้ทั้ง Word blob และ preview) */
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
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** สร้าง Blob สำหรับ preview ในเบราว์เซอร์ */
export function createPreviewBlob(bodyHtml: string): Blob {
  return new Blob([buildFullHtml(bodyHtml)], { type: "text/html; charset=utf-8" });
}

/**
 * สร้าง Word-compatible HTML Blob (.doc)
 * Word อ่านขนาด/ขอบกระดาษจาก @page ที่ตั้งชื่อ + div ของ section เท่านั้น (@page เปล่าถูกข้าม → ขอบ 1 นิ้วทุกด้าน)
 * ย่อหน้าเล็กท้ายเอกสาร = ย่อหน้าที่ Word ต้องมีหลังตารางสุดท้าย (ไม่งั้น Word เติมย่อหน้าขนาดปกติจนส่วนติดต่อล้นหน้า)
 */
export function createWordBlob(bodyHtml: string): Blob {
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <meta name="color-scheme" content="light only">
  <style>
    :root { color-scheme: light only; }
    @page WordSection1 { size: 21cm 29.7cm; margin: 2.5cm 2cm 2cm 3cm; mso-header-margin: 1.25cm; mso-footer-margin: 1.25cm; }
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
<body><div class="WordSection1">${bodyHtml}
<p style="font-size:1pt;line-height:1pt;margin:0">&nbsp;</p></div></body>
</html>`;
  return new Blob(["﻿", doc], { type: "application/msword" });
}

// ── 1. หนังสือขอความอนุเคราะห์ ─────────────────────────────────────────

export function buildDispatchLetterHtml(opts: {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  studyProgram?: string;
  major?: string | null;
  majorNameTh?: string | null;
  companyName: string;
  companyContact?: string;   // ชื่อผู้ติดต่อ เช่น "คุณวิราภาณ์ต กาวิชัย  Talent Acquisition Partner"
  startDate: string;
  endDate: string;
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[]; // หนังสือรวมหลายคน (บริษัทเดียวกัน) — ไม่ส่ง/คนเดียว = หนังสือเดี่ยว
}): string {
  const { docNumber, docDate, studentName, studentId, studyProgram, major, majorNameTh, companyName,
          companyContact, startDate, endDate, deanName, deanPosition, students } = opts;
  const group = isGroup(students) ? students : null;
  const groupSameDates = group ? sameDates(group) : true;
  const spLabel = studyProgramLabel(studyProgram);
  // major เป็นรหัสสาขา (CS/AI) — หนังสือส่งตัวต้องใช้ชื่อหลักสูตรภาษาไทยจริงของนักศึกษา ไม่ใช่ค่าคงที่
  const majorName = formMajorName({ major, majorNameTh }, "วิทยาการคอมพิวเตอร์");
  const dateStr = toThaiDate(docDate);
  const startStr = toThaiDate(startDate);
  const endStr = toThaiDate(endDate);
  const rearnLine = companyContact
    ? `${companyContact}  ${companyName}`
    : `กรรมการผู้จัดการ  ${companyName}`;

  return `
<table style="width:100%;margin-bottom:4pt">
  <tr>
    <td style="width:55%"><p>ที่ อว ${normalizeDocNumber(docNumber)}</p></td>
    <td style="width:45%;text-align:right">
      <p>มหาวิทยาลัยขอนแก่น</p>
      <p>123 ถนนมิตรภาพ</p>
      <p>อำเภอเมืองขอนแก่น</p>
      <p>จังหวัดขอนแก่น 40002</p>
    </td>
  </tr>
</table>
<p class="center">${dateStr}</p>
${GAP}
<p><b>เรื่อง</b>&nbsp;&nbsp;&nbsp;ขอความอนุเคราะห์พิจารณานักศึกษาเข้าร่วมปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;&nbsp;${rearnLine}</p>
<table style="width:100%">
  <tr>
    <td style="width:95pt"><b>สิ่งที่ส่งมาด้วย</b></td>
    <td>1. รายละเอียดโครงการสหกิจศึกษา</td>
    <td style="width:80pt;text-align:right">จำนวน&nbsp;&nbsp;1&nbsp;&nbsp;ชุด</td>
  </tr>
  <tr>
    <td></td>
    <td>2. ประวัตินักศึกษาและใบแสดงผลการเรียน</td>
    <td style="text-align:right">จำนวน&nbsp;&nbsp;${group ? group.length : 2}&nbsp;&nbsp;ชุด</td>
  </tr>
  <tr>
    <td></td>
    <td>3. แบบฟอร์มตอบรับนักศึกษาเข้าปฏิบัติงานในหน่วยงาน</td>
    <td style="text-align:right">จำนวน&nbsp;&nbsp;1&nbsp;&nbsp;ชุด</td>
  </tr>
</table>
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามที่ ${companyName} ได้เข้าร่วมโครงการสหกิจศึกษากับมหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ และยินดีรับนักศึกษาหลักสูตร${majorName} เข้าปฏิบัติงานสหกิจศึกษากับบริษัทของท่าน ${groupSameDates ? `ซึ่งมีกำหนดช่วงเวลาปฏิบัติงาน ระหว่างวันที่ ${group ? toThaiDate(group[0].startDate || undefined) : startStr} ถึงวันที่ ${group ? toThaiDate(group[0].endDate || undefined) : endStr}` : 'ซึ่งมีกำหนดช่วงเวลาปฏิบัติงานตามที่ระบุท้ายรายชื่อนักศึกษาแต่ละคน'} นั้น ในการนี้ ทางวิทยาลัยการคอมพิวเตอร์ จึงใคร่ขอให้ท่านพิจารณานักศึกษาเข้าร่วมโครงการสหกิจศึกษากับทาง ${companyName} จำนวน ${group ? group.length : 1} คน ดังมีรายชื่อต่อไปนี้</p>
${GAP}
${group
  ? studentListHtml(group, { withProgram: true, withDates: !groupSameDates })
  : `<p class="center">${studentName}&nbsp;&nbsp;&nbsp;&nbsp;รหัสประจำตัว ${studentId}${spLabel ? `&nbsp;&nbsp;&nbsp;&nbsp;${spLabel}` : ''}</p>`}
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ในการรับนักศึกษาเข้าร่วมโครงการสหกิจศึกษา หากผลการพิจารณาเป็นประการใด กรุณาแจ้งผลกลับมายัง<u>วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น 40002</u> หรือ E-mail: wijika@kku.ac.th ด้วยจักขอบคุณยิ่ง</p>
${signatureBlockHtml(deanName, deanPosition)}
${contactFooterHtml(CONTACT_LINES)}`;
}

// ── 2. หนังสือส่งตัวฝึกสหกิจ (บันทึกข้อความ) ────────────────────────────

export function buildPlacementLetterHtml(opts: {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  major: string;
  companyName: string;
  companyRecipient?: string;  // เช่น "ผู้อำนวยการอุทยานวิทยาศาสตร์ มหาวิทยาลัยขอนแก่น"
  startDate: string;
  endDate: string;
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[]; // หนังสือรวมหลายคน — วันฝึกต่างกันได้ (ใส่ท้ายชื่อแต่ละคน)
}): string {
  const { docNumber, docDate, studentName, studentId, major, companyName,
          companyRecipient, startDate, endDate, deanName, deanPosition, students } = opts;
  const group = isGroup(students) ? students : null;
  const groupSameDates = group ? sameDates(group) : true;
  const dateStr = toThaiDate(docDate);
  const startStr = toThaiDate(startDate);
  const endStr = toThaiDate(endDate);
  const recipient = companyRecipient || `ผู้จัดการบริษัท ${companyName}`;

  return `
<table style="width:100%;margin-bottom:4pt">
  <tr>
    <td style="width:55%"><p>ที่ อว ${normalizeDocNumber(docNumber)}</p></td>
    <td style="width:45%;text-align:right">
      <p>มหาวิทยาลัยขอนแก่น</p>
      <p>123 ถนนมิตรภาพ</p>
      <p>อำเภอเมืองขอนแก่น</p>
      <p>จังหวัดขอนแก่น 40002</p>
    </td>
  </tr>
</table>
<p class="center">${dateStr}</p>
${GAP}
<p><b>เรื่อง</b>&nbsp;&nbsp;&nbsp;ขอส่งตัวนักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;&nbsp;${recipient}</p>
${GAP}
${group ? `<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามแบบตอบรับนักศึกษาปฏิบัติงานสหกิจศึกษา ที่ทางบริษัท ${companyName} ยินดีรับนักศึกษาหลักสูตร${major} วิทยาลัยการคอมพิวเตอร์ เข้ารับการปฏิบัติงานสหกิจศึกษา จำนวน ${group.length} คน ดังรายชื่อต่อไปนี้</p>
${studentListHtml(group, { withDates: !groupSameDates })}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ในการนี้ มหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ ใคร่ขอส่งตัวนักศึกษาปฏิบัติงานสหกิจศึกษาดังกล่าว เข้ารับการปฏิบัติงาน${groupSameDates ? `ในระหว่างวันที่ ${toThaiDate(group[0].startDate || undefined)} ถึงวันที่ ${toThaiDate(group[0].endDate || undefined)}` : 'ตามช่วงเวลาที่ระบุท้ายรายชื่อข้างต้น'} และขอความอนุเคราะห์` : `<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามแบบตอบรับนักศึกษาปฏิบัติงานสหกิจศึกษา ที่ทางบริษัท ${companyName} ยินดีรับนักศึกษาหลักสูตร${major} วิทยาลัยการคอมพิวเตอร์ เข้ารับการปฏิบัติงานสหกิจศึกษา จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId} ในการนี้ มหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ ใคร่ขอส่งตัวนักศึกษาปฏิบัติงานสหกิจศึกษาดังกล่าว เข้ารับการปฏิบัติงานในระหว่างวันที่ ${startStr} ถึงวันที่ ${endStr} และขอความอนุเคราะห์`}จากท่านตรวจสอบรายงานผลการปฏิบัติงานของนักศึกษาสหกิจศึกษา และส่งกลับมายัง วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ภายหลังครบกำหนดระยะเวลาการปฏิบัติงานของนักศึกษา ภายใน 10 วัน เพื่อวิทยาลัยการคอมพิวเตอร์จักได้ดำเนินการประเมินผลการปฏิบัติงานสหกิจศึกษานักศึกษาดังกล่าวต่อไป ทั้งนี้ ใคร่ขอขอบพระคุณหน่วยงานของท่าน ที่ได้อนุเคราะห์ให้นักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษาในครั้งนี้ หวังเป็นอย่างยิ่งว่าจะได้รับความอนุเคราะห์จากท่านอีกในโอกาสต่อไป</p>
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดทราบ</p>
${signatureBlockHtml(deanName, deanPosition)}
${contactFooterHtml(CONTACT_LINES)}`;
}

// ── 3. หนังสือขอนิเทศสหกิจศึกษา ────────────────────────────────────────

export function buildSupervisionLetterHtml(opts: {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  major?: string | null;
  majorNameTh?: string | null;
  companyName: string;
  companyRecipient?: string;  // เช่น "เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล"
  supervisorNames: string[];  // อาจารย์นิเทศ 1-2 คน
  visitDate: string;
  visitTime?: string;         // เช่น "13.30 น."
  visitMode?: string;         // เช่น "ออนไลน์" หรือ "ณ สถานประกอบการ"
  deanName: string;
  deanPosition: string;
  students?: LetterStudent[]; // หนังสือรวมของกลุ่มนิเทศ (บริษัท/วันเดียวกัน)
}): string {
  const { docNumber, docDate, studentName, studentId, major, majorNameTh, companyName,
          companyRecipient, supervisorNames, visitDate, visitTime,
          visitMode, deanName, deanPosition, students } = opts;
  const group = isGroup(students) ? students : null;
  const dateStr = toThaiDate(docDate);
  const visitStr = toThaiDate(visitDate);
  const recipient = companyRecipient || "เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล";
  const timeStr = visitTime || "13.30 น.";
  const modeStr = visitMode || "ณ สถานประกอบการ";
  const supervisorStr = joinThaiNames(supervisorNames);
  // major เป็นรหัสสาขา (CS/AI) — หนังสือนิเทศต้องใช้ชื่อหลักสูตรภาษาไทยจริงของนักศึกษา ไม่ใช่ค่าคงที่
  const majorName = letterMajorName({ major, majorNameTh });

  return `
<table style="width:100%;margin-bottom:4pt">
  <tr>
    <td style="width:55%"><p>ที่ อว ${normalizeDocNumber(docNumber)}</p></td>
    <td style="width:45%;text-align:right">
      <p>มหาวิทยาลัยขอนแก่น</p>
      <p>123 ถนนมิตรภาพ</p>
      <p>อำเภอเมืองขอนแก่น</p>
      <p>จังหวัดขอนแก่น 40002</p>
    </td>
  </tr>
</table>
<p class="center">${dateStr}</p>
${GAP}
<p><b>เรื่อง</b>&nbsp;&nbsp;&nbsp;ขอเข้านิเทศงานนักศึกษาปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;&nbsp;${recipient}</p>
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามที่ท่านให้ความอนุเคราะห์รับนักศึกษาสาขาวิชา${majorName} ${group ? `จำนวน ${group.length} คน ดังรายชื่อต่อไปนี้</p>
${studentListHtml(group)}
<p>เข้าปฏิบัติงานสหกิจศึกษากับทาง${companyName} นั้น ในการนี้` : `จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId} เข้าปฏิบัติงานสหกิจศึกษากับทาง${companyName} นั้น ในการนี้`} สาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอเข้านิเทศนักศึกษาปฏิบัติงานสหกิจศึกษา ในหน่วยงานของท่าน เพื่อแนะนำแนวทางการจัดทำรายงานสหกิจศึกษาและรับทราบปัญหาอุปสรรคของนักศึกษาในรูปแบบ${modeStr} โดยนิเทศงานใน<u>วันที่ ${visitStr} เวลา ${timeStr}</u> โดยมีอาจารย์ผู้นิเทศงานคือ ${supervisorStr}</p>
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอขอบคุณท่านที่ให้ความอนุเคราะห์เข้านิเทศงาน และร่วมประเมินเบื้องต้นและแจ้งลักษณะการมอบหมายงานของนักศึกษาในครั้งนี้ด้วย จักขอบพระคุณยิ่ง</p>
${GAP}
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดทราบ</p>
${signatureBlockHtml(deanName, deanPosition)}
${contactFooterHtml([`สาขาวิชา${majorName}`, ...CONTACT_LINES])}`;
}
