// cookie สำหรับเปิดไฟล์ใน /uploads — ลิงก์ <a> / <img> / แท็บใหม่ ส่ง header Authorization เองไม่ได้
// ค่าคือ token เข้าสู่ระบบตัวเดียวกัน (ตรวจ session แบบเดียวกับ verifyToken) · httpOnly: JavaScript อ่านไม่ได้
// API ไม่รับ cookie นี้เป็นการยืนยันตัวตน (ใช้ Bearer เท่านั้น) จึงไม่เปิดช่อง CSRF · ใช้ที่ middlewares/uploadsGuard.js
const FILE_COOKIE = 'coop_file';

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setFileCookie(req, res, token, decoded) {
  res.cookie(FILE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax', // เปิดลิงก์ไฟล์จากแอปอื่น (เช่น แชท) ในเบราว์เซอร์ที่ login ไว้ได้ · คนอื่นที่ได้ลิงก์ไปเปิดไม่ได้
    secure: !!req.secure,
    path: '/',
    ...(decoded?.exp ? { expires: new Date(decoded.exp * 1000) } : {}),
  });
}

function clearFileCookie(res) {
  res.clearCookie(FILE_COOKIE, { path: '/' });
}

module.exports = { FILE_COOKIE, readCookie, setFileCookie, clearFileCookie };
