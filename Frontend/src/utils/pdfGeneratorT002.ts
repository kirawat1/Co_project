// Frontend/src/utils/pdfGeneratorT002.ts
import { jsPDF } from "jspdf";

// ================= HELPERS =================
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
  if (!dateStr) return "";
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

// ================= GENERATOR =================
export const createT002PDF = async (
  profile: any,
  formData: any,
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

  // --- Helper วาดข้อความ ---
  const drawText = (
    text: string,
    x: number,
    y: number,
    align: "left" | "center" | "right" = "left",
    bold = false,
    size = 14,
  ) => {
    doc.setFont("THSarabun", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text || "", x, y, { align });
  };

  // --- Helper วาดเส้นประเติมคำ ---
  const drawDataLine = (
    label: string,
    value: string,
    x: number,
    y: number,
    lineWidth: number,
  ) => {
    drawText(label, x, y);
    const labelW = doc.getTextWidth(label);
    const startX = x + labelW + 2;

    // วาดเส้นประ
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(startX, y + 1, startX + lineWidth, y + 1);
    doc.setLineDashPattern([], 0); // Reset

    // พิมพ์ข้อความ
    doc.setFont("THSarabun", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "", startX + 2, y);
  };

  // --- Helper วาดกล่องหัวข้อสีเทา ---
  const drawHeaderBox = (title: string, y: number) => {
    doc.setFillColor(211, 211, 211); // สีเทาอ่อน
    doc.rect(leftX, y, contentWidth, 8, "FD"); // Fill & Stroke
    drawText(title, leftX + 3, y + 5.5, "left", true, 14);
  };

  // --- Helper วาด Checkbox ---
  const drawCheckbox = (x: number, y: number, isChecked: boolean) => {
    drawText(isChecked ? "(  /  )" : "(     )", x, y, "left", false, 14);
  };

  // --- Helper วาด Footer ---
  const drawFooter = (pageY: number) => {
    doc.setLineWidth(0.5);
    doc.line(leftX, pageY, leftX + contentWidth, pageY);
    doc.setLineWidth(0.2);
    doc.line(leftX, pageY + 1, leftX + contentWidth, pageY + 1);
    drawText(
      "สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น",
      leftX,
      pageY + 6,
      "left",
      true,
      12,
    );
    drawText(
      "โทรศัพท์มือถือ 08-9710-2645 หรือ 043-009700 ต่อ 50523 EMail address wijika@kku.ac.th",
      leftX,
      pageY + 11,
      "left",
      false,
      12,
    );
  };

  // ================= PAGE 1 =================
  let y = 15;
  drawText("KKU CP-T002", 190, y, "right", false, 12);

  y += 10;
  drawText(
    "แบบแจ้งรายละเอียดงานและรายละเอียดที่พัก",
    leftX,
    y,
    "left",
    true,
    16,
  );
  y += 6;
  drawText("CO-OPERATIVE EDUCATION", leftX, y, "left", false, 12);
  y += 6;
  drawText(
    "สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น",
    leftX,
    y,
    "left",
    true,
    14,
  );

  doc.setLineWidth(0.5);
  doc.line(leftX, y + 2, leftX + contentWidth, y + 2);
  doc.setLineWidth(0.2);
  doc.line(leftX, y + 3, leftX + contentWidth, y + 3);

  y += 10;
  drawText(
    "ผู้ให้ข้อมูล : ผู้จัดการฝ่ายบุคคล หรือพนักงานที่ปรึกษา",
    leftX,
    y,
    "left",
    true,
    14,
  );
  y += 6;
  drawText("คำชี้แจง", leftX, y, "left", false, 14);

  y += 5;
  const introText =
    "เพื่อให้การประสานงานระหว่างงานสหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น และสถานประกอบการเป็นไปโดยความเรียบร้อยและมีประสิทธิภาพ จึงใคร่ขอความกรุณาผู้จัดการฝ่ายบุคคลหรือผู้ที่รับผิดชอบดูแลการปฏิบัติงานสหกิจศึกษาของนักศึกษาได้โปรดประสานงานกับพนักงานที่ปรึกษา (Job Supervisor) เพื่อจัดทำข้อมูลตำแหน่งงาน ลักษณะงาน และผู้ทำหน้าที่พนักงานที่ปรึกษา แบบฟอร์ม (KKU CP-T002) ฉบับนี้ และโปรดส่งกลับคืนงานสหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ ภายในสัปดาห์แรกตามปฏิทินการปฏิบัติงานสหกิจศึกษาด้วยจักขอบคุณยิ่ง";
  const introLines = doc.splitTextToSize(introText, contentWidth - 10);
  doc.text(introLines, leftX + 10, y);

  // --- Box 1 ---
  y += introLines.length * 5 + 3;
  drawHeaderBox("1. ชื่อ-ที่อยู่ สถานประกอบการ", y);
  doc.rect(leftX, y + 8, contentWidth, 50); // กรอบเนื้อหา

  let inY = y + 16;
  drawDataLine(
    "ชื่อสถานประกอบการ (ภาษาไทย)",
    formData.companyNameTh,
    leftX + 5,
    inY,
    110,
  );
  inY += 7;
  drawDataLine("(ภาษาอังกฤษ)", formData.companyNameEn, leftX + 33, inY, 82);
  inY += 7;
  drawText(
    "ที่อยู่ (เพื่อประกอบการเดินทางไปนิเทศงานนักศึกษาที่ถูกต้อง โปรดระบุที่อยู่ตามสถานที่ที่นักศึกษาไปปฏิบัติงาน)",
    leftX + 5,
    inY,
    "left",
    false,
    12,
  );
  inY += 7;
  drawDataLine("เลขที่", formData.addressNo, leftX + 5, inY, 15);
  drawDataLine("หมู่ที่", formData.moo, leftX + 35, inY, 15);
  drawDataLine("ถนน", formData.road, leftX + 65, inY, 40);
  drawDataLine("ซอย", formData.soi, leftX + 120, inY, 35);
  inY += 7;
  drawDataLine("อำเภอ/เขต", formData.district, leftX + 5, inY, 35);
  drawDataLine("จังหวัด", formData.province, leftX + 60, inY, 35);
  drawDataLine("รหัสไปรษณีย์", formData.zipcode, leftX + 115, inY, 35);
  inY += 7;
  drawDataLine("โทรศัพท์", formData.companyPhone, leftX + 5, inY, 35);
  drawDataLine("โทรสาร", formData.companyFax, leftX + 60, inY, 35);
  drawDataLine("EMail address", formData.companyEmail, leftX + 115, inY, 40);

  // --- Box 2 ---
  y = inY + 5;
  drawHeaderBox(
    "2. ผู้จัดการทั่วไป / ผู้จัดการโรงงาน และผู้ได้รับมอบหมายให้ประสานงาน",
    y,
  );
  doc.rect(leftX, y + 8, contentWidth, 68);

  inY = y + 16;
  drawDataLine(
    "ชื่อผู้จัดการสถานประกอบการ",
    formData.managerName,
    leftX + 5,
    inY,
    110,
  );
  inY += 7;
  drawDataLine("ตำแหน่ง", formData.managerPosition, leftX + 5, inY, 140);
  inY += 7;
  drawDataLine("โทรศัพท์", formData.managerPhone, leftX + 5, inY, 35);
  drawDataLine("โทรสาร", formData.managerFax, leftX + 60, inY, 35);
  drawDataLine("EMail address", formData.managerEmail, leftX + 115, inY, 40);

  inY += 8;
  drawText(
    "การติดต่อประสานงานกับวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น (การนิเทศงานนักศึกษา และอื่น ๆ) ขอมอบให้",
    leftX + 5,
    inY,
  );
  inY += 7;
  drawCheckbox(leftX + 15, inY, formData.coordinatorType === "MANAGER");
  drawText("ติดต่อกับผู้จัดการโดยตรง", leftX + 25, inY);
  inY += 7;
  drawCheckbox(leftX + 15, inY, formData.coordinatorType === "OTHER");
  drawText("ขอมอบหมายให้บุคคลต่อไปนี้ประสานงานแทน", leftX + 25, inY);

  inY += 7;
  drawDataLine("ชื่อ-นามสกุล", formData.coordName, leftX + 25, inY, 110);
  inY += 7;
  drawDataLine("ตำแหน่ง", formData.coordPosition, leftX + 25, inY, 45);
  drawDataLine("แผนก", formData.coordDept, leftX + 90, inY, 55);
  inY += 7;
  drawDataLine("โทรศัพท์", formData.coordPhone, leftX + 25, inY, 35);
  drawDataLine("โทรสาร", formData.coordFax, leftX + 75, inY, 30);
  drawDataLine("EMail address", formData.coordEmail, leftX + 120, inY, 35);

  // --- Box 3 (Header Only) ---
  y = inY + 5;
  drawHeaderBox("3. พนักงานที่ปรึกษา (Job Supervisor)", y);

  drawFooter(250);

  // ================= PAGE 2 =================
  doc.addPage();
  y = 15;
  drawText("KKU CP-T002", 190, y, "right", false, 12);

  // --- Box 3 (Content) ---
  y = 20;
  doc.rect(leftX, y, contentWidth, 25);
  inY = y + 8;
  drawDataLine("ชื่อ-นามสกุล", formData.supervisorName, leftX + 5, inY, 135);
  inY += 8;
  drawDataLine("ตำแหน่ง", formData.supervisorPosition, leftX + 5, inY, 60);
  drawDataLine("แผนก", formData.supervisorDept, leftX + 85, inY, 60);
  inY += 8;
  drawDataLine("โทรศัพท์", formData.supervisorPhone, leftX + 5, inY, 35);
  drawDataLine("โทรสาร", formData.supervisorFax, leftX + 60, inY, 35);
  drawDataLine(
    "E-Mail address",
    formData.supervisorEmail,
    leftX + 115,
    inY,
    40,
  );

  // --- Box 4 ---
  y = inY + 5;
  drawHeaderBox("4. งานที่มอบหมายนักศึกษา", y);
  doc.rect(leftX, y + 8, contentWidth, 70);

  inY = y + 16;
  drawDataLine(
    "ชื่อ-สกุล นักศึกษา",
    `${profile.firstName || ""} ${profile.lastName || ""}`,
    leftX + 5,
    inY,
    130,
  );
  inY += 8;
  drawDataLine(
    "ตำแหน่งงานที่นักศึกษาปฏิบัติ (Job Position)",
    formData.jobPosition,
    leftX + 5,
    inY,
    90,
  );
  inY += 8;
  drawText("ลักษณะงานที่นักศึกษาปฏิบัติ (Job Description)", leftX + 5, inY);

  // ปริ้นลักษณะงานพร้อมวาดบรรทัดเส้นประ
  const jobLines = doc.splitTextToSize(formData.jobDescription || "", 155);
  doc.text(jobLines, leftX + 10, inY + 7);
  for (let i = 0; i < 6; i++) {
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(leftX + 5, inY + 7 + i * 7, leftX + 165, inY + 7 + i * 7);
  }
  doc.setLineDashPattern([], 0);

  // --- Box 5 ---
  y = inY + 50;
  doc.rect(leftX, y, contentWidth, 85);
  inY = y + 7;
  drawText("5. ข้อมูลที่พัก", leftX + 2, inY, "left", true, 14);
  inY += 6;
  drawText(
    "ขอแจ้งรายละเอียดเกี่ยวกับที่พักระหว่างปฏิบัติงานสหกิจศึกษา ดังนี้",
    leftX + 2,
    inY,
  );
  inY += 8;
  drawDataLine("ที่อยู่", formData.accommodationAddress, leftX + 10, inY, 140);
  inY += 8;
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(leftX + 20, inY, leftX + 160, inY);
  doc.setLineDashPattern([], 0);
  inY += 8;
  drawDataLine("โทรศัพท์", formData.accommodationPhone, leftX + 10, inY, 50);
  drawDataLine("โทรสาร", "", leftX + 80, inY, 50);

  inY += 10;
  drawText(
    "ชื่อที่อยู่ ผู้ที่สามารถติดต่อได้ในกรณีฉุกเฉิน",
    leftX + 2,
    inY,
    "left",
    false,
    14,
  );
  inY += 8;
  drawDataLine("ชื่อ - สกุล", formData.emergencyName, leftX + 10, inY, 135);
  inY += 8;
  drawDataLine("ที่อยู่", formData.emergencyAddress, leftX + 10, inY, 140);
  inY += 8;
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(leftX + 20, inY, leftX + 160, inY);
  doc.setLineDashPattern([], 0);
  inY += 8;
  drawDataLine("โทรศัพท์", formData.emergencyPhone, leftX + 10, inY, 45);
  drawDataLine("EMail address", formData.emergencyEmail, leftX + 75, inY, 60);

  // --- แผนที่ Intro ---
  y = inY + 15;
  drawText(
    "แผนที่แสดงตำแหน่งที่นักศึกษาไปปฏิบัติงาน",
    leftX,
    y,
    "left",
    true,
    14,
  );
  doc.line(leftX, y + 1, leftX + 58, y + 1);
  y += 6;
  drawText(
    "เพื่อความสะดวกในการนิเทศงานของคณาจารย์ โปรดระบุชื่อถนนและสถานที่สำคัญใกล้เคียงที่สามารถเข้าใจโดยง่าย",
    leftX,
    y,
  );

  drawFooter(250);

  // ================= PAGE 3 =================
  doc.addPage();
  y = 15;
  drawText("KKU CP-T002", 190, y, "right", false, 12);

  // กล่องแผนที่
  y = 20;
  doc.rect(leftX, y, contentWidth, 100);

  // Signatures
  y = 150;
  drawDataLine("(ลงชื่อ)", "", leftX + 5, y, 55);
  drawText("นักศึกษา", leftX + 68, y);
  drawText(
    `( ${profile.firstName || ""} ${profile.lastName || ""} )`,
    leftX + 35,
    y + 8,
    "center",
  );
  doc.line(leftX + 13, y + 9, leftX + 60, y + 9);
  drawDataLine("วันที่", "", leftX + 10, y + 16, 50);

  drawDataLine("(ลงชื่อ)", "", 105, y, 55);
  drawText("พนักงานที่ปรึกษา", 168, y);
  drawText(
    `( ${formData.supervisorName || "                                        "} )`,
    136,
    y + 8,
    "center",
  );
  doc.line(113, y + 9, 160, y + 9);
  drawDataLine("วันที่", "", 110, y + 16, 50);

  y += 35;
  drawText("(ลงชื่อ)  รับทราบข้อมูล", 110, y);
  drawText(
    `( ${formData.managerName || "                                        "} )`,
    136,
    y + 8,
    "center",
  );
  doc.line(113, y + 9, 160, y + 9);
  drawDataLine("ตำแหน่ง", formData.managerPosition || "", 110, y + 16, 50);
  drawDataLine("วันที่", "", 110, y + 24, 50);
  y += 32;
  drawText(
    "ผู้จัดการทั่วไป / ผู้จัดการโรงงาน หรือ ผู้ได้รับมอบหมาย",
    135,
    y,
    "center",
  );

  drawFooter(280);

  return doc;
};
