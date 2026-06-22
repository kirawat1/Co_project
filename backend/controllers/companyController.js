// backend/controllers/companyController.js
const prisma = require('../config/prismaClient');

// ---------------- Company ----------------
exports.getCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: { mentors: true },
      orderBy: { id: 'desc' } // (แถม) เรียงจากบริษัทล่าสุดขึ้นก่อน
    });
    res.json(companies);
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
    res.status(400).json({ ok: false, message: "เพิ่มบริษัทไม่สำเร็จ" });
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

    const company = await prisma.company.findUnique({
      where: { id: req.params.id }, 
    });

    if (!company) return res.status(404).json({ ok: false, message: "ไม่พบบริษัท" });

    // ✅ 2. แปลง currentUserId เป็น Number เสมอ ป้องกัน Prisma หาไม่เจอ
    const currentUser = await prisma.user.findUnique({ 
        where: { id: Number(currentUserId) } 
    });
    
    const isStaff = currentUser && (currentUser.role === "staff" || currentUser.role === "admin");

    // ถ้าไม่ใช่เจ้าหน้าที่ และไม่ใช่คนสร้างบริษัทนี้ ให้เด้งออก
    if (!isStaff && company.createdById !== Number(currentUserId)) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์แก้ไขบริษัทนี้" });
    }

    // อัปเดตข้อมูลทั้งหมด
    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { 
        name, nameEn, address, addressNo, moo, soi, road, 
        subDistrict, district, province, zipcode, 
        email, phone, fax, website, pastYears, 
        contactPerson, contactPosition 
      },
    });

    res.json({ ok: true, company: updated });
  } catch (err) {
    console.error("Update Company Error:", err);
    res.status(400).json({ ok: false, message: "แก้ไขไม่สำเร็จ" });
  }
};

// ลบบริษัท
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ ใช้ Logic ดึง ID แบบเดียวกัน
    const currentUserId = req.userId || (req.user && req.user.id);

    const company = await prisma.company.findUnique({
        where: { id }
    });

    if (!company) {
        return res.status(404).json({ ok: false, message: "ไม่พบบริษัท" });
    }

    // ✅ ค้นหา User แบบครอบด้วย Number()
    const currentUser = await prisma.user.findUnique({ 
        where: { id: Number(currentUserId) } 
    });
    
    const isStaff = currentUser && (currentUser.role === "staff" || currentUser.role === "admin");

    if (!isStaff && company.createdById !== Number(currentUserId)) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบบริษัทนี้" });
    }

    // เมื่อเช็คสิทธิ์ผ่าน ค่อยสั่งลบ
    await prisma.company.delete({
      where: { id },
    });

    res.json({ ok: true, message: "ลบบริษัทและพี่เลี้ยงสำเร็จ" });
  } catch (err) {
    console.error("Delete Company Error:", err);
    res.status(400).json({ ok: false, message: "ลบไม่สำเร็จ" });
  }
};
// ---------------- Mentor ----------------
// เช็คสิทธิ์แบบเดียวกับ company: staff/admin หรือเจ้าของบริษัทที่ mentor ผูกอยู่เท่านั้น
async function isStaffOrCompanyOwner(currentUserId, companyId) {
  const currentUser = await prisma.user.findUnique({ where: { id: Number(currentUserId) } });
  if (currentUser && (currentUser.role === "staff" || currentUser.role === "admin")) return true;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return !!company && company.createdById === Number(currentUserId);
}

exports.addMentor = async (req, res) => {
  try {
    const { firstName, lastName, department, position, email, phone } = req.body;
    const userId = req.user.id;
    const companyId = req.params.companyId;

    if (!(await isStaffOrCompanyOwner(userId, companyId))) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์เพิ่มพี่เลี้ยงของบริษัทนี้" });
    }

    const mentor = await prisma.mentor.create({
      data: {
        firstName, lastName, department, position, email, phone,
        company: { connect: { id: companyId } },
        createdBy: { connect: { id: userId } },
      },
    });

    res.json({ ok: true, mentor });
  } catch (err) {
    console.error("Add Mentor Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการเพิ่มพี่เลี้ยง" });
  }
};

exports.updateMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, department, position, email, phone } = req.body;
    const currentUserId = req.userId || (req.user && req.user.id);

    const mentor = await prisma.mentor.findUnique({ where: { id: String(id) } });
    if (!mentor) return res.status(404).json({ ok: false, message: "ไม่พบพี่เลี้ยง" });
    if (!(await isStaffOrCompanyOwner(currentUserId, mentor.companyId))) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์แก้ไขพี่เลี้ยงคนนี้" });
    }

    const updatedMentor = await prisma.mentor.update({
      where: { id: String(id) }, // เปลี่ยนเป็น Number(id) ถ้า id ใน schema เป็น Int
      data: { firstName, lastName, department, position, email, phone },
    });

    res.json({ ok: true, mentor: updatedMentor });
  } catch (err) {
    console.error("Update Mentor Error:", err);
    res.status(500).json({ ok: false, message: "Server Error", error: err.message });
  }
};

exports.deleteMentor = async (req, res) => {
  try {
    const currentUserId = req.userId || (req.user && req.user.id);
    const mentor = await prisma.mentor.findUnique({ where: { id: req.params.id } });
    if (!mentor) return res.status(404).json({ ok: false, message: "ไม่พบพี่เลี้ยง" });
    if (!(await isStaffOrCompanyOwner(currentUserId, mentor.companyId))) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบพี่เลี้ยงคนนี้" });
    }

    await prisma.mentor.delete({
        where: { id: req.params.id }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete Mentor Error:", err);
    res.status(500).json({ ok: false, message: "ลบพี่เลี้ยงไม่สำเร็จ" });
  }
};