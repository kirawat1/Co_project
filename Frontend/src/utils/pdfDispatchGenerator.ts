// Frontend/src/utils/pdfDispatchGenerator.ts
// PDF Generator สำหรับหนังสืออนุเคราหาะส่งตัวสหกิจศึกษา
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

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
  if (!res.ok) {
    throw new Error(`ไฟล์ไม่พบหรือโหลดไม่ได้: ${url} (Status: ${res.status})`);
  }

  // ตรวจสอบ Content-Type คร่าวๆ ว่าไม่ใช่ HTML (กันกรณี Server ส่งหน้า 404 กลับมา)
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error(`URL นี้ส่งค่ากลับมาเป็นหน้าเว็บ ไม่ใช่ไฟล์เอกสาร: ${url}`);
  }

  return await res.arrayBuffer();
};

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

// ================= MAIN GENERATOR =================
// ✅ ฟังก์ชันเวอร์ชันใหม่ รับ 8 arguments
export const createDispatchPDF = async (
  profile: any,
  docNumber: string,
  docDate: string,
  krutUrl: string, // 4. ตรามหาวิทยาลัย
  signatureUrl: string, // 5. ลายเซ็น
  staticProjectUrl: string, // 6. ไฟล์รายละเอียดโครงการ (หน้า 2-6)
  staticAcceptanceUrl: string, // 7. ไฟล์ใบตอบรับ (หน้าสุดท้าย)
  studentDocs: { type: string; url: string }[], // 8. ไฟล์เอกสารของนักศึกษา
  deanName: string = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา", // รับค่าชื่อ
  deanPosition: string = "คณบดีวิทยาลัยการคอมพิวเตอร์", // รับค่าตำแหน่ง
) => {
  // ---------------------------------------------------------
  // PART 1: สร้างหน้าปก (Cover Letter) ด้วย jsPDF
  // ---------------------------------------------------------
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // 1. Load Font
  // ตรวจสอบ path font ให้ตรงกับใน public/fonts/ ของคุณ
  const fontNormal = await getFontBase64("/fonts/THSarabunNew.ttf");
  const fontBold = await getFontBase64("/fonts/THSarabunNew Bold.ttf");
  doc.addFileToVFS("THSarabunNew.ttf", fontNormal);
  doc.addFileToVFS("THSarabunNew Bold.ttf", fontBold);
  doc.addFont("THSarabunNew.ttf", "Sarabun", "normal");
  doc.addFont("THSarabunNew Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");

  const pageWidth = 210;
  const margin = 20;
  let y = 15;

  // 2. ตรามหาวิทยาลัย (กลางหน้ากระดาษ)
  try {
    const krutImg = await getImageArrayBuffer(krutUrl);
    const krutUint8 = new Uint8Array(krutImg);
    // ตรวจสอบนามสกุลไฟล์เพื่อเลือก format
    const format = krutUrl.toLowerCase().endsWith("png") ? "PNG" : "JPEG";
    doc.addImage(krutUint8, format, pageWidth / 2 - 15, y, 30, 28);
  } catch (e) {
    console.error("Krut load error", e);
  }

  // 3. เลขที่หนังสือ & ส่วนราชการ
  y += 35;
  doc.setFontSize(16);
  doc.text(`ที่ อว ${docNumber}`, margin, y);

  doc.text(`มหาวิทยาลัยขอนแก่น`, pageWidth - margin - 50, y);
  y += 7;
  doc.text(`123 ถนนมิตรภาพ`, pageWidth - margin - 50, y);
  y += 7;
  doc.text(`อำเภอเมืองขอนแก่น`, pageWidth - margin - 50, y);
  y += 7;
  doc.text(`จังหวัดขอนแก่น 40002`, pageWidth - margin - 50, y);

  // 4. วันที่
  y += 10;
  const dateText = toThaiDate(docDate);
  const dateX = pageWidth / 2 - doc.getTextWidth(dateText) / 2;
  doc.text(dateText, dateX, y);

  // 5. เรื่อง & เรียน
  y += 15;
  doc.text(
    `เรื่อง   ขอความอนุเคราะห์พิจารณานักศึกษาเข้าร่วมปฏิบัติงานสหกิจศึกษา`,
    margin,
    y,
  );
  y += 8;
  const companyName =
    profile.company?.name || profile.coop?.company?.name || "...............";

  const companyContact =
    profile.company?.contactPersonName ||
    profile.coop?.company?.contactPersonName ||
    "..............";

  const companyPosition =
    profile.company?.contactPersonPosition ||
    profile.coop?.company?.contactPersonPosition ||
    "..............";

  doc.text(`เรียน   กรรมการผู้จัดการ ${companyName}`, margin, y);

  // 6. สิ่งที่ส่งมาด้วย
  y += 8;
  const attachmentX = margin;
  doc.text(`สิ่งที่ส่งมาด้วย`, attachmentX, y);
  doc.text(`1. รายละเอียดโครงการสหกิจศึกษา`, attachmentX + 28, y);
  doc.text(`จำนวน   1   ชุด`, pageWidth - margin - 35, y);
  y += 7;
  doc.text(`2. ประวัตินักศึกษาและใบแสดงผลการเรียน`, attachmentX + 28, y);
  doc.text(`จำนวน   1   ชุด`, pageWidth - margin - 35, y);
  y += 7;
  doc.text(
    `3. แบบฟอร์มตอบรับนักศึกษาเข้าปฏิบัติงานในหน่วยงาน`,
    attachmentX + 28,
    y,
  );
  doc.text(`จำนวน   1   ชุด`, pageWidth - margin - 35, y);

  // 7. เนื้อหา
  y += 12;
  const studentName = `${profile.prefix || ""}${profile.firstName} ${
    profile.lastName
  }`;
  const studentId = profile.studentId;
  const startDate = toThaiDate(
    profile.coop?.actualStartDate ||
      profile.coop?.coopApplicationForm?.startDate,
  );
  const endDate = toThaiDate(
    profile.coop?.actualEndDate || profile.coop?.coopApplicationForm?.endDate,
  );

  const indent = 25;
  const contentWidth = pageWidth - margin * 2;

  const p1 = `       ตามที่ ${companyName} ได้เข้าร่วมโครงการสหกิจศึกษากับ มหาวิทยาลัยขอนแก่น วิทยาลัยการคอมพิวเตอร์ และยินดีรับนักศึกษาหลักสูตรวิทยาการคอมพิวเตอร์ เข้าปฏิบัติงานสหกิจศึกษากับบริษัทของท่าน ซึ่งมีกำหนดช่วงเวลาปฏิบัติงาน ระหว่างวันที่ ${startDate} ถึงวันที่ ${endDate} นั้น ในการนี้ ทางวิทยาลัยการคอมพิวเตอร์ จึงใคร่ขอให้ท่านพิจารณานักศึกษาเข้าร่วมโครงการสหกิจศึกษากับทาง ${companyName} จำนวน 1 คน ดังมีรายชื่อต่อไปนี้`;

  const splitP1 = doc.splitTextToSize(p1, contentWidth);
  doc.text(splitP1, margin, y);
  y += splitP1.length * 7 + 5;

  const nameLine = `1. ${studentName}        รหัสประจำตัว  ${studentId}`;
  const nameX = pageWidth / 2 - doc.getTextWidth(nameLine) / 2;
  doc.text(nameLine, nameX, y);
  y += 10;

  const p2 = `       จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ในการรับนักศึกษาเข้าร่วมโครงการสหกิจศึกษา หากผลการพิจารณาเป็นประการใด กรุณาแจ้งผลกลับมายังวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น 40002 หรือ E-mail: wijika@kku.ac.th ด้วยจักขอบคุณยิ่ง`;
  const splitP2 = doc.splitTextToSize(p2, contentWidth);
  doc.text(splitP2, margin, y);
  y += splitP2.length * 7 + 20;

  // 8. คำลงท้าย & ลายเซ็น
  const signCenter = pageWidth / 2 + 25;
  doc.text(`ขอแสดงความนับถือ`, signCenter, y, { align: "center" });
  y += 5;

  try {
    // ✅ เพิ่มการเช็ค typeof ว่าต้องเป็น string และไม่ว่าง
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
    } else {
      console.warn("⚠️ ข้ามการวาดลายเซ็น: URL ว่างเปล่า");
    }
  } catch (e) {
    console.warn("Signature load error (อาจยังไม่อัปโหลดไฟล์)", e);
  }
  y += 20;
  doc.text(`(${deanName})`, signCenter, y, {
    align: "center",
  });
  y += 7;
  doc.text(`${deanPosition}`, signCenter, y, { align: "center" });

  // 9. Footer
  y = 275;
  doc.setFontSize(12);
  doc.text(`วิทยาลัยการคอมพิวเตอร์`, margin, y);
  doc.text(`โทรศัพท์ 0 4300 9700 ต่อ 50523`, margin, y + 5);
  doc.text(`Email: wijika@kku.ac.th`, margin, y + 10);
  doc.text(`ผู้ร่าง/พิมพ์: วิจิตรา ขจร`, pageWidth - margin, y + 10, {
    align: "right",
  });

  const coverBytes = doc.output("arraybuffer");

  // ---------------------------------------------------------
  // PART 2: รวมไฟล์ (Merge) ด้วย pdf-lib
  // ---------------------------------------------------------
  const mergedPdf = await PDFDocument.create();
  mergedPdf.registerFontkit(fontkit);

  // Helper Merge
  const addPdfToMerge = async (bytes: ArrayBuffer) => {
    try {
      const srcDoc = await PDFDocument.load(bytes);
      const indices = srcDoc.getPageIndices();
      const pages = await mergedPdf.copyPages(srcDoc, indices);
      pages.forEach((page) => mergedPdf.addPage(page));
    } catch (e) {
      console.error("Merge PDF error", e);
    }
  };

  const addImageToMerge = async (url: string) => {
    try {
      const buff = await getImageArrayBuffer(url);
      const ext = url.split(".").pop()?.toLowerCase();
      let img;
      if (ext === "png") img = await mergedPdf.embedPng(buff);
      else img = await mergedPdf.embedJpg(buff);

      const page = mergedPdf.addPage();
      const { width, height } = page.getSize();
      const dims = img.scaleToFit(width - 50, height - 50);
      page.drawImage(img, {
        x: (width - dims.width) / 2,
        y: (height - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error("Image merge error", e);
    }
  };

  // ✅ 1. หน้าแรก (Cover Letter)
  await addPdfToMerge(coverBytes);

  // ✅ 2. รายละเอียดโครงการ (2-6.pdf)
  try {
    // ✅ เพิ่ม typeof เช็คชนิดตัวแปร
    if (
      typeof staticProjectUrl === "string" &&
      staticProjectUrl.trim() !== "" &&
      !staticProjectUrl.endsWith("undefined") &&
      !staticProjectUrl.endsWith("null")
    ) {
      const p26 = await getImageArrayBuffer(staticProjectUrl);
      await addPdfToMerge(p26);
    } else {
      console.warn("⚠️ ข้ามการรวมไฟล์: ไม่พบ URL รายละเอียดโครงการ");
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถรวมไฟล์รายละเอียดโครงการ (หน้า 2-6) ได้:", e);
  }

  // ✅ 3. เอกสารนักศึกษา
  const orderMap: Record<string, number> = {
    "CP-T000": 1,
    T000_SIGNED: 1,
    "CP-TRANSCRIPT": 2,
    TRANSCRIPT: 2,
    "CP-STUDENT_CARD": 3,
    STUDENT_CARD: 3,
    "CP-CITIZEN_CARD": 4,
    CITIZEN_CARD: 4,
    "CP-CV": 5,
    CV: 5,
  };

  const sortedDocs = studentDocs.sort((a, b) => {
    return (orderMap[a.type] || 99) - (orderMap[b.type] || 99);
  });

  for (const doc of sortedDocs) {
    if (doc.url.toLowerCase().endsWith(".pdf")) {
      const buff = await getImageArrayBuffer(doc.url);
      await addPdfToMerge(buff);
    } else {
      await addImageToMerge(doc.url);
    }
  }

  // ✅ 4. ใบตอบรับสหกิจ (Acceptance Form)
  try {
    // ✅ เพิ่ม typeof เช็คชนิดตัวแปร
    if (
      typeof staticAcceptanceUrl === "string" &&
      staticAcceptanceUrl.trim() !== "" &&
      !staticAcceptanceUrl.endsWith("undefined") &&
      !staticAcceptanceUrl.endsWith("null")
    ) {
      const accForm = await getImageArrayBuffer(staticAcceptanceUrl);
      await addPdfToMerge(accForm);
    } else {
      console.warn("⚠️ ข้ามการรวมไฟล์: ไม่พบ URL ใบตอบรับ");
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถรวมไฟล์ใบตอบรับได้:", e);
  }

  // Return Result
  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes as any], { type: "application/pdf" });
};
