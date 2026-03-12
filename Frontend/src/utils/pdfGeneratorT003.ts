// Frontend/src/utils/pdfGeneratorT003.ts
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

// ================= GENERATOR =================
export const createT003PDF = async (
  profile: any,
  payload: any,
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

  // --- Helper วาดบล็อกคำตอบแบบหลายบรรทัด (สำหรับหน้า 2) ---
  const drawTextBlock = (
    title: string,
    content: string,
    startY: number,
    lineCount: number = 3,
  ) => {
    drawText(title, leftX, startY, "left", true, 14);
    let currentY = startY + 7;

    if (content) {
      doc.setFont("THSarabun", "normal");
      const lines = doc.splitTextToSize(content, contentWidth - 5);
      doc.text(lines, leftX + 5, currentY);
      currentY += lines.length * 6;
    } else {
      // ถ้าไม่ได้กรอก ให้วาดเส้นประเปล่าๆ
      doc.setDrawColor(150, 150, 150);
      doc.setLineDashPattern([0.5, 0.5], 0);
      for (let i = 0; i < lineCount; i++) {
        doc.line(
          leftX + 5,
          currentY + i * 7,
          leftX + contentWidth,
          currentY + i * 7,
        );
      }
      doc.setLineDashPattern([], 0);
      currentY += lineCount * 7;
    }
    return currentY + 3; // return ตำแหน่ง Y ถัดไป
  };

  // --- Helper วาด Footer ---
  const drawFooter = (pageY: number) => {
    doc.setDrawColor(0, 0, 0);
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

  // ดึงข้อมูลบริษัท
  const company = profile?.coop?.company || profile?.company || {};

  // =================================================================
  // PAGE 1 : ข้อมูลทั่วไป และคำชี้แจง
  // =================================================================
  let y = 15;
  drawText("KKU CP-T003", 190, y, "right", false, 12);

  y += 10;
  drawText(
    "แบบแจ้งโครงร่างรายงานการปฏิบัติงานสหกิจศึกษา (Proposal)",
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

  y += 12;
  drawText(
    "ผู้ให้ข้อมูล : นักศึกษา ร่วมกับ พนักงานที่ปรึกษา",
    leftX,
    y,
    "left",
    true,
    14,
  );

  y += 10;
  drawText("คำชี้แจง", leftX, y, "left", true, 14);

  y += 6;
  const introText1 =
    "รายงานถือเป็นส่วนหนึ่งของการปฏิบัติงานสหกิจศึกษา มีวัตถุประสงค์เพื่อฝึกฝนทักษะการสื่อสาร (Communication Skill) ของนักศึกษา และจัดทำข้อมูลที่เป็นประโยชน์สำหรับสถานประกอบการ นักศึกษาจะต้องขอรับคำปรึกษาจากพนักงานที่ปรึกษา (Job Supervisor) เพื่อกำหนดหัวข้อรายงานที่เหมาะสม โดยคำนึงถึงความต้องการของสถานประกอบการเป็นหลัก ตัวอย่างของรายงาน ได้แก่ ผลงานวิจัยที่นักศึกษาปฏิบัติ รายงานวิชาการที่น่าสนใจ การสรุปข้อมูลหรือสถิติบางประการ การวิเคราะห์ และประเมินผลข้อมูล เป็นต้น ทั้งนี้รายงานอาจจะจัดทำเป็นกลุ่มของนักศึกษาสหกิจศึกษามากกว่า 1 คนก็ได้";
  const introText2 =
    "ในกรณีที่สถานประกอบการไม่ต้องการรายงานในหัวข้อข้างต้น นักศึกษาจะต้องพิจารณาเรื่องที่ตนสนใจและหยิบยกมาทำรายงาน โดยปรึกษากับพนักงานที่ปรึกษาเสียก่อน ตัวอย่างหัวข้อที่จะใช้เขียนรายงาน ได้แก่ รายงานวิชาการที่นักศึกษาสนใจ รายงานการปฏิบัติงานที่ได้รับมอบหมาย หรือแผนและวิธีการปฏิบัติงานที่จะทำให้บรรลุถึงวัตถุประสงค์ของการเรียนรู้ที่นักศึกษาวางเป้าหมายไว้จากการปฏิบัติงานสหกิจศึกษาครั้งนี้ (Learning Objectives) เมื่อกำหนดหัวข้อได้แล้ว ให้นักศึกษาจัดทำโครงร่างของเนื้อหารายงานพอสังเขปตามแบบฟอร์ม ทั้งนี้ ให้ปรึกษากับพนักงานที่ปรึกษาเสียก่อน แล้วจึงส่งกลับมายังงานสหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ ซึ่งจะรวบรวมเสนออาจารย์ที่ปรึกษาสหกิจศึกษาต่อไป หากอาจารย์มีข้อเสนอแนะเพิ่มเติม จะแจ้งให้นักศึกษาทราบภายใน 2 สัปดาห์ และเพื่อมิให้เป็นการเสียเวลานักศึกษาควรดำเนินการเขียนรายงานโดยทันที";

  doc.setFont("THSarabun", "normal");
  doc.setFontSize(14);
  const lines1 = doc.splitTextToSize("          " + introText1, contentWidth);
  doc.text(lines1, leftX, y);
  y += lines1.length * 6;

  const lines2 = doc.splitTextToSize("          " + introText2, contentWidth);
  doc.text(lines2, leftX, y);
  y += lines2.length * 6 + 10;

  // ส่วนข้อมูลนักศึกษา
  drawText("เรียน หัวหน้าโครงการสหกิจศึกษา", leftX, y, "left", true, 14);
  y += 8;
  drawDataLine(
    "ชื่อ-นามสกุล (นักศึกษา)",
    `${profile.firstName || ""} ${profile.lastName || ""}`,
    leftX,
    y,
    90,
  );
  drawDataLine("รหัสประจำตัว", profile.studentId || "", leftX + 115, y, 35);
  y += 8;
  drawDataLine("สาขาวิชา", profile.major || "", leftX, y, 70);
  drawText("วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น", leftX + 90, y);
  y += 8;
  drawText("ปฏิบัติงานสหกิจศึกษา ณ", leftX, y);
  y += 8;
  drawDataLine("(ชื่อสถานประกอบการ)", company.name || "", leftX, y, 140);
  y += 8;
  drawDataLine("เลขที่", company.addressNo || "", leftX, y, 15);
  drawDataLine("ถนน", company.road || "", leftX + 30, y, 35);
  drawDataLine("ซอย", company.soi || "", leftX + 75, y, 30);
  drawDataLine("ตำบล/แขวง", company.subDistrict || "", leftX + 115, y, 35);
  y += 8;
  drawDataLine("อำเภอ/เขต", company.district || "", leftX, y, 35);
  drawDataLine("จังหวัด", company.province || "", leftX + 50, y, 40);
  drawDataLine("รหัสไปรษณีย์", company.zipcode || "", leftX + 105, y, 45);
  y += 8;
  drawDataLine("โทรศัพท์", company.phone || "", leftX, y, 40);
  drawDataLine("โทรสาร", company.fax || "", leftX + 55, y, 40);
  drawDataLine("E-mail:", company.email || "", leftX + 110, y, 45);

  drawFooter(270);

  // =================================================================
  // PAGE 2 : รายละเอียดโครงร่างรายงาน
  // =================================================================
  doc.addPage();
  y = 15;
  drawText("KKU CP-T003", 190, y, "right", false, 12);

  y += 15;
  drawText(
    "ขอแจ้งรายละเอียดเกี่ยวกับโครงร่างรายงานการปฏิบัติงานสหกิจศึกษา ดังนี้",
    leftX,
    y,
    "left",
    true,
    14,
  );

  y += 8;
  drawText(
    "1. หัวข้อรายงาน (Report Title) อาจจะขอเปลี่ยนแปลงหรือแก้ไขเพิ่มเติมได้ในภายหลัง",
    leftX,
    y,
    "left",
    true,
    14,
  );
  y += 7;
  drawDataLine("ภาษาไทย", payload.reportTitleTh || "", leftX + 5, y, 150);
  y += 7;
  drawDataLine("English", payload.reportTitleEn || "", leftX + 5, y, 153);

  y += 10;
  y = drawTextBlock("2. วัตถุประสงค์", payload.objectives, y, 3);
  y = drawTextBlock("3. ผลที่คาดว่าจะได้รับ", payload.expectedOutcomes, y, 3);
  y = drawTextBlock("4. ความสำคัญ และที่มา", payload.significance, y, 3);
  y = drawTextBlock("5. เอกสารอ้างอิง:", payload.references, y, 3);
  y = drawTextBlock("6. ระเบียบวิธีดำเนินโครงงาน", payload.methodology, y, 3);
  y = drawTextBlock("7. ขอบเขตของโครงงาน", payload.scope, y, 3);
  y = drawTextBlock("8. ข้อเสนอแนะอื่นๆ", payload.otherSuggestions, y, 2);

  drawFooter(270);

  // =================================================================
  // PAGE 3 : แผนปฏิบัติงาน และลายเซ็น
  // =================================================================
  doc.addPage();
  y = 15;
  drawText("KKU CP-T003", 190, y, "right", false, 12);

  y += 20;
  drawText("แผนปฏิบัติงานสหกิจศึกษา", 105, y, "center", true, 16);

  // วาดตาราง
  y += 5;
  const startX = leftX;
  const colTaskW = 60;
  const colMonthW = 110 / 4; // แบ่ง 4 เดือน (27.5 mm ต่อเดือน)
  const colWeekW = colMonthW / 4; // แบ่งเป็นสัปดาห์ละ 6.875 mm

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Header Row 1
  doc.rect(startX, y, colTaskW, 10);
  drawText("หัวข้องาน", startX + colTaskW / 2, y + 6, "center", true, 14);

  for (let i = 0; i < 4; i++) {
    doc.rect(startX + colTaskW + i * colMonthW, y, colMonthW, 5);
    drawText(
      `เดือนที่ ${i + 1}`,
      startX + colTaskW + i * colMonthW + colMonthW / 2,
      y + 4,
      "center",
      true,
      14,
    );
  }

  // Header Row 2 (Weeks)
  for (let i = 0; i < 16; i++) {
    doc.rect(startX + colTaskW + i * colWeekW, y + 5, colWeekW, 5);
  }

  y += 10;

  // Body Rows (สร้างตารางเปล่า 12 แถว หรือตามที่กรอกมา)
  const rowCount = Math.max(12, payload.workPlan?.length || 0);
  const rowHeight = 8;

  for (let r = 0; r < rowCount; r++) {
    const plan = payload.workPlan?.[r] || { task: "", weeks: [] };

    // ช่องหัวข้องาน
    doc.rect(startX, y, colTaskW, rowHeight);
    if (plan.task) {
      doc.setFont("THSarabun", "normal");
      doc.text(plan.task, startX + 2, y + 5.5, { maxWidth: colTaskW - 4 });
    } else {
      // วาดเส้นประให้ดูเหมือนฟอร์มเปล่า
      doc.setDrawColor(150);
      doc.setLineDashPattern([0.5, 0.5], 0);
      doc.line(startX + 2, y + 6, startX + colTaskW - 2, y + 6);
      doc.setLineDashPattern([], 0);
      doc.setDrawColor(0);
    }

    // ช่องสัปดาห์ (ระบายสีเทาถ้าถูกเลือก)
    for (let w = 0; w < 16; w++) {
      const weekNum = w + 1;
      if (plan.weeks.includes(weekNum)) {
        doc.setFillColor(200, 200, 200); // สีเทา
        doc.rect(
          startX + colTaskW + w * colWeekW,
          y,
          colWeekW,
          rowHeight,
          "FD",
        );
      } else {
        doc.rect(startX + colTaskW + w * colWeekW, y, colWeekW, rowHeight);
      }
    }
    y += rowHeight;
  }

  // ลายเซ็น
  y += 25;
  drawDataLine("(ลงชื่อ)", "", leftX + 10, y, 60);
  drawText("นักศึกษา", leftX + 80, y);
  drawText(
    `( ${profile.firstName || ""} ${profile.lastName || ""} )`,
    leftX + 45,
    y + 8,
    "center",
  );
  doc.line(leftX + 20, y + 9, leftX + 70, y + 9);
  drawDataLine("วันที่", "", leftX + 20, y + 16, 50);

  drawDataLine("(ลงชื่อ)", "", 115, y, 50);
  drawText("พนักงานที่ปรึกษา", 175, y);
  drawText(
    `(                                          )`,
    145,
    y + 8,
    "center",
  );
  doc.line(125, y + 9, 165, y + 9);
  drawDataLine("วันที่", "", 120, y + 16, 45);

  y += 30;
  drawText(
    "โปรดส่งคืน งานสหกิจศึกษา ภายในสัปดาห์ที่ 3 นับตั้งแต่วันที่เข้าปฏิบัติงานของนักศึกษาด้วยจักขอบคุณยิ่ง",
    105,
    y,
    "center",
    true,
    14,
  );

  drawFooter(270);

  return doc;
};
