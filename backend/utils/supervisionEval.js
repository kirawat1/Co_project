// ลิงก์แบบประเมินการนิเทศ (ค่ากลาง + ค่าเฉพาะหลักสูตร) — ส่งให้อาจารย์ผู้นิเทศ + อาจารย์นิเทศร่วม ผ่านแจ้งเตือนในระบบ
const prisma = require('../config/prismaClient');
const { createNotifications } = require('./notificationHelper');
const { readEffective } = require('./majorConfig');

const CONFIG_KEY = 'CONFIG_SUPERVISION_EVAL';
const EVAL_DEFAULTS = { instructionText: '', evalLink: null, autoSend: false };
// ส่งได้เฉพาะนัดที่อนุมัติหนังสือแล้ว/นิเทศเสร็จแล้ว (นิเทศเกิดขึ้นจริงหรือกำลังจะเกิด)
const SENDABLE_STATUSES = ['LETTER_UPLOADED', 'COMPLETED'];

// major = หลักสูตรของนักศึกษาในนัด → ค่ากลาง + ค่าเฉพาะหลักสูตร (ลิงก์/คำชี้แจง/ส่งอัตโนมัติ ต่างกันได้) · ไม่ระบุ = ค่ากลาง
async function getEvalConfig(db = prisma, major = null) {
  return { ...EVAL_DEFAULTS, ...((await readEffective(CONFIG_KEY, major, db)) || {}) };
}

// ชื่อใน coTeacherName ที่ไม่มีบัญชีผูกอยู่ (ข้อมูลเก่าก่อนมีตาราง SupervisionCoTeacher ที่จับคู่ชื่อไม่ได้)
// — เทียบกับอาจารย์ที่ผูกแล้ว แบบตัดช่องว่างทิ้ง
const squash = (s) => String(s || '').replace(/\s+/g, '');
function unlinkedCoTeacherNames(coTeacherName, linkedTeachers) {
  const linked = new Set(linkedTeachers.map((t) => squash(`${t.prefix || ''}${t.firstName}${t.lastName}`)));
  return String(coTeacherName || '').split(',').map((n) => n.trim()).filter((n) => n && !linked.has(squash(n)));
}

const studentLabel = (s) => [s?.firstName, s?.lastName].filter(Boolean).join(' ') || s?.studentId || '';

/**
 * ส่งแจ้งเตือนลิงก์ประเมินของนัดที่ระบุ และบันทึก evalSentAt
 * @returns [{ id, recipients, unlinked }] — นัดที่สถานะยังไม่ถึงจะไม่ถูกส่ง (ไม่อยู่ในผลลัพธ์)
 */
async function sendEvalForAppointments(ids) {

  const appts = await prisma.supervisionAppointment.findMany({
    where: { id: { in: ids }, status: { in: SENDABLE_STATUSES }, student: { deletedAt: null } },
    select: {
      id: true, coTeacherName: true,
      teacher: { select: { userId: true } },
      coTeachers: { select: { teacher: { select: { userId: true, prefix: true, firstName: true, lastName: true } } } },
      student: { select: { studentId: true, firstName: true, lastName: true, major: true } },
    },
  });

  // ลิงก์ตั้งแยกหลักสูตรได้ — นัดที่หลักสูตรนั้นยังไม่มีลิงก์ไม่ส่ง (ไม่งั้นอาจารย์ได้แจ้งเตือนแต่ไม่มีลิงก์ให้กด)
  const configByMajor = new Map();
  for (const m of new Set(appts.map((a) => a.student?.major || null))) configByMajor.set(m, await getEvalConfig(prisma, m));
  if (appts.length && appts.every((a) => !configByMajor.get(a.student?.major || null).evalLink)) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่าลิงก์แบบประเมินการนิเทศ'), { is400: true });
  }

  const results = [];
  for (const appt of appts) {
    if (!configByMajor.get(appt.student?.major || null).evalLink) {
      results.push({ id: appt.id, recipients: 0, unlinked: [], skipped: 'ยังไม่มีลิงก์แบบประเมินของหลักสูตรนี้' });
      continue;
    }
    const coTeachers = appt.coTeachers.map((c) => c.teacher);
    const userIds = [...new Set([appt.teacher?.userId, ...coTeachers.map((t) => t.userId)].filter(Boolean))];
    await createNotifications(userIds, {
      type: 'SUPERVISION_EVAL',
      title: 'แบบประเมินการนิเทศ',
      message: `กรุณากรอกแบบประเมินการนิเทศของ ${studentLabel(appt.student)}`,
      link: '/teacher/review-supervision',
      relatedId: String(appt.id),
    });
    await prisma.supervisionAppointment.update({ where: { id: appt.id }, data: { evalSentAt: new Date() } });
    results.push({ id: appt.id, recipients: userIds.length, unlinked: unlinkedCoTeacherNames(appt.coTeacherName, coTeachers) });
  }
  return results;
}

module.exports = { CONFIG_KEY, EVAL_DEFAULTS, SENDABLE_STATUSES, getEvalConfig, unlinkedCoTeacherNames, sendEvalForAppointments };
