// รหัสนักศึกษาแบบระบบทะเบียน มข. = เลข 9 หลัก + ขีด + หลักตรวจสอบ เช่น 643040001-1 (ข้อมูลส่วนใหญ่ในระบบเก็บแบบนี้)
// เลข 10 หลักติดกัน (6430400011) = รหัสเดียวกันที่พิมพ์ไม่มีขีด → เก็บแบบมีขีดเสมอ
// (เดิมหน้าข้อมูลนักศึกษาตัดขีดทิ้งทุกครั้งที่บันทึก — นำเข้า Excel ครั้งต่อไปชนกับบัญชีเดิม ค้นด้วยรหัสแบบมีขีดไม่เจอ)
// รูปแบบอื่น (รหัสสั้น/ข้อมูลทดสอบ) เก็บตามที่กรอก
function normalizeStudentId(raw) {
  const s = String(raw ?? '').trim();
  if (/^\d{10}$/.test(s)) return `${s.slice(0, 9)}-${s.slice(9)}`;
  return s;
}

// ทุกรูปแบบที่หมายถึงรหัสเดียวกัน — ใช้ตรวจรหัสซ้ำ (643040001-1 กับ 6430400011 คือคนเดียวกัน)
function studentIdVariants(raw) {
  const n = normalizeStudentId(raw);
  if (!n) return [];
  return [...new Set([n, /^\d{9}-\d$/.test(n) ? n.replace('-', '') : n])];
}

// เงื่อนไขค้นหาด้วยรหัส — พิมพ์แบบมีขีดหรือไม่มีขีดก็เจอ
function studentIdSearchOr(search) {
  const s = String(search ?? '').trim();
  if (!s) return [];
  const forms = new Set([s, normalizeStudentId(s)]);
  if (/^[\d-]+$/.test(s)) forms.add(s.replace(/-/g, ''));
  return [...forms].map((f) => ({ studentId: { contains: f } }));
}

module.exports = { normalizeStudentId, studentIdVariants, studentIdSearchOr };
