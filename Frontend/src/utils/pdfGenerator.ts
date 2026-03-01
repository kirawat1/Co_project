// Frontend/src/utils/pdfGenerator.ts
// PDF Generator สำหรับยื่นตรวจสอบเข้าร่วมโครงการสหกิจศึกษา
import { jsPDF } from "jspdf";

// รับ Interface แบบคร่าวๆ เพื่อใช้ในฟังก์ชัน
interface ProfileData {
  studentId: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  year?: string;
  curriculum?: string;
  studyProgram?: string;
  company?: any;
  mentor?: any;
  coop?: {
    company: any;
    mentor?: any;
  };
}

// Helper: โหลด Font
const getFontBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Font not found");
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
};

// Main Function: สร้าง PDF
export const createCoopPDF = async (
  profile: ProfileData,
  coopField: string,
): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // 1. Load Fonts
  const fontNormal = await getFontBase64("/fonts/THSarabunNew.ttf");
  const fontBold = await getFontBase64("/fonts/THSarabunNew Bold.ttf");

  doc.addFileToVFS("THSarabunNew.ttf", fontNormal);
  doc.addFileToVFS("THSarabunNew Bold.ttf", fontBold);
  doc.addFont("THSarabunNew.ttf", "THSarabun", "normal");
  doc.addFont("THSarabunNew Bold.ttf", "THSarabun", "bold");
  doc.setFont("THSarabun", "normal");

  // --- Helpers internal ---
  const dots = (len: number) => ".".repeat(len);

  const drawField = (
    label: string,
    value: string,
    x: number,
    y: number,
    dotsLen: number = 0,
  ) => {
    doc.setFont("THSarabun", "normal");
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    const valueX = x + labelWidth + 2;
    doc.setFont("THSarabun", "bold");
    doc.text(value || "", valueX, y);
    doc.setFont("THSarabun", "normal");
    if (dotsLen > 0) {
      const dataWidth = doc.getTextWidth(value || "");
      const startDotX = value ? valueX + dataWidth + 2 : valueX;
      doc.text(dots(dotsLen), startDotX, y);
    }
  };

  const drawCheckbox = (
    x: number,
    y: number,
    checked: boolean,
    label: string,
  ) => {
    doc.rect(x, y - 4, 4, 4);
    if (checked) {
      doc.setFont("THSarabun", "bold");
      doc.text("/", x + 1, y - 0.5);
    }
    doc.setFont("THSarabun", "normal");
    doc.text(label, x + 6, y);
  };

  // --- Drawing Content ---
  const lineSpace = 8;
  const leftMargin = 25;
  let y = 15;

  // Header
  doc.setFontSize(14);
  doc.text("สำหรับนักศึกษา", 190, y, { align: "right" });
  y += 15;
  doc.setFontSize(20);
  doc.setFont("THSarabun", "bold");
  doc.text("ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา", 105, y, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("THSarabun", "normal");
  y += 10;

  // Data Prep
  const thaiPrefix =
    profile.prefix === "MR" || profile.prefix === "นาย" ? "นาย" : "นางสาว";
  const isMr = thaiPrefix === "นาย";
  const isMs = !isMr;
  const fullName = `${profile.firstName}  ${profile.lastName}`;

  // Line 1
  doc.text("ข้าพเจ้า", leftMargin + 10, y);
  drawCheckbox(leftMargin + 25, y, isMr, "นาย");
  drawCheckbox(leftMargin + 42, y, isMs, "นางสาว");
  doc.setFont("THSarabun", "bold");
  doc.text(fullName, leftMargin + 65, y);
  doc.setFont("THSarabun", "normal");
  doc.text(dots(60), leftMargin + 65 + doc.getTextWidth(fullName) + 2, y);

  // Line 2
  y += lineSpace;
  drawField("นักศึกษาชั้นปีที่", profile.year || "-", leftMargin, y);
  doc.text(dots(100), leftMargin + 30, y);

  // Line 3
  y += lineSpace;
  doc.text(
    "สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ หลักสูตร",
    leftMargin,
    y,
  );
  doc.setFont("THSarabun", "bold");
  doc.text(profile.curriculum || "", leftMargin + 100, y);
  doc.setFont("THSarabun", "normal");

  // Line 4
  y += lineSpace;
  const isReg =
    profile.studyProgram === "ภาคปกติ" || profile.studyProgram === "regular";
  const isSpec = !isReg;
  drawCheckbox(leftMargin + 25, y, isReg, "ภาคปกติ");
  drawCheckbox(leftMargin + 50, y, isSpec, "ภาคพิเศษ");
  doc.text("มีความประสงค์เข้าร่วม", leftMargin + 75, y);

  // Line 5
  y += lineSpace;
  doc.text("โครงการสหกิจกับ", leftMargin, y);

  // Company Info
  const company = profile.company || profile.coop?.company;
  const mentor = profile.mentor || profile.coop?.mentor;

  // Line 6
  y += lineSpace;
  drawField("ชื่อหน่วยงาน", company?.name || "-", leftMargin, y);
  doc.text(dots(10), 190, y, { align: "right" });

  y += lineSpace;
  doc.text(dots(165), leftMargin, y);

  // Line 7
  y += lineSpace;
  doc.text("ชื่อผู้ประสานงาน", leftMargin, y);
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : "-";
  doc.setFont("THSarabun", "bold");
  doc.text(mentorName, leftMargin + 26, y);

  doc.setFont("THSarabun", "normal");
  const posLabelX = 110;
  doc.text("ตำแหน่ง", posLabelX, y);
  doc.setFont("THSarabun", "bold");
  doc.text(mentor?.position || "-", posLabelX + 15, y);
  doc.setFont("THSarabun", "normal");

  // Line 8-9 (Address)
  y += lineSpace;
  doc.text("ที่อยู่หน่วยงาน", leftMargin, y);
  const address = company?.address || "-";
  doc.setFont("THSarabun", "bold");
  const addressLines = doc.splitTextToSize(address, 100);
  doc.text(addressLines[0], leftMargin + 32, y);

  if (addressLines.length > 1) {
    y += lineSpace;
    doc.text(addressLines[1], leftMargin, y);
  } else {
    y += lineSpace;
    doc.setFont("THSarabun", "normal");
    doc.text(dots(90), leftMargin, y);
  }

  doc.setFont("THSarabun", "normal");
  doc.text("เบอร์โทรติดต่อ", 130, y);
  doc.setFont("THSarabun", "bold");
  doc.text(company?.phone || "-", 155, y);

  // Line 10
  y += lineSpace;
  doc.setFont("THSarabun", "normal");
  doc.text(dots(105), leftMargin, y);
  doc.text("เบอร์โทรสาร", 140, y);
  doc.text(dots(20), 160, y);

  // Line 11
  y += lineSpace;
  doc.text("EMail address", leftMargin, y);
  const email = mentor?.email || company?.hrEmail || "-";
  doc.setFont("THSarabun", "bold");
  doc.text(email, leftMargin + 30, y);
  doc.setFont("THSarabun", "normal");
  doc.text("เว็บไซต์(ถ้ามี)", 135, y);

  // Line 12 (Detail)
  y += lineSpace;
  doc.text("มีความประสงค์ฝึกสหกิจศึกษาในด้าน", leftMargin, y);
  if (coopField) {
    doc.setFont("THSarabun", "bold");
    const jobLines = doc.splitTextToSize(coopField, 155);
    doc.text(jobLines[0], leftMargin + 55, y);
    for (let i = 1; i < jobLines.length; i++) {
      y += lineSpace;
      doc.text(jobLines[i], leftMargin, y);
    }
  } else {
    doc.setFont("THSarabun", "normal");
    doc.text(dots(110), leftMargin + 55, y);
    y += lineSpace;
    doc.text(dots(165), leftMargin, y);
    y += lineSpace;
    doc.text(dots(165), leftMargin, y);
  }

  // Attachments
  y += lineSpace;
  doc.setFont("THSarabun", "normal");
  doc.text("เอกสารแนบ", leftMargin, y);
  y += lineSpace;
  doc.text("      1. เอกสารตรวจสอบการสำเร็จการศึกษา", leftMargin, y);
  y += lineSpace;
  doc.text("      2. หนังสือยินยอมของผู้ปกครอง", leftMargin, y);

  // Signature
  y += lineSpace * 2;
  doc.text(dots(60), 120, y);
  y += lineSpace;
  const signName = `(${thaiPrefix}${profile.firstName} ${profile.lastName})`;
  doc.text(signName, 150, y, { align: "center" });
  y += lineSpace;
  doc.text("ผู้ยื่นคำร้อง", 150, y, { align: "center" });

  // Footer
  y = 275;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 6;
  doc.setFontSize(14);
  doc.text(
    "สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น",
    leftMargin,
    y,
  );
  y += 6;
  doc.text(
    "โทรศัพท์มือถือ 08-9710-2645 หรือ 043-009700 ต่อ 50523 E-Mail address",
    leftMargin,
    y,
  );
  y += 6;
  doc.text("wijika@kku.ac.th", leftMargin, y);

  return doc;
};
