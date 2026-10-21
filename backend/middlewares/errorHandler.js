// ตัวจัดการ error กลาง (ติดท้ายทุก route ใน server.js) — error ที่ไม่มี controller จับ เช่น multer ปฏิเสธไฟล์
//   ไฟล์ผิดชนิด (fileFilter ตั้ง status 400) / MulterError (ใหญ่เกิน, ชื่อช่องผิด) → 400 · อื่นๆ → 500 แบบ JSON
const multer = require('multer');

module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกินขนาดที่กำหนด' : `อัปโหลดไฟล์ไม่สำเร็จ (${err.code})`;
    return res.status(400).json({ ok: false, message });
  }
  if (err.status === 400) return res.status(400).json({ ok: false, message: err.message });
  console.error(err);
  return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในระบบ' });
};
