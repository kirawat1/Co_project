// แบบประเมินการนิเทศ — รายการนัดที่ส่ง/ยังไม่ส่งลิงก์ (อาจารย์ประจำวิชา/เจ้าหน้าที่) และฝั่งอาจารย์ผู้นิเทศ
const prisma = require('../config/prismaClient');
const { getEvalConfig, matchCoTeachers, sendEvalForAppointments, SENDABLE_STATUSES } = require('../utils/supervisionEval');

const TEACHER_NAME = { select: { prefix: true, firstName: true, lastName: true } };
const teacherName = (t) => (t ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim() : '');
const studentName = (s) => [s?.firstName, s?.lastName].filter(Boolean).join(' ');

const APPT_SELECT = {
  id: true, status: true, confirmedDate: true, coTeacherName: true, evalSentAt: true, teacherId: true,
  teacher: TEACHER_NAME,
  student: {
    select: {
      studentId: true, firstName: true, lastName: true,
      coop: { select: { coopPeriodId: true, company: { select: { name: true } } } },
    },
  },
};

const toRow = (a, teachers) => ({
  id: a.id,
  status: a.status,
  confirmedDate: a.confirmedDate,
  evalSentAt: a.evalSentAt,
  studentCode: a.student?.studentId || '',
  studentName: studentName(a.student),
  companyName: a.student?.coop?.company?.name || '',
  coopPeriodId: a.student?.coop?.coopPeriodId ?? null,
  teacherName: teacherName(a.teacher),
  coTeacherName: a.coTeacherName || '',
  unmatchedCoTeachers: matchCoTeachers(a.coTeacherName, teachers).unmatched,
});

// GET /api/admin/supervision-eval
exports.listEvalAppointments = async (_req, res) => {
  try {
    const [appts, teachers, config] = await Promise.all([
      prisma.supervisionAppointment.findMany({
        where: { status: { in: SENDABLE_STATUSES }, student: { deletedAt: null } },
        select: APPT_SELECT,
        orderBy: { confirmedDate: 'asc' },
      }),
      prisma.teacher.findMany({ select: { prefix: true, firstName: true, lastName: true } }),
      getEvalConfig(),
    ]);
    res.json({ ok: true, config, appointments: appts.map((a) => toRow(a, teachers)) });
  } catch (err) {
    console.error('listEvalAppointments error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถโหลดรายการนิเทศได้' });
  }
};

// POST /api/admin/supervision-eval/send  { ids: number[] }
exports.sendEval = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((n) => parseInt(n, 10)).filter((n) => n > 0) : [];
    if (ids.length === 0) return res.status(400).json({ ok: false, message: 'กรุณาเลือกรายการที่จะส่ง' });
    const results = await sendEvalForAppointments(ids);
    res.json({ ok: true, sent: results.length, results });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('sendEval error:', err);
    res.status(500).json({ ok: false, message: 'ส่งลิงก์แบบประเมินไม่สำเร็จ' });
  }
};

// GET /api/teacher/supervision-eval — นัดที่ส่งลิงก์ให้ "ฉัน" แล้ว (เป็นอาจารย์หลัก หรือมีชื่อเป็นอาจารย์ร่วม)
exports.getMyEval = async (req, res) => {
  try {
    const me = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      select: { id: true, prefix: true, firstName: true, lastName: true },
    });
    if (!me) return res.json({ ok: true, config: null, appointments: [] });

    const [appts, config] = await Promise.all([
      prisma.supervisionAppointment.findMany({
        where: { evalSentAt: { not: null }, student: { deletedAt: null } },
        select: APPT_SELECT,
        orderBy: { confirmedDate: 'asc' },
      }),
      getEvalConfig(),
    ]);
    const mine = appts.filter((a) => a.teacherId === me.id || matchCoTeachers(a.coTeacherName, [me]).matched.length > 0);
    if (!config.evalLink || mine.length === 0) return res.json({ ok: true, config: null, appointments: [] });
    res.json({
      ok: true,
      config: { instructionText: config.instructionText, evalLink: config.evalLink },
      appointments: mine.map((a) => ({ ...toRow(a, []), unmatchedCoTeachers: undefined, isPrimary: a.teacherId === me.id })),
    });
  } catch (err) {
    console.error('getMyEval error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถโหลดแบบประเมินได้' });
  }
};
