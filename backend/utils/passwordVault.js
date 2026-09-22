const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { defaultStudentPassword } = require('./studentPassword');

// สำเนารหัสผ่านแบบถอดได้ (AES-256-GCM) ให้เจ้าหน้าที่กด "แสดง" ได้เมื่อนักศึกษา/อาจารย์ลืมรหัสผ่าน
// - ตัดสินใจโดยผู้ดูแลระบบ: เก็บทุกรหัสของนักศึกษา/อาจารย์ รวมที่ตั้งเอง · บัญชีเจ้าหน้าที่ไม่เก็บ
// - ตรวจสิทธิ์ด้วย hash (bcrypt) เหมือนเดิม — ค่านี้ใช้แสดงผลอย่างเดียว
// - คีย์: PASSWORD_VIEW_KEY ถ้าตั้งไว้ ไม่งั้นใช้ JWT_SECRET · เปลี่ยนคีย์แล้วสำเนาเดิมถอดไม่ได้
//   (หน้าจอจะบอกให้รีเซ็ต หรือรอเจ้าของ login ครั้งถัดไประบบจะเก็บใหม่ให้เอง)
const VAULT_ROLES = new Set(['student', 'teacher']);
const VERSION = 'v1';

// รหัสเริ่มต้นของอาจารย์ที่สร้างจาก scripts/seed_teachers.js
const DEFAULT_TEACHER_PASSWORD = '1111111111111';

function vaultKey() {
  const secret = process.env.PASSWORD_VIEW_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('PASSWORD_VIEW_KEY / JWT_SECRET is not set');
  return crypto.createHash('sha256').update(`coop-password-view:${secret}`).digest();
}

function encryptPassword(plain) {
  if (typeof plain !== 'string' || !plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

// ถอดไม่ได้ (คีย์เปลี่ยน/ข้อมูลเสีย) → null
function decryptPassword(enc) {
  if (typeof enc !== 'string' || !enc) return null;
  const [version, iv, tag, data] = enc.split(':');
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ค่าที่จะเก็บลง User.passwordEnc คู่กับ hash ทุกครั้งที่ตั้งรหัสผ่าน — role อื่นเก็บ null
function passwordEncFor(role, plain) {
  return VAULT_ROLES.has(String(role || '').toLowerCase()) ? encryptPassword(plain) : null;
}

/**
 * หารหัสผ่านปัจจุบันของบัญชี เพื่อแสดงให้เจ้าหน้าที่
 * @param {{ role, password, passwordEnc, provider }} user
 * @param {{ studentId?: string }} [opts]
 * @returns {Promise<{ password: string|null, source: 'stored'|'default'|'none'|'unknown', backfill?: string }>}
 *   stored  = สำเนาที่ตรงกับ hash ปัจจุบัน
 *   default = ยังเป็นรหัสเริ่มต้น (backfill = ค่าที่ควรเก็บลง passwordEnc)
 *   none    = บัญชีไม่มีรหัสผ่าน (เข้าสู่ระบบด้วย Google)
 *   unknown = ตั้งไว้ก่อนมีระบบนี้ / คีย์เปลี่ยน — รอเจ้าของ login หรือรีเซ็ต
 */
async function revealPassword(user, { studentId } = {}) {
  if (!user || !user.password) return { password: null, source: 'none' };

  // สำเนาต้องตรงกับ hash ปัจจุบัน — กันกรณี hash ถูกเปลี่ยนจากทางอื่น (script/ฐานข้อมูล) แล้วสำเนาค้าง
  const stored = decryptPassword(user.passwordEnc);
  if (stored !== null && await bcrypt.compare(stored, user.password)) {
    return { password: stored, source: 'stored' };
  }

  const role = String(user.role || '').toLowerCase();
  const candidate = role === 'student' ? defaultStudentPassword(studentId)
    : role === 'teacher' ? DEFAULT_TEACHER_PASSWORD
    : '';
  if (candidate && await bcrypt.compare(candidate, user.password)) {
    return { password: candidate, source: 'default', backfill: encryptPassword(candidate) };
  }
  return { password: null, source: 'unknown' };
}

module.exports = {
  VAULT_ROLES,
  DEFAULT_TEACHER_PASSWORD,
  encryptPassword,
  decryptPassword,
  passwordEncFor,
  revealPassword,
};
