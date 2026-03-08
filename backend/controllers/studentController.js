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
        id: req.userId,
        userId: req.userId, 
        studentId: "",
        prefix: null, 
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
        coreGpa: 0.0,       
        activityUnit: 0,    
        isPassPrepCourse: false, 
        advisorName: "",   
        jobPosition: "",   
        emails: [],
        userEmail: user ? user.email : "",
        company: undefined,
        documents: [],
      });
    }

    // ✅ แก้ไข: เช็คให้ชัวร์ว่า student.coop.company มีค่าจริง ป้องกัน Error กระจายค่า null
    res.json({
      ...student,
      company: (student.coop && student.coop.company)
        ? { ...student.coop.company, mentor: student.coop.mentor }
        : null, // ถ้าไม่มีบริษัทให้เป็น null ไปเลย
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
      return res.status(400).json({ ok: false, message: "รหัสนักศึกษาต้องไม่เกิน 15 หลัก" });
    }

    const currentStudent = await prisma.student.findUnique({
      where: { userId: userId }
    });

    const targetMajor = data.major || currentStudent?.major;
    const gpa = data.gpa !== undefined ? parseFloat(data.gpa) : (currentStudent?.gpa || 0);
    const coreGpa = data.coreGpa !== undefined ? parseFloat(data.coreGpa) : (currentStudent?.coreGpa || 0);
    const activityUnit = data.activityUnit !== undefined ? parseInt(data.activityUnit) : (currentStudent?.activityUnit || 0);
    const isPassPrepCourse = data.isPassPrepCourse !== undefined ? 
      (data.isPassPrepCourse === true || data.isPassPrepCourse === 'true') : 
      (currentStudent?.isPassPrepCourse || false);

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
      }
    }

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

    if (data.emails && Array.isArray(data.emails)) {
      for (const e of data.emails) {
        if (e.email && e.email.trim() !== "") {
          await prisma.studentEmail.upsert({
            where: { id: e.id || -1 },
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

    // ==========================================
    // 3. จัดการสถานะการฝึกงาน (StudentCoop Table)
    // ==========================================
    let updatedCoop = null;
    
    // ✅ แก้ไข: เช็คจาก 'undefined' แทนการเช็ค truthy value 
    // เพื่อให้ทำงานได้แม้มีการส่ง { companyId: null } มาก็ตาม
    if (data.companyId !== undefined) {
      updatedCoop = await prisma.studentCoop.upsert({
        where: { studentId: student.id },
        update: {
          companyId: data.companyId, // รับค่า null เพื่อลบข้อมูลเดิมออกได้
          mentorId: data.mentorId || null, 
        },
        create: {
          studentId: student.id,
          companyId: data.companyId,
          mentorId: data.mentorId || null,
          status: "NOT_SUBMITTED", // กำหนดสถานะเริ่มต้นเมื่อมีการสร้างใหม่
        },
        include: {
          company: { include: { mentors: true } },
          mentor: true,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const finalEmails = await prisma.studentEmail.findMany({ where: { studentId: student.id } });

    res.json({
      ok: true,
      student,
      emails: finalEmails,
      // ✅ แก้ไข: เช็คให้ชัวร์ว่ามี company จริงๆ ถึงส่งข้อมูลกลับไป ไม่งั้นส่ง null
      company: (updatedCoop && updatedCoop.company) 
               ? { ...updatedCoop.company, mentor: updatedCoop.mentor } 
               : null,
      userEmail: user ? user.email : "",
    });

  } catch (err) {
    console.error("Update Error:", err);
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('studentId')) {
         return res.status(400).json({ ok: false, message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" });
      }
      return res.status(400).json({ ok: false, message: "ข้อมูลบางอย่างซ้ำกับในระบบ" });
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
