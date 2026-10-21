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

module.exports = { pdfOrImageFileFilter };
