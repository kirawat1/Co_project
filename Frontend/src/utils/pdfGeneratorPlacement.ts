import { jsPDF } from "jspdf";

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

// ✅ Helper ใหม่: โหลดรูป + เช็ค Format อัตโนมัติ (ไม่ต้องเดาจาก URL)
const getImageData = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Failed to fetch image: ${url} (Status: ${res.status})`);
      throw new Error(`Image not found: ${url}`);
    }

    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();

    // ตรวจสอบชนิดไฟล์จาก Header หรือ Blob type
    let format = "JPEG";
    if (blob.type === "image/png") format = "PNG";
    else if (blob.type === "image/jpeg" || blob.type === "image/jpg")
      format = "JPEG";

    return {
      data: new Uint8Array(buffer),
      format: format as "PNG" | "JPEG",
    };
  } catch (e) {
    console.error("⚠️ Image Load Error:", e);
    return null; // คืนค่า null ถ้าโหลดไม่ได้
  }
};

export const createPlacementPDF = async (
  student: any,
  formData: any,
  signatureUrl: string,
  krutUrl: string,
): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // 1. Load Fonts
  try {
    const fontNormal = await getFontBase64("/fonts/THSarabunNew.ttf");
    const fontBold = await getFontBase64("/fonts/THSarabunNew Bold.ttf");

    doc.addFileToVFS("THSarabunNew.ttf", fontNormal);
    doc.addFileToVFS("THSarabunNew Bold.ttf", fontBold);
    doc.addFont("THSarabunNew.ttf", "THSarabun", "normal");
    doc.addFont("THSarabunNew Bold.ttf", "THSarabun", "bold");
    doc.setFont("THSarabun", "normal");
  } catch (e) {
    console.error("Error loading fonts:", e);
    alert("ไม่พบไฟล์ฟอนต์ใน /fonts/ กรุณาตรวจสอบ");
    return doc;
  }

  // --- ข้อมูล ---
  const docNumber = formData.placeDocNumber || "อว xxxx/xxxx";
  const formatDate = (date: string | Date) => {
    if (!date) return "....................";
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const docDateStr = formatDate(formData.placeDocDate);
  const startDateStr = formatDate(formData.actualStartDate);
  const endDateStr = formatDate(formData.actualEndDate);
  const companyName =
    student.coop?.company?.name ||
    "..................................................";

  const prefix =
    student.prefix === "MR"
      ? "นาย"
      : student.prefix === "MS"
        ? "นางสาว"
        : student.prefix || "";
  const studentName = `${prefix}${student.firstName} ${student.lastName}`;
  const studentId = student.studentId;
  const majorName = student.major || "วิทยาการคอมพิวเตอร์";

  // --- เริ่มวาด PDF ---
  const pageWidth = 210;
  let y = 15;

  // ✅ 1. วาดรูปครุฑ (ใช้ Helper ใหม่)
  const krutImg = await getImageData(krutUrl);
  if (krutImg) {
    // x, y, w, h
    doc.addImage(krutImg.data, krutImg.format, pageWidth / 2 - 15, y, 30, 28);
  }

  // 2. Header
  doc.setFontSize(16);
  doc.text(`ที่ ${docNumber}`, 20, 45);

  doc.text("มหาวิทยาลัยขอนแก่น", 190, 45, { align: "right" });
  doc.text("123 ถนนมิตรภาพ", 190, 52, { align: "right" });
  doc.text("อำเภอเมืองขอนแก่น", 190, 59, { align: "right" });
  doc.text("จังหวัดขอนแก่น 40002", 190, 66, { align: "right" });

  // 3. วันที่
  const centerX = 105;
  doc.text(docDateStr, centerX, 75, { align: "center" });

  // 4. เรื่อง & เรียน
  doc.text("เรื่อง  ขอส่งตัวนักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษา", 20, 85);
  doc.text(
    `เรียน  ผู้จัดการ / ผู้อำนวยการ / หัวหน้างานทรัพยากรบุคคล บริษัท ${companyName}`,
    20,
    92,
  );

  // 5. เนื้อหา
  const p1 = `       ตามแบบตอบรับนักศึกษาปฏิบัติงานสหกิจศึกษา ที่ทางบริษัท ${companyName} ยินดีรับนักศึกษาสาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น เข้ารับการปฏิบัติงานสหกิจศึกษา จำนวน 1 คน คือ ${studentName} รหัสประจำตัว ${studentId}`;
  const p2 = `       ในการนี้ มหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ ใคร่ขอส่งตัวนักศึกษาปฏิบัติงานสหกิจศึกษาดังกล่าว เข้ารับการปฏิบัติงาน โดยเริ่มปฏิบัติงานระหว่างวันที่ ${startDateStr} ถึง วันที่ ${endDateStr} และขอความอนุเคราะห์จากท่านตรวจสอบรายงานผลการปฏิบัติงานของนักศึกษา และส่งกลับมายังสาขาวิชา${majorName} วิทยาลัยการคอมพิวเตอร์ ภายหลังครบกำหนดระยะเวลาการปฏิบัติงานของนักศึกษา`;
  const p3 = `       จึงเรียนมาเพื่อโปรดพิจารณา และขอขอบพระคุณหน่วยงานของท่านที่ได้อนุเคราะห์ให้นักศึกษาเข้ารับการปฏิบัติงานสหกิจศึกษาในครั้งนี้ หวังเป็นอย่างยิ่งว่าจะได้รับความอนุเคราะห์จากท่านอีก ในโอกาสต่อไป`;

  let currentY = 102;
  const lineHeight = 7;

  const lines1 = doc.splitTextToSize(p1, 165);
  doc.text(lines1, 20, currentY);
  currentY += lines1.length * lineHeight + 5;

  const lines2 = doc.splitTextToSize(p2, 165);
  doc.text(lines2, 20, currentY);
  currentY += lines2.length * lineHeight + 5;

  const lines3 = doc.splitTextToSize(p3, 165);
  doc.text(lines3, 20, currentY);
  currentY += lines3.length * lineHeight + 15;

  // 6. คำลงท้าย & ลายเซ็น
  doc.text("ขอแสดงความนับถือ", centerX, currentY, { align: "center" });

  currentY += 5; // เว้นที่

  // ✅ 2. วาดลายเซ็น (ใช้ Helper ใหม่)
  const sigImg = await getImageData(signatureUrl);
  if (sigImg) {
    doc.addImage(sigImg.data, sigImg.format, centerX - 20, currentY, 40, 15);
  } else {
    // ถ้าไม่มีรูป ให้เว้นที่ว่างไว้
    currentY += 15;
  }

  currentY += 20;
  doc.text("(รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา)", centerX, currentY, {
    align: "center",
  });
  doc.text("คณบดีวิทยาลัยการคอมพิวเตอร์", centerX, currentY + 7, {
    align: "center",
  });

  // 7. Footer
  currentY += 25;
  if (currentY > 280) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(14);
  doc.text("วิทยาลัยการคอมพิวเตอร์", 20, currentY);
  doc.text("งานสหกิจศึกษา", 20, currentY + 6);
  doc.text("โทรศัพท์ 0 4300 9700 ต่อ 50523", 20, currentY + 12);
  doc.text("Email: coop.cp@kku.ac.th", 20, currentY + 18);

  return doc;
};
