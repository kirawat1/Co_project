// ป้ายส่งช้า / เลยกำหนดยังไม่ส่ง ของรายการนักศึกษาในหน้าตรวจ (T000/T002/T003)
// กำหนดของแต่ละคน = แถวรอบ × หลักสูตรของตัวเอง → รอบยังไม่ตั้งขั้นนั้น = วันสิ้นสุดเดิมใน SystemConfig → ไม่มีรอบ = ไม่มีป้าย
const prisma = require('../config/prismaClient');
const { readEffective } = require('./majorConfig');
const { deadlineFlags } = require('./deadlines');

const LEGACY_WINDOW_KEY = { T000: 'T000_CONFIG', T002: 'T002_CONFIG', T003: 'T003_CONFIG' };
const NONE = { due: null, late: false, overdueNotSubmitted: false };

/**
 * @param students [{ id, major, coop: { coopPeriodId, status, submittedSteps, deadlineExtensions } }]
 * @returns Map<Student.id, { due, late, overdueNotSubmitted }>
 */
async function deadlineFlagsFor(students, stepKey, db = prisma, now = new Date()) {
  const out = new Map();
  if (!students.length) return out;
  const pairs = new Map();
  for (const s of students) {
    if (s.coop?.coopPeriodId && s.major) pairs.set(`${s.coop.coopPeriodId}|${s.major}`, { periodId: s.coop.coopPeriodId, major: s.major });
  }
  const rows = pairs.size
    ? await db.coopPeriodMajor.findMany({ where: { OR: [...pairs.values()] }, select: { periodId: true, major: true, deadlines: true } })
    : [];
  const byPair = new Map(rows.map((r) => [`${r.periodId}|${r.major}`, r]));
  const legacyDue = new Map();
  const legacyFor = async (major) => {
    if (!legacyDue.has(major)) {
      const c = await readEffective(LEGACY_WINDOW_KEY[stepKey], major, db);
      legacyDue.set(major, (typeof c?.endDate === 'string' && c.endDate.trim()) || null);
    }
    return legacyDue.get(major);
  };

  for (const s of students) {
    const coop = s.coop;
    if (!coop?.coopPeriodId) { out.set(s.id, NONE); continue; }
    const entry = byPair.get(`${coop.coopPeriodId}|${s.major}`)?.deadlines?.[stepKey];
    const due = entry ? entry.due || null : await legacyFor(s.major || null);
    out.set(s.id, deadlineFlags({
      stepKey, due, now,
      submitted: coop.submittedSteps?.[stepKey] || null,
      status: coop.status,
      extensionUntil: coop.deadlineExtensions?.[stepKey] || null,
    }));
  }
  return out;
}

module.exports = { deadlineFlagsFor };
