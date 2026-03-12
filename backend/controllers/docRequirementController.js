const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. ดึงรายการเอกสารทั้งหมด
exports.getRequirements = async (req, res) => {
  try {
    const requirements = await prisma.documentRequirement.findMany({
      orderBy: { id: 'asc' }
    });
    res.json({ ok: true, requirements });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 2. สร้างหัวข้อเอกสารใหม่
exports.createRequirement = async (req, res) => {
  try {
    const { docKey, title, description, isRequired, isActive } = req.body;
    const newReq = await prisma.documentRequirement.create({
      data: { docKey, title, description, isRequired, isActive }
    });
    res.json({ ok: true, requirement: newReq });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ ok: false, message: "รหัสเอกสาร (Key) ซ้ำกัน กรุณาใช้รหัสอื่น" });
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 3. แก้ไขหัวข้อเอกสาร
exports.updateRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const { docKey, title, description, isRequired, isActive } = req.body;
    const updated = await prisma.documentRequirement.update({
      where: { id: Number(id) },
      data: { docKey, title, description, isRequired, isActive }
    });
    res.json({ ok: true, requirement: updated });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 4. ลบหัวข้อเอกสาร
exports.deleteRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.documentRequirement.delete({ where: { id: Number(id) } });
    res.json({ ok: true, message: "ลบสำเร็จ" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};