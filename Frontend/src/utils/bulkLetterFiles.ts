import { createDispatchPDF, createDispatchAttachmentsPDF, type AttachmentReport } from "./pdfDispatchGenerator";
import { createPlacementPDF } from "./pdfGeneratorPlacement";
import { createWordBlob, buildDispatchLetterHtml, buildPlacementLetterHtml, thaiPrefix, letterMajorName } from "./docGeneratorUtils";
import { letterRecipient, recipientText } from "./letterRecipient";
import { toLetterStudent } from "./letterGroup";
import { letterFileNames, type BulkLetterType, type BulkFormat } from "./bulkLetters";
import { existingAttachmentFiles, type LetterAssets } from "./letterAssets";

/**
 * สร้างไฟล์ของหนังสือ 1 ฉบับ ด้วยตัวสร้างเดิมของหน้าต่างออกหนังสือรายคน (อาร์กิวเมนต์เท่ากัน)
 * students[0] = ผู้รับ/บริษัท · ≥ 2 คน = หนังสือรวม
 * REQUEST+doc → [.doc, เอกสารแนบ.pdf] · อื่นๆ → ไฟล์เดียว
 */
export async function buildLetterFiles(opts: {
  letter: BulkLetterType;
  format: BulkFormat;
  docNumber: string;
  docDate: string;
  students: any[];
  assets: LetterAssets;
}): Promise<{ files: { name: string; blob: Blob }[]; missingAttachments: string[] }> {
  const { letter, format, docNumber, docDate, students, assets } = opts;
  const student = students[0];
  const group = students.length > 1 ? students.map(toLetterStudent) : undefined;
  const startDate = student.coop?.actualStartDate || student.coopApplicationForm?.startDate || "";
  const endDate = student.coop?.actualEndDate || student.coopApplicationForm?.endDate || "";
  const names = letterFileNames(letter, format, docNumber, student.coop?.company?.name || "");
  const { krutUrl, projectUrl, acceptUrl, deanName, deanPosition } = assets;
  const studentName = `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`;
  const needKrut = () => { if (!krutUrl) throw new Error("ไม่พบไฟล์ตราสัญลักษณ์มหาวิทยาลัย กรุณาอัปโหลดในหน้าตั้งค่า"); return krutUrl; };

  if (letter === "REQUEST") {
    const attach = await existingAttachmentFiles(students);
    if (format === "pdf") {
      const profile = { ...student, coop: { ...student.coop, actualStartDate: startDate, actualEndDate: endDate } };
      const report: AttachmentReport = { skipped: [], pages: 0 };
      const blob = await createDispatchPDF(profile, docNumber, docDate, needKrut(), projectUrl || "", acceptUrl || "", attach.files, deanName, deanPosition, group, report);
      return { files: [{ name: names[0], blob }], missingAttachments: [...attach.missing, ...report.skipped] };
    }
    const html = buildDispatchLetterHtml({
      docNumber, docDate, studentName,
      studentId: student.studentId,
      studyProgram: student.studyProgram,
      major: student.major,
      majorNameTh: student.majorNameTh,
      companyName: student.coop?.company?.name || "....",
      companyContact: recipientText(letterRecipient(student.coop)) || undefined,
      startDate, endDate, deanName, deanPosition,
      students: group,
    });
    const report: AttachmentReport = { skipped: [], pages: 0 };
    const attachments = await createDispatchAttachmentsPDF(projectUrl || "", acceptUrl || "", attach.files, report);
    const missingAttachments = [...attach.missing, ...report.skipped];
    const wordFile = { name: names[0], blob: createWordBlob(html, assets.emblem) };
    // ไม่มีหน้าเอกสารแนบเลย → ไม่ใส่ไฟล์ PDF ว่าง (0 หน้า) ลงใน zip
    if (report.pages === 0) return { files: [wordFile], missingAttachments: [...missingAttachments, "ไม่มีเอกสารแนบที่รวมได้เลย (ไม่ได้สร้างไฟล์ -เอกสารแนบ.pdf)"] };
    return { files: [wordFile, { name: names[1], blob: attachments }], missingAttachments };
  }

  if (format === "pdf") {
    const doc = await createPlacementPDF(
      student, { placeDocNumber: docNumber, placeDocDate: docDate, actualStartDate: startDate, actualEndDate: endDate },
      needKrut(), deanName, deanPosition, group,
    );
    return { files: [{ name: names[0], blob: doc.output("blob") }], missingAttachments: [] };
  }
  const html = buildPlacementLetterHtml({
    docNumber, docDate, studentName,
    studentId: student.studentId, major: letterMajorName(student),
    companyName: student.coop?.company?.name || "....",
    companyRecipient: recipientText(letterRecipient(student.coop)) || undefined,
    startDate, endDate, deanName, deanPosition,
    students: group,
  });
  return { files: [{ name: names[0], blob: createWordBlob(html, assets.emblem) }], missingAttachments: [] };
}
