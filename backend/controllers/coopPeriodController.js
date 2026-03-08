const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
    
    // ตรวจสอบปี/เทอม ซ้ำ
    const existing = await prisma.coopPeriod.findUnique({
      where: {
        academicYear_semester: { academicYear, semester: Number(semester) }
      }
    });

    if (existing) {
      return res.status(400).json({ ok: false, error: "ปีการศึกษาและภาคเรียนนี้มีอยู่ในระบบแล้ว" });
    }

    const newPeriod = await prisma.coopPeriod.create({
      data: {
        academicYear,
        semester: Number(semester),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json({ ok: true, period: newPeriod });
  } catch (error) {
    console.error("Create period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// แก้ไขข้อมูลรอบ
exports.updatePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear, semester, startDate, endDate } = req.body;

    const updated = await prisma.coopPeriod.update({
      where: { id: Number(id) },
      data: {
        academicYear,
        semester: Number(semester),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json({ ok: true, period: updated });
  } catch (error) {
    console.error("Update period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// เปิด-ปิด การรับสมัคร
exports.togglePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // ✅ ถ้ากำลังจะเปิดรอบนี้ ให้ไป ปิด (isActive: false) รอบอื่นๆ ทั้งหมดก่อน
    if (isActive === true) {
      await prisma.coopPeriod.updateMany({
        where: { id: { not: Number(id) } },
        data: { isActive: false },
      });
    }

    const updated = await prisma.coopPeriod.update({
      where: { id: Number(id) },
      data: { isActive },
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
    await prisma.coopPeriod.delete({
      where: { id: Number(id) },
    });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete period error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getActivePeriod = async (req, res) => {
  try {
    const period = await prisma.coopPeriod.findFirst({
      where: { isActive: true },
    });
    res.json({ ok: true, period });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};