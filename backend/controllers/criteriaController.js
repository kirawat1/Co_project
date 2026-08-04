const prisma = require('../config/prismaClient');

// ==================================================
// 1. ดึงข้อมูล "ทุกสาขา" สำหรับหน้า Admin (A_CriteriaPage)
// ==================================================
exports.getAllCriteria = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      orderBy: { major: 'asc' }
    });
    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// ==================================================
// 2. สร้างสาขาใหม่ (major เป็น key — upsert กันสร้างซ้ำ)
// ==================================================
exports.saveCriteria = async (req, res) => {
  try {
    const { major } = req.body;
    if (!major) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อสาขา" });

    const criteria = await prisma.coopCriteria.upsert({
      where: { major },
      update: {},
      create: { major },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// ==================================================
// 3. ลบสาขา (สำหรับหน้า Admin)
// ==================================================
exports.deleteCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.coopCriteria.delete({
      where: { id: id }
    });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลที่ต้องการลบ" });
    }
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

exports.getMajorList = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      select: { major: true },
      orderBy: { major: 'asc' }
    });

    const majorList = criteria.map(c => c.major);

    res.json({ ok: true, majors: majorList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};
