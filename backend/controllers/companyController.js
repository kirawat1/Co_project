// backend/controllers/companyController.js
const prisma = require('../config/prismaClient');

// ---------------- Company ----------------
exports.getCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: { mentors: true },
      orderBy: { id: 'desc' } // (แถม) เรียงจากบริษัทล่าสุดขึ้นก่อน
    });
    res.json({ ok: true, data: companies });
  } catch (err) {
    console.error("Get Companies Error:", err);
    res.status(500).json({ ok: false, message: "ดึงข้อมูลบริษัทไม่สำเร็จ" });
  }
};

exports.addCompany = async (req, res) => {
  try {
    const userId = req.user.id; // มาจาก auth middleware

    // ✅ 1. รับค่าฟิลด์ใหม่ให้ครบตามหน้า Frontend
    const { 
        name, nameEn, 
        address, addressNo, moo, soi, road, 
        subDistrict, district, province, zipcode, 
        email, phone, fax, website, pastYears, 
        contactPerson, contactPosition 
    } = req.body;

    const company = await prisma.company.create({
      data: {
        name, nameEn, 
        address, addressNo, moo, soi, road, 
        subDistrict, district, province, zipcode, 
        email, phone, fax, website, pastYears, 
        contactPerson, contactPosition,
        createdById: userId, // ต้องมี
      },
    });

    res.json({ ok: true, company });
  } catch (err) {
    console.error("Add Company Error:", err);
    res.status(500).json({ ok: false, message: "เพิ่มบริษัทไม่สำเร็จ" });
  }
};

// แก้ไขบริษัท// แก้ไขบริษัท// แก้ไขบริษัท
exports.updateCompany = async (req, res) => {
  try {
    // ✅ 1. ดึง ID ออกมาให้ครอบคลุม (เผื่อ Middleware ใช้ req.userId หรือ req.user.id)
    const currentUserId = req.userId || (req.user && req.user.id);
    
    const { 
        name, nameEn, 
        address, addressNo, moo, soi, road, 
        subDistrict, district, province, zipcode, 
        email, phone, fax, website, pastYears, 
        contactPerson, contactPosition 
    } = req.body;

    let updated;
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: req.params.id } });
      if (!company) throw Object.assign(new Error("ไม่พบบริษัท"), { is404: true });

      const currentUser = await tx.user.findUnique({ where: { id: Number(currentUserId) } });
      const isStaff = currentUser && currentUser.role === "staff";
      if (!isStaff && company.createdById !== Number(currentUserId)) {
        throw Object.assign(new Error("ไม่มีสิทธิ์แก้ไขบริษัทนี้"), { is403: true });
      }

      updated = await tx.company.update({
        where: { id: req.params.id },
        data: {
          name, nameEn, address, addressNo, moo, soi, road,
          subDistrict, district, province, zipcode,
          email, phone, fax, website, pastYears,
          contactPerson, contactPosition
        },
      });
    });

    res.json({ ok: true, company: updated });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบบริษัท' });
    console.error("Update Company Error:", err);
    res.status(500).json({ ok: false, message: "แก้ไขไม่สำเร็จ" });
  }
};

// ลบบริษัท
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ ใช้ Logic ดึง ID แบบเดียวกัน
    const currentUserId = req.userId || (req.user && req.user.id);

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id } });
      if (!company) throw Object.assign(new Error("ไม่พบบริษัท"), { is404: true });

      const currentUser = await tx.user.findUnique({ where: { id: Number(currentUserId) } });
      const isStaff = currentUser && currentUser.role === "staff";
      if (!isStaff && company.createdById !== Number(currentUserId)) {
        throw Object.assign(new Error("ไม่มีสิทธิ์ลบบริษัทนี้"), { is403: true });
      }

      await tx.company.delete({ where: { id } });
    });

    res.json({ ok: true, message: "ลบบริษัทและพี่เลี้ยงสำเร็จ" });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบบริษัท' });
    if (err.code === 'P2003') return res.status(409).json({ ok: false, message: "ไม่สามารถลบบริษัทได้เพราะมีข้อมูลนักศึกษาอ้างอิงอยู่" });
    console.error("Delete Company Error:", err);
    res.status(500).json({ ok: false, message: "ลบไม่สำเร็จ" });
  }
};
// ---------------- Mentor ----------------

