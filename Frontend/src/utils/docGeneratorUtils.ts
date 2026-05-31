// Frontend/src/utils/docGeneratorUtils.ts
// สร้างไฟล์ Word (.doc) ตามรูปแบบหนังสือราชการของวิทยาลัยการคอมพิวเตอร์ มข.

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

const SHARED_LETTER_CSS = `
    p { margin: 0; }
    .center { text-align: center; }
    .right { text-align: right; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; padding: 0 4px; }
    .sig-block { margin-top: 40pt; text-align: center; }
    .footer-table { margin-top: 30pt; width: 100%; }
    .footer-table td { vertical-align: bottom; font-size: 14pt; }
    u { text-decoration: underline; }
`;

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

/** สร้าง Word-compatible HTML Blob (.doc) */
export function createWordBlob(bodyHtml: string): Blob {
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <meta name="color-scheme" content="light only">
  <style>
    :root { color-scheme: light only; }
    @page { size: A4; margin: 2.5cm 2.5cm 2cm 3cm; }
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
<body>${bodyHtml}</body>
</html>`;
  return new Blob(["﻿", doc], { type: "application/msword" });
}

// ── 1. หนังสือขอความอนุเคราะห์ ─────────────────────────────────────────

export function buildDispatchLetterHtml(opts: {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  companyName: string;
  companyContact?: string;   // ชื่อผู้ติดต่อ เช่น "คุณวิราภาณ์ต กาวิชัย  Talent Acquisition Partner"
  startDate: string;
  endDate: string;
  deanName: string;
  deanPosition: string;
}): string {
  const { docNumber, docDate, studentName, studentId, companyName,
          companyContact, startDate, endDate, deanName, deanPosition } = opts;
  const dateStr = toThaiDate(docDate);
  const startStr = toThaiDate(startDate);
  const endStr = toThaiDate(endDate);
  const rearnLine = companyContact
    ? `${companyContact}  ${companyName}`
    : `กรรมการผู้จัดการ  ${companyName}`;

  return `
<table style="width:100%;margin-bottom:4pt">
  <tr>
    <td style="width:55%"><p>ที่ อว ${docNumber}</p></td>
    <td style="width:45%;text-align:right">
      <p>มหาวิทยาลัยขอนแก่น</p>
      <p>123 ถนนมิตรภาพ</p>
      <p>อำเภอเมืองขอนแก่น</p>
      <p>จังหวัดขอนแก่น 40002</p>
    </td>
  </tr>
</table>
<p class="center">${dateStr}</p>
<p>&nbsp;</p>
<p><b>เรื่อง</b>&nbsp;&nbsp;&nbsp;ขอความอนุเคราะห์พิจารณานักศึกษาเข้าร่วมปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;&nbsp;${rearnLine}</p>
<table style="width:100%;margin:4pt 0">
  <tr>
    <td style="width:120pt"><b>สิ่งที่ส่งมาด้วย</b></td>
    <td>1. รายละเอียดโครงการสหกิจศึกษา</td>
    <td style="width:100pt;text-align:right">จำนวน&nbsp;&nbsp;1&nbsp;&nbsp;ชุด</td>
  </tr>
  <tr>
    <td></td>
    <td>2. ประวัตินักศึกษาและใบแสดงผลการเรียน</td>
    <td style="text-align:right">จำนวน&nbsp;&nbsp;2&nbsp;&nbsp;ชุด</td>
  </tr>
  <tr>
    <td></td>
    <td>3. แบบฟอร์มตอบรับนักศึกษาเข้าปฏิบัติงานในหน่วยงาน</td>
    <td style="text-align:right">จำนวน&nbsp;&nbsp;1&nbsp;&nbsp;ชุด</td>
  </tr>
</table>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามที่ ${companyName} ได้เข้าร่วมโครงการสหกิจศึกษากับมหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ และยินดีรับนักศึกษาหลักสูตรวิทยาการคอมพิวเตอร์ เข้าปฏิบัติงานสหกิจศึกษากับบริษัทของท่าน ซึ่งมีกำหนดช่วงเวลาปฏิบัติงาน ระหว่างวันที่ ${startStr} ถึงวันที่ ${endStr} นั้น ในการนี้ ทางวิทยาลัยการคอมพิวเตอร์ จึงใคร่ขอให้ท่านพิจารณานักศึกษาเข้าร่วมโครงการสหกิจศึกษากับทาง ${companyName} จำนวน 1 คน ดังมีรายชื่อต่อไปนี้</p>
<p>&nbsp;</p>
<p class="center">${studentName}&nbsp;&nbsp;&nbsp;&nbsp;รหัสประจำตัว ${studentId}</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ในการรับนักศึกษาเข้าร่วมโครงการสหกิจศึกษา หากผลการพิจารณาเป็นประการใด กรุณาแจ้งผลกลับมายัง<u>วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น 40002</u> หรือ E-mail: wijika@kku.ac.th ด้วยจักขอบคุณยิ่ง</p>
<div class="sig-block">
  <p>ขอแสดงความนับถือ</p>
  <p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>
  <p>(${deanName})</p>
  <p>${deanPosition}</p>
</div>
<table class="footer-table">
  <tr>
    <td style="width:60%">
      <p>วิทยาลัยการคอมพิวเตอร์</p>
      <p>โทรศัพท์ 0 4300 9700 ต่อ 50523</p>
      <p>Email: wijika@kku.ac.th</p>
    </td>
    <td style="text-align:right">
      <p>ผู้ร่าง/พิมพ์: วิจิตรา ขจร</p>
    </td>
  </tr>
</table>`;
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
}): string {
  const { docNumber, docDate, studentName, studentId, major, companyName,
          companyRecipient, startDate, endDate, deanName, deanPosition } = opts;
  const dateStr = toThaiDate(docDate);
  const startStr = toThaiDate(startDate);
  const endStr = toThaiDate(endDate);
  const recipient = companyRecipient || `ผู้จัดการ / ผู้อำนวยการ / หัวหน้างานทรัพยากรบุคคล ${companyName}`;

  return `
<p class="center"><b>บันทึกข้อความ</b></p>
<p>&nbsp;</p>
<table style="width:100%">
  <tr>
    <td style="width:55%"><p><b>ส่วนงาน</b>&nbsp;&nbsp;วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น&nbsp;&nbsp;โทรศัพท์ 50523</p></td>
  </tr>
  <tr>
    <td><p><b>ที่</b>&nbsp;&nbsp;อว ${docNumber}</p></td>
    <td style="text-align:right"><p><b>วันที่</b>&nbsp;&nbsp;${dateStr}</p></td>
  </tr>
</table>
<p><b>เรื่อง</b>&nbsp;&nbsp;ขอส่งตัวนักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;${recipient}</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามแบบตอบรับนักศึกษาฝึกงานสหกิจศึกษา ที่ทาง${companyName} ยินดีรับนักศึกษาหลักสูตรวิทยาการคอมพิวเตอร์ จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId} เข้ารับการปฏิบัติงานทางด้านวิทยาการคอมพิวเตอร์ ในการนี้ วิทยาลัยการคอมพิวเตอร์ สาขาวิชาวิทยาการคอมพิวเตอร์ ใคร่ขอส่งตัวนักศึกษาปฏิบัติงานสหกิจศึกษาดังกล่าว เข้ารับการปฏิบัติงาน โดยเริ่มปฏิบัติงานตั้งแต่วันที่ ${startStr} ถึงวันที่ ${endStr} และขอความอนุเคราะห์จากท่านตรวจสอบรายงานผลการปฏิบัติงานของนักศึกษาสหกิจศึกษา และส่งกลับมายังสาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ภายหลังครบกำหนดระยะเวลาการปฏิบัติงานของนักศึกษา ภายใน 10 วัน เพื่อวิทยาลัยการคอมพิวเตอร์ จักได้ดำเนินการประเมินผลการปฏิบัติงานสหกิจศึกษานักศึกษาดังกล่าวต่อไป ทั้งนี้ใคร่ขอขอบพระคุณหน่วยงานของท่านที่ได้อนุเคราะห์ให้นักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษาในครั้งนี้ หวังเป็นอย่างยิ่งว่าจะได้รับความอนุเคราะห์จากท่านอีกในโอกาสต่อไป</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดทราบ</p>
<div class="sig-block">
  <p>ขอแสดงความนับถือ</p>
  <p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>
  <p>(${deanName})</p>
  <p>${deanPosition}</p>
