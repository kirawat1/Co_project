// ลิงก์แบบประเมินการนิเทศ (อันเดียวใช้ทุกคน) — ส่งให้อาจารย์ผู้นิเทศ + อาจารย์นิเทศร่วม ผ่านแจ้งเตือนในระบบ
const prisma = require('../config/prismaClient');
const { createNotifications } = require('./notificationHelper');

const CONFIG_KEY = 'CONFIG_SUPERVISION_EVAL';
const EVAL_DEFAULTS = { instructionText: '', evalLink: null, autoSend: false };
// ส่งได้เฉพาะนัดที่อนุมัติหนังสือแล้ว/นิเทศเสร็จแล้ว (นิเทศเกิดขึ้นจริงหรือกำลังจะเกิด)
const SENDABLE_STATUSES = ['LETTER_UPLOADED', 'COMPLETED'];

async function getEvalConfig(db = prisma) {
  const row = await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  let parsed = {};
  try { parsed = row?.value ? JSON.parse(row.value) : {}; } catch { parsed = {}; }
  return { ...EVAL_DEFAULTS, ...parsed };
}

// ชื่ออาจารย์ร่วมเก็บเป็นข้อความ "อ.สมชาย ใจดี, ผศ.สมหญิง ดีใจ" (ไม่มี FK) — จับคู่กลับเป็นบัญชีด้วยชื่อ
// เทียบแบบตัดช่องว่างทั้งหมด และยอมให้คำนำหน้าต่างกัน (เช่น แก้คำนำหน้าในโปรไฟล์ทีหลัง)
const squash = (s) => String(s || '').replace(/\s+/g, '');
function matchCoTeachers(coTeacherName, teachers) {
  const names = String(coTeacherName || '').split(',').map((n) => n.trim()).filter(Boolean);
  const matched = [];
  const unmatched = [];
  for (const name of names) {
    const key = squash(name);
    const t = teachers.find((tc) => key === squash(`${tc.prefix || ''}${tc.firstName}${tc.lastName}`))
      || teachers.find((tc) => {
        const bare = squash(`${tc.firstName}${tc.lastName}`);
        return bare && key.endsWith(bare);
      });
    if (t) matched.push(t); else unmatched.push(name);
  }
  return { matched, unmatched };
}

const studentLabel = (s) => [s?.firstName, s?.lastName].filter(Boolean).join(' ') || s?.studentId || '';

/**
 * ส่งแจ้งเตือนลิงก์ประเมินของนัดที่ระบุ และบันทึก evalSentAt
 * @returns [{ id, recipients, unmatched }] — นัดที่สถานะยังไม่ถึงจะไม่ถูกส่ง (ไม่อยู่ในผลลัพธ์)
 */
async function sendEvalForAppointments(ids) {
  const config = await getEvalConfig();
  if (!config.evalLink) throw Object.assign(new Error('ยังไม่ได้ตั้งค่าลิงก์แบบประเมินการนิเทศ'), { is400: true });

  const [appts, teachers] = await Promise.all([
    prisma.supervisionAppointment.findMany({
      where: { id: { in: ids }, status: { in: SENDABLE_STATUSES }, student: { deletedAt: null } },
      select: {
        id: true, coTeacherName: true,
        teacher: { select: { userId: true } },
        student: { select: { studentId: true, firstName: true, lastName: true } },
      },
    }),
    prisma.teacher.findMany({ select: { userId: true, prefix: true, firstName: true, lastName: true } }),
  ]);

  const results = [];
  for (const appt of appts) {
    const { matched, unmatched } = matchCoTeachers(appt.coTeacherName, teachers);
    const userIds = [...new Set([appt.teacher?.userId, ...matched.map((t) => t.userId)].filter(Boolean))];
    await createNotifications(userIds, {
      type: 'SUPERVISION_EVAL',
      title: 'แบบประเมินการนิเทศ',
      message: `กรุณากรอกแบบประเมินการนิเทศของ ${studentLabel(appt.student)}`,
      link: '/teacher/review-supervision',
      relatedId: String(appt.id),
    });
    await prisma.supervisionAppointment.update({ where: { id: appt.id }, data: { evalSentAt: new Date() } });
    results.push({ id: appt.id, recipients: userIds.length, unmatched });
  }
  return results;
}

module.exports = { CONFIG_KEY, EVAL_DEFAULTS, SENDABLE_STATUSES, getEvalConfig, matchCoTeachers, sendEvalForAppointments };
