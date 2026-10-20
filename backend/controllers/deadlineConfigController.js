// /api/coop/config/* ฝั่งนักศึกษา — คืนรูปเดิมที่หน้าเว็บใช้อยู่ แต่กำหนดส่งมาจากปฏิทินของรอบของนักศึกษา (utils/resolveDeadline.js)
//   ช่วงรับเอกสาร T000/T002/T003 → { startDate, endDate, isOpen, late, closed }
//   แบบฟอร์ม T005–T008          → { ok, config: { ...ลิงก์เดิม, deadline } }
//   ยื่นคำร้อง                    → { startDate, endDate, isOpen, state } ตัดสินจากรอบที่เปิดของหลักสูตร
// ผู้ใช้ที่ไม่ใช่นักศึกษาได้ค่ากลางเดิม (หน้าเจ้าหน้าที่ยังอ่านจาก /api/admin/config/*)
const prisma = require('../config/prismaClient');
const { readEffective } = require('../utils/majorConfig');
const { resolveDeadline, bangkokDay } = require('../utils/resolveDeadline');
const { autoCloseRows } = require('../utils/coopPeriodMajor');
const { applyWindowMessage } = require('../utils/applyWindow');

const fail = (res, err, label) => {
  console.error(label, err);
  res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการดึงกำหนดส่ง' });
};

async function callerStudent(req) {
  if (String(req.user?.role || '').toLowerCase() !== 'student') return null;
  return prisma.student.findUnique({ where: { userId: req.user.id }, select: { id: true, major: true } });
}

const windowGetter = (stepKey, legacyKey) => async (req, res) => {
  try {
    const student = await callerStudent(req);
    if (!student) {
      const config = await readEffective(legacyKey, null);
      return res.json(config || { startDate: null, endDate: null, isOpen: false });
    }
    const d = await resolveDeadline(stepKey, { studentId: student.id, major: student.major || null });
    res.json({ startDate: d.startDate, endDate: d.due, isOpen: d.canSubmit, late: d.late, closed: d.closed });
  } catch (err) { fail(res, err, `Get ${stepKey} deadline error:`); }
};

const formGetter = (stepKey, legacyKey) => async (req, res) => {
  try {
    const student = await callerStudent(req);
    const config = await readEffective(legacyKey, student?.major || null);
    if (!student) return res.json({ ok: true, config: config || null });
    const d = await resolveDeadline(stepKey, { studentId: student.id, major: student.major || null });
    // ยังไม่เลือกรอบ = ไม่มีปฏิทินให้ใช้ → แสดงกำหนดส่งเดิม
    const deadline = d.source === 'NO_ROUND' ? (config?.deadline ?? null) : d.due;
    const merged = { ...(config || {}) };
    if (deadline) merged.deadline = deadline; else delete merged.deadline;
    res.json({ ok: true, config: Object.keys(merged).length ? merged : null });
  } catch (err) { fail(res, err, `Get ${stepKey} config error:`); }
};

exports.getT000Config = windowGetter('T000', 'T000_CONFIG');
exports.getT002Config = windowGetter('T002', 'T002_CONFIG');
exports.getT003Config = windowGetter('T003', 'T003_CONFIG');
exports.getEvaluationConfig = formGetter('T005_T006', 'EVALUATION_FORMS');
exports.getT007Config = formGetter('T007', 'CONFIG_T007');
exports.getT008Config = formGetter('T008', 'CONFIG_T008');

// ยื่นคำร้องได้เมื่อรอบรับสมัครของหลักสูตรเปิดอยู่ (ปิดเองเมื่อเลยวันปิด) — ไม่ใช้ APPLY_CONFIG แล้ว
exports.getApplyConfig = async (req, res) => {
  try {
    const student = await callerStudent(req);
    let row = null;
    if (student?.major) {
      const rows = await autoCloseRows(await prisma.coopPeriodMajor.findMany({ where: { major: student.major, isActive: true } }));
      row = rows.filter((r) => r.isActive).sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0] || null;
    }
    const startDate = row ? bangkokDay(row.startDate) : null;
    const endDate = row ? bangkokDay(row.endDate) : null;
    const state = { configured: !!row, open: !!row, reason: row ? null : 'CLOSED', startDate, endDate };
    res.json({ startDate, endDate, isOpen: !!row, state: { ...state, message: applyWindowMessage(state) } });
  } catch (err) { fail(res, err, 'Get apply window error:'); }
};
