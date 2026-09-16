/**
 * supervisionClash.js — กันเวลานิเทศของอาจารย์คนเดียวกันทับกัน
 *
 * กติกา:
 *  - อาจารย์คนหนึ่ง ทั้งในฐานะผู้นิเทศหลักและอาจารย์ร่วม ห้ามมีนิเทศสองรายการที่ "ช่วงเวลาทับกัน"
 *  - นัดต่อกันพอดีได้ (10:00-12:00 แล้วต่อ 12:00-13:00 ไม่ถือว่าชน) — นิเทศเป็นคิวเดี่ยวเรียงเวลา
 *  - บริษัทเดียวกันก็ต้องไล่คิว ไม่ใช่ข้อยกเว้น
 *  - นับเฉพาะรายการที่ยืนยันวันแล้ว (DATE_CONFIRMED / LETTER_UPLOADED)
 *
 * เวลาสิ้นสุดอ่านจากคอลัมน์ confirmedEndDate ถ้าไม่มี (ข้อมูลเก่า) ถอยไปอ่านช่วงเวลาที่นักศึกษาเสนอ
 * แล้วสุดท้ายถือว่ายาว DEFAULT_SLOT_MINUTES นาที
 */

const DEFAULT_SLOT_MINUTES = 60;
// ช่วงเวลามองย้อนหลังตอนค้นรายการที่อาจทับกัน — คิวหนึ่งไม่ควรยาวเกินนี้
const MAX_SLOT_MINUTES = 12 * 60;

const pad2 = (n) => String(n).padStart(2, '0');

// "2026-04-11|13:00-14:30|ONSITE" · "2026-04-11|13:00|ONSITE" · ข้อมูลเก่า "2026-04-12T10:00"
function parseProposedEntry(entry) {
  if (typeof entry !== 'string' || !entry.trim()) return null;
  const [rawDate = '', rawTime = '', rawType = ''] = entry.split('|');
  const date = rawDate.slice(0, 10);
  let timePart = rawTime;
  if (!timePart && rawDate.includes('T')) timePart = rawDate.split('T')[1] || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [startRaw = '', endRaw = ''] = timePart.split('-');
  const norm = (t) => {
    const m = String(t).trim().replace('.', ':').match(/^(\d{1,2}):(\d{2})$/);
    return m ? `${pad2(m[1])}:${m[2]}` : null;
  };
  return {
    date,
    start: norm(startRaw),
    end: norm(endRaw),
    type: rawType === 'ONLINE' || rawType === 'ONSITE' ? rawType : null,
  };
}

function parseProposedList(json) {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.map(parseProposedEntry).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const timeKey = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

// เวลาสิ้นสุดของคิว: ใช้ค่าที่บันทึกไว้ก่อน ถ้าไม่มีก็หาจากช่วงเวลาที่เสนอ (วันเดียวกัน เวลาเริ่มตรงกัน) ไม่งั้น +60 นาที
function resolveSlotEnd(start, { confirmedEndDate = null, proposedDates = null } = {}) {
  if (confirmedEndDate) {
    const end = new Date(confirmedEndDate);
    if (!isNaN(end.getTime()) && end > start) return end;
  }
  const entries = parseProposedList(proposedDates);
  const sameDay = entries.filter((e) => e.date === dateKey(start));
  const match = sameDay.find((e) => e.start === timeKey(start)) || sameDay[0];
  if (match && match.start && match.end) {
    const [sh, sm] = match.start.split(':').map(Number);
    const [eh, em] = match.end.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes > 0) return addMinutes(start, minutes);
  }
  return addMinutes(start, DEFAULT_SLOT_MINUTES);
}

// ทับกันจริงเท่านั้น — ต่อกันพอดี (จบ 12:00 เริ่ม 12:00) ไม่ถือว่าทับ
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const normalizeName = (name) => String(name || '').replace(/[\s.]/g, '').toLowerCase();

// หน้าเว็บบันทึกอาจารย์ร่วมเป็นชื่อ "คำนำหน้า+ชื่อ สกุล" (ไม่ใช่ FK) จึงต้องจับคู่ด้วยชื่อ
// เก็บแบบไม่มีคำนำหน้าด้วย เผื่อข้อมูลเก่าที่พิมพ์คนละรูปแบบ
function teacherNameKeys(teacher) {
  if (!teacher) return [];
  const { prefix = '', firstName = '', lastName = '' } = teacher;
  return [
    normalizeName(`${prefix}${firstName}${lastName}`),
    normalizeName(`${firstName}${lastName}`),
  ].filter(Boolean);
}

