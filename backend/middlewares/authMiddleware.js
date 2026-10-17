// backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const { checkSession } = require('../utils/session');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ ok: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ ok: false, message: "Invalid token format" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // 401 = token หมดอายุ / ผิด secret → frontend ควร logout อัตโนมัติ
    return res.status(401).json({ ok: false, message: "Token expired or invalid — please log in again" });
  }
  // token เฉพาะงาน (เช่น ลิงก์ดาวน์โหลด zip) ใช้แทนการ login ไม่ได้
  if (decoded.purpose) {
    return res.status(401).json({ ok: false, message: "Token expired or invalid — please log in again" });
  }

  // บัญชียังอยู่ · role ตรง · ไม่ถูกเพิกถอน (เปลี่ยน/รีเซ็ตรหัสผ่าน) · นักศึกษาไม่อยู่ในถังขยะ
  let valid;
  try {
    valid = await checkSession(decoded);
  } catch (err) {
    // ตรวจไม่ได้เพราะ DB มีปัญหา — ไม่เตะผู้ใช้ออก (401 = frontend ลบ token) ให้ลองใหม่แทน
    console.error('[verifyToken] session check', err);
    return res.status(503).json({ ok: false, message: "ระบบตรวจสอบการเข้าสู่ระบบไม่ได้ชั่วคราว กรุณาลองใหม่" });
  }
  if (!valid) {
    return res.status(401).json({ ok: false, message: "บัญชีนี้ถูกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่" });
  }

  req.user = decoded;
  req.userId = decoded.id;
  return next();
};

exports.verifyRole = (...allowedRoles) => {
  // normalize ครั้งเดียวตอนสร้าง middleware — รองรับทั้ง 'teacher' และ 'TEACHER'
  const allowed = new Set(allowedRoles.map(r => r.toLowerCase()));
  return (req, res, next) => {
    const role = (req.user?.role ?? '').toLowerCase();
    if (!req.user || !allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "Access Denied: You do not have permission."
      });
    }
    next();
  };
};

// ผ่านถ้า: role = staff  หรือ  role = teacher ที่มี isCoopTeacher = true
exports.verifyCoopTeacherOrStaff = async (req, res, next) => {
  const role = (req.user?.role ?? '').toLowerCase();
  if (role === 'staff') return next();
  if (role === 'teacher') {
    try {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { isCoopTeacher: true }
      });
      if (teacher?.isCoopTeacher) return next();
    } catch (err) {
      return res.status(500).json({ ok: false, message: 'Server error' });
    }
  }
  return res.status(403).json({ ok: false, message: 'Access denied: เฉพาะเจ้าหน้าที่หรืออาจารย์ประจำวิชาสหกิจเท่านั้น' });
};