exports.addMentor = async (req, res) => {
  try {
    const { firstName, lastName, department, position, email, phone } = req.body;
    const userId = req.user.id;
    const companyId = req.params.companyId;

    let mentor;
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: Number(userId) }, select: { role: true } });
      if (!currentUser || currentUser.role !== 'staff') {
        const company = await tx.company.findUnique({ where: { id: companyId }, select: { createdById: true } });
        if (!company || company.createdById !== Number(userId)) {
          throw Object.assign(new Error("ไม่มีสิทธิ์เพิ่มพี่เลี้ยงของบริษัทนี้"), { is403: true });
        }
      }
      mentor = await tx.mentor.create({
        data: {
          firstName, lastName, department, position, email, phone,
          company: { connect: { id: companyId } },
          createdBy: { connect: { id: userId } },
        },
      });
    });

    res.json({ ok: true, mentor });
  } catch (err) {
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    console.error("Add Mentor Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการเพิ่มพี่เลี้ยง" });
  }
};

exports.updateMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, department, position, email, phone } = req.body;
    const currentUserId = req.userId || (req.user && req.user.id);

    let updatedMentor;
    await prisma.$transaction(async (tx) => {
      const mentor = await tx.mentor.findUnique({ where: { id: String(id) } });
      if (!mentor) throw Object.assign(new Error("ไม่พบพี่เลี้ยง"), { is404: true });

      const currentUser = await tx.user.findUnique({ where: { id: Number(currentUserId) }, select: { role: true } });
      if (!currentUser || currentUser.role !== 'staff') {
        const company = await tx.company.findUnique({ where: { id: mentor.companyId }, select: { createdById: true } });
        if (!company || company.createdById !== Number(currentUserId)) {
          throw Object.assign(new Error("ไม่มีสิทธิ์แก้ไขพี่เลี้ยงคนนี้"), { is403: true });
        }
      }

      updatedMentor = await tx.mentor.update({
        where: { id: String(id) },
        data: { firstName, lastName, department, position, email, phone },
      });
    });

    res.json({ ok: true, mentor: updatedMentor });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบพี่เลี้ยง' });
    console.error("Update Mentor Error:", err);
    res.status(500).json({ ok: false, message: "แก้ไขพี่เลี้ยงไม่สำเร็จ" });
  }
};

exports.deleteMentor = async (req, res) => {
  try {
    const currentUserId = req.userId || (req.user && req.user.id);

    await prisma.$transaction(async (tx) => {
      const mentor = await tx.mentor.findUnique({ where: { id: req.params.id } });
      if (!mentor) throw Object.assign(new Error("ไม่พบพี่เลี้ยง"), { is404: true });

      const currentUser = await tx.user.findUnique({ where: { id: Number(currentUserId) }, select: { role: true } });
      if (!currentUser || currentUser.role !== 'staff') {
        const company = await tx.company.findUnique({ where: { id: mentor.companyId }, select: { createdById: true } });
        if (!company || company.createdById !== Number(currentUserId)) {
          throw Object.assign(new Error("ไม่มีสิทธิ์ลบพี่เลี้ยงคนนี้"), { is403: true });
        }
      }

      await tx.mentor.delete({ where: { id: req.params.id } });
    });

    res.json({ ok: true });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบพี่เลี้ยง' });
    if (err.code === 'P2003') return res.status(409).json({ ok: false, message: "ไม่สามารถลบพี่เลี้ยงได้เพราะมีข้อมูลนักศึกษาอ้างอิงอยู่" });
    console.error("Delete Mentor Error:", err);
    res.status(500).json({ ok: false, message: "ลบพี่เลี้ยงไม่สำเร็จ" });
  }
};