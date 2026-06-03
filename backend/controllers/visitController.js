const prisma = require('../config/prismaClient');

// ดึงรายการนัดหมายของนักศึกษาคนนี้
exports.getVisitsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params; // รับเป็นรหัสนักศึกษา (String) เช่น "64302xxxx"

    // หา Student Internal ID ก่อน
    const student = await prisma.student.findUnique({
      where: { studentId: studentId },
    });

    if (!student) return res.status(404).json({ message: "Student not found" });

    const visits = await prisma.visit.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
      include: { teacher: true } // ถ้าอยากได้ชื่ออาจารย์ที่นัด
    });

    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    if (!student) return res.status(404).json({ message: "Student not found" });

    // หา Teacher ID (Int) จาก User ID
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherId }
    });

    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

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

    res.json(newVisit);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

// อัปเดตสถานะ (Toggle Done)
exports.toggleVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await prisma.visit.findUnique({ where: { id: parseInt(id) } });

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    const newStatus = visit.status === "scheduled" ? "done" : "scheduled";

    const updated = await prisma.visit.update({
      where: { id: parseInt(id) },
      data: { status: newStatus }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ลบนัดหมาย
exports.deleteVisit = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.visit.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};