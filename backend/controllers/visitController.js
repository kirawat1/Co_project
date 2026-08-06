const prisma = require('../config/prismaClient');

// ดึงรายการนัดหมายของนักศึกษาคนนี้
exports.getVisitsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params; // รับเป็นรหัสนักศึกษา (String) เช่น "64302xxxx"

    // หา Student Internal ID ก่อน
    const student = await prisma.student.findUnique({
      where: { studentId: studentId },
    });

    if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: "Student not found" });

    // Teacher callers may only view visits for their own advisees
    if (req.user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!teacher || (student.generalAdvisorId !== teacher.id && student.coopAdvisorId !== teacher.id)) {
        return res.status(403).json({ ok: false, message: "คุณไม่ใช่อาจารย์ที่ปรึกษาของนักศึกษาคนนี้" });
      }
    }

    const visits = await prisma.visit.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
      include: { teacher: true }
    });

    res.json({ ok: true, data: visits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// สร้างนัดหมายใหม่
exports.createVisit = async (req, res) => {
  try {
    const { studentId, date, time, location, note } = req.body;
    const teacherId = req.user.id; // มาจาก Token (authMiddleware)

    // หา Student ID (Int) จาก รหัส (String)
    const student = await prisma.student.findUnique({
      where: { studentId: studentId }
    });

    if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: "Student not found" });

    // หา Teacher ID (Int) จาก User ID
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherId }
    });

    if (!teacher) return res.status(404).json({ ok: false, message: "Teacher profile not found" });

    let newVisit;
    await prisma.$transaction(async (tx) => {
      // ตรวจสอบ advisor ownership — อาจารย์ต้องเป็นที่ปรึกษาของนักศึกษา
      const freshStudent = await tx.student.findUnique({
        where: { id: student.id },
        select: { generalAdvisorId: true, coopAdvisorId: true, deletedAt: true },
      });
      if (!freshStudent || freshStudent.deletedAt) {
        throw Object.assign(new Error("Student not found"), { is404: true });
      }
      if (freshStudent.generalAdvisorId !== teacher.id && freshStudent.coopAdvisorId !== teacher.id) {
        throw Object.assign(new Error("คุณไม่ใช่อาจารย์ที่ปรึกษาของนักศึกษาคนนี้"), { is403: true });
      }

      // กันนัดซ้ำ: อาจารย์คนเดียวกัน นัดวันเดียวกันกับนักศึกษาคนเดียวกันซ้ำ
      const conflict = await tx.visit.findFirst({
        where: { teacherId: teacher.id, studentId: student.id, date: new Date(date) },
      });
      if (conflict) {
        throw Object.assign(new Error("มีนัดหมายของนักศึกษาคนนี้ในวันนี้อยู่แล้ว"), { is409: true });
      }
      newVisit = await tx.visit.create({
        data: {
          date: new Date(date),
          time,
          location,
          note,
          status: "scheduled",
          studentId: student.id,
          teacherId: teacher.id
        }
      });
    });

    res.json({ ok: true, data: newVisit });
  } catch (err) {
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is409) {
      return res.status(409).json({ ok: false, message: err.message });
    }
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// เช็คว่าอาจารย์ที่เรียก (req.user.id) เป็นเจ้าของนัดหมายนี้จริง
async function isOwnerOfVisit(userId, visit) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  return !!teacher && teacher.id === visit.teacherId;
}

// อัปเดตสถานะ (Toggle Done)
exports.toggleVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ ok: false, message: "Invalid ID" });

    let updated;
    await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({ where: { id: numId } });
      if (!visit) throw Object.assign(new Error('Visit not found'), { is404: true });
      const teacher = await tx.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher || teacher.id !== visit.teacherId) {
        throw Object.assign(new Error('ไม่มีสิทธิ์แก้ไขนัดหมายของอาจารย์ท่านอื่น'), { is403: true });
      }
      const newStatus = visit.status === "scheduled" ? "done" : "scheduled";
      updated = await tx.visit.update({ where: { id: numId }, data: { status: newStatus } });
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// ลบนัดหมาย
exports.deleteVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ ok: false, message: "Invalid ID" });

    await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({ where: { id: numId } });
      if (!visit) throw Object.assign(new Error('Visit not found'), { is404: true });
      const teacher = await tx.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher || teacher.id !== visit.teacherId) {
        throw Object.assign(new Error('ไม่มีสิทธิ์ลบนัดหมายของอาจารย์ท่านอื่น'), { is403: true });
      }
      await tx.visit.delete({ where: { id: numId } });
    });

    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};