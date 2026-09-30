// แบบประเมินการนิเทศ — รายการนัดที่ส่ง/ยังไม่ส่งลิงก์ (อาจารย์ประจำวิชา/เจ้าหน้าที่) และฝั่งอาจารย์ผู้นิเทศ
const prisma = require('../config/prismaClient');
const { getEvalConfig, unlinkedCoTeacherNames, sendEvalForAppointments, SENDABLE_STATUSES } = require('../utils/supervisionEval');
const { getMajorScope, studentWhere } = require('../utils/majorScope');

const TEACHER_NAME = { select: { prefix: true, firstName: true, lastName: true } };
const teacherName = (t) => (t ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim() : '');
const studentName = (s) => [s?.firstName, s?.lastName].filter(Boolean).join(' ');

const APPT_SELECT = {
  id: true, status: true, confirmedDate: true, coTeacherName: true, evalSentAt: true, teacherId: true,
  teacher: TEACHER_NAME,
  coTeachers: { select: { teacherId: true, teacher: TEACHER_NAME } },
  student: {
    select: {
      studentId: true, firstName: true, lastName: true,
      coop: { select: { coopPeriodId: true, company: { select: { name: true } } } },
    },
  },
};

const toRow = (a) => ({
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
});

// GET /api/admin/supervision-eval
exports.listEvalAppointments = async (req, res) => {
  try {
    const scope = await getMajorScope(req);
    const [appts, config] = await Promise.all([
      prisma.supervisionAppointment.findMany({
        where: { status: { in: SENDABLE_STATUSES }, student: { deletedAt: null, ...studentWhere(scope) } },
        select: APPT_SELECT,
        orderBy: { confirmedDate: 'asc' },
      }),
      getEvalConfig(),
    ]);
    res.json({
      ok: true,
      config,
      appointments: appts.map((a) => ({
        ...toRow(a),
        unlinkedCoTeachers: unlinkedCoTeacherNames(a.coTeacherName, a.coTeachers.map((c) => c.teacher)),
      })),
    });
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
    // ส่งได้เฉพาะนัดของนักศึกษาในหลักสูตรที่ดูแล
    const inScopeIds = (await prisma.supervisionAppointment.findMany({
      where: { id: { in: ids }, student: studentWhere(await getMajorScope(req)) },
      select: { id: true },
    })).map((a) => a.id);
    if (inScopeIds.length !== ids.length) return res.status(403).json({ ok: false, message: 'มีนักศึกษาที่ไม่อยู่ในหลักสูตรที่คุณดูแล' });
    const results = await sendEvalForAppointments(ids);
    res.json({ ok: true, sent: results.length, results });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('sendEval error:', err);
    res.status(500).json({ ok: false, message: 'ส่งลิงก์แบบประเมินไม่สำเร็จ' });
  }
};

// GET /api/teacher/supervision-eval — นัดที่ส่งลิงก์ให้ "ฉัน" แล้ว (เป็นอาจารย์หลัก หรืออาจารย์ร่วม)
exports.getMyEval = async (req, res) => {
  try {
    const me = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!me) return res.json({ ok: true, config: null, appointments: [] });

    const [appts, config] = await Promise.all([
      prisma.supervisionAppointment.findMany({
        where: {
          evalSentAt: { not: null },
          student: { deletedAt: null },
          OR: [{ teacherId: me.id }, { coTeachers: { some: { teacherId: me.id } } }],
        },
        select: APPT_SELECT,
        orderBy: { confirmedDate: 'asc' },
      }),
      getEvalConfig(),
    ]);
    if (!config.evalLink || appts.length === 0) return res.json({ ok: true, config: null, appointments: [] });
    res.json({
      ok: true,
      config: { instructionText: config.instructionText, evalLink: config.evalLink },
      appointments: appts.map((a) => ({ ...toRow(a), isPrimary: a.teacherId === me.id })),
    });
  } catch (err) {
    console.error('getMyEval error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถโหลดแบบประเมินได้' });
  }
};
