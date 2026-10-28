// ป้ายตัวเลขบนเมนู = งานที่รออยู่จริงในขอบเขตของผู้ใช้ (ไม่ใช่แจ้งเตือนที่ยังไม่อ่าน)
// เดิมนับแจ้งเตือน: กดเมนูครั้งเดียวหายทั้งที่งานยังค้าง · คนอื่นทำงานไปแล้วตัวเลขไม่ลด · อาจารย์ประจำวิชาได้ของทุกหลักสูตร
// เงื่อนไข "รอ" ของแต่ละเมนู = เงื่อนไขเดียวกับหน้านั้น (countsOnly ของหน้ารายการ) — ตัวเลขบนเมนูตรงกับที่หน้าแสดง
const prisma = require('../config/prismaClient');
const { getMajorScope, studentWhere, visibleStudentWhere } = require('../utils/majorScope');

// หน้า T000: งานตรวจ (เจ้าหน้าที่ + อาจารย์ประจำวิชา) · งานออกหนังสือ (เจ้าหน้าที่เท่านั้น — รวมร่างที่รอลงนาม)
const T000_CHECK = ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_STAFF_CHECK_LETTER'];
const T000_LETTER = ['DOCS_APPROVED', 'ACCEPTANCE_CHECKED'];

/** GET /api/notifications/pending → { ok, pending: { [เมนู]: จำนวน } } — เฉพาะเมนูที่ผู้ใช้มี */
exports.getPendingCounts = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'staff' && role !== 'teacher') return res.json({ ok: true, pending: {} });

    const isStaff = role === 'staff';
    const scope = await getMajorScope(req); // ตัวกรองหลักสูตรบนแถบบนมีผลเหมือนหน้ารายการ
    const inScope = { deletedAt: null, ...studentWhere(scope) };
    const visible = { AND: [{ deletedAt: null }, await visibleStudentWhere(req)] };
    const coop = (status, student) => prisma.studentCoop.count({
      where: { status: Array.isArray(status) ? { in: status } : status, student },
    });

    const tasks = {
      t002: coop('T002_SUBMITTED', visible),
      t003: coop('T003_SUBMITTED', visible),
    };
    // เมนูหน้าจัดการหลักสูตร (/admin) — เจ้าหน้าที่ และอาจารย์ประจำวิชาที่มีหลักสูตรที่ดูแล
    if (isStaff || scope.majors.length) {
      tasks.coopApplications = coop('APPLYING', inScope);
      tasks.t000 = coop(isStaff ? [...T000_CHECK, ...T000_LETTER] : T000_CHECK, inScope);
    }
    if (isStaff) {
      tasks.supervisionManager = prisma.supervisionAppointment.count({ where: { status: 'DATE_CONFIRMED', student: inScope } });
      tasks.feedback = prisma.feedback.count({ where: { status: 'NEW' } });
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      tasks.teacherRequests = coop(['APPLYING', 'PENDING_GRADE'], visible);
      // นิเทศ: อาจารย์หลักรอเลือกวัน หรืออาจารย์ร่วมที่ยังไม่ตอบวันว่าง (นักศึกษาเสนอวันใหม่ = ล้างคำตอบ)
      tasks.teacherSupervision = teacher
        ? prisma.supervisionAppointment.count({
            where: {
              status: 'PENDING_TEACHER',
              student: { deletedAt: null },
              OR: [{ teacherId: teacher.id }, { coTeachers: { some: { teacherId: teacher.id, availableDates: null } } }],
            },
          })
        : 0;
    }

    const keys = Object.keys(tasks);
    const values = await Promise.all(Object.values(tasks));
    res.json({ ok: true, pending: Object.fromEntries(keys.map((k, i) => [k, values[i]])) });
  } catch (err) {
    console.error('[getPendingCounts]', err);
    res.status(500).json({ ok: false, pending: {} });
  }
};
