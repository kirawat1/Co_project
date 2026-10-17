// ตัวกรองรอบของรายชื่อนักศึกษา (?coopPeriodId=)
//   ไม่ระบุ / all → ทุกคน · ตัวเลข → รอบนั้น
//   none → ยังไม่เลือกรอบ: ยังไม่เคยยื่นคำร้อง (ไม่มีข้อมูลสหกิจ) หรือมีข้อมูลสหกิจแต่ยังไม่ผูกรอบ
const NO_PERIOD = 'none';

/** @returns {{ where: object|null } | { error: string }} where = เงื่อนไขของ Student (null = ไม่กรอง) */
function studentPeriodWhere(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return { where: null };
  if (raw === NO_PERIOD) return { where: { OR: [{ coop: null }, { coop: { coopPeriodId: null } }] } };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: 'coopPeriodId ไม่ถูกต้อง' };
  return { where: { coop: { coopPeriodId: id } } };
}

module.exports = { studentPeriodWhere, NO_PERIOD };
