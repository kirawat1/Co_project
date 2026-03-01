const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getDashboardStats = async (req, res) => {
  try {
    // รับค่า year จาก Query String (?year=2569 หรือ ?year=all)
    const { year } = req.query;

    // 1. สร้างเงื่อนไขการกรอง (Filter)
    const coopFilter = year && year !== 'all' ? {
      coopPeriod: {
        academicYear: year
      }
    } : {}; // ถ้าเป็น all จะเป็น {} คือไม่กรอง

    // 2. ดึงข้อมูลโครงการสหกิจตามเงื่อนไข
    const coops = await prisma.studentCoop.findMany({
      where: coopFilter
    });

    // 3. คำนวณจำนวนนักศึกษา
    let totalStudents = 0;
    if (year && year !== 'all') {
      // ถ้าเลือกปี ให้นับเฉพาะนักศึกษาที่ยื่นสหกิจในปีนั้น
      totalStudents = coops.length; 
    } else {
      // ถ้าเลือก "แสดงทั้งหมด" ให้นับนักศึกษาที่มีในระบบทั้งหมด
      totalStudents = await prisma.student.count();
    }

    // 4. จำนวนประกาศ (กรองตามปีด้วยถ้ามีการเลือก)
    const totalAnnouncements = year && year !== 'all'
      ? await prisma.announcement.count({ where: { year: year } })
      : await prisma.announcement.count();

    // 5. แยกสถานะของ StudentCoop
    const submittedStudents = coops.length;

    const waitingStatuses = [
      'APPLYING', 
      'WAITING_FOR_STAFF_CHECK', 
      'WAITING_FOR_PLACEMENT_LETTER', 
      'WAITING_FOR_STAFF_CHECK_LETTER'
    ];
    const waiting = coops.filter(c => waitingStatuses.includes(c.status)).length;

    const approvedStatuses = [
      'QUALIFIED', 
      'DOCS_APPROVED', 
      'REQ_LETTER_ISSUED', 
      'ACCEPTANCE_CHECKED', 
      'PLACEMENT_LETTER_ISSUED', 
      'INTERNSHIP_STARTED'
    ];
    const approved = coops.filter(c => approvedStatuses.includes(c.status)).length;

    const rejectedStatuses = [
      'QUALIFICATION_FAILED', 
      'APPLICATION_EDITS_REQUIRED', 
      'EDITS_REQUIRED'
    ];
    const rejected = coops.filter(c => rejectedStatuses.includes(c.status)).length;

    const totalDailyLogs = 0; 
    const specialRequests = 0;

    res.json({
      ok: true,
      data: {
        totalStudents,
        submittedStudents,
        totalAnnouncements,
        totalDailyLogs,
        waiting,
        approved,
        rejected,
        specialRequests
      }
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ ok: false, error: "Server Error" });
  }
};