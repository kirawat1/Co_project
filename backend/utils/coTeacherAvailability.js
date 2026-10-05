// วันว่างของอาจารย์นิเทศร่วม — อาจารย์ร่วมติ๊กวันที่ว่างจากวันที่นักศึกษาเสนอ ก่อนอาจารย์หลักเลือกวัน
// เก็บใน SupervisionCoTeacher.availableDates (JSON array ของ "YYYY-MM-DD") · null = ยังไม่ตอบ
const { parseProposedList } = require('./supervisionClash');

// วันที่ (ไม่ซ้ำ) ที่นักศึกษาเสนอ — อาจารย์ร่วมเลือกได้เฉพาะวันเหล่านี้
function proposedDays(proposedDates) {
  return [...new Set(parseProposedList(proposedDates).map((e) => e.date))];
}

function parseAvailable(value) {
  try {
    const arr = JSON.parse(value || 'null');
    return Array.isArray(arr) ? arr.filter((d) => typeof d === 'string') : null;
  } catch (_) {
    return null;
  }
}

const teacherName = (t) => [t?.prefix, t?.firstName].filter(Boolean).join('') + (t?.lastName ? ` ${t.lastName}` : '');

/**
 * อาจารย์ร่วมที่ไม่สะดวกวันนี้ (ตอบว่าไม่ว่าง หรือยังไม่ตอบ)
 * @param coTeachers [{ teacherId, availableDates, respondedAt, teacher: { prefix, firstName, lastName } }]
 * @param day "YYYY-MM-DD"
 * @returns [{ teacherId, name, reason: 'NOT_FREE' | 'NO_RESPONSE' }]
 */
function unavailableOn(coTeachers, day) {
  const out = [];
  for (const c of coTeachers || []) {
    const free = parseAvailable(c.availableDates);
    if (!c.respondedAt || !free) out.push({ teacherId: c.teacherId, name: teacherName(c.teacher), reason: 'NO_RESPONSE' });
    else if (!free.includes(day)) out.push({ teacherId: c.teacherId, name: teacherName(c.teacher), reason: 'NOT_FREE' });
  }
  return out;
}

function unavailableMessage(list) {
  const notFree = list.filter((u) => u.reason === 'NOT_FREE').map((u) => u.name);
  const noReply = list.filter((u) => u.reason === 'NO_RESPONSE').map((u) => u.name);
  const parts = [];
  if (notFree.length) parts.push(`ไม่ว่างวันนี้: ${notFree.join(', ')}`);
  if (noReply.length) parts.push(`ยังไม่ระบุวันว่าง: ${noReply.join(', ')}`);
  return `อาจารย์นิเทศร่วม${parts.join(' · ')}`;
}

const CO_TEACHER_SELECT = { teacherId: true, availableDates: true, respondedAt: true, teacher: { select: { prefix: true, firstName: true, lastName: true, userId: true } } };

module.exports = { proposedDays, parseAvailable, unavailableOn, unavailableMessage, teacherName, CO_TEACHER_SELECT };
