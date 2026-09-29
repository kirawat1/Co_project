// หลักสูตรที่อาจารย์ประจำวิชาสหกิจดูแล (CoopTeacherMajor) — จุดเดียวที่เขียนข้อมูลนี้
// Teacher.isCoopTeacher ตามมาจากรายการนี้เสมอ (มีอย่างน้อย 1 หลักสูตร = อาจารย์ประจำวิชา)

// รับค่าจาก body → รายการรหัสหลักสูตรไม่ซ้ำ หรือ undefined ถ้าไม่ได้ส่งมา (= ไม่แตะ)
function parseCoopMajors(raw) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((m) => typeof m !== 'string' || !m.trim())) {
    throw Object.assign(new Error('coopMajors ต้องเป็นรายการรหัสหลักสูตร'), { is400: true });
  }
  return [...new Set(raw.map((m) => m.trim()))];
}

async function setCoopMajors(tx, teacherId, majors) {
  if (majors.length) {
    const found = await tx.coopCriteria.findMany({ where: { major: { in: majors } }, select: { major: true } });
    const missing = majors.filter((m) => !found.some((f) => f.major === m));
    if (missing.length) throw Object.assign(new Error(`ไม่พบหลักสูตร: ${missing.join(', ')}`), { is400: true });
  }
  await tx.coopTeacherMajor.deleteMany({ where: { teacherId } });
  if (majors.length) await tx.coopTeacherMajor.createMany({ data: majors.map((major) => ({ teacherId, major })) });
  await tx.teacher.update({ where: { id: teacherId }, data: { isCoopTeacher: majors.length > 0 } });
}

module.exports = { parseCoopMajors, setCoopMajors };
