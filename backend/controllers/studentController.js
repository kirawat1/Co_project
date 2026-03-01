// backend/controllers/studentController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/students/me
exports.getMyProfile = async (req, res) => {
  console.log(`[getMyProfile] Requested by UserID: ${req.userId}`);
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.userId },
      include: {
        emails: true,
        coop: {
          include: {
            company: { include: { mentors: true } },
            mentor: true,
          },
        },
        documents: true,
        user: true,
      },
    });

    if (!student) {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      return res.json({
        id: req.userId, // ✅ สำคัญ: ส่ง ID กลับไปให้ Frontend ใช้ด้วย
        userId: req.userId, // เผื่อ Frontend ใช้ field นี้
        studentId: "",
        prefix: null, // เปลี่ยนจาก "" เป็น null เพื่อให้ตรงกับ Optional Enum
        firstName: "",
        lastName: "",
        firstNameEn: "",
        lastNameEn: "",
        year: "",
        major: null,
        curriculum: "",
        studyProgram: null,
        phone: "",
        gpa: 0.0,
        coreGpa: 0.0,       // ✅ เพิ่มฟิลด์ใหม่ (default)
        activityUnit: 0,    // ✅ เพิ่มฟิลด์ใหม่ (default)
        isPassPrepCourse: false, // ✅ เพิ่มฟิลด์ใหม่ (default)
        advisorName: "",   // ✅ เพิ่มฟิลด์ใหม่ (default)
        jobPosition: "",   // ✅ เพิ่มฟิลด์ใหม่ (default)
        emails: [],
        userEmail: user ? user.email : "",
        company: undefined,
        documents: [],
      });
    }

    // ส่งข้อมูลกลับ พร้อมแปลงโครงสร้างบริษัทให้ใช้ง่าย
    res.json({
      ...student,
      company: student.coop
        ? { ...student.coop.company, mentor: student.coop.mentor }
        : undefined,
      userEmail: student.user?.email || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/students/me
exports.updateMyProfile = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.userId;

    if (data.studentId && data.studentId.length > 15) {
      return res.status(400).json({ ok: false, message: "รหัสนักศึกษาต้องไม่เกิน 10 หลัก" });
    }

    // 🔍 ดึงข้อมูลปัจจุบันจาก DB มาพักไว้ก่อน เพื่อป้องกันการทับค่าด้วย 0
    const currentStudent = await prisma.student.findUnique({
      where: { userId: userId }
    });

    // 1. กำหนดค่าที่จะใช้คำนวณ (ถ้า Frontend ไม่ส่งมา ให้ใช้ค่าเดิมใน DB)
    const targetMajor = data.major || currentStudent?.major;
    const gpa = data.gpa !== undefined ? parseFloat(data.gpa) : (currentStudent?.gpa || 0);
    const coreGpa = data.coreGpa !== undefined ? parseFloat(data.coreGpa) : (currentStudent?.coreGpa || 0);
    const activityUnit = data.activityUnit !== undefined ? parseInt(data.activityUnit) : (currentStudent?.activityUnit || 0);
    const isPassPrepCourse = data.isPassPrepCourse !== undefined ? 
      (data.isPassPrepCourse === true || data.isPassPrepCourse === 'true') : 
      (currentStudent?.isPassPrepCourse || false);

    // 2. Logic การตรวจสอบคุณสมบัติ
    let calculatedQualified = currentStudent?.isQualified || false;

    if (targetMajor) {
      const criteria = await prisma.coopCriteria.findUnique({
        where: { major: targetMajor }
      });

      if (criteria) {
        calculatedQualified = 
          gpa >= criteria.minGpa && 
          coreGpa >= criteria.minCoreGpa && 
          activityUnit >= criteria.minActivityUnit && 
          isPassPrepCourse === true;
        
        console.log(`Debug Check [${targetMajor}]: GPA(${gpa >= criteria.minGpa}) Core(${coreGpa >= criteria.minCoreGpa}) Act(${activityUnit >= criteria.minActivityUnit}) Prep(${isPassPrepCourse}) -> Result: ${calculatedQualified}`);
      }
    }

    // 3. จัดการข้อมูลหลักของ Student (ใช้ upsert)
    const student = await prisma.student.upsert({
      where: { userId: userId },
      update: {
        studentId: data.studentId,
        prefix: data.prefix,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameEn: data.firstNameEn,
        lastNameEn: data.lastNameEn,
        year: data.year,
        major: data.major || null,
        curriculum: data.curriculum,
        studyProgram: data.studyProgram,
        phone: data.phone,
        email: data.email,
        advisorName: data.advisorName, 
        jobPosition: data.jobPosition,
        // ✅ บันทึกค่าใหม่เฉพาะที่มีการส่งมา ถ้าไม่มีส่งมา Prisma จะไม่ Update ฟิลด์นั้น (ใช้ undefined)
        gpa: data.gpa !== undefined ? parseFloat(data.gpa) : undefined,
        coreGpa: data.coreGpa !== undefined ? parseFloat(data.coreGpa) : undefined,
        activityUnit: data.activityUnit !== undefined ? parseInt(data.activityUnit) : undefined,
        isPassPrepCourse: data.isPassPrepCourse !== undefined ? (data.isPassPrepCourse === true || data.isPassPrepCourse === 'true') : undefined,
        isQualified: calculatedQualified,
      },
      create: {
        userId: userId,
        studentId: data.studentId || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        major: (data.major && data.major !== "") ? data.major : null,
        gpa: gpa,
        coreGpa: coreGpa,
        activityUnit: activityUnit,
        advisorName: data.advisorName, 
        jobPosition: data.jobPosition,
        isPassPrepCourse: isPassPrepCourse,
        isQualified: calculatedQualified,
      },
    });

    // 2. จัดการ Emails สำรอง (StudentEmail Table)
    if (data.emails && Array.isArray(data.emails)) {
      for (const e of data.emails) {
        if (e.email && e.email.trim() !== "") {
          await prisma.studentEmail.upsert({
            where: { id: e.id || -1 }, // ถ้าไม่มี id ให้พยายามหาด้วยค่าที่ไม่มีทางเจอเพื่อ create
            update: { email: e.email, primary: e.primary || false },
            create: {
              email: e.email,
              primary: e.primary || false,
              studentId: student.id,
            },
          });
        }
      }
    }

    // 3. จัดการสถานะการฝึกงาน (StudentCoop Table)
    let updatedCoop = null;
    if (data.companyId) {
      updatedCoop = await prisma.studentCoop.upsert({
        where: { studentId: student.id },
        update: {
          companyId: data.companyId,
          mentorId: data.mentorId || null,
        },
        create: {
          studentId: student.id,
          companyId: data.companyId,
          mentorId: data.mentorId || null,
          status: "APPLYING", // เริ่มต้นที่สถานะแรกตาม Enum
        },
        include: {
          company: { include: { mentors: true } },
          mentor: true,
        },
      });
    }

    // ดึงข้อมูล User และผลลัพธ์ทั้งหมดส่งกลับ
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const finalEmails = await prisma.studentEmail.findMany({ where: { studentId: student.id } });

    res.json({
      ok: true,
      student,
      emails: finalEmails,
      company: updatedCoop ? { ...updatedCoop.company, mentor: updatedCoop.mentor } : undefined,
      userEmail: user ? user.email : "",
    });

  } catch (err) {
    console.error("Update Error:", err);
    if (err.code === 'P2002') {
      // เช็คว่าซ้ำที่ field ไหน (ในที่นี้คือ studentId)
      const target = err.meta?.target;
      
      if (typeof target === 'string' && target.includes('studentId')) {
         return res.status(400).json({ 
           ok: false, 
           message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" 
         });
      }
      
      // กรณีซ้ำที่ field อื่น (เผื่อไว้)
      return res.status(400).json({ 
        ok: false, 
        message: "ข้อมูลบางอย่างซ้ำกับในระบบ" 
      });
    }
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// GET /api/students (สำหรับ Admin/Staff)
exports.getStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { email: true, username: true } },
        coop: {
          include: {
            company: true,
            mentor: true,
          },
        },
        documents: true,
      },
      orderBy: { studentId: "asc" },
    });
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// ฟังก์ชันสำหรับ Sync ข้อมูลจาก KKU REG
exports.syncKkuData = async (req, res) => {
  try {
    const userId = req.userId;

    // 1. ดึงข้อมูล User เพื่อเอา kkuAccessToken
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kkuAccessToken: true }
    });

    if (!user || !user.kkuAccessToken) {
      return res.status(400).json({ message: "ไม่พบ KKU Access Token กรุณาล็อกอินใหม่" });
    }

    const KKU_API_URL = "https://reg2.kku.ac.th/api/v1.2";
    const headers = { "x-access-token": user.kkuAccessToken };

    // 2. ยิง API ดึงข้อมูลพื้นฐาน (Info) และ ข้อมูลรายวิชา (Enroll List)
    // ใช้ Promise.all เพื่อความรวดเร็ว
    const [infoRes, enrollRes] = await Promise.all([
      axios.get(`${KKU_API_URL}/student/info`, { headers }),
      axios.get(`${KKU_API_URL}/student/enroll_list/2567/1`, { headers }) // ระบุปี/เทอมปัจจุบัน
    ]);

    if (infoRes.data.status.code !== 200) {
      return res.status(400).json({ message: "ดึงข้อมูลจาก KKU REG ไม่สำเร็จ" });
    }

    const info = infoRes.data.student_info;
    const enrolls = enrollRes.data.data.enroll_list;

    // 3. Logic ตรวจสอบวิชาเตรียมความพร้อม (CP002001 หรือ SC002001)
    // ตรวจหาว่ามีวิชาเหล่านี้ในรายการที่สอบผ่าน (Grade S หรือ A-D) หรือไม่
    const prepCourseCodes = ["CP002001", "SC002001", "CP123001"]; // เพิ่มรหัสตามจริง
    const hasPassedPrep = enrolls.some(course => 
      prepCourseCodes.includes(course.course_code) && 
      ["S", "A", "B+", "B", "C+", "C"].includes(course.grade)
    );

    // 4. บันทึกข้อมูลที่ดึงมาลงฐานข้อมูล
    const updatedStudent = await prisma.student.upsert({
      where: { userId: userId },
      update: {
        firstName: info.firstname_th,
        lastName: info.lastname_th,
        firstNameEn: info.firstname,
        lastNameEn: info.lastname,
        gpa: parseFloat(info.gpa),
        year: info.student_year.toString(),
        curriculum: info.faculty_name,
        email: info.email,
        // ข้อมูลที่คำนวณ/ดึงมาเพิ่ม
        isPassPrepCourse: hasPassedPrep,
        apiSyncedAt: new Date(),
      },
      create: {
        userId: userId,
        studentId: info.student_code,
        firstName: info.firstname_th,
        lastName: info.lastname_th,
        gpa: parseFloat(info.gpa),
        isPassPrepCourse: hasPassedPrep,
      }
    });

    res.json({ ok: true, message: "ซิงค์ข้อมูลสำเร็จ", student: updatedStudent });

  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเชื่อมต่อ REG API" });
  }
};

exports.downloadPlacementLetter = async (req, res) => {
  try {
    const studentId = req.user.id; // มาจาก token

    await prisma.studentCoop.update({
      where: { studentId },
      data: {
        status: 'INTERNSHIP_STARTED'
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('downloadPlacementLetter error:', err);
    res.status(500).json({ ok: false });
  }
};
