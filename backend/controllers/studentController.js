// backend/controllers/studentController.js
const prisma = require('../config/prismaClient');
const kkuReg = require('../services/kkuRegService');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

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
        t002Form: true, // เพิ่มการดึงข้อมูลฟอร์ม T002
        t003Form: true, // เพิ่มการดึงข้อมูลฟอร์ม T003
        generalAdvisor: { select: { firstName: true, lastName: true, email: true } },
        coopAdvisor: { select: { firstName: true, lastName: true, email: true } },
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
        studyProgram: null,
        phone: "",
        gpa: 0.0,
        activityUnit: 0,
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

    const gpa = data.gpa !== undefined ? parseFloat(data.gpa) : (currentStudent?.gpa || 0);
    const activityUnit = data.activityUnit !== undefined ? parseInt(data.activityUnit) : (currentStudent?.activityUnit || 0);

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
        studyProgram: data.studyProgram === '' ? null : data.studyProgram,
        phone: data.phone,
        email: data.email,
        advisorName: data.advisorName,
        jobPosition: data.jobPosition,
        coopAdvisorId: data.coopAdvisorId !== undefined ? (data.coopAdvisorId ? Number(data.coopAdvisorId) : null) : undefined,
        gpa: data.gpa !== undefined ? parseFloat(data.gpa) : undefined,
        activityUnit: data.activityUnit !== undefined ? parseInt(data.activityUnit) : undefined,
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
        activityUnit: activityUnit,
        advisorName: data.advisorName,
        jobPosition: data.jobPosition,
        coopAdvisorId: data.coopAdvisorId ? Number(data.coopAdvisorId) : null,
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

    const conditions = [{ deletedAt: null }];
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
    const where = { AND: conditions };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { email: true, username: true } },
          coop: { include: { company: true, mentor: true } },
          documents: true,
          coopApplicationForm: { select: { gradeSheetUrl: true } },
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

// GET /api/admin/students/export — export รายชื่อนักศึกษาเป็น Excel
exports.exportStudents = async (req, res) => {
  try {
    const coopPeriodId = req.query.coopPeriodId && req.query.coopPeriodId !== 'all'
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;

    const where = coopPeriodId
      ? { deletedAt: null, coop: { coopPeriodId } }
      : { deletedAt: null };

    const students = await prisma.student.findMany({
      where,
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { firstName: true, lastName: true } },
        coopAdvisor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { studentId: 'asc' },
    });

    const buffer = buildStudentExportWorkbook(students);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students_${coopPeriodId || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[exportStudents]', err);
    res.status(500).json({ ok: false, message: 'Server error' });
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
      if (info.major_name_th)   updateData.major       = info.major_name_th;
      if (info.class_year)      updateData.year        = String(info.class_year);
      if (info.prefix_th)       updateData.prefix      = info.prefix_th;
      if (info.activity_credit != null) updateData.activityUnit = parseFloat(info.activity_credit) || 0;
    }

    if (result.grades) {
      const g = result.grades;
      // คืนแค่ gpax รวมจาก KKU API
      if (g.gpax != null) updateData.gpa = parseFloat(g.gpax) || 0;
    }

    if (result.advisor) {
      const adv = result.advisor;
      const name = [adv.prefix_th, adv.first_name_th, adv.last_name_th].filter(Boolean).join(" ");
      if (name) updateData.advisorName = name;
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

// DELETE /api/admin/students/:id — ย้ายนักศึกษาไปถังขยะ (soft delete)
exports.softDeleteStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (student.deletedAt) return res.status(404).json({ ok: false, message: "นักศึกษาอยู่ในถังขยะแล้ว" });

    await prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ ok: true, message: "ย้ายไปถังขยะเรียบร้อย" });
  } catch (err) {
    console.error("SOFT DELETE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// GET /api/admin/students/trash — รายชื่อนักศึกษาในถังขยะ
exports.getTrashedStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { deletedAt: { not: null } },
      include: { user: { select: { email: true } } },
      orderBy: { deletedAt: 'desc' },
    });
    res.json({ ok: true, data: students });
  } catch (err) {
    console.error("GET TRASHED STUDENTS ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// POST /api/admin/students/:id/restore — กู้คืนนักศึกษาจากถังขยะ
exports.restoreStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (!student.deletedAt) return res.status(404).json({ ok: false, message: "นักศึกษาไม่ได้อยู่ในถังขยะ" });

    await prisma.student.update({ where: { id }, data: { deletedAt: null } });
    res.json({ ok: true, message: "กู้คืนเรียบร้อย" });
  } catch (err) {
    console.error("RESTORE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// DELETE /api/admin/students/:id/permanent — ลบนักศึกษาถาวร (ต้องอยู่ในถังขยะก่อน)
exports.permanentlyDeleteStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (!student.deletedAt) {
      return res.status(400).json({ ok: false, message: "ต้องย้ายไปถังขยะก่อนจึงจะลบถาวรได้" });
    }

    // ลบ Student และ User (บัญชี login) คู่กัน ป้องกัน User เหลือค้างเป็น "ผี" ที่บล็อก username เดิมไว้
    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id } });
      await tx.user.delete({ where: { id: student.userId } });
    });
    res.json({ ok: true, message: "ลบถาวรเรียบร้อย" });
  } catch (err) {
    console.error("PERMANENTLY DELETE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// PUT /api/admin/students/:id — แก้ไขข้อมูลพื้นฐานนักศึกษา (staff/teacher)
exports.updateStudentBasicInfo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      prefix, firstName, lastName, firstNameEn, lastNameEn,
      studentId, major, studyProgram, year, phone, email,
      advisorName, jobPosition,
    } = req.body;

    const student = await prisma.student.findUnique({ where: { id }, include: { user: true } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });

    if (email && email !== student.user.email) {
      const conflict = await prisma.user.findFirst({
        where: { email, NOT: { id: student.userId } },
      });
      if (conflict) {
        return res.status(409).json({ ok: false, message: `อีเมล ${email} มีในระบบแล้ว` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          prefix, firstName, lastName, firstNameEn, lastNameEn,
          studentId, major, studyProgram, year, phone,
          advisorName, jobPosition,
        },
      });
      if (email && email !== student.user.email) {
        await tx.user.update({ where: { id: student.userId }, data: { email } });
      }
      return updatedStudent;
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('studentId')) {
        return res.status(400).json({ ok: false, message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" });
      }
      return res.status(400).json({ ok: false, message: "ข้อมูลบางอย่างซ้ำกับในระบบ" });
    }
    console.error("UPDATE STUDENT BASIC INFO ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

