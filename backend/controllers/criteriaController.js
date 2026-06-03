const prisma = require('../config/prismaClient');

// ==================================================
// 1. (เพิ่มใหม่) ดึงข้อมูล "ทุกสาขา" สำหรับหน้า Admin (A_CriteriaPage)
// ==================================================
exports.getAllCriteria = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      orderBy: { major: 'asc' }
    });
    res.json({ ok: true, criteria }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ==================================================
// 2. (ของเดิมคุณ) ดึงเกณฑ์ทีละสาขา (เหมาะสำหรับตอน นศ. ล็อกอินเข้ามาเช็ค)
// ==================================================
exports.getCriteria = async (req, res) => {
  try {
    const { major } = req.query;
    if (!major) return res.status(400).json({ message: "Major is required" });

    const criteria = await prisma.coopCriteria.findUnique({
      where: { major: major },
    });

    if (!criteria) {
      return res.json({
        major,
        minGpa: 2.00,
        minCoreGpa: 2.00,
        minActivityUnit: 60,
        requiredCourses: [],
        coreCourses: [],
        prepCourseCodes: [],
        electiveMinCount: 1,
      });
    }

    res.json(criteria);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================================================
// 3. (ของเดิมคุณปรับปรุงนิดหน่อย) บันทึกและแก้ไข (Upsert) ใช้ได้ทั้งสร้างใหม่และอัปเดต
// ==================================================
exports.saveCriteria = async (req, res) => {
  try {
    const {
      major, minGpa, minCoreGpa, minActivityUnit,
      requiredCourses, coreCourses,
      prepCourseCodes, electiveMinCount
    } = req.body;

    const criteria = await prisma.coopCriteria.upsert({
      where: { major },
      update: {
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses || [],
        coreCourses: coreCourses || [],
        prepCourseCodes: prepCourseCodes || [],
        electiveMinCount: parseInt(electiveMinCount) || 1,
      },
      create: {
        major,
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses || [],
        coreCourses: coreCourses || [],
        prepCourseCodes: prepCourseCodes || [],
        electiveMinCount: parseInt(electiveMinCount) || 1,
      },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// ==================================================
// 4. (เพิ่มใหม่) ลบเกณฑ์ของสาขา (สำหรับหน้า Admin)
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
    res.status(500).json({ ok: false, error: "Delete failed" });
  }
};

exports.getMajorList = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      select: { major: true }, // ดึงมาแค่ column major
      orderBy: { major: 'asc' }
    });
    
    // แปลงจาก [{major: 'CS'}, {major: 'IT'}] ให้กลายเป็น ['CS', 'IT']
    const majorList = criteria.map(c => c.major); 
    
    res.json({ ok: true, majors: majorList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};