// ตรวจ T002 — ใช้ร่วมกันระหว่างเจ้าหน้าที่/อาจารย์ประจำวิชา (adminDocController) กับอาจารย์ที่ปรึกษา (teacherController)
//   ปกติตรวจตอน T002_SUBMITTED: ผ่าน = สถานะคงเดิม (ไม่มีสถานะ "T002 ผ่าน" แยก) · ตีกลับ = T002_EDITS_REQUIRED
//   ตรวจย้อนหลัง: นักศึกษาส่ง T003 ได้ทันทีหลังส่ง T002 (ไม่ต้องรอผล) → สถานะเลื่อนไปช่วง T003 ทั้งที่ไฟล์ T002 ยังรอตรวจ
//     เดิมตรวจไม่ได้อีกเลย (หน้าตรวจขึ้น "รอการตรวจสอบ — ไม่สามารถตรวจสอบซ้ำได้ในสถานะนี้") → ตรวจได้จนกว่าไฟล์จะถูกตรวจ
//     ผ่าน/ตีกลับ = เปลี่ยนเฉพาะสถานะไฟล์ ขั้น T003 ไม่ถอย · ตีกลับแล้วนักศึกษาส่ง T002 ใหม่ได้ ไม่ติดกำหนดส่ง
//     (docController.uploadDocument · resolveDeadline) แล้วกลับมารอตรวจที่นี่อีกรอบ
const T002_LATE_REVIEW_STATUSES = ['T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED'];
const REVIEWED_DOC = ['APPROVED', 'REJECTED', 'EDITS_REQUIRED'];

// T002 "รอตรวจ" (ป้ายเมนู · จำนวนรอตรวจของรอบ) = สถานะเหล่านี้ + ไฟล์ T002 ยังไม่ถูกตรวจ
//   เดิมนับจาก T002_SUBMITTED อย่างเดียว — ตรวจผ่านแล้วยังนับค้าง (สถานะไม่เปลี่ยน) และไม่นับคนที่ไปขั้น T003 แล้ว
const T002_PENDING_STATUSES = ['T002_SUBMITTED', ...T002_LATE_REVIEW_STATUSES];
const T002_UNREVIEWED_STUDENT = { documents: { some: { type: 'T002_FORM', status: { notIn: REVIEWED_DOC } } } };

const isLateT002 = (coopStatus) => T002_LATE_REVIEW_STATUSES.includes(coopStatus);

/** บันทึกผลตรวจ T002 ในทรานแซกชัน — reject = ตีกลับ · คืน { late } (ตรวจย้อนหลังหรือไม่) */
async function applyT002Review(tx, { studentId, reject, comment }) {
  const coop = await tx.studentCoop.findUnique({ where: { studentId }, select: { status: true } });
  const doc = await tx.document.findFirst({ where: { studentId, type: 'T002_FORM' }, orderBy: { id: 'desc' } });
  const late = !!coop && isLateT002(coop.status) && !!doc && !REVIEWED_DOC.includes(doc.status);
  if (!coop || (coop.status !== 'T002_SUBMITTED' && !late)) {
    throw Object.assign(new Error('ตรวจ T002 ได้เมื่อนักศึกษาส่ง T002 แล้วและยังไม่ได้ตรวจ (ตอนนี้ตรวจไปแล้ว หรือรอนักศึกษาแก้ไข)'), { is400: true });
  }
  if (!late) {
    await tx.studentCoop.update({ where: { studentId }, data: { status: reject ? 'T002_EDITS_REQUIRED' : 'T002_SUBMITTED' } });
  }
  if (doc) {
    await tx.document.update({ where: { id: doc.id }, data: { status: reject ? 'REJECTED' : 'APPROVED', rejectReason: comment || null } });
  }
  return { late };
}

module.exports = { T002_LATE_REVIEW_STATUSES, T002_PENDING_STATUSES, T002_UNREVIEWED_STUDENT, isLateT002, applyT002Review };
