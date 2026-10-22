// จำกัดจำนวนคำขอ API ทั้งระบบ (กัน scraping / ยิงถล่ม)
// ผู้ใช้ที่ login นับต่อคน — ผู้ใช้เข้าผ่านเน็ตมหาวิทยาลัย/VPN จึงออกเน็ตด้วย IP ชุดเดียวกัน ถ้านับต่อ IP
// ช่วงใกล้ปิดส่งทั้งกลุ่มจะโดนบล็อกพร้อมกัน · ยังไม่ login (หน้า login) นับต่อ IP
// ตรวจลายเซ็น token จริง (ไม่แค่ decode) — ปลอม id มาหลบเพดานไม่ได้ · บัญชี/เวอร์ชัน token ตรวจที่ verifyToken ตามเดิม
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

function rateLimitKey(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (payload && payload.id != null) return `user:${payload.id}`;
    } catch (_) { /* token เสีย/หมดอายุ → นับต่อ IP */ }
  }
  return `ip:${req.ip}`;
}

function createApiLimiter({ windowMs = 15 * 60 * 1000, max }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: rateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message: 'Too many requests, please try again later.' },
    skip: (req) => req.originalUrl === '/api/internal-status', // VM-local health check ไม่ต้อง limit
  });
}

module.exports = { rateLimitKey, createApiLimiter };
