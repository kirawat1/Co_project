// ขยายเวลาส่งรายคน (ปฏิทินของรอบ) — StudentCoop.deadlineExtensions = { T002: "YYYY-MM-DD" }
// เฉพาะขั้นที่ส่งในระบบ (T000/T002/T003) · ส่งได้ถึงสิ้นวันที่ขยาย แต่ยังนับว่าส่งช้า · เหตุผลเก็บในบันทึกการใช้งาน
const prisma = require('../config/prismaClient');
const { MODE_STEPS, isValidDay } = require('../utils/deadlines');
const { assertStudentInScope } = require('../utils/majorScope');

const fail = (res, status, message) => res.status(status).json({ ok: false, message });
const handle = (res, err, label) => {
  if (err.status) return fail(res, err.status, err.message);
  console.error(label, err);
  return fail(res, 500, 'เกิดข้อผิดพลาดที่ Server');
};
const parseId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const todayBangkok = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

const REASON_MAX = 200;
const notFound = () => Object.assign(new Error('นักศึกษาคนนี้ยังไม่มีข้อมูลสหกิจ'), { status: 404 });

// อ่าน-แก้-เขียน deadlineExtensions ในทรานแซกชันเดียว ล็อกแถวก่อน — สองคนขยายพร้อมกันไม่ทับกัน
async function updateExtensions(req, studentId, change) {
  await assertStudentInScope(req, studentId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM StudentCoop WHERE studentId = ${studentId} FOR UPDATE`;
    const coop = await tx.studentCoop.findUnique({ where: { studentId }, select: { deadlineExtensions: true } });
    if (!coop) throw notFound();
    const deadlineExtensions = change({ ...(coop.deadlineExtensions || {}) });
    await tx.studentCoop.update({ where: { studentId }, data: { deadlineExtensions } });
    return deadlineExtensions;
  }, { isolationLevel: 'ReadCommitted' });
}

// PUT /students/:id/deadline-extension  body { stepKey, until, reason }
exports.setExtension = async (req, res) => {
  try {
    const studentId = parseId(req.params.id);
    const { stepKey, until } = req.body || {};
    if (!studentId) return fail(res, 400, 'id ไม่ถูกต้อง');
    if (!MODE_STEPS.includes(stepKey)) return fail(res, 400, 'ขยายเวลาได้เฉพาะ T000 / T002 / T003');
    if (!isValidDay(until)) return fail(res, 400, 'วันที่ขยายถึงไม่ถูกต้อง (YYYY-MM-DD)');
    if (until < todayBangkok()) return fail(res, 400, 'วันที่ขยายถึงต้องไม่ย้อนหลัง');
    const { reason } = req.body || {};
    if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > REASON_MAX)) {
      return fail(res, 400, `เหตุผลต้องเป็นข้อความไม่เกิน ${REASON_MAX} ตัวอักษร`);
    }
    const deadlineExtensions = await updateExtensions(req, studentId, (ext) => ({ ...ext, [stepKey]: until }));
    res.json({ ok: true, deadlineExtensions });
  } catch (err) {
    handle(res, err, 'Set deadline extension error:');
  }
};

// DELETE /students/:id/deadline-extension/:stepKey
exports.clearExtension = async (req, res) => {
  try {
    const studentId = parseId(req.params.id);
    const { stepKey } = req.params;
    if (!studentId) return fail(res, 400, 'id ไม่ถูกต้อง');
    if (!MODE_STEPS.includes(stepKey)) return fail(res, 400, 'ขั้นไม่ถูกต้อง');
    const deadlineExtensions = await updateExtensions(req, studentId, (ext) => { delete ext[stepKey]; return ext; });
    res.json({ ok: true, deadlineExtensions });
  } catch (err) {
    handle(res, err, 'Clear deadline extension error:');
  }
};
