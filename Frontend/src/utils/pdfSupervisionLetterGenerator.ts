// utils/pdfSupervisionLetterGenerator.ts
// PDF หนังสือขอนิเทศ — เนื้อหาเดียวกับ Word (supervisionLetterModel) วาดด้วย jsPDF
import { thaiPrefix, supervisionSupervisorNames, supervisionTimeText, supervisionLetterModel } from "./docGeneratorUtils";
import { letterRecipient, recipientText } from "./letterRecipient";
import { type LetterStudent } from "./letterGroup";
import { loadEmblem } from "./letterAssets";
import { newLetterDoc, renderLetterPdf } from "./pdfLetter";

export const createSupervisionLetterPDF = async (
  appt: any, // ข้อมูลตาราง SupervisionAppointment
  docNumber: string,
  docDate: string,
  krutUrl: string,
  deanName: string = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา",
  deanPosition: string = "คณบดีวิทยาลัยการคอมพิวเตอร์",
  students?: LetterStudent[], // หนังสือรวมของกลุ่มนิเทศ
) => {
  const student = appt.student || {};
  const model = supervisionLetterModel({
    docNumber, docDate,
    // prefix เก็บเป็น MR/MS ได้ — แปลงเป็นไทยก่อน ไม่งั้นขึ้น "MRสมชาย"
    studentName: `${thaiPrefix(student.prefix) || "นาย/นางสาว"}${student.firstName || ""} ${student.lastName || ""}`,
    studentId: student.studentId || "...................",
    major: student.major,
    majorNameTh: student.majorNameTh,
    companyName: student.coop?.company?.name || appt.companyName || "........................................................",
    // ผู้รับ = ผู้ติดต่อ (HR) ของคำร้อง → ผู้ติดต่อเดิมของบริษัท
    companyRecipient: recipientText(letterRecipient(student.coop)) || undefined,
    // อาจารย์หลัก + อาจารย์นิเทศร่วม (coTeacherName)
    supervisorNames: supervisionSupervisorNames(appt),
    visitDate: appt.confirmedDate,
    // เวลาอยู่ใน confirmedDate · "13.30 น." แบบหนังสือราชการ (เดิม 13:30)
    visitTime: supervisionTimeText(appt.confirmedDate),
    online: appt.supervisionType === "ONLINE",
    onlineLink: appt.onlineLink,
    deanName, deanPosition, students,
  });
  const doc = await newLetterDoc();
  renderLetterPdf(doc, model, await loadEmblem(krutUrl));
  return new Blob([doc.output("arraybuffer") as any], { type: "application/pdf" });
};