</div>
<table class="footer-table">
  <tr>
    <td style="width:60%"></td>
    <td style="text-align:right"><p>ผู้ร่าง/พิมพ์: วิจิตรา ขจร</p></td>
  </tr>
</table>`;
}

// ── 3. หนังสือขอนิเทศสหกิจศึกษา ────────────────────────────────────────

export function buildSupervisionLetterHtml(opts: {
  docNumber: string;
  docDate: string;
  studentName: string;
  studentId: string;
  companyName: string;
  companyRecipient?: string;  // เช่น "เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล"
  supervisorNames: string[];  // อาจารย์นิเทศ 1-2 คน
  visitDate: string;
  visitTime?: string;         // เช่น "13.30 น."
  visitMode?: string;         // เช่น "ออนไลน์" หรือ "ณ สถานประกอบการ"
  deanName: string;
  deanPosition: string;
}): string {
  const { docNumber, docDate, studentName, studentId, companyName,
          companyRecipient, supervisorNames, visitDate, visitTime,
          visitMode, deanName, deanPosition } = opts;
  const dateStr = toThaiDate(docDate);
  const visitStr = toThaiDate(visitDate);
  const recipient = companyRecipient || "เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล";
  const timeStr = visitTime || "13.30 น.";
  const modeStr = visitMode || "ณ สถานประกอบการ";
  const supervisorStr = supervisorNames.length > 1
    ? supervisorNames.slice(0, -1).join(" และ") + " และ" + supervisorNames.slice(-1)[0]
    : (supervisorNames[0] || "อาจารย์ผู้นิเทศ");

  return `
