// Frontend/src/utils/pdfDispatchGenerator.ts
// PDF หนังสือขอความอนุเคราะห์ (หน้าหนังสือ + เอกสารแนบต่อท้าย)
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { dispatchLetterModel, thaiPrefix } from "./docGeneratorUtils";
import { letterRecipient, recipientText } from "./letterRecipient";
import { type LetterStudent } from "./letterGroup";
import { loadEmblem } from "./letterAssets";
import { newLetterDoc, renderLetterPdf } from "./pdfLetter";

// --- Helpers ---
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

/** ผลรวมเอกสารแนบ (out-param ทางเลือก): skipped = รายการที่รวมไม่ได้ · pages = จำนวนหน้าเอกสารแนบที่รวมได้ */
export interface AttachmentReport { skipped: string[]; pages: number }

// รวมเอกสารแนบต่อท้าย (หน้า 2 เป็นต้นไป): รายละเอียดโครงการ → เอกสารนักศึกษาตามลำดับ → แบบฟอร์มตอบรับ
// ใช้ร่วมกันระหว่างหนังสือ PDF เต็มเล่ม (createDispatchPDF) กับเอกสารแนบล้วน (createDispatchAttachmentsPDF)
const appendDispatchAttachments = async (
  mergedPdf: PDFDocument,
  staticProjectUrl: string,
  staticAcceptanceUrl: string,
  studentDocs: { type: string; url: string; label?: string }[],
  report?: AttachmentReport,
) => {
  const skipped: string[] = [];
  let pageCount = 0;
  // Helper Merge — คืน true เมื่อรวมได้
  const addPdfToMerge = async (bytes: ArrayBuffer): Promise<boolean> => {
    try {
      const srcDoc = await PDFDocument.load(bytes);
      const indices = srcDoc.getPageIndices();
      const pages = await mergedPdf.copyPages(srcDoc, indices);
      pages.forEach((page) => mergedPdf.addPage(page));
      pageCount += pages.length;
      return true;
    } catch (e) {
      console.error("Merge PDF error", e);
      return false;
    }
  };

  const addImageToMerge = async (url: string): Promise<boolean> => {
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
      pageCount += 1;
      return true;
    } catch (e) {
      console.error("Image merge error", e);
      return false;
    }
  };

  // 1. รายละเอียดโครงการ (2-6.pdf)
  try {
    // ✅ เพิ่ม typeof เช็คชนิดตัวแปร
    if (
      typeof staticProjectUrl === "string" &&
      staticProjectUrl.trim() !== "" &&
      !staticProjectUrl.endsWith("undefined") &&
      !staticProjectUrl.endsWith("null")
    ) {
      const p26 = await getImageArrayBuffer(staticProjectUrl);
      if (!(await addPdfToMerge(p26))) skipped.push("รายละเอียดโครงการ");
    } else {
      console.warn("⚠️ ข้ามการรวมไฟล์: ไม่พบ URL รายละเอียดโครงการ");
      skipped.push("รายละเอียดโครงการ");
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถรวมไฟล์รายละเอียดโครงการ (หน้า 2-6) ได้:", e);
    skipped.push("รายละเอียดโครงการ");
  }

  // 2. เอกสารนักศึกษา
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

  const sortedDocs = [...studentDocs].sort((a, b) => {
    return (orderMap[a.type] || 99) - (orderMap[b.type] || 99);
  });

  for (const doc of sortedDocs) {
    try {
      let ok: boolean;
      if (doc.url.toLowerCase().endsWith(".pdf")) {
        const buff = await getImageArrayBuffer(doc.url);
        ok = await addPdfToMerge(buff);
      } else {
        ok = await addImageToMerge(doc.url);
      }
      if (!ok) skipped.push(doc.label || `${doc.type} ${doc.url}`);
    } catch (e) {
      console.warn(`⚠️ ข้ามเอกสาร [${doc.type}] ${doc.url} — ไม่พบไฟล์:`, e);
      skipped.push(doc.label || `${doc.type} ${doc.url}`);
    }
  }

  // 3. ใบตอบรับสหกิจ (Acceptance Form)
  try {
    // ✅ เพิ่ม typeof เช็คชนิดตัวแปร
    if (
      typeof staticAcceptanceUrl === "string" &&
      staticAcceptanceUrl.trim() !== "" &&
      !staticAcceptanceUrl.endsWith("undefined") &&
      !staticAcceptanceUrl.endsWith("null")
    ) {
      const accForm = await getImageArrayBuffer(staticAcceptanceUrl);
      if (!(await addPdfToMerge(accForm))) skipped.push("แบบฟอร์มตอบรับ");
    } else {
      console.warn("⚠️ ข้ามการรวมไฟล์: ไม่พบ URL ใบตอบรับ");
      skipped.push("แบบฟอร์มตอบรับ");
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถรวมไฟล์ใบตอบรับได้:", e);
    skipped.push("แบบฟอร์มตอบรับ");
  }
  if (report) { report.skipped.push(...skipped); report.pages += pageCount; }
};

// ================= MAIN GENERATOR =================
// ไม่มีรูปลายเซ็น — หนังสือโหลดไปลงนามจริง (เว้นที่ว่างไว้ให้ลงนาม)
export const createDispatchPDF = async (
  profile: any,
  docNumber: string,
  docDate: string,
  krutUrl: string, // 4. ตรามหาวิทยาลัย
  staticProjectUrl: string, // 6. ไฟล์รายละเอียดโครงการ (หน้า 2-6)
  staticAcceptanceUrl: string, // 7. ไฟล์ใบตอบรับ (หน้าสุดท้าย)
  studentDocs: { type: string; url: string; label?: string }[], // 8. ไฟล์เอกสารของนักศึกษา
  deanName: string = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา", // รับค่าชื่อ
  deanPosition: string = "คณบดีวิทยาลัยการคอมพิวเตอร์", // รับค่าตำแหน่ง
  students?: LetterStudent[], // หนังสือรวมหลายคน (บริษัทเดียวกัน) — ไม่ส่ง/คนเดียว = หนังสือเดี่ยว
  report?: AttachmentReport, // out-param ทางเลือก: รายการเอกสารแนบที่รวมไม่ได้ (หน้าต่างรายคนไม่ส่ง)
) => {
  // ---------------------------------------------------------
  // PART 1: หน้าหนังสือ — เนื้อหาเดียวกับ Word (dispatchLetterModel) วาดด้วย jsPDF
  // ---------------------------------------------------------
  const company = profile.coop?.company || profile.company;
  // ผู้รับ = ผู้ติดต่อ (HR) ของคำร้อง → ผู้ติดต่อเดิมของบริษัท → กรรมการผู้จัดการ
  const contact = recipientText(letterRecipient({ contacts: profile.coop?.contacts, company }));
  const model = dispatchLetterModel({
    docNumber, docDate,
    // prefix เก็บเป็น MR/MS — เดิมพิมพ์ "MRชื่อ" ลงหนังสือ
    studentName: `${thaiPrefix(profile.prefix)}${profile.firstName} ${profile.lastName}`,
    studentId: profile.studentId,
    major: profile.major,
    majorNameTh: profile.majorNameTh,
    companyName: company?.name || "...............",
    companyContact: contact || undefined,
    startDate: profile.coop?.actualStartDate || profile.coop?.coopApplicationForm?.startDate,
    endDate: profile.coop?.actualEndDate || profile.coop?.coopApplicationForm?.endDate,
    deanName, deanPosition, students,
  });
  const doc = await newLetterDoc();
  renderLetterPdf(doc, model, await loadEmblem(krutUrl));

  const coverBytes = doc.output("arraybuffer");

  // ---------------------------------------------------------
  // PART 2: รวมไฟล์ (Merge) ด้วย pdf-lib
  // ---------------------------------------------------------
  const mergedPdf = await PDFDocument.create();
  mergedPdf.registerFontkit(fontkit);

  // ✅ 1. หน้าแรก (Cover Letter)
  try {
    const coverDoc = await PDFDocument.load(coverBytes);
    const pages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  } catch (e) {
    console.error("Merge PDF error", e);
  }

  // ✅ 2-4. รายละเอียดโครงการ → เอกสารนักศึกษา → ใบตอบรับ
  await appendDispatchAttachments(mergedPdf, staticProjectUrl, staticAcceptanceUrl, studentDocs, report);

  // Return Result
  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes as any], { type: "application/pdf" });
};

// เอกสารแนบล้วน (ไม่มีหน้าหนังสือ) — คู่กับหนังสือ Word ในออกร่างหลายคน
export const createDispatchAttachmentsPDF = async (
  staticProjectUrl: string,
  staticAcceptanceUrl: string,
  studentDocs: { type: string; url: string; label?: string }[],
  report?: AttachmentReport,
): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();
  mergedPdf.registerFontkit(fontkit);
  await appendDispatchAttachments(mergedPdf, staticProjectUrl, staticAcceptanceUrl, studentDocs, report);
  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes as any], { type: "application/pdf" });
};
