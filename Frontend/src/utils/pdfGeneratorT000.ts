// Frontend/src/utils/pdfGeneratorT000.ts
// PDF Generator สำหรับใบสมัครงานสหกิจศึกษา (T000)
import { jsPDF } from "jspdf";

// ================= HELPERS =================
const getThaiPrefix = (prefix?: string | null) => {
  if (!prefix) return "";
  const p = prefix.toUpperCase();
  if (p === "MR" || p === "MISTER" || p === "นาย") return "นาย";
  if (["MS", "MISS", "MRS", "นาง", "นางสาว"].includes(p)) return "นางสาว";
  return prefix;
};

const getEngPrefix = (prefix?: string | null) => {
  if (!prefix) return "";
  const p = prefix.toUpperCase();
  if (p === "MR" || p === "MISTER" || p === "นาย") return "Mr.";
  if (["MS", "MISS", "MRS", "นาง", "นางสาว"].includes(p)) return "Miss";
  return prefix;
};

const getFontBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
};

const formatDateTH = (dateStr?: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// ================= INTERFACES =================
export interface ProfileData {
  studentId: string;
  prefix?: string | null;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  gpa?: number;
  year?: string;
  phone?: string;
  email?: string;
  major?: string;
  curriculum?: string;

  // ✅ เพิ่ม jobPosition ใน ProfileData ด้วย
  jobPosition?: string;
  advisorName?: string;

  company?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  coop?: { company?: { name?: string } };
}

export interface T000FormData {
  jobPosition?: string;
  advisorName?: string;
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyJob: string;
  emergencyWorkplace: string;
  emergencyAddress: string;
  emergencyPhone: string;
  emergencyEmail: string;
  careerObjective1?: string;
  careerObjective2?: string;
  careerObjective3?: string;
  startDate?: string;
  endDate?: string;
}

// ================= GENERATOR =================
export const createT000PDF = async (
  profile: ProfileData,
  formData: T000FormData,
): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  try {
    const fontNormal = await getFontBase64("/fonts/THSarabunNew.ttf");
    const fontBold = await getFontBase64("/fonts/THSarabunNew Bold.ttf");
    doc.addFileToVFS("THSarabunNew.ttf", fontNormal);
    doc.addFileToVFS("THSarabunNew Bold.ttf", fontBold);
    doc.addFont("THSarabunNew.ttf", "THSarabun", "normal");
    doc.addFont("THSarabunNew Bold.ttf", "THSarabun", "bold");
    doc.setFont("THSarabun", "normal");
  } catch (e) {
    console.error("Error loading font", e);
  }

  const leftX = 20;
  const contentWidth = 170;

  const drawText = (
    text: string,
    x: number,
    y: number,
    align: "left" | "center" = "left",
    bold = false,
    size = 14,
  ) => {
    doc.setFont("THSarabun", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text || "", x, y, { align });
  };

  const drawDataLine = (
    label: string,
    value: string,
    x: number,
    y: number,
    lineWidth: number,
  ) => {
    drawText(label, x, y);
    const labelW = doc.getTextWidth(label);
    const lineStartX = x + labelW + 2;
    const lineEndX = x + lineWidth;
    doc.line(lineStartX, y + 1, lineEndX, y + 1);
    doc.setFont("THSarabun", "bold");
    doc.text(value || "", lineStartX + 2, y);
  };

  // ================= PAGE 1 =================
  let y = 15;

  // Header
  drawText("ใบสมัครงานสหกิจศึกษา", leftX, y, "left", true, 16);
  y += 6;
  drawText("CO-OPERATIVE EDUCATION", leftX, y, "left", true, 14);
  y += 6;
  drawText(
    "สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น",
    leftX,
    y,
    "left",
    true,
    14,
  );

  y += 2;
  doc.setLineWidth(0.5);
  doc.line(leftX, y, 190, y);
  doc.setLineWidth(0.2);
  doc.line(leftX, y + 1, 190, y + 1);

  // --- Box 1: Job Info ---
  y += 6;
  const box1Top = y;
  doc.rect(leftX, y, 140, 24);
  doc.line(leftX, y + 8, 160, y + 8);
  doc.line(leftX, y + 16, 160, y + 16);

  doc.rect(160, y, 30, 35); // Photo Box
  drawText("รูปถ่าย", 175, y + 10, "center", false, 10);
  drawText("Recent", 175, y + 14, "center", false, 10);
  drawText("of Applicant", 175, y + 22, "center", false, 10);

  // Row 1: Company Name
  drawText(
    "ชื่อสถานประกอบการที่ต้องการสมัคร",
    leftX + 2,
    y + 5,
    "left",
    true,
    12,
  );
  drawText("Name of employer", leftX + 2, y + 7.5, "left", false, 9);
  drawText(
    profile.company?.name || profile.coop?.company?.name || "-",
    leftX + 60,
    y + 6,
    "left",
    true,
    12,
  );

  // Row 2: Job Position
  y += 8;
  drawText("สมัครงานในตำแหน่ง", leftX + 2, y + 5, "left", true, 12);
  drawText("Position sought", leftX + 2, y + 7.5, "left", false, 9);

  // ✅ แก้ไข: ให้ดึงจาก profile.jobPosition ด้วย
  drawText(
    profile.jobPosition || formData.jobPosition || "-",
    leftX + 60,
    y + 6,
    "left",
    true,
    12,
  );

  // Row 3: Dates
  y += 8;
  drawText("ระยะเวลาปฏิบัติงานสหกิจศึกษา", leftX + 2, y + 5, "left", true, 12);
  drawText("Period of working", leftX + 2, y + 7.5, "left", false, 9);
  drawText("จาก", leftX + 50, y + 5, "left", false, 12);
  drawText(
    formatDateTH(formData.startDate),
    leftX + 60,
    y + 5,
    "left",
    true,
    12,
  );
  drawText("ถึง", leftX + 100, y + 5, "left", false, 12);
  drawText(
    formatDateTH(formData.endDate),
    leftX + 108,
    y + 5,
    "left",
    true,
    12,
  );

  // --- Box 2: Personal Data ---
  y = box1Top + 35 + 5;
  doc.rect(leftX, y, contentWidth, 7); // Header Bar
  drawText(
    "ข้อมูลส่วนตัวนักศึกษา (STUDENT PERSONAL DATA)",
    105,
    y + 5,
    "center",
    true,
    12,
  );

  y += 7;
  const box2Top = y;
  doc.rect(leftX, y, contentWidth, 55);

  // Row 1: Name
  y += 7;
  drawText("ชื่อ-นามสกุล", leftX + 2, y, "left", true, 12);
  drawText("Name & Surname", leftX + 2, y + 3.5, "left", false, 9);

  drawDataLine(
    "ไทย (นาย/นางสาว)",
    `${getThaiPrefix(profile.prefix)} ${profile.firstName || ""} ${
      profile.lastName || ""
    }`,
    leftX + 35,
    y,
    125,
  );

  y += 8;
  drawDataLine(
    "อังกฤษ (Mr./Miss)",
    `${getEngPrefix(profile.prefix)} ${profile.firstNameEn || ""} ${
      profile.lastNameEn || ""
    }`,
    leftX + 35,
    y,
    125,
  );

  // Row 2: ID
  y += 8;
  drawDataLine(
    "รหัสนักศึกษา (Student identification no.)",
    profile.studentId,
    leftX + 2,
    y,
    160,
  );

  // Row 3: Dept / Faculty
  y += 8;
  drawText("สาขาวิชา", leftX + 2, y);
  drawText("Department", leftX + 2, y + 3.5, "left", false, 9);
  doc.line(leftX + 18, y + 1, leftX + 90, y + 1);
  doc.setFont("THSarabun", "bold");
  doc.text(profile.major || "-", leftX + 20, y);

  drawText("คณะ", leftX + 95, y);
  drawText("Faculty", leftX + 95, y + 3.5, "left", false, 9);
  doc.line(leftX + 105, y + 1, 185, y + 1);
  doc.text(profile.curriculum || "วิทยาลัยการคอมพิวเตอร์", leftX + 110, y);

  // Row 4: Year / Advisor
  y += 8;
  drawText("นักศึกษาชั้นปีที่", leftX + 2, y);
  drawText("Years in", leftX + 2, y + 3.5, "left", false, 9);
  doc.line(leftX + 25, y + 1, leftX + 60, y + 1);
  doc.setFont("THSarabun", "bold");
  doc.text(profile.year || "-", leftX + 30, y);

  drawText("ชื่ออาจารย์ที่ปรึกษา", leftX + 65, y);
  drawText("Name of academic advisor", leftX + 65, y + 3.5, "left", false, 9);
  doc.line(leftX + 95, y + 1, 185, y + 1);

  // ✅ แก้ไข: ให้ดึงจาก profile.advisorName เป็นหลัก
  doc.text(profile.advisorName || formData.advisorName || "-", leftX + 100, y);

  // Row 5: GPA
  y += 8;
  drawDataLine(
    "เกรดเฉลี่ยรวม",
    profile.gpa?.toFixed(2) || "-",
    leftX + 2,
    y,
    50,
  );
  drawText(
    "GPA for all courses completed to date",
    leftX + 2,
    y + 3.5,
    "left",
    false,
    9,
  );

  // ... (ส่วนที่เหลือเหมือนเดิม) ...

  // --- Box 3: Address ---
  y = box2Top + 55;
  doc.rect(leftX, y, contentWidth, 40);

  let innerY = y + 7;
  drawText("ที่อยู่ที่ติดต่อได้", leftX + 2, innerY, "left", true, 12);
  drawText("Address this term", leftX + 2, innerY + 3.5, "left", false, 9);

  const addrLines = doc.splitTextToSize(formData.contactAddress || "-", 90);
  doc.setFont("THSarabun", "normal");
  doc.text(addrLines, leftX + 2, innerY + 8);
  doc.line(leftX + 2, innerY + 20, leftX + 100, innerY + 20);
  doc.line(leftX + 2, innerY + 28, leftX + 100, innerY + 28);

  const col2X = leftX + 110;
  drawDataLine(
    "โทรศัพท์",
    formData.contactPhone || profile.phone || "-",
    col2X,
    innerY,
    55,
  );
  drawText("Tel.", col2X, innerY + 3.5, "left", false, 9);

  innerY += 10;
  drawDataLine(
    "E-mail",
    formData.contactEmail || profile.email || "-",
    col2X,
    innerY,
    55,
  );

  innerY += 10;
  drawDataLine("อื่นๆ", "-", col2X, innerY, 55);
  drawText("Other", col2X, innerY + 3.5, "left", false, 9);

  // --- Box 4: Emergency Contact ---
  y += 40;
  doc.rect(leftX, y, contentWidth, 45);
  innerY = y + 7;
  drawText(
    "บุคคลที่ติดต่อได้ในกรณีฉุกเฉิน",
    leftX + 2,
    innerY,
    "left",
    false,
    12,
  );

  innerY += 8;
  drawDataLine("ชื่อ-นามสกุล", formData.emergencyName, leftX + 2, innerY, 90);
  drawText("Name & surname", leftX + 2, innerY + 3.5, "left", false, 9);
  drawDataLine(
    "ความเกี่ยวข้อง",
    formData.emergencyRelation,
    leftX + 100,
    innerY,
    65,
  );

  innerY += 8;
  drawDataLine("อาชีพ", formData.emergencyJob, leftX + 2, innerY, 90);
  drawText("Occupation", leftX + 2, innerY + 3.5, "left", false, 9);
  drawDataLine(
    "สถานที่ทำงาน",
    formData.emergencyWorkplace,
    leftX + 100,
    innerY,
    65,
  );
  drawText("Place of work", leftX + 100, innerY + 3.5, "left", false, 9);

  innerY += 8;
  drawDataLine("ที่อยู่", formData.emergencyAddress, leftX + 2, innerY, 163);
  drawText("Address", leftX + 2, innerY + 3.5, "left", false, 9);

  innerY += 8;
  drawDataLine("โทรศัพท์", formData.emergencyPhone, leftX + 2, innerY, 60);
  drawText("Tel.", leftX + 2, innerY + 3.5, "left", false, 9);
  drawDataLine("E-mail", formData.emergencyEmail, leftX + 70, innerY, 95);

  // Footer Page 1
  y = 280;
  doc.setLineWidth(0.5);
  doc.line(leftX, y, 190, y);
  doc.setLineWidth(0.2);
  doc.line(leftX, y + 1, 190, y + 1);
  y += 5;
  drawText(
    "สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น",
    leftX,
    y,
    "left",
    true,
    10,
  );
  y += 4;
  drawText(
    "โทรศัพท์มือถือ 08-9710-2645 หรือ 043-009700 ต่อ 50523 E-Mail address wijika@kku.ac.th",
    leftX,
    y,
    "left",
    false,
    10,
  );

  // ================= PAGE 2 =================
  doc.addPage();
  y = 20;

  // --- Box 5: Career Objectives ---
  doc.rect(leftX, y, contentWidth, 8);
  drawText(
    "จุดมุ่งหมายงานอาชีพ (CAREER OBJECTIVES)",
    105,
    y + 5.5,
    "center",
    true,
    12,
  );

  y += 8;
  doc.rect(leftX, y, contentWidth, 45);
  innerY = y + 7;
  drawText(
    "ระบุสายงานและลักษณะงานอาชีพที่นักศึกษาสนใจ",
    leftX + 2,
    innerY,
    "left",
    true,
    12,
  );
  innerY += 5;
  drawText(
    "(Indicate your career objectives, fields of interest and job preference)",
    leftX + 2,
    innerY,
    "left",
    false,
    10,
  );

  innerY += 8;
  drawDataLine("1.", formData.careerObjective1 || "-", leftX + 5, innerY, 155);
  innerY += 9;
  drawDataLine("2.", formData.careerObjective2 || "-", leftX + 5, innerY, 155);
  innerY += 9;
  drawDataLine("3.", formData.careerObjective3 || "-", leftX + 5, innerY, 155);

  // --- Certification ---
  y += 60;
  drawText(
    "ข้าพเจ้าขอรับรองว่าข้อความทั้งหมดเป็นความจริงและถูกต้องทุกประการ",
    leftX,
    y,
    "left",
    false,
    12,
  );

  y += 15;
  const signX = 110;
  drawDataLine("ลายเซ็นผู้สมัคร", "", signX, y, 70);
  drawText("Applicant", signX, y + 3.5, "left", false, 9);

  drawText("(", signX + 25, y + 6.5);
  doc.text(
    `${getThaiPrefix(profile.prefix)} ${profile.firstName || ""} ${
      profile.lastName || ""
    }`,
    signX + 30,
    y + 6.5,
  );
  drawText(")", signX + 75, y + 6.5);

  y += 12;
  drawDataLine(
    "วันที่",
    formatDateTH(new Date().toISOString()),
    signX + 10,
    y,
    50,
  );
  drawText("Date", signX + 10, y + 3.5, "left", false, 9);

  // --- Attachments List ---
  y += 20;
  drawText(
    "หมายเหตุ: นักศึกษาโปรดแนบเอกสารดังต่อไปนี้อย่างละ 1 ชุด",
    leftX,
    y,
    "left",
    true,
    12,
  );
  y += 8;
  const listItem = (text: string) => {
    drawText(`- ${text}`, leftX + 5, y, "left", false, 12);
    y += 6;
  };
  listItem("ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา");
  listItem("สำเนาบัตรประจำตัวนักศึกษา");
  listItem("สำเนาบัตรประชาชน");
  listItem("สำเนาใบรายงานผลการศึกษา");
  listItem("ประวัติส่วนตัว (CV)");

  return doc;
};
