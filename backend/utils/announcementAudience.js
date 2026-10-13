// ประกาศแบบห้องเรียน — ห้อง = รอบ (year "เทอม/ปี") × หลักสูตร · ประกาศส่วนกลาง (targetMajors ว่าง) ขึ้นทุกห้องของรอบนั้น
// ใครเห็นอะไร ตัดสินที่นี่ทั้งหมด (เดิมเชื่อ ?major= จากหน้าเว็บ — นักศึกษาแก้ URL อ่านประกาศหลักสูตรอื่นได้)
const prisma = require('../config/prismaClient');
const { getMajorScope } = require('./majorScope');
const { createNotifications } = require('./notificationHelper');

const GLOBAL_ROOM = 'GLOBAL';

/** targetMajors ใน DB เป็น JSON (เคยเป็น null) → array */
const targetsOf = (ann) => (Array.isArray(ann?.targetMajors) ? ann.targetMajors.filter((m) => typeof m === 'string' && m) : []);
const isGlobal = (ann) => targetsOf(ann).length === 0;
const periodLabel = (p) => (p ? `${p.semester}/${p.academicYear}` : null);
const isPublished = (ann, now = new Date()) => !ann.publishAt || new Date(ann.publishAt) <= now;

/** รอบของนักศึกษา — รอบที่ผูกไว้ · ยังไม่ผูก = รอบที่เปิดอยู่ของหลักสูตรตัวเอง · ไม่มี = รอบล่าสุดที่หลักสูตรนั้นตั้งไว้ */
async function studentYear(student) {
  if (student.coop?.coopPeriodId) {
    const p = await prisma.coopPeriod.findUnique({ where: { id: student.coop.coopPeriodId }, select: { semester: true, academicYear: true } });
    if (p) return periodLabel(p);
  }
  if (!student.major) return null;
  const row = await prisma.coopPeriodMajor.findFirst({
    where: { major: student.major },
    orderBy: [{ isActive: 'desc' }, { periodId: 'desc' }],
    select: { period: { select: { semester: true, academicYear: true } } },
  });
  return periodLabel(row?.period);
}

/**
 * ผู้ดู:
 *   staff   → ทุกห้อง เขียนได้ทุกห้อง (รวมส่วนกลาง)
 *   coop    → อาจารย์ประจำวิชา: ห้องของหลักสูตรที่ดูแล (+ส่วนกลาง อ่านอย่างเดียว) เขียนได้เฉพาะหลักสูตรที่ดูแล
 *   teacher → อาจารย์ทั่วไป: ห้องหลักสูตรตัวเอง + ส่วนกลาง อ่านอย่างเดียว
 *   student → ห้องของรอบ+หลักสูตรตัวเอง + ส่วนกลางของรอบนั้น อ่านอย่างเดียว · เห็นเฉพาะที่เผยแพร่แล้ว
 */
async function viewerOf(req) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'staff') return { kind: 'staff', majors: null, writeMajors: null };
  if (role === 'teacher') {
    const scope = await getMajorScope(req, { ignoreFilter: true });
    const t = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { major: true } });
    const majors = [...new Set([...(scope.majors || []), t?.major].filter(Boolean))];
    return scope.majors.length
      ? { kind: 'coop', majors, writeMajors: scope.majors }
      : { kind: 'teacher', majors, writeMajors: [] };
  }
  if (role === 'student') {
    const s = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { major: true, deletedAt: true, coop: { select: { coopPeriodId: true } } } });
    if (!s || s.deletedAt) return { kind: 'none' };
    return { kind: 'student', majors: s.major ? [s.major] : [], writeMajors: [], year: await studentYear(s) };
  }
  return { kind: 'none' };
}

/** ผู้ดูเห็นประกาศนี้ไหม (ไม่สนห้องที่เปิดอยู่) */
function canSee(viewer, ann, now = new Date()) {
  if (viewer.kind === 'none') return false;
  if (viewer.kind === 'staff') return true;
  const targets = targetsOf(ann);
  const mine = targets.length === 0 || targets.some((m) => viewer.majors.includes(m));
  if (!mine) return false;
  if (viewer.kind === 'student') return ann.year === viewer.year && isPublished(ann, now);
  if (viewer.kind === 'teacher') return isPublished(ann, now);
  return true; // coop: เห็นที่ตั้งเวลาไว้ด้วย (ห้องที่ดูแล)
}

