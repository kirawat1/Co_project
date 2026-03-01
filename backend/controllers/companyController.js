// backend/controllers/companyController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ---------------- Company ----------------
exports.getCompanies = async (req, res) => {
  const companies = await prisma.company.findMany({
    include: { mentors: true }
  });
  res.json(companies);
};

exports.addCompany = async (req, res) => {
  try {
    const userId = req.user.id; // มาจาก auth middleware

    const company = await prisma.company.create({
      data: {
        name: req.body.name,
        address: req.body.address,
        email: req.body.email,
        phone: req.body.phone,
        website: req.body.website,
        pastYears: req.body.pastYears,
        contactPerson: req.body.contactPerson,
        contactPosition: req.body.contactPosition,
        createdById: userId, // ต้องมี
      },
    });

    res.json({ ok: true, company });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, message: err.message });
  }
};

// แก้ไขบริษัท
exports.updateCompany = async (req, res) => {
  const { name, address, phone, email, contactPerson, contactPosition } = req.body;
  const user = req.user;

  try {
    // Student แก้ไขได้เฉพาะบริษัทของตัวเอง
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
    });

    if (!company) return res.status(404).json({ ok: false, message: "ไม่พบบริษัท" });

    if (user.role !== "staff" && company.createdById !== user.id) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์แก้ไขบริษัทนี้" });
    }

    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { name, address, phone, email, contactPerson, contactPosition },
    });

    res.json({ ok: true, company: updated });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// ลบบริษัท
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.company.delete({
      where: { id },
    });

    if (user.role !== "staff" && company.createdById !== user.id) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบบริษัทนี้" });
    }

    res.json({ ok: true, message: "ลบบริษัทและพี่เลี้ยงสำเร็จ" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, message: "ลบสำเร็จ" });
  }
};
// ---------------- Mentor ----------------
// controllers/companyController.js
exports.addMentor = async (req, res) => {
  try {
    const { firstName, lastName, department, position, email, phone } = req.body;
    const userId = req.user.id; // จาก auth middleware
    const companyId = req.params.companyId; // จาก URL

    const mentor = await prisma.mentor.create({
      data: {
        firstName,
        lastName,
        department,
        position,
        email,
        phone,
        company: { connect: { id: companyId } }, // ✅ ต้องใช้ connect
        createdBy: { connect: { id: userId } }, // ✅ ต้องใช้ connect
      },
    });

    res.json({ ok: true, mentor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการเพิ่มพี่เลี้ยง" });
  }
};


exports.updateMentor = async (req, res) => {
  try {
    const { id } = req.params; // หรือ req.body.id แล้วแต่ Route ของคุณ

    
    const { 
      firstName, 
      lastName, 
      department, 
      position, 
      email, 
      phone, 
    } = req.body;

    const updatedMentor = await prisma.mentor.update({
      where: { id: String(id) }, // แปลงเป็น String หรือ Int ตาม Type ใน DB
      data: {
        firstName,
        lastName,
        department,
        position,
        email,
        phone,
      },
    });

    res.json({ ok: true, mentor: updatedMentor });

  } catch (err) {
    console.error("Update Mentor Error:", err);
    res.status(500).json({ ok: false, message: "Server Error", error: err.message });
  }
};


exports.deleteMentor = async (req, res) => {
  await prisma.mentor.delete({
    where: { id: req.params.id }
  });
  res.json({ ok: true });
};
