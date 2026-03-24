import { jsPDF } from "jspdf";

// --- Helpers ---
const getFontBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
};

const getImageArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  if (!url) throw new Error("URL is empty");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ไฟล์ไม่พบหรือโหลดไม่ได้: ${url}`);
  return await res.arrayBuffer();
};

// แปลงวันที่ แบบ วัน เดือน ปี (เช่น 18 สิงหาคม 2568)
const toThaiDate = (dateStr?: string | Date) => {
  if (!dateStr) return "....................";
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

// แปลงวันที่ แบบระบุวันในสัปดาห์ (เช่น วันอังคารที่ 2 กันยายน 2568)
const toFullThaiDateWithDay = (dateStr?: string | Date) => {
  if (!dateStr)
    return "วัน................ที่ ....... ....................... ............";
  const d = new Date(dateStr);
  const days = [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ];
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
  return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// ================= MAIN GENERATOR =================
export const createSupervisionLetterPDF = async (
  appt: any, // ข้อมูลตาราง SupervisionAppointment
  docNumber: string,
  docDate: string,
  krutUrl: string,
  signatureUrl: string,
  deanName: string = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา",
  deanPosition: string = "คณบดีวิทยาลัยการคอมพิวเตอร์",
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // 1. Load Font
  const fontNormal = await getFontBase64("/fonts/THSarabunNew.ttf");
  const fontBold = await getFontBase64("/fonts/THSarabunNew Bold.ttf");
  doc.addFileToVFS("THSarabunNew.ttf", fontNormal);
  doc.addFileToVFS("THSarabunNew Bold.ttf", fontBold);
  doc.addFont("THSarabunNew.ttf", "Sarabun", "normal");
  doc.addFont("THSarabunNew Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");

  const pageWidth = 210;
  const margin = 25; // กั้นหน้าซ้าย
  let y = 20;

  // 2. ตรามหาวิทยาลัย (ครุฑ) - กึ่งกลาง
  try {
    if (typeof krutUrl === "string" && krutUrl.trim() !== "") {
      const krutImg = await getImageArrayBuffer(krutUrl);
      const krutUint8 = new Uint8Array(krutImg);
      const format = krutUrl.toLowerCase().endsWith("png") ? "PNG" : "JPEG";
      doc.addImage(krutUint8, format, pageWidth / 2 - 15, y, 30, 30);
    }
  } catch (e) {
    console.error("Krut load error", e);
  }

  y += 35;
  doc.setFontSize(16);

  // 3. ที่... และ ที่อยู่ (ขวา)
  const formattedDocNumber = docNumber.includes("อว")
    ? docNumber
    : `อว ${docNumber}`;
  doc.text(`ที่ ${formattedDocNumber}`, margin, y);

  const rightAlignX = pageWidth - margin - 45;
  doc.text(`มหาวิทยาลัยขอนแก่น`, rightAlignX, y);
  y += 7;
  doc.text(`123 ถนนมิตรภาพ`, rightAlignX, y);
  y += 7;
  doc.text(`อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40002`, rightAlignX - 10, y);

  // 4. วันที่ (กึ่งกลาง)
  y += 12;
  const dateText = toThaiDate(docDate);
  const dateX = pageWidth / 2 - doc.getTextWidth(dateText) / 2;
  doc.text(dateText, dateX, y);

  // 5. เรื่อง & เรียน
  y += 15;
  doc.text(`เรื่อง ขอเข้านิเทศงานนักศึกษาปฏิบัติงานสหกิจศึกษา`, margin, y);

  y += 8;
  const company = appt.student?.coop?.company || {};
  const companyName =
    company.name || "........................................................";
  const contactName = company.contactPerson || "ผู้จัดการ / ผู้อำนวยการ";
  const contactPos = company.contactPersonPosition
    ? ` ${company.contactPersonPosition}`
    : "";

  doc.text(`เรียน ${contactName}${contactPos}`, margin, y);

  // เตรียมตัวแปรข้อความ
  const student = appt.student || {};
  const studentName = `${student.prefix || "นาย/นางสาว"}${student.firstName || ""} ${student.lastName || ""}`;
  const studentId = student.studentId || "...................";

  const teacher = appt.teacher || {};
  const teacherName = `${teacher.prefix || "อาจารย์"}${teacher.firstName || ""} ${teacher.lastName || ""}`;

  const isOnline = appt.supervisionType === "ONLINE";
  const supFormat = isOnline ? "ออนไลน์" : "ออนไซต์";

  const supDateObj = appt.confirmedDate
    ? new Date(appt.confirmedDate)
    : new Date();
  const supDateStr = toFullThaiDateWithDay(supDateObj);
  const supTimeStr = supDateObj.toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const onlineLinkText =
    isOnline && appt.onlineLink ? ` (ลิงก์เข้าร่วม: ${appt.onlineLink})` : "";

  // ==========================================================
  // 6. เนื้อหาจดหมาย (เป๊ะตามแบบ 100%)
  // ==========================================================
  y += 12;
  const contentWidth = pageWidth - margin * 2;

  // ย่อหน้า 1
  const p1 = `       ตามที่ท่านให้ความอนุเคราะห์รับนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId} เข้าปฏิบัติงานสหกิจศึกษากับทางบริษัท ${companyName} นั้น`;
  const splitP1 = doc.splitTextToSize(p1, contentWidth);
  doc.text(splitP1, margin, y);
  y += splitP1.length * 7 + 2;

  // ย่อหน้า 2
  const p2 = `       ในการนี้ สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอเข้านิเทศนักศึกษาปฏิบัติงานสหกิจศึกษา ในหน่วยงานของท่าน เพื่อแนะนำแนวทางการจัดทำรายงานสหกิจศึกษาและรับทราบปัญหาอุปสรรคของนักศึกษาในรูปแบบ${supFormat} โดยนิเทศงานใน${supDateStr} เวลา ${supTimeStr} น.${onlineLinkText} โดยมีอาจารย์ผู้นิเทศงานคือ ${teacherName}`;
  const splitP2 = doc.splitTextToSize(p2, contentWidth);
  doc.text(splitP2, margin, y);
  y += splitP2.length * 7 + 2;

  // ย่อหน้า 3
  const p3 = `       สาขาวิชาวิทยาการคอมพิวเตอร์ วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ใคร่ขอขอบคุณท่านที่ให้ความอนุเคราะห์เข้านิเทศงานนักศึกษา และหวังเป็นอย่างยิ่งว่าจะได้รับความร่วมมือจากท่านด้วยดีตลอดไป`;
  const splitP3 = doc.splitTextToSize(p3, contentWidth);
  doc.text(splitP3, margin, y);
  y += splitP3.length * 7 + 15;

  // ==========================================================
  // 7. คำลงท้าย & ลายเซ็น
  // ==========================================================
  const signCenter = pageWidth / 2 + 30;
  doc.text(`ขอแสดงความนับถือ`, signCenter, y, { align: "center" });
  y += 5;

  try {
    if (
      typeof signatureUrl === "string" &&
      signatureUrl.trim() !== "" &&
      !signatureUrl.endsWith("undefined") &&
      !signatureUrl.endsWith("null")
    ) {
      const sigImg = await getImageArrayBuffer(signatureUrl);
      const sigUint8 = new Uint8Array(sigImg);
      const format = signatureUrl.toLowerCase().endsWith("png")
        ? "PNG"
        : "JPEG";
      doc.addImage(sigUint8, format, signCenter - 15, y, 30, 15);
    }
  } catch (e) {
    console.warn("Signature load error", e);
  }

  y += 20;
  doc.text(`(${deanName})`, signCenter, y, { align: "center" });
  y += 7;
  doc.text(`${deanPosition}`, signCenter, y, { align: "center" });

  // ==========================================================
  // 8. Footer ท้ายกระดาษ (ข้อมูลติดต่อ)
  // ==========================================================
  y = 265;
  doc.setFontSize(14);
  doc.text(`สาขาวิชาวิทยาการคอมพิวเตอร์`, margin, y);
  doc.text(`โทรศัพท์ 043-009700 ต่อ 50523`, margin, y + 5);
  doc.text(`อีเมล: wijika@kku.ac.th`, margin, y + 10);

  doc.text(`ผู้ร่าง/พิมพ์ : วิจิตรา ขจร`, pageWidth - margin, y + 10, {
    align: "right",
  });

  const pdfBytes = doc.output("arraybuffer");
  return new Blob([pdfBytes as any], { type: "application/pdf" });
};
