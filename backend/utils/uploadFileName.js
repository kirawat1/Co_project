// ชื่อไฟล์ที่อ่านออกตอนเปิด/บันทึกไฟล์จาก /uploads (middlewares/uploadsGuard.js)
// ไฟล์เก็บบนเครื่องด้วยชื่อสุ่มเป็นตัวเลข (เช่น 17053928123-884912.pdf — uploadMiddleware) → กดบันทึกจากเบราว์เซอร์ได้ชื่อตัวเลข
// ตั้งชื่อแบบเดียวกับไฟล์ใน zip หนังสือ (letterDownloadController): รหัส_ชื่อ_นามสกุล_ประเภท.pdf
const path = require('path');
const prisma = require('../config/prismaClient');

const DOC_LABELS = {
  DISPATCH_LETTER: 'หนังสือขอความอนุเคราะห์',
  PLACEMENT_LETTER: 'หนังสือส่งตัว',
  'CP-ACCEPTANCE': 'ใบตอบรับ',
  ACCEPTANCE_FORM: 'ใบตอบรับ',
  T002_FORM: 'T002 แบบแจ้งรายละเอียดงาน',
  T003_FORM: 'T003 โครงร่างรายงาน',
  T003: 'T003 โครงร่างรายงาน',
  TRANSCRIPT: 'ใบแสดงผลการเรียน',
  STUDENT_CARD: 'บัตรนักศึกษา',
  CITIZEN_CARD: 'บัตรประชาชน',
  PARENTAL_CONSENT: 'หนังสือยินยอมผู้ปกครอง',
};

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, '-').replace(/\s+/g, ' ').trim();
const STUDENT_SELECT = { studentId: true, firstName: true, lastName: true };

// คนเดียว = รหัส_ชื่อ_นามสกุล_ประเภท · หนังสือรวมหลายคน = ประเภท_รวม N คน
async function nameFor(label, studentIds, ext, db) {
  const ids = [...new Set(studentIds)];
  if (ids.length > 1) return `${safe(label)}_รวม ${ids.length} คน${ext}`;
  const s = ids.length ? await db.student.findUnique({ where: { id: ids[0] }, select: STUDENT_SELECT }) : null;
  if (!s) return `${safe(label)}${ext}`;
  return `${[s.studentId, s.firstName, s.lastName].map(safe).filter(Boolean).join('_')}_${safe(label)}${ext}`;
}

/** @param rel path หลัง /uploads/ · @returns ชื่อไฟล์ภาษาไทย หรือ null = ไม่รู้จัก (ใช้ชื่อเดิม) */
async function friendlyUploadName(rel, db = prisma) {
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  const dir = parts.length > 1 ? parts[0] : '';
  const ext = path.extname(name).toLowerCase();

  if (dir === 'supervision') {
    const appts = await db.supervisionAppointment.findMany({ where: { officialLetterPath: name }, select: { studentId: true } });
    return appts.length ? nameFor('หนังสือขอนิเทศ', appts.map((a) => a.studentId), ext, db) : null;
  }
  if (dir) return null; // system/ · announcements/ — ตั้งชื่อไว้อ่านออกอยู่แล้ว

  // หนังสือขอความอนุเคราะห์/ส่งตัว เก็บใน StudentCoop (หนังสือรวม = หลายคนใช้ไฟล์เดียวกัน)
  const coops = await db.studentCoop.findMany({
    where: { OR: [{ reqLetterUrl: name }, { placeLetterUrl: name }] },
    select: { studentId: true, reqLetterUrl: true },
  });
  if (coops.length) {
    const label = coops[0].reqLetterUrl === name ? DOC_LABELS.DISPATCH_LETTER : DOC_LABELS.PLACEMENT_LETTER;
    return nameFor(label, coops.map((c) => c.studentId), ext, db);
  }

  const docs = await db.document.findMany({ where: { path: name }, select: { studentId: true, type: true } });
  const label = docs.length ? DOC_LABELS[docs[0].type] : null;
  return label ? nameFor(label, docs.map((d) => d.studentId), ext, db) : null;
}

/** Content-Disposition แบบ inline (ยังเปิดดูในเบราว์เซอร์ได้) + ชื่อ UTF-8 ตอนกดบันทึก */
function inlineDisposition(utf8Name, asciiFallback) {
  const ascii = String(asciiFallback || 'file').replace(/[^\w.-]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}

module.exports = { friendlyUploadName, inlineDisposition, DOC_LABELS };
