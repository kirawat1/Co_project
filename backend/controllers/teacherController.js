const prisma = require("../config/prismaClient");
const { createNotifications } = require('../utils/notificationHelper');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

// ✅ 1. getProfile: เลียนแบบ logic ของ Student
exports.getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    // หา Teacher พร้อมดึง email จากตาราง User
    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId },
      include: { 
        user: { select: { email: true } } 
      }
    });

    // กรณี: เข้าใช้งานครั้งแรก (ยังไม่มีข้อมูลในตาราง Teacher)
    if (!teacher) {
      // ดึง Email จากตาราง User มาเพื่อแสดงผล
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { email: true }
      });

      // ส่งค่าว่างกลับไป (Default Value) เหมือนของ Student
      return res.json({
        firstName: "",
        lastName: "",
        phone: "",
        faculty: "",
        major: null,
        email: user ? user.email : "", // ส่ง email ของ user กลับไป
        isFirstTime: true // ตัวช่วยบอก frontend
      });
    }

    // กรณี: มีข้อมูลแล้ว
    res.json({
      ...teacher,
      email: teacher.user ? teacher.user.email : "",
    });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ 2. updateProfile: แก้ไข Upsert ให้ถูกต้อง (แก้ Error ก่อนหน้า)
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, faculty, major, prefix } = req.body;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;

    // 1. ดึง Email ของ User ปัจจุบันก่อน (จำเป็นสำหรับ create ใน Prisma schema ของคุณ)
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
    });

    if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
    }

    // 2. ใช้ Upsert (Update หรือ Insert)
    const updated = await prisma.teacher.upsert({
      where: { 
        userId: userId 
      },
      // กรณีมีข้อมูลอยู่แล้ว -> อัปเดตข้อมูลทั่วไป
      update: {
        firstName,
        lastName,
        phone,
        faculty,
        major,
        prefix: prefix || null,
      },
      // กรณีไม่มีข้อมูล (สร้างใหม่) -> ต้องใส่ฟิลด์ Required ให้ครบ
      create: {
        firstName,
        lastName,
        phone,
        faculty,
        major,
        prefix: prefix || null,
        email: currentUser.email, // ✅ ใส่ email ที่ดึงมา
        user: {                   
            connect: { id: userId } // ✅ เชื่อม Relation แบบที่ถูกต้อง
        }
      },
      include: {
        user: { select: { email: true } }
      }
    });

    // จัดรูปแบบข้อมูลส่งกลับ
    const result = {
      ...updated,
      email: updated.user ? updated.user.email : ""
    };

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ ok: false, message: "Update failed" });
  }
};

// ... (โค้ดเดิม getProfile, updateProfile เก็บไว้เหมือนเดิม ห้ามลบ) ...

