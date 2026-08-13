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
// 2a. สร้างสาขาใหม่ (POST)
// ==================================================
exports.createCriteria = async (req, res) => {
  try {
    const { major } = req.body;
    if (!major || !major.trim()) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อสาขา" });

    const criteria = await prisma.coopCriteria.upsert({
      where: { major: major.trim() },
      update: {},
      create: { major: major.trim() },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// ==================================================
// 2b. แก้ไขชื่อสาขา (PUT by id)
// ==================================================
exports.updateCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    const { major } = req.body;
    if (!major || !major.trim()) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อสาขา" });

    const criteria = await prisma.coopCriteria.update({
      where: { id },
      data: { major: major.trim() },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: "ไม่พบสาขาวิชาที่ต้องการแก้ไข" });
    if (err.code === 'P2002') return res.status(409).json({ ok: false, message: "ชื่อสาขาวิชานี้มีอยู่แล้ว" });
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
