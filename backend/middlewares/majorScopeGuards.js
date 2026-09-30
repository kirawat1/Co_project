// ตัวกันระดับ route สำหรับงานจัดการที่อาจารย์ประจำวิชาทำแทนเจ้าหน้าที่ได้ (เฉพาะหลักสูตรที่ดูแล)
// ใส่หลัง multer (ถ้ามี) เพื่อให้ req.body ของ multipart ถูก parse แล้ว — ปฏิเสธเมื่อไรลบไฟล์ที่อัปโหลดมาทิ้ง
const fs = require('fs');
const prisma = require('../config/prismaClient');
const { getMajorScope, inScope } = require('../utils/majorScope');

const discardUpload = (req) => {
  for (const f of [req.file, ...(Array.isArray(req.files) ? req.files : [])]) {
    if (f?.path && fs.existsSync(f.path)) { try { fs.unlinkSync(f.path); } catch (_) { /* ignore */ } }
  }
};
const deny = (req, res, message) => { discardUpload(req); return res.status(403).json({ ok: false, message }); };
const OUT_OF_SCOPE = 'นักศึกษาคนนี้ไม่อยู่ในหลักสูตรที่คุณดูแล';

// นักศึกษา (Student.id จาก body/params) ต้องอยู่ในหลักสูตรที่ดูแล
function studentInScope(pick) {
  return async (req, res, next) => {
    try {
      const scope = await getMajorScope(req);
      if (scope.all) return next();
      const id = parseInt(pick(req), 10);
      if (!id || id <= 0) return next(); // ให้ controller ตอบ 400 เอง
      const s = await prisma.student.findUnique({ where: { id }, select: { major: true } });
      if (s && !inScope(scope, s.major)) return deny(req, res, OUT_OF_SCOPE);
      next();
    } catch (err) { next(err); }
  };
}

// ค่าหลักสูตรที่จะบันทึก (เช่น เพิ่ม/ย้ายหลักสูตรนักศึกษา) ต้องเป็นหลักสูตรที่ดูแล
function majorFieldInScope(field = 'major', { required = false } = {}) {
  return async (req, res, next) => {
    try {
      const scope = await getMajorScope(req);
      if (scope.all) return next();
      const value = req.body?.[field];
      if (value === undefined && !required) return next();
      if (!inScope(scope, value)) return deny(req, res, `กำหนดได้เฉพาะหลักสูตรที่คุณดูแล (${scope.majors.join(', ') || '-'})`);
      next();
    } catch (err) { next(err); }
  };
}

// ออกหนังสือราชการ (เลขที่/วันที่/ไฟล์หนังสือ) = เจ้าหน้าที่เท่านั้น — route เดียวกันใช้ตรวจเอกสารด้วย
const LETTER_STATUSES = new Set(['REQ_LETTER_ISSUED', 'PLACEMENT_LETTER_ISSUED']);
const LETTER_FIELDS = ['reqDocNumber', 'reqDocDate', 'placeDocNumber', 'placeDocDate', 'deliveryMethod'];
function lettersStaffOnly(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() === 'staff') return next();
  const b = req.body || {};
  if (LETTER_STATUSES.has(b.status) || LETTER_FIELDS.some((k) => b[k] !== undefined && b[k] !== '')) {
    return deny(req, res, 'ออกหนังสือราชการได้เฉพาะเจ้าหน้าที่');
  }
  next();
}

module.exports = { studentInScope, majorFieldInScope, lettersStaffOnly, LETTER_FIELDS };