// ✅ 2.5 คืน unique prefix ที่มีใน DB สำหรับ dropdown
exports.getTeacherPrefixes = async (req, res) => {
  try {
    const rows = await prisma.teacher.findMany({
      select: { prefix: true },
      where: { prefix: { not: null } },
      distinct: ['prefix'],
      orderBy: { prefix: 'asc' },
    });
    const prefixes = rows.map(r => r.prefix).filter(Boolean);
    res.json({ ok: true, prefixes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

// ✅ 3. [ADMIN] ดึงรายชื่ออาจารย์ทั้งหมด
// หมายเหตุ: endpoint นี้เปิดให้ทุก role ที่ login แล้วเรียกได้โดยตั้งใจ — นักศึกษาใช้
// ดึงรายชื่อ+อีเมลอาจารย์ไปแสดงในหน้าเลือกอาจารย์ที่ปรึกษา (S_ProfilePage.tsx)
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { email: true } } // ดึงอีเมลจากตาราง User
      },
      orderBy: { id: 'asc' }
    });

    // Map ข้อมูลจัดรูปแบบให้ Frontend ใช้ง่าย
    const result = teachers.map(t => ({
      ...t,
      email: t.user ? t.user.email : ""
    }));

    res.json(result);
  } catch (err) {
    console.error("GET ALL TEACHERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ 4. [ADMIN] แก้ไขข้อมูลอาจารย์รายคน (แก้ไขโดย ID ของ Teacher)
exports.updateTeacherById = async (req, res) => {
  try {
    const { id } = req.params; // รับ Teacher ID
    const parsedTeacherId = parseInt(id, 10);
    if (isNaN(parsedTeacherId) || parsedTeacherId <= 0)
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const { firstName, lastName, phone, major, prefix, isCoopTeacher } = req.body;

    const updated = await prisma.teacher.update({
      where: { id: parsedTeacherId },
      data: {
        firstName,
        lastName,
        phone,
        major,
        prefix: prefix || null,
        ...(isCoopTeacher !== undefined && { isCoopTeacher: Boolean(isCoopTeacher) }),
      },
      include: {
        user: { select: { email: true } }
      }
    });

    res.json({ ok: true, data: { ...updated, email: updated.user?.email } });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบอาจารย์' });
    console.error("UPDATE TEACHER BY ID ERROR:", err);
    res.status(500).json({ ok: false, message: "Update failed" });
  }
};

// ==========================================
// อาจารย์ตรวจ T003
// ==========================================
exports.reviewT003 = async (req, res) => {
    try {
        const { studentId, status, comment } = req.body;

        if (!studentId) return res.status(400).json({ ok: false, message: "ไม่พบข้อมูล Student ID" });
        const parsedStudentId = parseInt(studentId, 10);
        if (isNaN(parsedStudentId) || parsedStudentId <= 0) return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });

        const T003_ALLOWED = ['T003_APPROVED', 'T003_EDITS_REQUIRED'];
        if (!T003_ALLOWED.includes(status)) {
            return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
        }

        // Ownership: teacher must be the student's assigned advisor
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
        if (!teacher) return res.status(403).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });
        const student = await prisma.student.findUnique({ where: { id: parsedStudentId } });
        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });
        if (student.generalAdvisorId !== teacher.id && student.coopAdvisorId !== teacher.id) {
            return res.status(403).json({ ok: false, message: 'คุณไม่ใช่อาจารย์ที่ปรึกษาของนักศึกษาคนนี้' });
        }

        await prisma.$transaction(async (tx) => {
            const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedStudentId }, select: { status: true } });
            if (!coop || coop.status !== 'T003_SUBMITTED') {
                throw Object.assign(new Error('สามารถตรวจสอบ T003 ได้เฉพาะเมื่อสถานะเป็น T003_SUBMITTED เท่านั้น'), { is400: true });
            }

            // 1. อัปเดตสถานะในตาราง studentCoop
            await tx.studentCoop.update({
                where: { studentId: parsedStudentId },
                data: { status: status }
            });

            // 2. ค้นหาไฟล์ T003 ล่าสุดเพื่ออัปเดตสถานะไฟล์และคอมเมนต์
            const doc = await tx.document.findFirst({
                where: { studentId: parsedStudentId, type: 'T003_FORM' },
                orderBy: { id: 'desc' }
            });

            if (doc) {
                await tx.document.update({
                    where: { id: doc.id },
                    data: {
                        status: status === 'T003_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                        rejectReason: comment || null
                    }
                });
            }
        });

        res.json({ ok: true, message: "บันทึกผลตรวจสอบ T003 สำเร็จ" });

        // Notify student
        prisma.student.findUnique({ where: { id: parsedStudentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'T003_REVIEWED',
                title: 'T003 ได้รับการตรวจสอบ',
                message: status === 'T003_EDITS_REQUIRED'
                  ? 'T003 ของคุณต้องแก้ไข กรุณาตรวจสอบความคิดเห็น'
                  : 'T003 ของคุณผ่านการตรวจสอบ ✅',
                link: '/student/docs-t003',
                relatedId: String(studentId),
              });
            }
          }).catch(console.error);
    } catch (err) {
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error("Teacher Review T003 Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
};

exports.reviewT002 = async (req, res) => {
    try {
        const { studentId, status, comment } = req.body;

        if (!studentId) return res.status(400).json({ ok: false, message: "ไม่พบข้อมูล Student ID" });
        const parsedStudentId = parseInt(studentId, 10);
        if (isNaN(parsedStudentId) || parsedStudentId <= 0) return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });

        const T002_ALLOWED = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED'];
        if (!T002_ALLOWED.includes(status)) {
            return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
        }

        // Ownership: teacher must be the student's assigned advisor
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
        if (!teacher) return res.status(403).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });
        const student = await prisma.student.findUnique({ where: { id: parsedStudentId } });
        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'ไม่พบนักศึกษา' });
        if (student.generalAdvisorId !== teacher.id && student.coopAdvisorId !== teacher.id) {
            return res.status(403).json({ ok: false, message: 'คุณไม่ใช่อาจารย์ที่ปรึกษาของนักศึกษาคนนี้' });
        }

        await prisma.$transaction(async (tx) => {
            const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedStudentId }, select: { status: true } });
            if (!coop || coop.status !== 'T002_SUBMITTED') {
                throw Object.assign(new Error('สามารถตรวจสอบ T002 ได้เฉพาะเมื่อสถานะเป็น T002_SUBMITTED เท่านั้น'), { is400: true });
            }

            // 1. อัปเดตสถานะนักศึกษา
            await tx.studentCoop.update({
                where: { studentId: parsedStudentId },
                data: { status: status }
            });

            // 2. อัปเดตสถานะไฟล์ T002
            const doc = await tx.document.findFirst({
                where: { studentId: parsedStudentId, type: 'T002_FORM' },
                orderBy: { id: 'desc' }
            });

            if (doc) {
                await tx.document.update({
                    where: { id: doc.id },
                    data: {
                        status: status === 'T002_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                        rejectReason: comment || null
                    }
                });
            }
        });

        res.json({ ok: true, message: "บันทึกผลการตรวจสอบสำเร็จ" });

        // Notify student
        prisma.student.findUnique({ where: { id: parsedStudentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'T002_REVIEWED',
                title: 'T002 ได้รับการตรวจสอบ',
                message: status === 'T002_EDITS_REQUIRED'
                  ? 'T002 ของคุณต้องแก้ไข กรุณาตรวจสอบความคิดเห็น'
                  : 'T002 ของคุณผ่านการตรวจสอบ ✅',
                link: '/student/docs-t002',
                relatedId: String(studentId),
              });
            }
          }).catch(console.error);
    } catch (err) {
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error("Teacher Review T002 Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
};

exports.getAdviseesForReview = async (req, res) => {
    try {
        const userId = req.user.id;

        // หาข้อมูลอาจารย์จาก userId ที่ล็อกอิน
        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) }
        });

        if (!teacher) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
        }

        // ดึงเฉพาะนักศึกษาที่มีอาจารย์คนนี้เป็นที่ปรึกษา (ทั้ง generalAdvisor และ coopAdvisor)
        const students = await prisma.student.findMany({
            where: { deletedAt: null, OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }] },
            include: {
                coop: {
                    include: { company: true }
                },
                documents: true // ดึงประวัติไฟล์แนบมาหา T002, T003
            }
        });

        res.json({ ok: true, data: students });
    } catch (err) {
        console.error("Get Advisees Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลนักศึกษาได้" });
    }
};
// ==========================================
// 1. ดึงสถิติ Dashboard ของอาจารย์
// ==========================================
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { semester, year } = req.query;

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) }
        });

        // คืนค่าศูนย์แทน 404 เมื่อยังไม่มีข้อมูล Teacher (ป้องกัน 404 Error บน frontend)
        if (!teacher) {
            return res.json({ ok: true, data: { myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0 } });
        }

        // แปลง semester ให้เป็นตัวเลข (Int) ตาม Schema
        const semesterInt = semester ? parseInt(semester, 10) : undefined;
        if (semesterInt !== undefined && (isNaN(semesterInt) || semesterInt <= 0))
            return res.status(400).json({ ok: false, message: 'semester ไม่ถูกต้อง' });
        const yearStr = year ? String(year) : undefined;

        // ใช้ FK (generalAdvisorId / coopAdvisorId) แบบเดียวกับ getMyStudents
        // เพื่อไม่ให้ตัวเลขในแดชบอร์ดไม่ตรงกับรายชื่อ นศ. ในดูแลจริง
        // (อาจารย์ผู้ประสานงานสหกิจ isCoopTeacher เห็นทุกคน เหมือน getMyStudents)
        const advisorFilter = teacher.isCoopTeacher
            ? { deletedAt: null }
            : { deletedAt: null, OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }] };

        // 1. นับนักศึกษาทั้งหมดในดูแล
        let myStudentsCount = 0;
        if (semesterInt && yearStr) {
            // ถ้าเลือกเทอม: นับจากใบสมัครของเทอมนั้น
            myStudentsCount = await prisma.studentCoop.count({
                where: {
                    student: advisorFilter,
                    coopPeriod: { semester: semesterInt, academicYear: yearStr }
                }
            });
        } else {
            // ถ้าไม่เลือกเทอม: นับ นศ. ทั้งหมดในดูแล
            myStudentsCount = await prisma.student.count({
                where: advisorFilter
            });
        }

        // 2. คำร้องรอพิจารณา (Schema ใช้ APPLYING)
        const pendingRequests = await prisma.studentCoop.count({
            where: {
                student: advisorFilter,
                status: 'APPLYING', // 🟢 ปรับให้ตรงกับ Enum ของคุณ
                ...(semesterInt && yearStr ? {
                    coopPeriod: { semester: semesterInt, academicYear: yearStr }
                } : {})
            }
        });

        // 3. ผ่านคุณสมบัติ (Schema ใช้ QUALIFIED)
        const approvedStudents = await prisma.studentCoop.count({
            where: {
                student: advisorFilter,
                status: 'QUALIFIED', // 🟢 ปรับให้ตรงกับ Enum ของคุณ
                ...(semesterInt && yearStr ? {
                    coopPeriod: { semester: semesterInt, academicYear: yearStr }
                } : {})
            }
        });

        res.json({
            ok: true,
            data: { myStudentsCount, pendingRequests, approvedStudents }
        });

    } catch (err) {
        console.error("Get Teacher Stats Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการดึงสถิติ" });
    }
};

