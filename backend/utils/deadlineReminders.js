// เตือนนักศึกษาก่อนปิดรับ (ปฏิทินของรอบ) — วันละครั้ง
// เตือนเมื่อครบทุกข้อ: ขั้นนั้นตั้งในรอบ × หลักสูตรแล้ว · โหมดปิดรับ (HARD) · ไม่ได้ปิดรับชั่วคราว · เหลือ 0–3 วัน (นับจากวันขยายถ้ามี)
//   · ยังไม่ส่ง (StudentCoop.submittedSteps) · อยู่ในขั้นที่ส่งครั้งแรกได้ (FIRST_SUBMIT_STATUSES)
// รอบที่ยังไม่ตั้งขั้นนั้น (ใช้ช่วงเวลาเดิม) ไม่เตือน
const prisma = require('../config/prismaClient');
const { createNotifications } = require('./notificationHelper');
const { MODE_STEPS, STEP_LABEL, FIRST_SUBMIT_STATUSES } = require('./deadlines');
const { thaiDate } = require('./applyWindow');

const DAY = 24 * 60 * 60 * 1000;
const REMIND_DAYS = 3;
const STEP_LINK = { T000: '/student/docs', T002: '/student/docs-t002', T003: '/student/docs-t003' };

// จำนวนวันจากวันนี้ (เวลาไทย) ถึงวันปิด — 0 = วันนี้วันสุดท้าย
function daysUntil(day, now) {
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  return Math.round((Date.parse(day) - Date.parse(today)) / DAY);
}

/** @returns Array<{ userId, due }> — due = วันปิดที่ใช้ (วันขยายถ้ามี) */
async function findStudentsToRemind(stepKey, now = new Date(), db = prisma) {
  const coops = await db.studentCoop.findMany({
    where: { status: { in: FIRST_SUBMIT_STATUSES[stepKey] }, coopPeriodId: { not: null }, student: { deletedAt: null } },
    select: { studentId: true, coopPeriodId: true, submittedSteps: true, deadlineExtensions: true, student: { select: { userId: true, major: true } } },
  });
  if (!coops.length) return [];
  const pairs = new Map();
  for (const c of coops) if (c.student?.major) pairs.set(`${c.coopPeriodId}|${c.student.major}`, { periodId: c.coopPeriodId, major: c.student.major });
  const rows = pairs.size
    ? await db.coopPeriodMajor.findMany({ where: { OR: [...pairs.values()] }, select: { periodId: true, major: true, deadlines: true } })
    : [];
  const byPair = new Map(rows.map((r) => [`${r.periodId}|${r.major}`, r]));

  const out = [];
  for (const c of coops) {
    if (c.submittedSteps?.[stepKey]) continue;
    const entry = byPair.get(`${c.coopPeriodId}|${c.student?.major}`)?.deadlines?.[stepKey];
    if (!entry || !entry.due || entry.mode === 'SOFT' || entry.closed) continue;
    const ext = c.deadlineExtensions?.[stepKey];
    const due = ext && ext > entry.due ? ext : entry.due;
    const left = daysUntil(due, now);
    if (left >= 0 && left <= REMIND_DAYS) out.push({ userId: c.student.userId, due });
  }
  return out;
}

// แจ้งเตือนรวมตามวันปิด — relatedId = ขั้น:วันปิด · ข้อความเดิมที่ยังไม่อ่านไม่ซ้ำ (createNotifications กันไว้)
async function runDeadlineReminders(now = new Date(), db = prisma) {
  for (const stepKey of MODE_STEPS) {
    const list = await findStudentsToRemind(stepKey, now, db);
    const byDue = new Map();
    for (const { userId, due } of list) byDue.set(due, [...(byDue.get(due) || []), userId]);
    for (const [due, userIds] of byDue) {
      await createNotifications(userIds, {
        type: 'DEADLINE_REMINDER',
        title: `ใกล้ปิดรับ ${STEP_LABEL[stepKey]}`,
        message: `${STEP_LABEL[stepKey]} ปิดรับสิ้นวันที่ ${thaiDate(due)} — กรุณาส่งก่อนปิด`,
        link: STEP_LINK[stepKey],
        relatedId: `${stepKey}:${due}`,
      });
    }
  }
}

function startDeadlineReminderJob({ firstDelayMs = 90_000, intervalMs = DAY } = {}) {
  const tick = () => runDeadlineReminders().catch((err) => console.error('[deadline-reminders]', err));
  const first = setTimeout(tick, firstDelayMs);
  const every = setInterval(tick, intervalMs);
  first.unref?.();
  every.unref?.();
  return { first, every };
}

module.exports = { findStudentsToRemind, runDeadlineReminders, startDeadlineReminderJob };
