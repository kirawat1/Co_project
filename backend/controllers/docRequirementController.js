const prisma = require('../config/prismaClient');

// 1a. ดึงเฉพาะเอกสารที่ active (สำหรับนักศึกษา)
exports.getRequirements = async (req, res) => {
  try {
    const requirements = await prisma.documentRequirement.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    res.json({ ok: true, requirements });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 1b. ดึงเอกสารทั้งหมด รวม inactive (สำหรับ admin จัดการ)
exports.getAllRequirements = async (req, res) => {
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
    if (!docKey || typeof docKey !== 'string' || !title || typeof title !== 'string') {
      return res.status(400).json({ ok: false, message: "docKey และ title เป็นข้อมูลที่จำเป็น" });
    }
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
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ ok: false, message: "ID ไม่ถูกต้อง" });
    const { docKey, title, description, isRequired, isActive } = req.body;
    // Build update data excluding undefined; reject explicit null for required string fields
    if (docKey !== undefined && (docKey === null || typeof docKey !== 'string')) {
      return res.status(400).json({ ok: false, message: "docKey ต้องเป็น string" });
    }
    if (title !== undefined && (title === null || typeof title !== 'string')) {
      return res.status(400).json({ ok: false, message: "title ต้องเป็น string" });
    }
    const data = {};
    if (docKey !== undefined)    data.docKey     = docKey;
    if (title !== undefined)     data.title      = title;
    if (description !== undefined) data.description = description;
    if (isRequired !== undefined)  data.isRequired  = isRequired;
    if (isActive !== undefined)    data.isActive    = isActive;
    const updated = await prisma.documentRequirement.update({ where: { id: numId }, data });
    res.json({ ok: true, requirement: updated });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ ok: false, message: "ไม่พบข้อมูล" });
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 4. ลบหัวข้อเอกสาร
exports.deleteRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ ok: false, message: "ID ไม่ถูกต้อง" });
    await prisma.documentRequirement.delete({ where: { id: numId } });
    res.json({ ok: true, message: "ลบสำเร็จ" });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ ok: false, message: "ไม่พบข้อมูล" });
    res.status(500).json({ ok: false, error: "Server error" });
  }
};