function coTeacherKeys(coTeacherName) {
  return String(coTeacherName || '')
    .split(',')
    .map(normalizeName)
    .filter(Boolean);
}

function fullTeacherName(teacher) {
  if (!teacher) return 'อาจารย์';
  return `${teacher.prefix || ''}${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDateTimeRange(start, end) {
  const d = `${start.getDate()} ${THAI_MONTHS[start.getMonth()]} ${start.getFullYear() + 543}`;
  return `${d} เวลา ${timeKey(start)}-${timeKey(end)} น.`;
}

/**
 * หารายการที่ชนกับช่วงเวลาที่กำลังจะบันทึก
 * opts: { start, end, teacher: {id,prefix,firstName,lastName}|null, coTeacherName, excludeIds }
 * คืน null ถ้าไม่ชน หรือ { appointmentId, message }
 */
async function findTeacherClash(tx, { start, end, teacher = null, coTeacherName = null, excludeIds = [] }) {
  if (!start || !end) return null;
  const myTeacherId = teacher && teacher.id != null ? teacher.id : null;
  const myKeys = new Set([...teacherNameKeys(teacher), ...coTeacherKeys(coTeacherName)]);
  if (myTeacherId == null && myKeys.size === 0) return null;

  const candidates = await tx.supervisionAppointment.findMany({
    where: {
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED'] },
      confirmedDate: { gte: addMinutes(start, -MAX_SLOT_MINUTES), lt: end },
      student: { deletedAt: null },
    },
    select: {
      id: true, confirmedDate: true, confirmedEndDate: true, proposedDates: true,
      teacherId: true, coTeacherName: true,
      teacher: { select: { prefix: true, firstName: true, lastName: true } },
      student: { select: { studentId: true, firstName: true, lastName: true } },
    },
  });

  for (const c of candidates) {
    const cStart = new Date(c.confirmedDate);
    const cEnd = resolveSlotEnd(cStart, c);
    if (!rangesOverlap(start, end, cStart, cEnd)) continue;

    const cKeys = new Set([...teacherNameKeys(c.teacher), ...coTeacherKeys(c.coTeacherName)]);
    const sameTeacherId = myTeacherId != null && c.teacherId === myTeacherId;
    const sharedName = [...myKeys].some((k) => cKeys.has(k));
    if (!sameTeacherId && !sharedName) continue;

    // บอกชื่ออาจารย์ที่ชนจริง — ถ้าชนที่อาจารย์ร่วม ผู้นิเทศหลักของอีกฝั่งอาจเป็นคนละคน
    const mainMatched = sameTeacherId || teacherNameKeys(c.teacher).some((k) => myKeys.has(k));
    const coMatched = String(c.coTeacherName || '')
      .split(',')
      .map((s) => s.trim())
      .find((n) => myKeys.has(normalizeName(n)));
    const clashTeacher = mainMatched ? fullTeacherName(c.teacher) : (coMatched || fullTeacherName(c.teacher));
    const who = `${c.student.firstName} ${c.student.lastName}`;
    return {
      appointmentId: c.id,
      message: `${clashTeacher} มีนิเทศของ ${who} ${thaiDateTimeRange(cStart, cEnd)} อยู่แล้ว กรุณาเลือกเวลาอื่น (นัดต่อกันได้ แต่ห้ามเวลาทับกัน)`,
    };
  }
  return null;
}

// โยน 409 ถ้าชน — ใช้กับทุกจุดที่บันทึก/แก้วันเวลานิเทศ
async function assertNoTeacherClash(tx, opts) {
  const clash = await findTeacherClash(tx, opts);
  if (clash) throw Object.assign(new Error(clash.message), { is409: true });
}

module.exports = {
  DEFAULT_SLOT_MINUTES,
  parseProposedEntry,
  parseProposedList,
  resolveSlotEnd,
  rangesOverlap,
  teacherNameKeys,
  coTeacherKeys,
  thaiDateTimeRange,
  findTeacherClash,
  assertNoTeacherClash,
  addMinutes,
  dateKey,
  timeKey,
};