// ==========================================
// 2. ดึงคำร้องล่าสุดของนักศึกษา
// ==========================================
exports.getLatestRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { semester, year } = req.query;

        const teacher = await prisma.teacher.findUnique({ where: { userId: parseInt(userId) } });
        if (!teacher) return res.json({ ok: true, students: [] });

        const semesterInt = semester ? parseInt(semester, 10) : undefined;
        if (semesterInt !== undefined && (isNaN(semesterInt) || semesterInt <= 0))
            return res.status(400).json({ ok: false, message: 'semester ไม่ถูกต้อง' });
        const yearStr = year ? String(year) : undefined;

        // ดึงจากตาราง StudentCoop ตรงๆ จะได้ไม่ติด Error เรื่อง Relation
        const studentCoops = await prisma.studentCoop.findMany({
            where: {
                student: { deletedAt: null, OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }] },
                status: { not: 'NOT_SUBMITTED' }, // เอาคนที่ยื่นแล้ว
                ...(semesterInt && yearStr ? {
                    coopPeriod: { semester: semesterInt, academicYear: yearStr }
                } : {})
            },
            include: {
                student: true,
                company: true
            },
            orderBy: { updatedAt: 'desc' },
            take: 10
        });

        // Map โครงสร้างกลับไปให้ Frontend แบบเนียนๆ โดยแปลงสถานะให้ Frontend เข้าใจ
        const students = studentCoops.map(sc => {
            const { student, company, ...coopData } = sc;
            
            // แปลงสถานะกลับเป็นคำที่ Frontend เข้าใจ (APPLYING -> submitted)
            let mappedStatus = coopData.status;
            if (mappedStatus === 'APPLYING') mappedStatus = 'submitted';
            if (mappedStatus === 'QUALIFIED') mappedStatus = 'approved';
            if (mappedStatus === 'QUALIFICATION_FAILED') mappedStatus = 'rejected';

            return {
                ...student,
                coop: {
                    ...coopData,
                    status: mappedStatus, // ส่งสถานะที่แปลแล้วกลับไป
                    company: company
                }
            };
        });

        res.json({ ok: true, students });
    } catch (err) {
        console.error("Get Latest Requests Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการดึงคำร้อง" });
    }
};
// ==========================================
// ADMIN: สร้างอาจารย์ใหม่ + User account
// POST /api/admin/teachers
// ==========================================
const bcrypt = require("bcryptjs");

