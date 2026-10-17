// ตัวกรองรอบของรายชื่อนักศึกษา (?coopPeriodId=)
//   ไม่ระบุ / all → ทุกคน · ตัวเลข → รอบนั้น
//   none → ยังไม่เลือกรอบ: ยังไม่เคยยื่นคำร้อง (ไม่มีข้อมูลสหกิจ) หรือมีข้อมูลสหกิจแต่ยังไม่ผูกรอบ
// ไม่ระบุ = ทุกรอบเหมือนเดิม → ผู้เรียกเดิมที่ไม่ส่งค่านี้ไม่กระทบ
const NO_PERIOD = 'none';

function parsePeriod(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return { all: true };
  if (raw === NO_PERIOD) return { none: true };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: 'coopPeriodId ไม่ถูกต้อง' };
  return { id };
}

/** @returns {{ where: object|null } | { error: string }} where = เงื่อนไขของ Student (null = ไม่กรอง) */
function studentPeriodWhere(raw) {
  const p = parsePeriod(raw);
  if (p.error) return { error: p.error };
  if (p.all) return { where: null };
  if (p.none) return { where: { OR: [{ coop: null }, { coop: { coopPeriodId: null } }] } };
  return { where: { coop: { coopPeriodId: p.id } } };
}

/** เงื่อนไขเดียวกันสำหรับตารางที่ผูกกับ StudentCoop (คำร้อง) — ไม่มีกรณี "ไม่มีข้อมูลสหกิจ" */
function coopPeriodWhere(raw) {
  const p = parsePeriod(raw);
  if (p.error) return { error: p.error };
  if (p.all) return { where: null };
  return { where: { coopPeriodId: p.none ? null : p.id } };
}

/**
 * จำนวนต่อรอบ (ทั้งหมด / รอดำเนินการ) — หน้าเว็บแสดงใน dropdown และเตือนงานค้างในรอบอื่น
 * นับจากแถวชุดเดียวกับที่หน้าแสดง ตัวเลขจึงตรงกับตารางเสมอ · coopPeriodId null = ยังไม่ผูกรอบ
 */
function countByPeriod(rows, { periodOf, isPending }) {
  const map = new Map();
  for (const r of rows) {
    const key = periodOf(r) ?? null;
    const c = map.get(key) || { coopPeriodId: key, count: 0, pending: 0 };
    c.count++;
    if (isPending(r)) c.pending++;
    map.set(key, c);
  }
  return [...map.values()];
}

module.exports = { studentPeriodWhere, coopPeriodWhere, countByPeriod, NO_PERIOD };