<table style="width:100%;margin-bottom:4pt">
  <tr>
    <td style="width:55%"><p>ที่ อว ${docNumber}</p></td>
    <td style="width:45%;text-align:right">
      <p>มหาวิทยาลัยขอนแก่น</p>
      <p>123 ถนนมิตรภาพ</p>
      <p>อำเภอเมืองขอนแก่น</p>
      <p>จังหวัดขอนแก่น 40002</p>
    </td>
  </tr>
</table>
<p class="center">${dateStr}</p>
<p>&nbsp;</p>
<p><b>เรื่อง</b>&nbsp;&nbsp;&nbsp;ขอเข้านิเทศงานนักศึกษาปฏิบัติงานสหกิจศึกษา</p>
<p><b>เรียน</b>&nbsp;&nbsp;&nbsp;${recipient}</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามที่ท่านให้ความอนุเคราะห์รับนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId} เข้าปฏิบัติงานสหกิจศึกษากับทาง${companyName} นั้น ในการนี้ สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอเข้านิเทศนักศึกษาปฏิบัติงานสหกิจศึกษา ในหน่วยงานของท่าน เพื่อแนะนำแนวทางการจัดทำรายงานสหกิจศึกษาและรับทราบปัญหาอุปสรรคของนักศึกษาในรูปแบบ${modeStr} โดยนิเทศงานใน<u>วันที่ ${visitStr} เวลา ${timeStr}</u> โดยมีอาจารย์ผู้นิเทศงานคือ ${supervisorStr}</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอขอบคุณท่านที่ให้ความอนุเคราะห์เข้านิเทศงาน และร่วมประเมินเบื้องต้นและแจ้งลักษณะการมอบหมายงานของนักศึกษาในครั้งนี้ด้วย จักขอบพระคุณยิ่ง</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงเรียนมาเพื่อโปรดทราบ</p>
<div class="sig-block">
  <p>ขอแสดงความนับถือ</p>
  <p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>
  <p>(${deanName})</p>
  <p>${deanPosition}</p>
</div>
<table class="footer-table">
  <tr>
    <td style="width:60%">
      <p>สาขาวิชาวิทยาการคอมพิวเตอร์</p>
      <p>วิทยาลัยการคอมพิวเตอร์</p>
      <p>โทรศัพท์ 0 4300 9700 ต่อ 50523</p>
      <p>Email: wijika@kku.ac.th</p>
    </td>
    <td style="text-align:right">
      <p>ผู้ร่าง/พิมพ์: วิจิตรา ขจร</p>
    </td>
  </tr>
</table>`;
}
