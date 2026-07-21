const prisma = require('../config/prismaClient');

// ดึงรายการนัดหมายของนักศึกษาคนนี้
exports.getVisitsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params; // รับเป็นรหัสนักศึกษา (String) เช่น "64302xxxx"

    // หา Student Internal ID ก่อน
    const student = await prisma.student.findUnique({
      where: { studentId: studentId },
    });

    if (!student) return res.status(404).json({ ok: false, message: "Student not found" });

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

    if (!student) return res.status(404).json({ ok: false, message: "Student not found" });

    // หา Teacher ID (Int) จาก User ID
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherId }
    });

    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    // กันนัดซ้ำ: อาจารย์คนเดียวกัน นัดวันเดียวกันกับนักศึกษาคนเดียวกันซ้ำ
    const conflict = await prisma.visit.findFirst({
      where: { teacherId: teacher.id, studentId: student.id, date: new Date(date) },
    });
    if (conflict) {
      return res.status(409).json({ message: "มีนัดหมายของนักศึกษาคนนี้ในวันนี้อยู่แล้ว" });
    }

    const newVisit = await prisma.visit.create({
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

    res.json({ ok: true, data: newVisit });
  } catch (err) {
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
    const visit = await prisma.visit.findUnique({ where: { id: parseInt(id) } });

    if (!visit) return res.status(404).json({ ok: false, message: "Visit not found" });
    if (!(await isOwnerOfVisit(req.user.id, visit))) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์แก้ไขนัดหมายของอาจารย์ท่านอื่น" });
    }

    const newStatus = visit.status === "scheduled" ? "done" : "scheduled";

    const updated = await prisma.visit.update({
      where: { id: parseInt(id) },
      data: { status: newStatus }
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// ลบนัดหมาย
exports.deleteVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await prisma.visit.findUnique({ where: { id: parseInt(id) } });
    if (!visit) return res.status(404).json({ ok: false, message: "Visit not found" });
    if (!(await isOwnerOfVisit(req.user.id, visit))) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ลบนัดหมายของอาจารย์ท่านอื่น" });
    }

    await prisma.visit.delete({ where: { id: parseInt(id) } });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};