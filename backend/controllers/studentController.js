// backend/controllers/studentController.js
const prisma = require('../config/prismaClient');
const kkuReg = require('../services/kkuRegService');
const { buildStudentExportWorkbook, STUDENT_EXPORT_INCLUDE } = require('../utils/studentExport');
const { defaultStudentPassword, hashDefaultStudentPassword } = require('../utils/studentPassword');
const { changeUserEmail, normalizeEmail } = require('../utils/userEmail');
const { removeUnreferencedUploads } = require('../utils/uploadCleanup');
const { resolveMajorNameTh } = require('../utils/majorName');

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
            mentors: true,
          },
        },
        coopApplicationForm: true,
        documents: true,
        user: { select: { email: true } },
        t002Form: true, // เพิ่มการดึงข้อมูลฟอร์ม T002
        t003Form: true, // เพิ่มการดึงข้อมูลฟอร์ม T003
        generalAdvisor: { select: { prefix: true, firstName: true, lastName: true, email: true } },
        coopAdvisor: { select: { prefix: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (student?.deletedAt) {
      return res.status(403).json({ ok: false, message: 'บัญชีถูกระงับการใช้งาน' });
    }

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
        activityUnit: 0,
        advisorName: "",
        jobPosition: "",
        emails: [],
        userEmail: user ? user.email : "",
        company: undefined,
        documents: [],
      });
    }

    // major เป็นรหัสสาขา (CS) — เอกสาร PDF ของนักศึกษา (T000/T003/หนังสือยินยอมผู้ปกครอง) ต้องพิมพ์ชื่อไทย
    const criteria = student.major
      ? await prisma.coopCriteria.findMany({ select: { major: true, nameTh: true } })
      : [];

    // ✅ แก้ไข: เช็คให้ชัวร์ว่า student.coop.company มีค่าจริง ป้องกัน Error กระจายค่า null
    res.json({
      ...student,
      majorNameTh: resolveMajorNameTh(student.major, criteria),
      company: (student.coop && student.coop.company)
        ? { ...student.coop.company, mentors: student.coop.mentors } // เดิมใช้ mentor (เอกพจน์) ซึ่งไม่มีอยู่จริง — เป็น mentors อาเรย์ เพราะเลือกพี่เลี้ยงได้หลายคน
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
    }

    const currentStudent = await prisma.student.findUnique({
      where: { userId: userId }
    });

    if (currentStudent?.deletedAt) {
      return res.status(403).json({ ok: false, message: "บัญชีถูกระงับการใช้งาน" });
    }

    // ระบบไม่ใช้ GPA แล้ว — ไม่รับ/ไม่บันทึก gpa (คอลัมน์ยังอยู่ใน DB แต่ไม่มีที่ใช้)
    // ช่องว่าง ("" หรือ null) = ไม่กรอก ไม่ใช่ค่าที่ผิด
    const activityUnitProvided = data.activityUnit !== undefined && data.activityUnit !== null && data.activityUnit !== '';
    const activityUnit = activityUnitProvided ? parseInt(data.activityUnit) : (currentStudent?.activityUnit || 0);
    if (activityUnitProvided && isNaN(activityUnit))
      return res.status(400).json({ ok: false, message: 'activityUnit ไม่ถูกต้อง' });
    if (data.coopAdvisorId !== undefined && data.coopAdvisorId !== null && data.coopAdvisorId !== '' && isNaN(Number(data.coopAdvisorId)))
      return res.status(400).json({ ok: false, message: 'coopAdvisorId ไม่ถูกต้อง' });
    if (data.generalAdvisorId !== undefined && data.generalAdvisorId !== null && data.generalAdvisorId !== '' && isNaN(Number(data.generalAdvisorId)))
      return res.status(400).json({ ok: false, message: 'generalAdvisorId ไม่ถูกต้อง' });

    let student;
    let updatedCoop = null;

    await prisma.$transaction(async (tx) => {
      const currentCheck = await tx.student.findUnique({ where: { userId }, select: { deletedAt: true } });
      if (currentCheck?.deletedAt) throw Object.assign(new Error('บัญชีถูกระงับการใช้งาน'), { is403: true });
      if (data.studentId) {
        const taken = await tx.student.findFirst({
          where: { studentId: data.studentId, NOT: { userId }, deletedAt: null }
        });
        if (taken) throw Object.assign(new Error("รหัสนักศึกษานี้ถูกใช้งานแล้ว กรุณาตรวจสอบอีกครั้ง"), { is409: true });
      }

      // generalAdvisorId/coopAdvisorId เป็น FK จริงที่ทั้งระบบใช้ (dashboard, advisee list, นัดนิเทศ) —
      // advisorName เป็นแค่ข้อความที่ derive มาจาก generalAdvisorId เสมอ ห้ามรับ advisorName ดิบๆ จาก client
      // (เดิม endpoint นี้รับ advisorName ตรงๆ จาก client แต่ไม่เคยอัปเดต generalAdvisorId เลย ทำให้ข้อความกับ FK ไม่ตรงกัน
      //  — นักศึกษาเปลี่ยนที่ปรึกษาทั่วไปที่หน้าโปรไฟล์ตัวเอง ข้อความเปลี่ยนแต่ FK ไม่เปลี่ยนตาม)
      const advisorData = {};
      if (data.generalAdvisorId !== undefined) {
        if (!data.generalAdvisorId) {
          advisorData.generalAdvisorId = null;
          advisorData.advisorName = null;
        } else {
          const advisor = await tx.teacher.findUnique({ where: { id: Number(data.generalAdvisorId) } });
          if (!advisor) throw Object.assign(new Error("ไม่พบอาจารย์ที่ปรึกษาทั่วไปที่เลือก"), { is400: true });
          advisorData.generalAdvisorId = advisor.id;
          advisorData.advisorName = `${advisor.prefix || ""}${advisor.firstName} ${advisor.lastName}`.trim();
        }
      }
      if (data.coopAdvisorId !== undefined) {
        if (!data.coopAdvisorId) {
          advisorData.coopAdvisorId = null;
        } else {
          const advisor = await tx.teacher.findUnique({ where: { id: Number(data.coopAdvisorId) } });
          if (!advisor) throw Object.assign(new Error("ไม่พบอาจารย์ที่ปรึกษาโครงงานสหกิจที่เลือก"), { is400: true });
          advisorData.coopAdvisorId = advisor.id;
        }
      }

      student = await tx.student.upsert({
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
          jobPosition: data.jobPosition,
          ...advisorData,
          activityUnit: activityUnitProvided ? activityUnit : undefined,
        },
        create: {
          userId: userId,
          studentId: data.studentId || "",
          prefix: data.prefix === '' ? null : data.prefix,
          studyProgram: data.studyProgram === '' ? null : data.studyProgram,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          major: (data.major && data.major !== "") ? data.major : null,
          activityUnit: activityUnit,
          jobPosition: data.jobPosition,
          ...advisorData,
        },
      });

      if (data.emails && Array.isArray(data.emails)) {
        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validEmails = data.emails.filter(e => e.email && EMAIL_RE.test(e.email.trim()));
        await tx.studentEmail.deleteMany({ where: { studentId: student.id } });
        if (validEmails.length > 0) {
          await tx.studentEmail.createMany({
            data: validEmails.map(e => ({
              email: e.email,
              primary: e.primary || false,
              studentId: student.id,
            })),
          });
        }
      }

      // ==========================================
      // 3. จัดการสถานะการฝึกงาน (StudentCoop Table)
      // ==========================================
      // เช็คจาก 'undefined' แทนการเช็ค truthy value
      // เพื่อให้ทำงานได้แม้มีการส่ง { companyId: null } มาก็ตาม
      if (data.companyId !== undefined) {
        const mentorConnect = Array.isArray(data.mentorIds) && data.mentorIds.length > 0
          ? { set: data.mentorIds.map(id => ({ id })) }
          : { set: [] };
        updatedCoop = await tx.studentCoop.upsert({
          where: { studentId: student.id },
          update: {
            companyId: data.companyId,
            mentors: mentorConnect,
          },
          create: {
            studentId: student.id,
            companyId: data.companyId,
            mentors: { connect: Array.isArray(data.mentorIds) ? data.mentorIds.map(id => ({ id })) : [] },
            status: "NOT_SUBMITTED",
          },
          include: {
            company: { include: { mentors: true } },
            mentors: true,
          },
        });
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const finalEmails = await prisma.studentEmail.findMany({ where: { studentId: student.id } });

    res.json({
      ok: true,
      student: student,
      emails: finalEmails,
      company: updatedCoop && updatedCoop.company
                 ? { ...updatedCoop.company, mentors: updatedCoop.mentors } // เดิมใช้ mentor (เอกพจน์) ซึ่งไม่มีอยู่จริง — เป็น mentors อาเรย์ เพราะเลือกพี่เลี้ยงได้หลายคน
                 : null,
      userEmail: user ? user.email : "",
    });

  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    if (err.is403) return res.status(403).json({ ok: false, message: err.message });
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
    console.error("Update Error:", err);
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('studentId')) {
         return res.status(409).json({ ok: false, message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" });
      }
      return res.status(409).json({ ok: false, message: "ข้อมูลบางอย่างซ้ำกับในระบบ" });
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
    if (coopPeriodId !== undefined && isNaN(coopPeriodId))
      return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });
    const search = (req.query.search || "").trim();
    const statuses = req.query.statuses ? req.query.statuses.split(',').filter(Boolean) : [];
    const studyPrograms = req.query.studyProgram ? req.query.studyProgram.split(',').filter(Boolean) : [];
    // สาขา: รหัสสาขา (CS,AI) · __NONE__ = นักศึกษาที่ยังไม่ระบุสาขา
    const majors = req.query.majors ? String(req.query.majors).split(',').map(s => s.trim()).filter(Boolean) : [];

    const ALLOWED_SORT = ['studentId', 'firstName', 'lastName', 'studyProgram'];
    const sortBy = ALLOWED_SORT.includes(req.query.sortBy) ? req.query.sortBy : 'studentId';
    const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';

    const conditions = [{ deletedAt: null }];
    if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
    if (statuses.length > 0) conditions.push({ coop: { status: { in: statuses } } });
    if (studyPrograms.length > 0) conditions.push({ studyProgram: { in: studyPrograms } });
    if (majors.length > 0) {
      const codes = majors.filter(m => m !== '__NONE__');
      // ข้อมูลเก่าบางคนเก็บเป็นชื่อไทยของสาขา (เช่น "วิทยาการคอมพิวเตอร์") แทนรหัส — นับรวมด้วย
      if (codes.length > 0) {
        const criteria = await prisma.coopCriteria.findMany({ where: { major: { in: codes } }, select: { nameTh: true } });
        for (const c of criteria || []) if (c.nameTh && !codes.includes(c.nameTh)) codes.push(c.nameTh);
      }
      const majorOr = codes.length > 0 ? [{ major: { in: codes } }] : [];
      if (majors.includes('__NONE__')) majorOr.push({ major: null }, { major: '' });
      conditions.push({ OR: majorOr });
    }
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

    // Scope to advisees when caller is a teacher (non-coop-teacher sees only own students)
    if (req.user?.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.userId },
        select: { id: true, isCoopTeacher: true },
      });
      if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });
      if (!teacher.isCoopTeacher) {
        // เห็นเฉพาะนักศึกษาที่ตนเป็นอาจารย์ที่ปรึกษาโครงงานสหกิจ (coopAdvisorId, นักศึกษาเลือกเอง)
        // ที่ปรึกษาทั่วไป (generalAdvisorId) เป็นแค่ข้อมูลอ้างอิง ไม่มีสิทธิ์ในระบบสหกิจ
        conditions.push({ coopAdvisorId: teacher.id });
      }
    }

    const where = { AND: conditions };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { email: true, username: true } },
          coop: { include: { company: true, mentors: true, coopPeriod: { select: { semester: true, academicYear: true } } } },
          documents: true,
          coopApplicationForm: { select: { gradeSheetUrl: true } },
          // หน้าดูข้อมูลนักศึกษา (admin/students) — ที่ปรึกษา + การนิเทศ
          generalAdvisor: { select: { id: true, prefix: true, firstName: true, lastName: true } },
          coopAdvisor: { select: { id: true, prefix: true, firstName: true, lastName: true } },
          supervisionAppointment: {
            select: {
              status: true, supervisionType: true, confirmedDate: true, coTeacherName: true,
              teacher: { select: { id: true, prefix: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { [sortBy]: sortDir },
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
    if (coopPeriodId !== undefined && isNaN(coopPeriodId))
      return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });

    const where = coopPeriodId
      ? { deletedAt: null, coop: { coopPeriodId } }
      : { deletedAt: null };

    const [students, criteria] = await Promise.all([
      prisma.student.findMany({ where, include: STUDENT_EXPORT_INCLUDE, orderBy: { studentId: 'asc' } }),
      prisma.coopCriteria.findMany({ select: { major: true, nameTh: true } }),
    ]);

    const buffer = buildStudentExportWorkbook(students, { criteria });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students_${coopPeriodId || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[exportStudents]', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};


// สถานะที่ยังไม่เริ่มฝึกงาน (ก่อน INTERNSHIP_STARTED) ที่อนุญาตให้ดาวน์โหลดหนังสือส่งตัวได้
const PRE_INTERNSHIP_STATUSES = ['PLACEMENT_LETTER_ISSUED'];

exports.downloadPlacementLetter = async (req, res) => {
  try {
    // ต้องหา Student.id จาก User.id ก่อน — สองตาราง มี id คนละ sequence กัน
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });

    const studentId = student.id;

    await prisma.$transaction(async (tx) => {
      const freshCoop = await tx.studentCoop.findUnique({ where: { studentId } });
      if (!freshCoop?.placeLetterUrl || !PRE_INTERNSHIP_STATUSES.includes(freshCoop.status)) {
        throw Object.assign(new Error("ยังไม่สามารถดาวน์โหลดหนังสือส่งตัวได้ในสถานะปัจจุบัน"), { is400: true });
      }
      await tx.studentCoop.update({ where: { studentId }, data: { status: 'INTERNSHIP_STARTED' } });
    });

    res.json({ ok: true });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('downloadPlacementLetter error:', err);
    res.status(500).json({ ok: false });
  }
};

exports.syncFromReg = async (req, res) => {
  const { kkuUsername, kkuPassword } = req.body;

  if (!kkuUsername || !kkuPassword ||
      typeof kkuUsername !== 'string' || typeof kkuPassword !== 'string') {
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
    if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });

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
    if (isNaN(id)) return res.status(400).json({ ok: false, message: "id ไม่ถูกต้อง" });
    let statusErr = null;
    await prisma.$transaction(async (tx) => {
      const s = await tx.student.findUnique({ where: { id } });
      if (!s) { statusErr = { code: 404, msg: "ไม่พบนักศึกษา" }; throw new Error('not-found'); }
      if (s.deletedAt) { statusErr = { code: 409, msg: "นักศึกษาอยู่ในถังขยะแล้ว" }; throw new Error('already-deleted'); }
      await tx.student.update({ where: { id }, data: { deletedAt: new Date() } });
    }).catch((err) => { if (!statusErr) throw err; });
    if (statusErr) return res.status(statusErr.code).json({ ok: false, message: statusErr.msg });
    res.json({ ok: true, message: "ย้ายไปถังขยะเรียบร้อย" });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });
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
    if (isNaN(id)) return res.status(400).json({ ok: false, message: "id ไม่ถูกต้อง" });
    let statusErr = null;
    await prisma.$transaction(async (tx) => {
      const s = await tx.student.findUnique({ where: { id } });
      if (!s) { statusErr = { code: 404, msg: "ไม่พบนักศึกษา" }; throw new Error('not-found'); }
      if (!s.deletedAt) { statusErr = { code: 409, msg: "นักศึกษาไม่ได้อยู่ในถังขยะ" }; throw new Error('not-in-trash'); }
      await tx.student.update({ where: { id }, data: { deletedAt: null } });
    }).catch((err) => { if (!statusErr) throw err; });
    if (statusErr) return res.status(statusErr.code).json({ ok: false, message: statusErr.msg });
    res.json({ ok: true, message: "กู้คืนเรียบร้อย" });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });
    console.error("RESTORE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// DELETE /api/admin/students/:id/permanent — ลบนักศึกษาถาวร (ต้องอยู่ในถังขยะก่อน)
exports.permanentlyDeleteStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, message: "id ไม่ถูกต้อง" });
    let statusErr = null;
    let files = [];
    let accountKept = null;
    // ลบ Student และ User (บัญชี login) คู่กัน ป้องกัน User เหลือค้างเป็น "ผี" ที่บล็อก username เดิมไว้
    // Guard อยู่ใน transaction เพื่อกันเงื่อนไข TOCTOU (restore concurrently before delete)
    // ข้อมูลที่ผูกกับนักศึกษา (สหกิจ, เอกสาร, T002/T003, นิเทศ, บันทึก, แจ้งเตือน) ลบตาม (onDelete: Cascade)
    // บริษัท/พี่เลี้ยงที่นักศึกษาเคยเพิ่มไม่ถูกลบ — createdById เป็น ON DELETE SET NULL (migration 20260811140435)
    // เดิมบล็อกไว้ถ้านักศึกษาเป็นเจ้าของบริษัท ซึ่งเป็นของจากสมัยที่ FK ยังห้ามลบ ตอนนี้ไม่จำเป็นแล้ว
    await prisma.$transaction(async (tx) => {
      const s = await tx.student.findUnique({
        where: { id },
        include: {
          documents: { select: { path: true } },
          coop: { select: { reqLetterUrl: true, acceptanceFileUrl: true, placeLetterUrl: true } },
          supervisionAppointment: { select: { officialLetterPath: true } },
          user: { select: { role: true, teacher: { select: { id: true } }, staffProfile: { select: { id: true } } } },
        },
      });
      if (!s) { statusErr = { code: 404, msg: "ไม่พบนักศึกษา" }; throw new Error('not-found'); }
      if (!s.deletedAt) { statusErr = { code: 400, msg: "ต้องย้ายไปถังขยะก่อนจึงจะลบถาวรได้" }; throw new Error('not-in-trash'); }
      files = [
        ...(s.documents || []).map((d) => d.path),
        s.coop?.reqLetterUrl, s.coop?.acceptanceFileUrl, s.coop?.placeLetterUrl,
        s.supervisionAppointment?.officialLetterPath,
      ];
      await tx.student.delete({ where: { id } });
      const role = s.user?.role;
      // บัญชีจริงเป็นอาจารย์/เจ้าหน้าที่ แต่มีข้อมูลนักศึกษาผูกอยู่ → ลบเฉพาะข้อมูลนักศึกษา เก็บบัญชีไว้
      if (role === 'teacher' || role === 'staff') {
        accountKept = role === 'teacher' ? 'อาจารย์' : 'เจ้าหน้าที่';
        return;
      }
      // บัญชีนักศึกษาที่มีข้อมูลอาจารย์ค้างอยู่ (Teacher.userId เป็น RESTRICT ลบบัญชีจะติด P2003 → เดิมได้ 500)
      // ลบข้อมูลอาจารย์ตามไปด้วยแบบเดียวกับตอนลบอาจารย์ — ยกเว้นยังเป็นอาจารย์นิเทศในนัดหมาย/การนิเทศของคนอื่น
      const strayTeacherId = s.user?.teacher?.id;
      if (strayTeacherId) {
        const [apptCount, visitCount] = await Promise.all([
          tx.supervisionAppointment.count({ where: { teacherId: strayTeacherId } }),
          tx.visit.count({ where: { teacherId: strayTeacherId } }),
        ]);
        if (apptCount > 0 || visitCount > 0) {
          statusErr = {
            code: 409,
            msg: `ลบไม่ได้ เพราะบัญชีนี้มีข้อมูลอาจารย์ผูกอยู่ด้วย และยังเป็นอาจารย์นิเทศในนัดหมายนิเทศ ${apptCount} รายการ การนิเทศ ${visitCount} รายการ — กรุณาเปลี่ยนอาจารย์นิเทศหรือลบรายการดังกล่าวก่อน`,
          };
          throw new Error('stray-teacher-in-use'); // rollback — ข้อมูลนักศึกษายังอยู่ครบ
        }
        await tx.student.updateMany({ where: { generalAdvisorId: strayTeacherId }, data: { generalAdvisorId: null, advisorName: null } });
        await tx.student.updateMany({ where: { coopAdvisorId: strayTeacherId }, data: { coopAdvisorId: null, advisorName: null } });
        await tx.teacher.delete({ where: { id: strayTeacherId } });
      }
      await tx.user.delete({ where: { id: s.userId } });
    }).catch((err) => {
      if (statusErr) return;
      if (err.code === 'P2003') {
        statusErr = { code: 409, msg: "ลบไม่ได้ เพราะยังมีข้อมูลอื่นในระบบอ้างถึงบัญชีนี้ — กรุณาติดต่อผู้ดูแลระบบ" };
        console.error("PERMANENTLY DELETE STUDENT FK:", err.meta || err.message);
        return;
      }
      throw err;
    });
    if (statusErr) return res.status(statusErr.code).json({ ok: false, message: statusErr.msg });
    // ลบไฟล์หลัง commit แล้วเท่านั้น — ถ้าลบ DB ไม่สำเร็จ ไฟล์ต้องยังอยู่
    const removedFiles = await removeUnreferencedUploads(files);
    if (accountKept) {
      return res.json({
        ok: true, accountKept: true, removedFiles,
        message: `ลบข้อมูลนักศึกษาถาวรเรียบร้อย — บัญชี login ยังเก็บไว้ เพราะใช้เป็นบัญชี${accountKept}ด้วย`,
      });
    }
    res.json({ ok: true, message: "ลบถาวรเรียบร้อย", removedFiles });
  } catch (err) {
    console.error("PERMANENTLY DELETE STUDENT ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// PUT /api/admin/students/:id — แก้ไขข้อมูลพื้นฐานนักศึกษา (staff/teacher)
exports.updateStudentBasicInfo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, message: "id ไม่ถูกต้อง" });
    const {
      prefix, firstName, lastName, firstNameEn, lastNameEn,
      studentId, major, studyProgram, year, phone, email,
      jobPosition, generalAdvisorId, coopAdvisorId,
    } = req.body;

    const student = await prisma.student.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
    if (!student) return res.status(404).json({ ok: false, message: "ไม่พบนักศึกษา" });
    if (student.deletedAt) return res.status(400).json({ ok: false, message: "ไม่สามารถแก้ไขนักศึกษาที่อยู่ในถังขยะได้" });

    // Integer validation only (sync) — DB lookups happen inside the transaction
    // generalAdvisorId/coopAdvisorId เป็น FK จริงที่ทั้งระบบใช้ (dashboard, advisee list, นัดนิเทศ) —
    // advisorName เป็นแค่ข้อความที่ derive มาจาก generalAdvisorId เสมอ ห้ามรับ advisorName ดิบๆ
    // จาก client แยกต่างหาก เพราะจะทำให้ข้อความกับ FK ไม่ตรงกัน (สาเหตุของบั๊กเดิมที่แก้ไม่ได้จริง)
    if (generalAdvisorId !== undefined && generalAdvisorId) {
      if (!Number.isInteger(Number(generalAdvisorId))) return res.status(400).json({ ok: false, message: "generalAdvisorId ไม่ถูกต้อง" });
    }
    if (coopAdvisorId !== undefined && coopAdvisorId) {
      if (!Number.isInteger(Number(coopAdvisorId))) return res.status(400).json({ ok: false, message: "coopAdvisorId ไม่ถูกต้อง" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // เปลี่ยนอีเมลบัญชี + username (= อีเมล) ตามกัน (ชนกับบัญชีอื่น → 409 และ rollback ทั้งหมด)
      const emailChange = await changeUserEmail(tx, student.userId, email);
      // อีเมลในข้อมูลนักศึกษาเปลี่ยนตามเฉพาะเมื่อเดิมเป็นอีเมลเดียวกับบัญชี (ไม่ทับอีเมลติดต่ออื่นที่กรอกไว้)
      const studentEmailData = emailChange.changed && normalizeEmail(student.email) === normalizeEmail(emailChange.oldEmail)
        ? { email: emailChange.email }
        : {};

      // Advisor lookups inside transaction to prevent TOCTOU (concurrent teacher delete → P2003)
      const advisorData = {};
      if (generalAdvisorId !== undefined) {
        if (!generalAdvisorId) {
          advisorData.generalAdvisorId = null;
          advisorData.advisorName = null;
        } else {
          const advisor = await tx.teacher.findUnique({ where: { id: Number(generalAdvisorId) } });
          if (!advisor) throw Object.assign(new Error("ไม่พบอาจารย์ที่ปรึกษาปกติที่เลือก"), { is400: true });
          advisorData.generalAdvisorId = advisor.id;
          advisorData.advisorName = `${advisor.firstName} ${advisor.lastName}`.trim();
        }
      }
      if (coopAdvisorId !== undefined) {
        if (!coopAdvisorId) {
          advisorData.coopAdvisorId = null;
        } else {
          const advisor = await tx.teacher.findUnique({ where: { id: Number(coopAdvisorId) } });
          if (!advisor) throw Object.assign(new Error("ไม่พบอาจารย์ที่ปรึกษาโครงการที่เลือก"), { is400: true });
          advisorData.coopAdvisorId = advisor.id;
        }
      }

      // Re-check inside transaction to prevent TOCTOU with concurrent softDelete
      const freshCheck = await tx.student.findUnique({ where: { id }, select: { deletedAt: true } });
      if (!freshCheck || freshCheck.deletedAt) {
        throw Object.assign(new Error("ไม่สามารถแก้ไขนักศึกษาที่อยู่ในถังขยะได้"), { is400: true });
      }

      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          // prefix/studyProgram เป็น enum — ค่า '' (ยังไม่เลือก) ต้องแปลงเป็น null ไม่งั้น Prisma ปฏิเสธ
          prefix: prefix === '' ? null : prefix,
          firstName, lastName, firstNameEn, lastNameEn,
          studentId, major,
          studyProgram: studyProgram === '' ? null : studyProgram,
          year, phone,
          jobPosition, ...advisorData, ...studentEmailData,
        },
      });
      return updatedStudent;
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('studentId')) {
        return res.status(409).json({ ok: false, message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว (ซ้ำกับบัญชีอื่น)" });
      }
      return res.status(409).json({ ok: false, message: "ข้อมูลบางอย่างซ้ำกับในระบบ" });
    }
    console.error("UPDATE STUDENT BASIC INFO ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// POST /api/admin/students/create — เพิ่มนักศึกษาทีละคน (staff only)
exports.createStudentSingle = async (req, res) => {
  try {
    const {
      studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
      email, phone, major, studyProgram, year, advisorName,
    } = req.body;

    const missing = ["studentId", "firstName", "lastName", "email"].filter(f => !req.body[f]?.toString().trim());
    if (missing.length) return res.status(400).json({ ok: false, message: `กรุณากรอก: ${missing.join(", ")}` });

    const emailLower = email.trim().toLowerCase();
    if (!/^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i.test(emailLower)) {
      return res.status(400).json({ ok: false, message: "กรุณาใช้อีเมล @kkumail.com หรือ @kku.ac.th" });
    }

    const prefixMap = { นาย: "MR", นางสาว: "MS", mr: "MR", ms: "MS", mrs: "MS" };
    const prefixEnum = prefix ? (prefixMap[prefix.toLowerCase()] || (["MR", "MS"].includes(prefix.toUpperCase()) ? prefix.toUpperCase() : undefined)) : undefined;

    const studyProgramEnum = studyProgram === "special" ? "special" : studyProgram === "normal" ? "normal" : undefined;

    // สาขาวิชาต้องเป็นสาขาที่มีในหน้าจัดการสาขาวิชา (CoopCriteria) และเก็บเป็นรหัสสาขา (เช่น CS)
    // ให้ตรงกันทั้งระบบ — รับชื่อไทยได้ด้วย แล้วแปลงเป็นรหัส แบบเดียวกับตอนนำเข้า Excel
    let majorCode = null;
    const majorInput = major?.toString().trim();
    if (majorInput) {
      const criteria = await prisma.coopCriteria.findFirst({
        where: { OR: [{ major: majorInput }, { nameTh: majorInput }] },
        select: { major: true },
      });
      if (!criteria) {
        return res.status(400).json({ ok: false, message: `ไม่พบสาขาวิชา "${majorInput}" ในระบบ — เพิ่มที่หน้าจัดการสาขาวิชาก่อน` });
      }
      majorCode = criteria.major;
    }

    // รหัสผ่านเริ่มต้น = รหัสนักศึกษา (นักศึกษาไปเปลี่ยนเองทีหลัง)
    const defaultPasswordHash = await hashDefaultStudentPassword(studentId);

    let user;
    await prisma.$transaction(async (tx) => {
      const existEmail = await tx.user.findFirst({ where: { OR: [{ email: emailLower }, { username: emailLower }] } });
      if (existEmail) throw Object.assign(new Error("อีเมลนี้มีในระบบแล้ว"), { is409: true });

      const existId = await tx.student.findFirst({ where: { studentId: studentId.trim(), deletedAt: null } });
      if (existId) throw Object.assign(new Error("รหัสนักศึกษานี้มีในระบบแล้ว"), { is409: true });

      user = await tx.user.create({
        data: {
          username: emailLower, email: emailLower, password: defaultPasswordHash, role: "student", provider: "google",
          student: {
            create: {
              studentId: studentId.trim(),
              prefix: prefixEnum,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              firstNameEn: firstNameEn?.trim() || null,
              lastNameEn: lastNameEn?.trim() || null,
              email: emailLower,
              phone: phone?.trim() || null,
              major: majorCode,
              studyProgram: studyProgramEnum,
              year: year?.toString().trim() || null,
              advisorName: advisorName?.trim() || null,
            },
          },
        },
        include: { student: true },
      });
    });

    res.status(201).json({ ok: true, message: "เพิ่มนักศึกษาเรียบร้อย", data: { id: user.id, email: user.email, studentId: user.student.studentId } });
  } catch (err) {
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
    if (err.code === "P2002") return res.status(409).json({ ok: false, message: "ข้อมูลซ้ำกับในระบบ (รหัสนักศึกษาหรืออีเมล)" });
    console.error("CREATE STUDENT SINGLE ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// PATCH /api/admin/students/:id/reset-password — ตั้งรหัสผ่านกลับเป็นรหัสนักศึกษา (staff only)
// ใช้เมื่อนักศึกษาลืมรหัสผ่าน หรือเจ้าหน้าที่แก้รหัสนักศึกษาแล้วอยากให้รหัสผ่านตามรหัสใหม่
exports.resetStudentPassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });

    const student = await prisma.student.findUnique({
      where: { id },
      select: { userId: true, studentId: true, deletedAt: true },
    });
    if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });

    const password = await hashDefaultStudentPassword(student.studentId);
    if (!password) return res.status(400).json({ ok: false, message: 'นักศึกษาคนนี้ยังไม่มีรหัสนักศึกษา' });

    await prisma.user.update({ where: { id: student.userId }, data: { password } });
    res.json({ ok: true, message: `รีเซ็ตรหัสผ่านเป็น ${defaultStudentPassword(student.studentId)} เรียบร้อย` });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบบัญชีผู้ใช้ของนักศึกษา' });
    console.error("RESET STUDENT PASSWORD ERROR:", err);
    res.status(500).json({ ok: false, message: "รีเซ็ตรหัสผ่านไม่สำเร็จ" });
  }
};

