const prisma = require('../config/prismaClient');
const { isPeriodExpired } = require('../utils/coopPeriodHelper');
const { listPeriods, getRow, viewPeriod, viewerMajors, targetMajors, allMajorCodes } = require('../utils/coopPeriodMajor');
const { getMajorScope } = require('../utils/majorScope');
const { createNotifications } = require('../utils/notificationHelper');

// รอบสหกิจ = ปี/เทอม ใช้ร่วมกัน · วันรับสมัคร / เปิด-ปิด / ช่วงนิเทศ แยกหลักสูตร (CoopPeriodMajor — ดู utils/coopPeriodMajor.js)

const fail = (res, status, message) => res.status(status).json({ ok: false, message, error: message });
const handle = (res, error, label) => {
  if (error.status) return fail(res, error.status, error.message);
  if (error.code === 'P2025') return fail(res, 404, 'ไม่พบรอบสหกิจ');
  if (error.code === 'P2003') return fail(res, 400, 'ไม่พบหลักสูตรนี้ในระบบ');
  console.error(label, error);
  return fail(res, 500, 'เกิดข้อผิดพลาดที่ Server');
};
const parseId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const parseDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? undefined : d; };
const isStaff = (req) => String(req.user?.role || '').toLowerCase() === 'staff';

// ดึงรอบทั้งหมดในมุมของผู้ดู (นักศึกษา = หลักสูตรตัวเอง · อาจารย์ประจำวิชา = ที่ดูแล · เจ้าหน้าที่ = ทุกหลักสูตร)
exports.getPeriods = async (req, res) => {
  try {
    const majors = await viewerMajors(req);
    const periods = (await listPeriods()).map((p) => viewPeriod(p, majors));
    res.json({ ok: true, periods });
  } catch (error) {
    handle(res, error, 'Get periods error:');
  }
};
exports.getAllCoopPeriods = exports.getPeriods;

// สร้างรอบ — ถ้าปี/เทอมนี้มีแล้ว จะเพิ่มแถวให้หลักสูตรที่ยังไม่มี (อาจารย์ประจำวิชาเพิ่มรอบให้หลักสูตรตัวเองได้)
exports.createPeriod = async (req, res) => {
  try {
    const { academicYear, semester, startDate, endDate, major } = req.body;
    const year = String(academicYear || '').trim();
    const parsedSemester = Number(semester);
    if (!year) return fail(res, 400, 'academicYear ต้องระบุ');
    if (!Number.isInteger(parsedSemester) || parsedSemester <= 0) return fail(res, 400, 'semester ไม่ถูกต้อง');
    const start = parseDate(startDate), end = parseDate(endDate);
    if (!start || !end) return fail(res, 400, 'startDate และ endDate ต้องระบุ');

    // เจ้าหน้าที่ไม่ระบุหลักสูตร = ทุกหลักสูตร · อาจารย์ประจำวิชา = หลักสูตรที่ระบุ / ทุกหลักสูตรที่ดูแล
    let majors;
    if (major) majors = await targetMajors(req, major);
    else if (isStaff(req)) majors = await allMajorCodes();
    else majors = (await getMajorScope(req, { ignoreFilter: true })).majors;
    if (!majors.length) return fail(res, 400, 'ยังไม่มีหลักสูตรในระบบ');

    const result = await prisma.$transaction(async (tx) => {
      let period = await tx.coopPeriod.findUnique({ where: { academicYear_semester: { academicYear: year, semester: parsedSemester } } });
      if (!period) {
        period = await tx.coopPeriod.create({ data: { academicYear: year, semester: parsedSemester, startDate: start, endDate: end } });
      }
      const existing = new Set((await tx.coopPeriodMajor.findMany({ where: { periodId: period.id }, select: { major: true } })).map((r) => r.major));
      const missing = majors.filter((m) => !existing.has(m));
      if (!missing.length) throw Object.assign(new Error('ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว'), { status: 409 });
      await tx.coopPeriodMajor.createMany({ data: missing.map((m) => ({ periodId: period.id, major: m, startDate: start, endDate: end })) });
      return { period, added: missing };
    });
    const full = (await listPeriods()).find((p) => p.id === result.period.id);
    res.json({ ok: true, period: viewPeriod(full, await viewerMajors(req)), added: result.added });
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว');
    handle(res, error, 'Create period error:');
  }
};

