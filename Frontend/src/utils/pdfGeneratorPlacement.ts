// utils/pdfGeneratorPlacement.ts
// PDF หนังสือส่งตัว — เนื้อหาเดียวกับ Word (placementLetterModel) วาดด้วย jsPDF
import type { jsPDF } from "jspdf";
import { letterMajorName, placementLetterModel, thaiPrefix } from "./docGeneratorUtils";
import { letterRecipient, recipientText } from "./letterRecipient";
import { type LetterStudent } from "./letterGroup";
import { loadEmblem } from "./letterAssets";
import { newLetterDoc, renderLetterPdf } from "./pdfLetter";

export const createPlacementPDF = async (
  student: any,
  formData: any,
  krutUrl: string,
  deanName: string = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา", // รับค่าชื่อ (มีค่า Default กันเหนียว)
  deanPosition: string = "คณบดีวิทยาลัยการคอมพิวเตอร์", // รับค่าตำแหน่ง
  students?: LetterStudent[], // หนังสือรวมหลายคน — วันฝึกต่างกันได้ (ใส่ท้ายชื่อแต่ละคน)
): Promise<jsPDF> => {
  const model = placementLetterModel({
    // เดิมพิมพ์ "ที่ 660301…" ไม่มี "อว" — ตัวสร้างใหม่เติม "ที่ อว" ให้เหมือนหนังสือแบบอื่น
    docNumber: formData.placeDocNumber || "",
    docDate: formData.placeDocDate,
    studentName: `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`,
    studentId: student.studentId,
    // ชื่อหลักสูตรภาษาไทย — student.major เป็นรหัสสาขา (CS)
    major: letterMajorName(student),
    companyName: student.coop?.company?.name || "..................................................",
    // ผู้รับ = ผู้ติดต่อ (HR) ของคำร้อง → ผู้ติดต่อเดิมของบริษัท → ผู้จัดการบริษัท
    companyRecipient: recipientText(letterRecipient(student.coop)) || undefined,
    startDate: formData.actualStartDate,
    endDate: formData.actualEndDate,
    deanName, deanPosition, students,
  });
  const doc = await newLetterDoc();
  renderLetterPdf(doc, model, await loadEmblem(krutUrl));
  return doc;
};
