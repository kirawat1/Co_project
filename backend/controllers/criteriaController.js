const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET: ดึงเกณฑ์ตามสาขา
exports.getCriteria = async (req, res) => {
  try {
    const { major } = req.query;
    if (!major) return res.status(400).json({ message: "Major is required" });

    // ค้นหาเกณฑ์
    const criteria = await prisma.coopCriteria.findUnique({
      where: { major: major },
    });

    // ถ้ายังไม่เคยมี ให้ส่งค่า Default กลับไป (Frontend จะได้ไม่ Error)
    if (!criteria) {
      return res.json({
        major,
        minGpa: 2.00,
        minCoreGpa: 2.00,
        minActivityUnit: 60,
        requiredCourses: [], 
        coreCourses: []
      });
    }

    res.json(criteria);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST: บันทึกเกณฑ์
exports.saveCriteria = async (req, res) => {
  try {
    const { major, minGpa, minCoreGpa, minActivityUnit, requiredCourses, coreCourses } = req.body;

    const criteria = await prisma.coopCriteria.upsert({
      where: { major: major },
      update: {
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses,
        coreCourses: coreCourses
      },
      create: {
        major: major,
        minGpa: parseFloat(minGpa),
        minCoreGpa: parseFloat(minCoreGpa),
        minActivityUnit: parseInt(minActivityUnit),
        requiredCourses: requiredCourses,
        coreCourses: coreCourses
      },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Save failed" });
  }
};