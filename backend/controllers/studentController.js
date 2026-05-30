// backend/controllers/studentController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const kkuReg = require('../services/kkuRegService');

const PASSING_GRADES = new Set(["S", "A", "B+", "B", "C+", "C", "D+", "D"]);
const GRADE_POINTS = { "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0, "E": 0.0 };

function checkEligibility(gradeList, criteria) {
  if (!gradeList || !criteria) {
    return { isPassPrepCourse: false, passedAllRequired: false, passedElectiveCount: 0, calculatedCoreGpa: 0, isQualified: false };
  }

  const passedCodes = new Set(
    gradeList.filter(c => PASSING_GRADES.has(c.grade)).map(c => c.course_code)
  );

  // 1. วิชาเตรียมความพร้อม (ผ่านอย่างน้อย 1 วิชาจากรายการ)
  const prepCodes = criteria.prepCourseCodes || [];
  const isPassPrepCourse = prepCodes.length === 0 || prepCodes.some(code => passedCodes.has(code));

  // 2. วิชาบังคับ (ต้องผ่านทุกตัว)
  const requiredCourses = criteria.requiredCourses || [];
  const passedAllRequired = requiredCourses.length === 0 ||
    requiredCourses.every(code => passedCodes.has(code));

  // 3. หมวดวิชาบังคับเลือก (ผ่านอย่างน้อย electiveMinCount)
  const coreCourses = criteria.coreCourses || [];
  const electiveMinCount = criteria.electiveMinCount ?? 1;
  const passedElectiveCount = coreCourses.filter(code => passedCodes.has(code)).length;
  const passedElective = coreCourses.length === 0 || passedElectiveCount >= electiveMinCount;

  // 4. คำนวณ coreGpa แบบ weighted average จาก coreCourses ที่กำหนด
  //    S/U/W ไม่อยู่ใน GRADE_POINTS → ไม่นับในสูตร GPA (แต่นับว่าผ่านใน passedCodes)
  let totalPoints = 0, totalCredits = 0;
  for (const entry of gradeList) {
    if (!coreCourses.includes(entry.course_code)) continue;
    const pts = GRADE_POINTS[entry.grade];
    if (pts !== undefined) {
      const credit = entry.creditattempt || 0;
      totalPoints += pts * credit;
      totalCredits += credit;
    }
  }
  const calculatedCoreGpa = totalCredits > 0
    ? Math.round((totalPoints / totalCredits) * 100) / 100
    : 0;

  const isQualified = isPassPrepCourse && passedAllRequired && passedElective;

  return { isPassPrepCourse, passedAllRequired, passedElectiveCount, calculatedCoreGpa, isQualified };
}

exports.checkEligibility = checkEligibility;

// GET /api/students/me
exports.getMyProfile = async (req, res) => {
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
        coopApplicationForm: true,
        documents: true,
        user: true,
        t003Form: true, // เพิ่มการดึงข้อมูลฟอร์ม T003
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

    if (data.studentId !== undefined && data.studentId !== "") {
      // strip ตัวอักษรที่ไม่ใช่ตัวเลขออกก่อน (เช่น "u640001" → "640001")
      data.studentId = String(data.studentId).replace(/\D/g, "");
      if (data.studentId.length === 0 || data.studentId.length > 10) {
        return res.status(400).json({ ok: false, message: "รหัสนักศึกษาต้องเป็นตัวเลขไม่เกิน 10 หลัก" });
      }
      // ป้องกัน unique constraint crash: ตรวจว่ารหัสนี้ถูกใช้โดยนักศึกษาคนอื่นหรือไม่
      const taken = await prisma.student.findFirst({
        where: { studentId: data.studentId, NOT: { userId } }
      });
      if (taken) {
        return res.status(409).json({ ok: false, message: "รหัสนักศึกษานี้ถูกใช้งานแล้ว กรุณาตรวจสอบอีกครั้ง" });
      }
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
        prefix: data.prefix === '' ? null : data.prefix,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameEn: data.firstNameEn,
        lastNameEn: data.lastNameEn,
        year: data.year,
        major: data.major || null,
        curriculum: data.curriculum,
        studyProgram: data.studyProgram === '' ? null : data.studyProgram,
        phone: data.phone,
        email: data.email,
        advisorName: data.advisorName,
        jobPosition: data.jobPosition,
        coopAdvisorId: data.coopAdvisorId !== undefined ? (data.coopAdvisorId ? Number(data.coopAdvisorId) : null) : undefined,
        gpa: data.gpa !== undefined ? parseFloat(data.gpa) : undefined,
        coreGpa: data.coreGpa !== undefined ? parseFloat(data.coreGpa) : undefined,
        activityUnit: data.activityUnit !== undefined ? parseInt(data.activityUnit) : undefined,
        isPassPrepCourse: data.isPassPrepCourse !== undefined ? (data.isPassPrepCourse === true || data.isPassPrepCourse === 'true') : undefined,
        isQualified: calculatedQualified,
      },
      create: {
        userId: userId,
        studentId: data.studentId || "",
        prefix: data.prefix === '' ? null : data.prefix,
        studyProgram: data.studyProgram === '' ? null : data.studyProgram,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        major: (data.major && data.major !== "") ? data.major : null,
        gpa: gpa,
        coreGpa: coreGpa,
        activityUnit: activityUnit,
        advisorName: data.advisorName,
        jobPosition: data.jobPosition,
        coopAdvisorId: data.coopAdvisorId ? Number(data.coopAdvisorId) : null,
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
      student: student,
      emails: finalEmails,
      company: updatedCoop && updatedCoop.company 
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

// GET /api/students (สำหรับ Admin/Staff) — รองรับ pagination + coopPeriodId filter + search
exports.getStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const coopPeriodId = req.query.coopPeriodId
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;
    const search = (req.query.search || "").trim();

    const conditions = [];
    if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
    if (search) {
      conditions.push({
        OR: [
          { studentId: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { user: { email: { contains: search } } },
        ],
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { email: true, username: true } },
          coop: { include: { company: true, mentor: true } },
          documents: true,
        },
        orderBy: { studentId: "asc" },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      data: students,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
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

exports.syncFromReg = async (req, res) => {
  const { kkuUsername, kkuPassword } = req.body;

  if (!kkuUsername || !kkuPassword) {
    return res.status(400).json({ ok: false, message: "กรุณาระบุ KKU Username และ Password" });
  }

  if (!kkuReg.isConfigured()) {
    return res.status(503).json({
      ok: false,
      message: "ฟีเจอร์นี้ยังไม่พร้อมใช้ — รอการตั้งค่า API credentials จาก KKU",
    });
  }

  try {
    const student = await prisma.student.findUnique({ where: { userId: req.userId } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });

    // 1. ดึงข้อมูลพื้นฐาน (syncStudentAll ทำ login 1 ครั้ง แล้วดึงทุกอย่างพร้อมกัน)
    const result = await kkuReg.syncStudentAll(kkuUsername, kkuPassword);
    if (!result.ok) return res.status(401).json(result);

    const updateData = {};

    if (result.info) {
      const info = result.info;
      if (info.first_name_th)   updateData.firstName   = info.first_name_th;
      if (info.last_name_th)    updateData.lastName    = info.last_name_th;
      if (info.first_name_en)   updateData.firstNameEn = info.first_name_en;
      if (info.last_name_en)    updateData.lastNameEn  = info.last_name_en;
      if (info.faculty_name_th) updateData.curriculum  = info.faculty_name_th;
      if (info.major_name_th)   updateData.major       = info.major_name_th;
      if (info.class_year)      updateData.year        = String(info.class_year);
      if (info.prefix_th)       updateData.prefix      = info.prefix_th;
      if (info.activity_credit != null) updateData.activityUnit = parseFloat(info.activity_credit) || 0;
    }

    if (result.grades) {
      const g = result.grades;
      // คืนแค่ gpax รวม — ไม่มี gpax_core ใน KKU API (คำนวณเองจาก coreCourses)
      if (g.gpax != null) updateData.gpa = parseFloat(g.gpax) || 0;
    }

    if (result.advisor) {
      const adv = result.advisor;
      const name = [adv.prefix_th, adv.first_name_th, adv.last_name_th].filter(Boolean).join(" ");
      if (name) updateData.advisorName = name;
    }

    // 2. ดึงประวัติเกรดทุกวิชา (reuse token จาก syncStudentAll — ไม่ต้อง login ซ้ำ)
    const gradeList = result._token
      ? await kkuReg.getGradeList(result._token, result.grades)
      : null;

    // 3. โหลด CoopCriteria ของสาขานักศึกษา
    const major = updateData.major || student.major;
    const criteria = major
      ? await prisma.coopCriteria.findUnique({ where: { major } })
      : null;

    // 4. ตรวจสอบเงื่อนไขรายวิชา + คำนวณ coreGpa
    if (gradeList && criteria) {
      const eligibility = checkEligibility(gradeList, criteria);
      updateData.isPassPrepCourse = eligibility.isPassPrepCourse;

      // coreGpa คำนวณจาก coreCourses ที่กำหนด (แทน gpax_core ที่ไม่มีใน API)
      if (eligibility.calculatedCoreGpa > 0) {
        updateData.coreGpa = eligibility.calculatedCoreGpa;
      }

      // isQualified = ผ่านทุกเงื่อนไข: วิชา + GPA + coreGpa + กิจกรรม
      const currentGpa = updateData.gpa ?? student.gpa ?? 0;
      const currentCoreGpa = updateData.coreGpa ?? student.coreGpa ?? 0;
      const currentActivityUnit = updateData.activityUnit ?? student.activityUnit ?? 0;

      updateData.isQualified =
        eligibility.isQualified &&
        currentGpa >= (criteria.minGpa || 0) &&
        currentCoreGpa >= (criteria.minCoreGpa || 0) &&
        currentActivityUnit >= (criteria.minActivityUnit || 0);
    }

    updateData.apiSyncedAt = new Date();

    if (Object.keys(updateData).length > 0) {
      await prisma.student.update({ where: { id: student.id }, data: updateData });
    }

    res.json({
      ok: true,
      message: `ซิงค์ข้อมูลจาก KKU สำเร็จ (อัปเดต ${Object.keys(updateData).length} ฟิลด์)`,
      updated: Object.keys(updateData),
      image: result.image || null,
    });
  } catch (err) {
    console.error("[syncFromReg]", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};