exports.createTeacher = async (req, res) => {
  try {
    const { validatePassword } = require('../utils/validatePassword');
    const { firstName, lastName, email, phone, major, prefix, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ ok: false, message: "กรุณากรอก ชื่อ นามสกุล อีเมล และรหัสผ่าน" });
    }
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ ok: false, message: pwError });

    const hashed = await bcrypt.hash(password, 10);

    let teacher;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { OR: [{ username: email }, { email }] } });
      if (existing) throw Object.assign(new Error(`อีเมล ${email} มีในระบบแล้ว`), { is409: true });
      const user = await tx.user.create({
        data: { username: email, email, password: hashed, role: "teacher" },
      });
      teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          email,
          phone: phone || null,
          faculty: 'วิทยาลัยการคอมพิวเตอร์',
          major: major || null,
          prefix: prefix || null,
        },
      });
    });

    res.json({ ok: true, teacher });
  } catch (err) {
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
    console.error("CREATE TEACHER ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// ==========================================
// ADMIN: ลบอาจารย์ + User account
// DELETE /api/admin/teachers/:id
// ==========================================
exports.deleteTeacher = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);
    if (isNaN(teacherId) || teacherId <= 0)
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) return res.status(404).json({ ok: false, message: "ไม่พบอาจารย์" });

    const [apptCount, visitCount] = await Promise.all([
      prisma.supervisionAppointment.count({ where: { teacherId } }),
      prisma.visit.count({ where: { teacherId } }),
    ]);
    if (apptCount > 0 || visitCount > 0) {
      return res.status(409).json({
        ok: false,
        message: `ไม่สามารถลบอาจารย์ได้ เนื่องจากมีนัดหมายนิเทศ ${apptCount} รายการ หรือการนิเทศ ${visitCount} รายการ ผูกกับอาจารย์คนนี้อยู่ กรุณามอบหมายอาจารย์อื่นหรือยกเลิกรายการดังกล่าวก่อน`,
      });
    }

    // ต้องลบ Teacher ก่อน User เสมอ เพราะ Teacher.userId อ้างถึง User.id (ลบ User ก่อนจะติด FK constraint)
    await prisma.$transaction([
      prisma.student.updateMany({ where: { generalAdvisorId: teacherId }, data: { generalAdvisorId: null, advisorName: null } }),
      prisma.student.updateMany({ where: { coopAdvisorId: teacherId }, data: { coopAdvisorId: null, advisorName: null } }),
      prisma.teacher.delete({ where: { id: teacherId } }),
      prisma.user.delete({ where: { id: teacher.userId } }),
    ]);
    res.json({ ok: true, message: "ลบอาจารย์เรียบร้อย" });
  } catch (err) {
    console.error("DELETE TEACHER ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการลบอาจารย์" });
  }
};

