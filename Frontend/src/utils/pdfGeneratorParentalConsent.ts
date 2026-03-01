import { jsPDF } from "jspdf";

// ================= HELPERS =================
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

const formatDateTH = (dateStr?: string) => {
  if (!dateStr) return "....... เดือน ..................... พ.ศ. ..........";
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
  return ` ${d.getDate()}  เดือน  ${months[d.getMonth()]}  พ.ศ.  ${d.getFullYear() + 543}`;
};

const getThaiPrefix = (prefix?: string | null) => {
  if (!prefix) return "";
  const p = prefix.toUpperCase();
  if (p === "MR" || p === "MISTER" || p === "นาย") return "นาย";
  if (["MS", "MISS", "MRS", "นาง", "นางสาว"].includes(p)) return "นางสาว";
  return prefix;
};

// ================= MAIN FUNCTION =================
export const createParentalConsentPDF = async (
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
    console.error("Error loading fonts:", e);
    alert("ไม่พบไฟล์ฟอนต์ THSarabunNew ในโฟลเดอร์ public/fonts/");
    return doc;
  }

  // --- ข้อมูล ---
  const studentPrefix = getThaiPrefix(profile.prefix);
  const studentName = `${studentPrefix}${profile.firstName} ${profile.lastName}`;
  const studentId = profile.studentId || "...................................";
  const major = profile.major || "...................................";
  const curriculum =
    profile.curriculum || "...................................";
  const companyName =
    profile.company?.name ||
    profile.coop?.company?.name ||
    "......................................................................";

  // ข้อมูลผู้ปกครอง (ดึงจากบุคคลติดต่อฉุกเฉิน)
  const parentName =
    formData.emergencyName ||
    "......................................................................";
  const relation = formData.emergencyRelation || "....................";
  const parentAddress =
    formData.emergencyAddress ||
    "....................................................................................................";
  const parentPhone =
    formData.emergencyPhone || "..............................";
  const parentEmail = formData.emergencyEmail || "-";

  // วันที่ปัจจุบัน
  const currentDate = new Date();
  const dateDay = currentDate.getDate();
  const dateMonth = [
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
  ][currentDate.getMonth()];
  const dateYear = currentDate.getFullYear() + 543;

  // --- เริ่มวาด PDF ---
  const leftX = 20;
  const rightX = 190;
  const contentWidth = 170;
  const centerX = 105;
  let y = 15;

  // 1. Top Right Code
  doc.setFontSize(12);
  doc.text("KKU CP-T001", rightX, y, { align: "right" });

  // 2. Header
  y += 10;
  doc.setFontSize(16);
  doc.setFont("THSarabun", "bold");
  doc.text("หนังสือยินยอมจากผู้ปกครอง", leftX, y);

  y += 7;
  doc.text("CO-OPERATIVE EDUCATION", leftX, y);

  y += 7;
  doc.text("สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น", leftX, y);

  y += 3;
  doc.setLineWidth(0.5);
  doc.line(leftX, y, rightX, y); // ขีดเส้นใต้

  // 3. Date
  y += 12;
  doc.setFont("THSarabun", "normal");
  doc.text(
    `วันที่  ${dateDay}   เดือน   ${dateMonth}   พ.ศ.   ${dateYear}`,
    rightX,
    y,
    { align: "right" },
  );

  // 4. เรียน หัวหน้าสาขา
  y += 12;
  // หัวหน้าสาขาอาจจะ Hardcode หรือเว้นไว้ก็ได้
  doc.text(
    "เรียน   หัวหน้าสาขาวิชา  ..................................................................................",
    leftX,
    y,
  );

  // 5. Body Paragraph 1 (ข้อมูลผู้ปกครอง & การยินยอม)
  y += 12;
  const p1 = `       ด้วยข้าพเจ้า นาย/นาง/นางสาว ${parentName} ผู้ปกครองของ ${studentName} รหัสประจำตัว ${studentId} หลักสูตร ${curriculum} สาขาวิชา ${major} วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น ยินยอมให้ ${studentName} ซึ่งเกี่ยวข้องกับข้าพเจ้าโดยเป็น ${relation} เดินทางไปปฏิบัติงานสหกิจศึกษา ณ สถานประกอบการที่ ${companyName}`;

  doc.setFont("THSarabun", "normal");
  const lines1 = doc.splitTextToSize(p1, contentWidth);
  doc.text(lines1, leftX, y);
  y += lines1.length * 7;

  // 6. Body Paragraph 2 (ระยะเวลา)
  y += 3;
  const startDateStr = formData.startDate
    ? formatDateTH(formData.startDate)
    : "....... เดือน ..................... พ.ศ. ..........";
  const endDateStr = formData.endDate
    ? formatDateTH(formData.endDate)
    : "....... เดือน ..................... พ.ศ. ..........";

  const p2 = `       ซึ่งเป็นรายวิชาหนึ่งในหลักสูตรของวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น โดยออกปฏิบัติสหกิจศึกษาในระหว่างวันที่ ${startDateStr} ถึงวันที่ ${endDateStr}`;
  const lines2 = doc.splitTextToSize(p2, contentWidth);
  doc.text(lines2, leftX, y);
  y += lines2.length * 7;

  // 7. Body Paragraph 3 (รับทราบความเสี่ยง)
  y += 3;
  const p3 = `       โดยนักศึกษาและผู้ปกครองทราบถึงวัตถุประสงค์ของการไปปฏิบัติงานและความเสี่ยงที่จะเกิดขึ้น พร้อมปฏิบัติตามแนวปฏิบัติของวิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น และหน่วยงานที่ปฏิบัติงานสหกิจศึกษา และยอมรับผลกระทบที่เกิดขึ้นจากความเสี่ยงดังกล่าวด้วยความเต็มใจ`;
  const lines3 = doc.splitTextToSize(p3, contentWidth);
  doc.text(lines3, leftX, y);
  y += lines3.length * 7;

  // 8. Emergency Contact Section
  y += 10;
  doc.setFont("THSarabun", "bold");
  doc.text(
    `ชื่อที่สามารถติดต่อได้ในกรณีฉุกเฉิน นาย/นาง/นางสาว  ${parentName}`,
    leftX,
    y,
  );

  y += 8;
  doc.text("ที่อยู่", leftX, y);
  doc.setFont("THSarabun", "normal");

  // ตัดคำที่อยู่ถ้ายาวเกิน
  const addressLines = doc.splitTextToSize(parentAddress, contentWidth - 10);
  doc.text(addressLines, leftX + 10, y);
  y += addressLines.length * 7 + 2;

  doc.setFont("THSarabun", "bold");
  doc.text("เบอร์โทรศัพท์", leftX, y);
  doc.setFont("THSarabun", "normal");
  doc.text(
    `${parentPhone}       E-Mail address  ${parentEmail}`,
    leftX + 25,
    y,
  );

  // 9. Signature Section
  y += 20;
  const signX = 130;
  doc.text(
    "(ลงชื่อ)...........................................................",
    signX,
    y,
    { align: "center" },
  );

  y += 8;
  doc.text(`( ${parentName} )`, signX, y, { align: "center" });

  y += 8;
  doc.text("ผู้ปกครองนักศึกษา", signX, y, { align: "center" });

  // 10. Footer (เส้นใต้ + Contact Info)
  // ดัน Footer ไปล่างสุด
  y = 270;
  doc.setLineWidth(0.5);
  doc.line(leftX, y, rightX, y);

  y += 6;
  doc.setFontSize(14);
  doc.text("สหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น", leftX, y);

  y += 6;
  doc.text(
    "โทรศัพท์มือถือ 08-9710-2645 หรือ 043-009700 ต่อ 50523 E-Mail address wijika@kku.ac.th",
    leftX,
    y,
  );

  return doc;
};
