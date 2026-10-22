// ด่านหน้า /uploads (server.js) — เดิมเปิดสาธารณะ ใครมีลิงก์ก็เปิดบัตรประชาชน/ใบเกรด/หนังสือยินยอมได้
// 1. ต้อง login: token จาก cookie (utils/fileCookie) หรือ Bearer · ตรวจ session แบบเดียวกับ verifyToken
// 2. ต้องมีสิทธิ์ในไฟล์นั้น (utils/uploadAccess) · ไม่มีสิทธิ์ = 403
const jwt = require('jsonwebtoken');
const { checkSession } = require('../utils/session');
const { canAccessUpload } = require('../utils/uploadAccess');
const { FILE_COOKIE, readCookie } = require('../utils/fileCookie');

module.exports = async function uploadsGuard(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : readCookie(req, FILE_COOKIE);
  const unauthorized = () => res.status(401).json({ ok: false, message: 'กรุณาเข้าสู่ระบบก่อนเปิดไฟล์' });
  if (!token) return unauthorized();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return unauthorized();
  }
  if (decoded.purpose) return unauthorized(); // token เฉพาะงาน (ลิงก์ zip) ใช้แทนการ login ไม่ได้

  try {
    if (!(await checkSession(decoded))) return unauthorized();
  } catch (err) {
    console.error('[uploadsGuard] session check', err);
    return res.status(503).json({ ok: false, message: 'ระบบตรวจสอบการเข้าสู่ระบบไม่ได้ชั่วคราว กรุณาลองใหม่' });
  }

  let rel;
  try {
    rel = decodeURIComponent(req.path).replace(/^\/+/, '');
  } catch (_) {
    return res.status(404).json({ ok: false, message: 'ไม่พบไฟล์' });
  }
  if (!rel || rel.split(/[\\/]/).some((p) => p === '..' || p === '')) {
    return res.status(404).json({ ok: false, message: 'ไม่พบไฟล์' });
  }

  try {
    if (!(await canAccessUpload(decoded, rel))) {
      return res.status(403).json({ ok: false, message: 'ไม่มีสิทธิ์เปิดไฟล์นี้' });
    }
  } catch (err) {
    console.error('[uploadsGuard] access check', err);
    return res.status(500).json({ ok: false, message: 'ตรวจสิทธิ์ไฟล์ไม่สำเร็จ' });
  }

  // ไฟล์ส่วนตัว — ห้าม proxy/cache ที่ใช้ร่วมกันเก็บไว้ (express.static ตั้ง cacheControl: false)
  res.set('Cache-Control', 'private, max-age=0');
  return next();
};