// ==========================================
// ADMIN: รีเซ็ตรหัสผ่านอาจารย์
// PUT /api/admin/teachers/:id/password
// ==========================================
exports.resetTeacherPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0)
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const { newPassword } = req.body;
    const { validatePassword } = require('../utils/validatePassword');
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ ok: false, message: pwError });
    const teacher = await prisma.teacher.findUnique({ where: { id: parsedId } });
    if (!teacher) return res.status(404).json({ ok: false, message: "ไม่พบอาจารย์" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: teacher.userId }, data: { password: hashed } });
    res.json({ ok: true, message: "รีเซ็ตรหัสผ่านเรียบร้อย" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// ==========================================
// ADMIN: แก้ไขข้อมูลอาจารย์ (รวม email)
// PUT /api/admin/teachers/:id
// ==========================================
exports.adminUpdateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0)
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const { firstName, lastName, email, phone, major, prefix, isCoopTeacher } = req.body;

    const teacher = await prisma.teacher.findUnique({ where: { id: parsedId } });
    if (!teacher) return res.status(404).json({ ok: false, message: "ไม่พบอาจารย์" });

    let updated;
    await prisma.$transaction(async (tx) => {
      if (email && email !== teacher.email) {
        const conflict = await tx.user.findFirst({
          where: { OR: [{ email }, { username: email }], NOT: { id: teacher.userId } },
        });
        if (conflict) throw Object.assign(new Error(`อีเมล ${email} มีในระบบแล้ว`), { is409: true });
      }
      updated = await tx.teacher.update({
        where: { id: parsedId },
        data: {
          firstName, lastName, email, phone, major,
          prefix: prefix || null,
          ...(isCoopTeacher !== undefined && { isCoopTeacher: Boolean(isCoopTeacher) }),
        },
      });
      if (email) {
        await tx.user.update({ where: { id: teacher.userId }, data: { email, username: email } });
      }
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    if (err.is409) return res.status(409).json({ ok: false, message: err.message });
    console.error("ADMIN UPDATE TEACHER ERROR:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// GET /api/teacher/my-students
exports.getMyStudents = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      select: { id: true, isCoopTeacher: true },
    });

    if (!teacher) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const coopPeriodId = req.query.coopPeriodId ? parseInt(req.query.coopPeriodId) : undefined;
    if (coopPeriodId !== undefined && isNaN(coopPeriodId))
      return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });

    const baseWhere = {
      deletedAt: null,
      ...(search && {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { studentId: { contains: search } },
        ],
      }),
      ...(coopPeriodId && { coop: { coopPeriodId } }),
    };

    // อาจารย์ปกติ — เฉพาะ advisees ของตัวเอง
    const where = teacher.isCoopTeacher
      ? baseWhere
      : {
          AND: [
            baseWhere,
            {
              OR: [
                { generalAdvisorId: teacher.id },
                { coopAdvisorId: teacher.id },
              ],
            },
          ],
        };

    const include = {
      user: { select: { email: true } },
      coop: { include: { company: true } },
      generalAdvisor: { select: { prefix: true, firstName: true, lastName: true, email: true } },
      coopAdvisor: { select: { prefix: true, firstName: true, lastName: true, email: true } },
      coopApplicationForm: { select: { gradeSheetUrl: true } },
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({ where, include, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.student.count({ where }),
    ]);

    res.json({
      ok: true,
      data: students,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[getMyStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// GET /api/teacher/students/export
exports.exportMyStudents = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      select: { id: true, isCoopTeacher: true },
    });

    if (!teacher) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
    }

    const coopPeriodId = req.query.coopPeriodId && req.query.coopPeriodId !== 'all'
      ? parseInt(req.query.coopPeriodId, 10)
      : undefined;
    if (coopPeriodId !== undefined && isNaN(coopPeriodId))
      return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });

    const advisorFilter = { OR: [{ generalAdvisorId: teacher.id }, { coopAdvisorId: teacher.id }] };
    const periodFilter = coopPeriodId ? { coop: { coopPeriodId } } : null;
    const deletedFilter = { deletedAt: null };

    let where;
    if (teacher.isCoopTeacher) {
      where = periodFilter ? { AND: [deletedFilter, periodFilter] } : deletedFilter;
    } else {
      where = periodFilter
        ? { AND: [deletedFilter, periodFilter, advisorFilter] }
        : { AND: [deletedFilter, advisorFilter] };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { prefix: true, firstName: true, lastName: true } },
        coopAdvisor: { select: { prefix: true, firstName: true, lastName: true } },
      },
      orderBy: { studentId: 'asc' },
    });

    const buffer = buildStudentExportWorkbook(students);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students_${coopPeriodId || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[exportMyStudents]', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};
