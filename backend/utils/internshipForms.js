// ฟอร์มช่วงฝึกสหกิจ T002/T003 — "เท่ากัน ไม่ต่อกัน"
//   สถานะหลักของนักศึกษาคงที่ที่ INTERNSHIP_STARTED (แสดงว่า "ส่งเอกสารฝึกสหกิจ") ตลอดช่วงฝึกงาน
//   สถานะของแต่ละฟอร์มอ่านจากไฟล์ล่าสุดของฟอร์มนั้น (Document.status) ไม่มีการเลื่อนขั้น T002 -> T003 อีกแล้ว
//   ส่ง/ตรวจ/ตีกลับ ฟอร์มหนึ่งไม่กระทบอีกฟอร์ม และการตรวจไม่แตะ StudentCoop.status
const FORM_TYPES = { T002: 'T002_FORM', T003: 'T003_FORM' };

// สถานะหลักแบบเก่าที่ยังค้างใน DB จนกว่าจะรันสคริปต์ migrate — ต้องปฏิบัติเหมือน INTERNSHIP_STARTED ทุกประการ
const LEGACY_INTERNSHIP_STATUSES = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED'];
const INTERNSHIP_STATUSES = ['INTERNSHIP_STARTED', ...LEGACY_INTERNSHIP_STATUSES];

const isInternshipStatus = (status) => INTERNSHIP_STATUSES.includes(status);

/** สถานะย่อยของฟอร์มจากไฟล์ล่าสุด: NONE (ยังไม่ส่ง) | WAITING (รอตรวจ) | REJECTED (ต้องแก้) | APPROVED */
function formState(doc) {
  if (!doc) return 'NONE';
  if (doc.status === 'WAITING' || doc.status === 'PENDING') return 'WAITING';
  if (doc.status === 'REJECTED' || doc.status === 'EDITS_REQUIRED') return 'REJECTED';
  return 'APPROVED';
}

// ป้ายสถานะย่อยของฟอร์ม (Excel/ที่อื่นใช้ร่วมกัน — ที่เดียว)
const FORM_STATE_LABEL = { NONE: 'ยังไม่ส่ง', WAITING: 'รอตรวจ', REJECTED: 'ต้องแก้', APPROVED: 'ผ่าน' };

/** ส่งฟอร์มได้: อยู่ช่วงฝึกงาน และยังไม่เคยส่ง หรือถูกตีกลับ (รอตรวจ/ผ่านแล้วห้ามส่งซ้ำ) */
const canSubmitForm = (coopStatus, state) =>
  isInternshipStatus(coopStatus) && (state === 'NONE' || state === 'REJECTED');

/** ปุ่มตรวจ: รอตรวจ = ผ่าน/ตีกลับ · ผ่านแล้ว = ตีกลับย้อนหลังได้ · ที่เหลือ (ยังไม่ส่ง/รอนักศึกษาแก้) ตรวจไม่ได้ */
function reviewActions(coopStatus, state) {
  if (!isInternshipStatus(coopStatus)) return { approve: false, reject: false };
  if (state === 'WAITING') return { approve: true, reject: true };
  if (state === 'APPROVED') return { approve: false, reject: true };
  return { approve: false, reject: false };
}

/** ไฟล์ล่าสุดของฟอร์ม (db = prisma หรือ tx) */
const latestFormDoc = (db, studentId, stepKey) =>
  db.document.findFirst({ where: { studentId, type: FORM_TYPES[stepKey] }, orderBy: { id: 'desc' } });

/** บันทึกผลตรวจในทรานแซกชัน — reject = ตีกลับ · แก้เฉพาะไฟล์ ไม่แตะ StudentCoop.status */
async function reviewForm(tx, { studentId, stepKey, reject, comment }) {
  const coop = await tx.studentCoop.findUnique({ where: { studentId }, select: { status: true } });
  const doc = await latestFormDoc(tx, studentId, stepKey);
  const actions = reviewActions(coop && coop.status, formState(doc));
  if (!(reject ? actions.reject : actions.approve)) {
    throw Object.assign(new Error(`ตรวจ ${stepKey} ไม่ได้ในสถานะนี้ (ยังไม่ส่ง รอนักศึกษาแก้ไข หรือตรวจผ่านแล้ว)`), { is400: true });
  }
  await tx.document.update({
    where: { id: doc.id },
    data: reject ? { status: 'REJECTED', rejectReason: comment || null } : { status: 'APPROVED', rejectReason: null },
  });
}

/** where ของ Student: มีไฟล์ฟอร์มนั้นรอตรวจ (ป้ายเมนู · จำนวนรอตรวจ) */
const formPendingStudent = (stepKey) => ({
  documents: { some: { type: FORM_TYPES[stepKey], status: { in: ['WAITING', 'PENDING'] } } },
});

module.exports = {
  FORM_TYPES, FORM_STATE_LABEL, LEGACY_INTERNSHIP_STATUSES, INTERNSHIP_STATUSES, isInternshipStatus,
  formState, canSubmitForm, reviewActions, latestFormDoc, reviewForm, formPendingStudent,
};
