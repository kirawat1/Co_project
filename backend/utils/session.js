// session ของผู้ใช้ — token ใช้ได้เมื่อบัญชียังอยู่ · role ตรง · เวอร์ชัน token ตรง · นักศึกษาไม่อยู่ในถังขยะ
// เดิม verifyToken ตรวจแค่ลายเซ็น → ลบบัญชี/ถอดสิทธิ์แล้ว token เดิมใช้ต่อได้จนหมดอายุ (สูงสุด 30 วันเมื่อ "จดจำฉันไว้")
const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');

/** token สำหรับเข้าสู่ระบบ — tv = เวอร์ชัน token ของบัญชี ณ ตอนออก */
function signSession(user, expiresIn) {
  return jwt.sign({ id: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn });
}

/**
 * @returns {Promise<boolean>} false = ต้องเข้าสู่ระบบใหม่ · โยน error = ตรวจไม่ได้ (DB มีปัญหา) — ผู้เรียกตอบ 503 ไม่ใช่ 401
 * token เก่าที่ไม่มี tv ถือเป็นเวอร์ชัน 0 → deploy แล้วผู้ใช้ไม่ต้องเข้าสู่ระบบใหม่ทั้งคณะ
 */
async function checkSession(decoded) {
  const id = Number(decoded?.id);
  if (!Number.isInteger(id) || id <= 0) return false;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, tokenVersion: true, student: { select: { deletedAt: true } } },
  });
  if (!user) return false;
  if (String(user.role).toLowerCase() !== String(decoded.role || '').toLowerCase()) return false;
  if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) return false;
  if (String(user.role).toLowerCase() === 'student' && user.student?.deletedAt) return false;
  return true;
}

/** เพิกถอนทุก session ของบัญชี (เปลี่ยน/รีเซ็ตรหัสผ่าน) — คืนบัญชีที่มีเวอร์ชันใหม่ ไว้ออก token ใหม่ให้เครื่องที่ทำรายการ */
function revokeSessions(userId, db = prisma) {
  return db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } }, select: { id: true, role: true, tokenVersion: true } });
}

module.exports = { signSession, checkSession, revokeSessions };