/** แก้/ลบ/ปักหมุดได้ไหม — ประกาศส่วนกลางเป็นงานเจ้าหน้าที่ */
function canWrite(viewer, targets) {
  if (viewer.kind === 'staff') return true;
  if (viewer.kind !== 'coop') return false;
  return targets.length > 0 && targets.every((m) => viewer.writeMajors.includes(m));
}

/** ประกาศอยู่ในห้องนี้ไหม (ห้อง = หลักสูตร หรือ GLOBAL) — ส่วนกลางขึ้นทุกห้อง */
function inRoom(ann, room) {
  if (!room) return true;
  const targets = targetsOf(ann);
  if (room === GLOBAL_ROOM) return targets.length === 0;
  return targets.length === 0 || targets.includes(room);
}

/** ห้องที่ผู้ดูเข้าได้ */
async function roomsFor(viewer) {
  if (viewer.kind === 'staff') {
    const all = await prisma.coopCriteria.findMany({ select: { major: true }, orderBy: { major: 'asc' } });
    return [GLOBAL_ROOM, ...all.map((c) => c.major)];
  }
  if (viewer.kind === 'none') return [];
  return [GLOBAL_ROOM, ...[...viewer.majors].sort()];
}

// ── แจ้งเตือนนักศึกษาเมื่อเผยแพร่ ─────────────────────────────
/** นักศึกษาที่ประกาศนี้ส่งถึง: รอบเดียวกัน (ผูกรอบไว้) + หลักสูตรเป้าหมาย (ส่วนกลาง = ทุกหลักสูตร) */
async function recipientUserIds(ann) {
  const [semester, academicYear] = String(ann.year || '').split('/');
  const period = semester && academicYear
    ? await prisma.coopPeriod.findFirst({ where: { semester: Number(semester), academicYear }, select: { id: true } })
    : null;
  if (!period) return [];
  const targets = targetsOf(ann);
  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      coop: { coopPeriodId: period.id },
      ...(targets.length ? { major: { in: targets } } : {}),
    },
    select: { userId: true },
  });
  return [...new Set(students.map((s) => s.userId).filter(Boolean))];
}

/** ส่งแจ้งเตือนครั้งเดียว — จองด้วย notifiedAt ก่อน (กันงานตั้งเวลา + การบันทึกส่งซ้ำพร้อมกัน) */
async function notifyIfDue(annId, now = new Date()) {
  const claimed = await prisma.announcement.updateMany({
    where: { id: annId, notifiedAt: null, OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    data: { notifiedAt: now },
  });
  if (!claimed.count) return 0;
  const ann = await prisma.announcement.findUnique({ where: { id: annId } });
  const userIds = await recipientUserIds(ann);
  if (userIds.length) {
    await createNotifications(userIds, {
      type: 'ANNOUNCEMENT',
      title: '📢 ประกาศใหม่',
      message: ann.title,
      link: '/student/announcements',
      relatedId: ann.id,
    });
  }
  return userIds.length;
}

/** งานตั้งเวลา — ประกาศที่ถึงเวลาเผยแพร่แล้วแต่ยังไม่ได้แจ้ง */
async function publishDueAnnouncements(now = new Date()) {
  const due = await prisma.announcement.findMany({ where: { notifiedAt: null, publishAt: { lte: now } }, select: { id: true } });
  for (const a of due) {
    try { await notifyIfDue(a.id, now); } catch (err) { console.error('[announcement publish]', a.id, err); }
  }
  return due.length;
}

function startAnnouncementScheduler(intervalMs = 60_000) {
  const tick = () => publishDueAnnouncements().catch((err) => console.error('[announcement scheduler]', err));
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = {
  GLOBAL_ROOM, targetsOf, isGlobal, isPublished, viewerOf, canSee, canWrite, inRoom, roomsFor,
  recipientUserIds, notifyIfDue, publishDueAnnouncements, startAnnouncementScheduler,
};