// แก้ไขรอบ
//   ระบุ major (หรืออาจารย์ประจำวิชาที่ดูแลหลักสูตรเดียว) → แก้วันรับสมัครของหลักสูตรนั้น (ยังไม่มีแถว = สร้างให้)
//   เจ้าหน้าที่ไม่ระบุ major → แก้ปี/เทอม และวันตั้งต้นของรอบ (ไม่ทับวันของแต่ละหลักสูตร)
exports.updatePeriod = async (req, res) => {
  try {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return fail(res, 400, 'id ไม่ถูกต้อง');
    const { academicYear, semester, startDate, endDate, major } = req.body;
    const start = parseDate(startDate), end = parseDate(endDate);
    if (!start || !end) return fail(res, 400, 'startDate และ endDate ต้องระบุ');

    const period = await prisma.coopPeriod.findUnique({ where: { id: parsedId } });
    if (!period) return fail(res, 404, 'ไม่พบรอบสหกิจ');

    if (!major && isStaff(req)) {
      const parsedSemester = Number(semester);
      if (semester !== undefined && (!Number.isInteger(parsedSemester) || parsedSemester <= 0)) return fail(res, 400, 'semester ไม่ถูกต้อง');
      await prisma.coopPeriod.update({
        where: { id: parsedId },
        data: {
          ...(academicYear ? { academicYear: String(academicYear).trim() } : {}),
          ...(semester !== undefined ? { semester: parsedSemester } : {}),
          startDate: start, endDate: end,
        },
      });
    } else {
      const [m] = await targetMajors(req, major);
      await prisma.coopPeriodMajor.upsert({
        where: { periodId_major: { periodId: parsedId, major: m } },
        update: { startDate: start, endDate: end },
        create: { periodId: parsedId, major: m, startDate: start, endDate: end },
      });
    }
    const full = (await listPeriods()).find((p) => p.id === parsedId);
    res.json({ ok: true, period: viewPeriod(full, await viewerMajors(req)) });
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว');
    handle(res, error, 'Update period error:');
  }
};

// เปิด-ปิดรับสมัคร — แยกหลักสูตร · เปิดรอบหนึ่ง = ปิดรอบอื่นของหลักสูตรเดียวกัน (หลักสูตรอื่นไม่เกี่ยว)
// เจ้าหน้าที่ไม่ระบุ major = ทุกหลักสูตรที่ตั้งรอบนี้ไว้
exports.togglePeriod = async (req, res) => {
  try {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return fail(res, 400, 'id ไม่ถูกต้อง');
    const { isActive, major } = req.body;
    if (typeof isActive !== 'boolean') return fail(res, 400, 'isActive ต้องเป็น true/false');

    const period = await prisma.coopPeriod.findUnique({ where: { id: parsedId }, include: { majors: true } });
    if (!period) return fail(res, 404, 'ไม่พบรอบสหกิจ');
    const target = await targetMajors(req, major, { allowAll: true });
    const rows = period.majors.filter((r) => !target || target.includes(r.major));
    if (!rows.length) return fail(res, 400, 'หลักสูตรนี้ยังไม่ได้ตั้งรอบนี้ — กด "ตั้งวันรับสมัคร" ก่อน');

    // เปิดรอบที่เลยวันปิดรับสมัครแล้วไม่ได้ — ถ้าปล่อยเปิด ระบบจะปิดกลับทันทีตอนโหลดรายการใหม่
    if (isActive) {
      const expired = rows.filter((r) => isPeriodExpired(r));
      if (expired.length) {
        return fail(res, 400, `เปิดรับสมัครไม่ได้ เพราะเลยวันปิดรับสมัครแล้ว (${expired.map((r) => r.major).join(', ')}) กรุณากด "แก้วัน" เพื่อเลื่อนวันปิดรับสมัครก่อน`);
      }
    }

    const majors = rows.map((r) => r.major);
    await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.coopPeriodMajor.updateMany({ where: { major: { in: majors }, periodId: { not: parsedId } }, data: { isActive: false } });
      }
      await tx.coopPeriodMajor.updateMany({ where: { periodId: parsedId, major: { in: majors } }, data: { isActive } });
    });
    const full = (await listPeriods()).find((p) => p.id === parsedId);
    res.json({ ok: true, period: viewPeriod(full, await viewerMajors(req)), majors });
  } catch (error) {
    handle(res, error, 'Toggle period error:');
  }
};

