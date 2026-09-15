// backend/controllers/companyController.js
const prisma = require('../config/prismaClient');

const ALLOWED_URL_PROTOCOLS = ['https:', 'http:'];
function safeUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let value = raw.trim();
  // คนส่วนใหญ่พิมพ์ "www.abc.co.th" / "abc.com" ไม่มี http(s):// — เดิมได้ 400 เพิ่ม/แก้บริษัทไม่ได้ จึงเติม https:// ให้
  // (มี scheme อื่นอยู่แล้ว เช่น javascript: / ftp: ยังไม่รับเหมือนเดิม)
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (!ALLOWED_URL_PROTOCOLS.includes(u.protocol) || !u.hostname.includes('.')) return null;
    return value;
  } catch { return null; }
}

// ---------------- Company ----------------
exports.searchCompanies = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ ok: true, data: [] });
    const companies = await prisma.company.findMany({
      where: { OR: [{ name: { contains: q } }, { nameEn: { contains: q } }] },
      take: 10,
      orderBy: { name: 'asc' },
    });
    res.json({ ok: true, data: companies });
  } catch (err) {
    console.error("Search Companies Error:", err);
    res.status(500).json({ ok: false, message: "ค้นหาบริษัทไม่สำเร็จ" });
  }
};

// ช่องที่รับจากไฟล์นำเข้า — ใช้ทั้งตอนสร้างบริษัทใหม่ และตอนเติมช่องที่ยังว่างของบริษัทที่มีอยู่แล้ว
const IMPORT_FIELDS = [
  'nameEn', 'address', 'addressNo', 'moo', 'soi', 'road',
  'subDistrict', 'district', 'province', 'zipcode', 'email', 'phone', 'pastYears',
];

/** ค่าว่าง / มีแต่ช่องว่าง นับเป็นไม่มีข้อมูล */
function importValue(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

exports.bulkImportCompanies = async (req, res) => {
  try {
    const rows = req.body.companies;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'ไม่มีข้อมูลบริษัท' });
    }
    const userId = req.user?.id || null;
    let created = 0, updated = 0, skipped = 0;
    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) { skipped++; continue; }
      const exists = await prisma.company.findFirst({ where: { name } });
      if (exists) {
        // ชื่อซ้ำ: ไม่ทับข้อมูลเดิม เติมเฉพาะช่องที่ยังว่าง
        // (ปีที่รับซึ่งมีอยู่แล้วจึงคงเป็นปีแรกที่พบตามเดิม)
        const fill = {};
        for (const field of IMPORT_FIELDS) {
          const incoming = importValue(row[field]);
          if (incoming && !importValue(exists[field])) fill[field] = incoming;
        }
        if (Object.keys(fill).length === 0) { skipped++; continue; }
        await prisma.company.update({ where: { id: exists.id }, data: fill });
        updated++;
        continue;
      }
      const data = { name, createdById: userId };
      for (const field of IMPORT_FIELDS) data[field] = importValue(row[field]);
      await prisma.company.create({ data });
      created++;
    }
    res.json({ ok: true, created, updated, skipped });
  } catch (err) {
    console.error('Bulk Import Error:', err);
    res.status(500).json({ ok: false, message: 'นำเข้าไม่สำเร็จ' });
  }
};

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

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, message: "ชื่อบริษัทเป็นข้อมูลที่จำเป็น" });
    }

    if (website && !safeUrl(website)) {
      return res.status(400).json({ ok: false, message: 'เว็บไซต์ไม่ถูกต้อง — ใส่เป็นลิงก์เว็บ เช่น www.example.co.th' });
    }

    const company = await prisma.company.create({
      data: {
        name, nameEn,
        address, addressNo, moo, soi, road,
        subDistrict, district, province, zipcode,
        email, phone, fax, website: safeUrl(website) ?? null, pastYears,
        contactPerson, contactPosition,
        createdById: userId,
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

      if (website && !safeUrl(website)) {
        throw Object.assign(new Error('เว็บไซต์ไม่ถูกต้อง — ใส่เป็นลิงก์เว็บ เช่น www.example.co.th'), { is400: true });
      }

      updated = await tx.company.update({
        where: { id: req.params.id },
        data: {
          name, nameEn, address, addressNo, moo, soi, road,
          subDistrict, district, province, zipcode,
          email, phone, fax, website: safeUrl(website) ?? null, pastYears,
          contactPerson, contactPosition
        },
      });
    });

    res.json({ ok: true, company: updated });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
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

      // ใครก็ลบได้ (นักศึกษารุ่นใหม่มาอัปเดตข้อมูลบริษัทต่อจากรุ่นก่อน) — ยกเว้นมีนักศึกษาคนอื่นเลือกบริษัทนี้อยู่
      // ลบบริษัท = companyId ของนักศึกษาเหล่านั้นกลายเป็นว่าง (ON DELETE SET NULL) + พี่เลี้ยงหายตาม — ให้แก้ไขแทน
      const currentUser = await tx.user.findUnique({ where: { id: Number(currentUserId) } });
      const isStaff = currentUser && currentUser.role === "staff";
      if (!isStaff) {
        const usedByOthers = await tx.studentCoop.count({
          where: { companyId: id, student: { userId: { not: Number(currentUserId) } } },
        });
        if (usedByOthers > 0) {
          throw Object.assign(
            new Error(`ลบไม่ได้ — มีนักศึกษาคนอื่นเลือกบริษัทนี้อยู่ ${usedByOthers} คน ถ้าข้อมูลเปลี่ยนให้กด "แก้ไข" แทน`),
            { is409: true },
          );
        }
      }

      await tx.company.delete({ where: { id } });
    });

    res.json({ ok: true, message: "ลบบริษัทและพี่เลี้ยงสำเร็จ" });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
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

    if (!firstName || typeof firstName !== 'string' || !lastName || typeof lastName !== 'string') {
      return res.status(400).json({ ok: false, message: "ชื่อและนามสกุลพี่เลี้ยงเป็นข้อมูลที่จำเป็น" });
    }

    let mentor;
    await prisma.$transaction(async (tx) => {
      // ใครก็เพิ่มพี่เลี้ยงให้บริษัทได้ (อัปเดตข้อมูลต่อจากคนที่เพิ่มบริษัทไว้)
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) throw Object.assign(new Error("ไม่พบบริษัท"), { is404: true });
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
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    console.error("Add Mentor Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการเพิ่มพี่เลี้ยง" });
  }
};

exports.updateMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, department, position, email, phone } = req.body;

    let updatedMentor;
    await prisma.$transaction(async (tx) => {
      // ใครก็แก้ข้อมูลพี่เลี้ยงได้ (อัปเดตต่อจากรุ่นก่อน)
      const mentor = await tx.mentor.findUnique({ where: { id: String(id) } });
      if (!mentor) throw Object.assign(new Error("ไม่พบพี่เลี้ยง"), { is404: true });

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
    await prisma.$transaction(async (tx) => {
      // ใครก็ลบพี่เลี้ยงได้ (เช่น พี่เลี้ยงเดิมลาออกแล้ว) — ถอดออกจากนักศึกษาที่เคยเลือกไว้ด้วย (ตาราง M:N ลบตาม)
      const mentor = await tx.mentor.findUnique({ where: { id: req.params.id } });
      if (!mentor) throw Object.assign(new Error("ไม่พบพี่เลี้ยง"), { is404: true });

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