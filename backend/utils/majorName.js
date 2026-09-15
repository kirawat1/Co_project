// ชื่อหลักสูตร/สาขาภาษาไทยสำหรับหนังสือราชการ
// Student.major เก็บเป็นรหัสสาขา (CS, AI) ตาม CoopCriteria.major — หน้าโปรไฟล์และนำเข้า Excel แปลงชื่อไทยเป็นรหัสก่อนบันทึก
// ข้อมูลเก่าอาจเป็นชื่อไทยล้วน หรือชื่อไทยต่อด้วยตัวย่อ เช่น "วิทยาการคอมพิวเตอร์ (CS)"
const THAI = /[฀-๿]/;

function resolveMajorNameTh(major, criteria) {
  const value = String(major || '').trim();
  if (!value) return null;
  const list = Array.isArray(criteria) ? criteria : [];
  const nameByCode = new Map(list.map((c) => [String(c.major).trim().toLowerCase(), c.nameTh ? String(c.nameTh).trim() : null]));

  if (nameByCode.has(value.toLowerCase())) return nameByCode.get(value.toLowerCase()) || null;

  // "ชื่อไทย (CS)" → ตัวย่อในวงเล็บตรงกับรหัสสาขา ใช้ชื่อไทยจาก criteria
  const code = value.match(/\(\s*([A-Za-z0-9]+)\s*\)/);
  if (code && nameByCode.get(code[1].toLowerCase())) return nameByCode.get(code[1].toLowerCase());

  // ตัดตัวย่อในวงเล็บ / "CS - " ข้างหน้าออก เหลือชื่อไทยล้วน
  const stripped = value
    .replace(/\s*\(\s*[A-Za-z0-9 .-]*\)\s*/g, ' ')
    .replace(/^[A-Za-z0-9]+\s*[-–:]\s*/, '')
    .trim();
  return THAI.test(stripped) ? stripped : null;
}

module.exports = { resolveMajorNameTh };