// ลบรอบ (ปี/เทอม) — เจ้าหน้าที่เท่านั้น (ดู route) · มีนักศึกษาอยู่ในรอบ = ลบไม่ได้
exports.deletePeriod = async (req, res) => {
  try {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return fail(res, 400, 'id ไม่ถูกต้อง');
    await prisma.coopPeriod.delete({ where: { id: parsedId } });
    res.json({ ok: true, message: 'Deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return fail(res, 404, 'ไม่พบรอบสหกิจ');
    if (error.code === 'P2003') return fail(res, 409, 'ไม่สามารถลบรอบสหกิจได้เพราะมีนักศึกษาอ้างอิงอยู่');
    handle(res, error, 'Delete period error:');
  }
};

// เอารอบนี้ออกจากหลักสูตรหนึ่ง (หลักสูตรนั้นไม่เปิดรอบนี้) — นักศึกษาหลักสูตรนั้นที่อยู่ในรอบนี้ = เอาออกไม่ได้
exports.removePeriodMajor = async (req, res) => {
  try {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return fail(res, 400, 'id ไม่ถูกต้อง');
    const [m] = await targetMajors(req, req.params.major);
    const used = await prisma.studentCoop.count({ where: { coopPeriodId: parsedId, student: { major: m } } });
    if (used) return fail(res, 409, `มีนักศึกษาหลักสูตร ${m} อยู่ในรอบนี้ ${used} คน — ย้ายรอบนักศึกษาก่อน`);
    const row = await getRow(parsedId, m);
    if (!row) return fail(res, 404, 'หลักสูตรนี้ไม่ได้ตั้งรอบนี้');
    await prisma.coopPeriodMajor.delete({ where: { periodId_major: { periodId: parsedId, major: m } } });
    res.json({ ok: true });
  } catch (error) {
    handle(res, error, 'Remove period major error:');
  }
};

// รอบที่เปิดรับสมัครอยู่ตอนนี้ — นักศึกษา = ของหลักสูตรตัวเอง (ยังไม่ระบุหลักสูตร → null + reason)
exports.getActivePeriod = async (req, res) => {
  try {
    const majors = await viewerMajors(req);
    if (majors && majors.length === 0) {
      return res.json({ ok: true, period: null, reason: 'NO_MAJOR', message: 'ยังไม่ได้ระบุหลักสูตรของคุณ กรุณาติดต่อเจ้าหน้าที่ให้ระบุหลักสูตรก่อนยื่นคำร้อง' });
    }
    const period = (await listPeriods()).map((p) => viewPeriod(p, majors)).find((p) => p.isActive) || null;
    res.json({ ok: true, period });
  } catch (error) {
    handle(res, error, 'Get active period error:');
  }
};

// ==========================================
// ย้ายรอบสหกิจของนักศึกษา (เช่น ยื่นเทอม 1 แล้วไปไม่ได้ → ไปเทอม 2)
// ข้อมูลสหกิจมีชุดเดียวต่อคน — ประวัติรอบเดิมอยู่ในบันทึกการใช้งาน (เหตุผลที่กรอกถูกเก็บไปด้วย)
//   resetTo = KEEP          → ย้ายรอบอย่างเดียว (เฉพาะยังไม่ผ่านคุณสมบัติ — ยังไม่มีหนังสือให้ยกเลิก)
//             QUALIFIED     → คงการผ่านคุณสมบัติ เริ่ม T000 ใหม่ (หนังสือขอความอนุเคราะห์/ส่งตัว/ใบตอบรับ ถูกยกเลิก)
//             NOT_SUBMITTED → เริ่มยื่นคำร้องใหม่ทั้งหมด
// ออกฝึกแล้ว (INTERNSHIP_STARTED / T002 / T003) หรือมีนัดนิเทศแล้ว = ย้ายไม่ได้
// ==========================================
const EARLY_STATUSES = new Set(['NOT_SUBMITTED', 'APPLYING', 'PENDING_GRADE', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED']);
const MOVE_BLOCKED = new Set(['INTERNSHIP_STARTED', 'T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED']);
const T000_RESET = {
  t000Status: 'WAITING', t000Comment: null, staffCheckComment: null,
  reqDocNumber: null, reqDocDate: null, reqLetterUrl: null,
  reqLetterPendingAt: null, reqLetterDraftNumber: null, reqLetterDraftDate: null, reqLetterDelivery: null,
  acceptanceFileUrl: null, actualStartDate: null, actualEndDate: null,
  placeDocNumber: null, placeDocDate: null, placeLetterUrl: null,
  placeLetterPendingAt: null, placeLetterDraftNumber: null, placeLetterDraftDate: null, placeLetterDelivery: null,
  mentors: { set: [] },
};
const RESET_LABEL = { KEEP: 'คงสถานะเดิม', QUALIFIED: 'ผ่านคุณสมบัติแล้ว เริ่มยื่น T000 ใหม่', NOT_SUBMITTED: 'เริ่มยื่นคำร้องใหม่' };

exports.moveStudentPeriod = async (req, res) => {
  try {
    const studentId = parseId(req.params.id);
    const periodId = parseId(req.body?.periodId);
    const resetTo = String(req.body?.resetTo || '');
    const reason = String(req.body?.reason || '').trim();
    if (!studentId) return fail(res, 400, 'id ไม่ถูกต้อง');
    if (!periodId) return fail(res, 400, 'กรุณาเลือกรอบที่จะย้ายไป');
    if (!RESET_LABEL[resetTo]) return fail(res, 400, 'กรุณาเลือกว่าจะให้เริ่มใหม่จากขั้นไหน');
    if (!reason) return fail(res, 400, 'กรุณาระบุเหตุผลที่ย้ายรอบ');

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true, major: true, deletedAt: true, coop: { select: { status: true, coopPeriodId: true } }, supervisionAppointment: { select: { id: true } } },
    });
    if (!student || student.deletedAt) return fail(res, 404, 'ไม่พบนักศึกษา');
    const coop = student.coop;
    if (!coop) return fail(res, 400, 'นักศึกษาคนนี้ยังไม่มีข้อมูลสหกิจ');
    if (coop.coopPeriodId === periodId) return fail(res, 400, 'นักศึกษาอยู่ในรอบนี้อยู่แล้ว');
    if (MOVE_BLOCKED.has(coop.status) || student.supervisionAppointment) {
      return fail(res, 400, 'นักศึกษาออกฝึกสหกิจแล้ว (หรือมีนัดนิเทศแล้ว) ย้ายรอบไม่ได้');
    }
    const early = EARLY_STATUSES.has(coop.status);
    if (resetTo === 'KEEP' && !early) return fail(res, 400, 'นักศึกษาผ่านคุณสมบัติแล้ว ต้องเลือกให้เริ่ม T000 ใหม่ หรือเริ่มยื่นคำร้องใหม่');
    if (resetTo === 'QUALIFIED' && early) return fail(res, 400, 'นักศึกษายังไม่ผ่านคุณสมบัติ เลือก "คงสถานะเดิม" หรือ "เริ่มยื่นคำร้องใหม่"');

    const period = await prisma.coopPeriod.findUnique({ where: { id: periodId }, select: { id: true, academicYear: true, semester: true } });
    if (!period) return fail(res, 404, 'ไม่พบรอบสหกิจ');
    if (student.major && !(await getRow(periodId, student.major))) {
      return fail(res, 400, `หลักสูตร ${student.major} ยังไม่ได้ตั้งรอบ ${period.semester}/${period.academicYear} — ตั้งรอบในหน้ารอบสหกิจก่อน`);
    }

    const data = { coopPeriodId: periodId };
    if (resetTo === 'QUALIFIED') Object.assign(data, T000_RESET, { status: 'QUALIFIED' });
    if (resetTo === 'NOT_SUBMITTED') Object.assign(data, T000_RESET, { status: 'NOT_SUBMITTED', teacherCheckComment: null, teacherCheckDate: null });
    await prisma.studentCoop.update({ where: { studentId }, data });

    const label = `${period.semester}/${period.academicYear}`;
    res.json({ ok: true, message: `ย้ายไปรอบ ${label} แล้ว (${RESET_LABEL[resetTo]})`, from: coop.coopPeriodId, to: periodId, resetTo });

    createNotifications([student.userId], {
      type: 'COOP_PERIOD_MOVED',
      title: 'ย้ายรอบสหกิจ',
      message: `คุณถูกย้ายไปรอบสหกิจ ${label}${resetTo === 'KEEP' ? '' : ` — ${RESET_LABEL[resetTo]}`}`,
      link: '/student/dashboard',
    }).catch((e) => console.error('notify move period', e));
  } catch (error) {
    handle(res, error, 'Move student period error:');
  }
};
