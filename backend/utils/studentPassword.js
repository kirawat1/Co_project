const bcrypt = require('bcryptjs');

// รหัสผ่านเริ่มต้นของนักศึกษา = รหัสนักศึกษาแบบมีขีด เช่น 653380123-4
// สร้างให้ตอนเจ้าหน้าที่ลงข้อมูล แล้วนักศึกษาไปเปลี่ยนเองทีหลัง
function defaultStudentPassword(studentId) {
  const s = String(studentId ?? '').trim();
  // ข้อมูลส่วนใหญ่เก็บแบบมีขีดอยู่แล้ว ถ้าเป็นเลข 10 หลักติดกันให้เติมขีดก่อนหลักตรวจสอบ
  if (/^\d{10}$/.test(s)) return `${s.slice(0, 9)}-${s.slice(9)}`;
  return s;
}

// cost 8 (ราว 17 ms) แทน 10 (ราว 65 ms) เฉพาะรหัสเริ่มต้น — bcryptjs ทำงานบน thread เดียว
// นำเข้า 400 คนด้วย cost 10 จะช้าขึ้น ~26 วินาที เสี่ยงโดน proxy ตัด ส่วนความแข็งของ hash
// แทบไม่ช่วยอะไรกับรหัสที่เดาได้จากรหัสนักศึกษาอยู่แล้ว รหัสที่นักศึกษาตั้งเองยังใช้ cost 10
const DEFAULT_PASSWORD_COST = 8;

async function hashDefaultStudentPassword(studentId) {
  const password = defaultStudentPassword(studentId);
  if (!password) return null;
  return bcrypt.hash(password, DEFAULT_PASSWORD_COST);
}

module.exports = { defaultStudentPassword, hashDefaultStudentPassword };
