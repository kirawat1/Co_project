const prisma = require('../config/prismaClient');
const { autoCloseIfExpired } = require('../utils/coopPeriodHelper');

// ดึงข้อมูลรอบทั้งหมด
exports.getPeriods = async (req, res) => {
  try {
    const periods = await prisma.coopPeriod.findMany({
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
    });
    res.json({ ok: true, periods });
  } catch (error) {
    console.error("Get periods error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// สร้างรอบใหม่
exports.createPeriod = async (req, res) => {
  try {
    const { academicYear, semester, startDate, endDate } = req.body;
    const parsedSemester = Number(semester);
    if (!Number.isInteger(parsedSemester) || parsedSemester <= 0)
      return res.status(400).json({ ok: false, error: 'semester ไม่ถูกต้อง' });

    // ตรวจสอบปี/เทอม ซ้ำ
    const existing = await prisma.coopPeriod.findUnique({
      where: {
        academicYear_semester: { academicYear, semester: parsedSemester }
      }
    });

    if (existing) {
      return res.status(409).json({ ok: false, error: "ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว" });
    }

    const newPeriod = await prisma.coopPeriod.create({
      data: {
        academicYear,
        semester: parsedSemester,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json({ ok: true, period: newPeriod });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ ok: false, error: "ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว" });
    }
    console.error("Create period error:", error);
    res.status(500).json({ ok: false, error: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// แก้ไขข้อมูลรอบ
exports.updatePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear, semester, startDate, endDate } = req.body;

    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, error: 'id ไม่ถูกต้อง' });
    }

    const parsedSemester = Number(semester);
    if (semester !== undefined && (!Number.isInteger(parsedSemester) || parsedSemester <= 0))
      return res.status(400).json({ ok: false, error: 'semester ไม่ถูกต้อง' });

    const updated = await prisma.coopPeriod.update({
      where: { id: parsedId },
      data: {
        academicYear,
        semester: parsedSemester,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json({ ok: true, period: updated });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ ok: false, error: 'ไม่พบรอบสหกิจ' });
    console.error("Update period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// เปิด-ปิด การรับสมัคร
exports.togglePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0)
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const { isActive } = req.body;

    let updated;
    await prisma.$transaction(async (tx) => {
      // ถ้ากำลังจะเปิดรอบนี้ ให้ปิดรอบอื่นๆ ทั้งหมดก่อน
      if (isActive === true) {
        await tx.coopPeriod.updateMany({
          where: { id: { not: parsedId } },
          data: { isActive: false },
        });
      }
      updated = await tx.coopPeriod.update({
        where: { id: parsedId },
        data: { isActive },
      });
    });
    res.json({ ok: true, period: updated });
  } catch (error) {
    console.error("Toggle period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// ลบรอบ
exports.deletePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, error: 'id ไม่ถูกต้อง' });
    }
    await prisma.coopPeriod.delete({
      where: { id: parsedId },
    });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ ok: false, error: 'ไม่พบรอบสหกิจ' });
    console.error("Delete period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getActivePeriod = async (req, res) => {
  try {
    let period = await prisma.coopPeriod.findFirst({
      where: { isActive: true },
    });
    period = await autoCloseIfExpired(period);
    res.json({ ok: true, period: period?.isActive ? period : null });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// ดึงข้อมูลปีการศึกษาทั้งหมด (เรียงจากใหม่ไปเก่า)
exports.getAllCoopPeriods = async (req, res) => {
  try {
    const periods = await prisma.coopPeriod.findMany({
      orderBy: [
        { academicYear: 'desc' }, // เรียงปีล่าสุดขึ้นก่อน
        { semester: 'desc' }      // เรียงเทอมล่าสุดขึ้นก่อน
      ]
    });
    res.json({ ok: true, periods });
  } catch (err) {
    console.error("Error fetching CoopPeriods:", err);
    res.status(500).json({ ok: false, message: "Server Error" });
  }
};