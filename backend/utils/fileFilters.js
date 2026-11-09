const path = require('path');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);

// ตรวจทั้ง MIME type และ extension พร้อมกัน — ป้องกัน MIME spoofing
function pdfOrImageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
    cb(null, true);
  } else {
    // status 400 → middlewares/errorHandler ตอบ 400 (ไม่ใช่ 500)
    cb(Object.assign(new Error('รองรับเฉพาะไฟล์ PDF และรูปภาพ (.pdf, .jpg, .jpeg, .png, .gif, .webp, .bmp) เท่านั้น'), { status: 400 }), false);
  }
}

// ── ตรวจเนื้อไฟล์จริงหลังรับไฟล์ (magic bytes) ───────────────────────────────
// ชื่อไฟล์และ MIME มาจากเครื่องผู้ส่ง ปลอมได้: เดิมไฟล์ .exe / HTML / ไฟล์ว่าง ตั้งชื่อ .pdf ส่ง application/pdf ผ่านเป็น "หนังสือลงนาม"/เอกสารได้
const fs = require('fs');
const SIGNATURE = {
  pdf: (b) => b.subarray(0, 1024).includes('%PDF-'),
  png: (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  bmp: (b) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d,
};
const IMAGE_KINDS = ['png', 'jpg', 'gif', 'webp', 'bmp'];

function readHead(file) {
  if (file.buffer) return file.buffer.subarray(0, 1024);
  const fd = fs.openSync(file.path, 'r');
  try {
    const b = Buffer.alloc(1024);
    return b.subarray(0, fs.readSync(fd, b, 0, 1024, 0));
  } finally { fs.closeSync(fd); }
}

// .pdf ต้องเป็น PDF จริง · รูปต้องเป็นรูปจริงสักชนิด (ยอม .jpg ที่ข้างในเป็น PNG — ผู้ใช้เปลี่ยนชื่อไฟล์กันบ่อย)
function contentMatches(file) {
  const head = readHead(file);
  if (!head.length) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.pdf') return SIGNATURE.pdf(head);
  return IMAGE_KINDS.some((k) => SIGNATURE[k](head));
}

const uploadedFiles = (req) => [
  ...(req.file ? [req.file] : []),
  ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
];

// ต่อท้าย multer ใน route — ไฟล์ปลอมทำให้ทั้งคำขอถูกปฏิเสธ และลบไฟล์ทุกไฟล์ที่เพิ่งรับมา
function rejectFakeFiles(req, res, next) {
  const files = uploadedFiles(req);
  const bad = files.find((f) => { try { return !contentMatches(f); } catch (_) { return true; } });
  if (!bad) return next();
  for (const f of files) if (f.path) try { fs.unlinkSync(f.path); } catch (_) { /* ลบแล้ว */ }
  return res.status(400).json({ ok: false, message: `ไฟล์ "${bad.originalname}" ไม่ใช่ไฟล์ PDF หรือรูปภาพจริง (เนื้อไฟล์ไม่ตรงกับนามสกุล หรือเป็นไฟล์ว่าง)` });
}

// ห่อ multer ให้ .single/.array/.fields คืน [multer, rejectFakeFiles] — ใช้ใน route ได้เหมือนเดิม
function withContentCheck(m) {
  return {
    single: (name) => [m.single(name), rejectFakeFiles],
    array: (name, max) => [m.array(name, max), rejectFakeFiles],
    fields: (spec) => [m.fields(spec), rejectFakeFiles],
  };
}

module.exports = { pdfOrImageFileFilter, rejectFakeFiles, withContentCheck, contentMatches };
