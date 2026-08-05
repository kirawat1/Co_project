// backend/controllers/coopController.js
const prisma = require('../config/prismaClient');
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
const { autoCloseIfExpired } = require('../utils/coopPeriodHelper');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// 1. ตั้งค่าการเก็บไฟล์ (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อไฟล์: เวลาปัจจุบัน-เลขสุ่ม.นามสกุลเดิม
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, fileFilter: pdfOrImageFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// 2. ฟังก์ชันยื่นคำร้อง (Submit Application)
// 2. ฟังก์ชันยื่นคำร้อง (Submit Application)
const submitCoopApplication = async (req, res) => {
  try {
    const userId = req.user.id;
    // ✅ 1. เพิ่มการรับค่า coopPeriodId ที่ส่งมาจาก Frontend
    const { jobPosition, coopPeriodId, gradeSheetUrl } = req.body;
    const files = req.files || [];

    // เช็คว่ามีข้อมูลรอบรับสมัครส่งมาด้วยหรือไม่
    const parsedPeriodId = Number(coopPeriodId);
    if (!Number.isInteger(parsedPeriodId) || parsedPeriodId <= 0) {
      return res.status(400).json({ ok: false, message: "coopPeriodId ไม่ถูกต้อง กรุณารีเฟรชหน้าเว็บแล้วลองใหม่" });
    }

    // (Option เสริมเพื่อความปลอดภัย) เช็คว่ารอบรับสมัครนี้มีอยู่จริงและยังเปิดอยู่ไหม
    let activePeriod = await prisma.coopPeriod.findUnique({
      where: { id: parsedPeriodId }
    });
    activePeriod = await autoCloseIfExpired(activePeriod);

    if (!activePeriod || !activePeriod.isActive) {
      return res.status(400).json({ ok: false, message: "ไม่สามารถยื่นคำร้องได้ เนื่องจากรอบรับสมัครนี้ถูกปิดไปแล้ว" });
    }

    // หา Student ID
    const student = await prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student || student.deletedAt) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });
    }

    // เตรียมข้อมูลไฟล์ (แก้ชื่อภาษาไทยเพี้ยน)
    const docData = files.map((f) => ({
      name: Buffer.from(f.originalname, "latin1").toString("utf8"), // ชื่อไฟล์เดิม (ไว้อ่าน)
      path: f.filename,                                             // ชื่อไฟล์ในระบบ (ไว้เรียก)
      type: "APPLICATION_DOC",
      studentId: student.id,
    }));

    // ตรวจสอบ gradeSheetUrl — รับเฉพาะ http/https เพื่อป้องกัน javascript: URI injection
    let safeGradeUrl = null;
    if (gradeSheetUrl) {
      try {
        const u = new URL(gradeSheetUrl.trim());
        if (!['https:', 'http:'].includes(u.protocol)) throw new Error('bad protocol');
        safeGradeUrl = gradeSheetUrl.trim();
      } catch {
        return res.status(400).json({ ok: false, message: 'gradeSheetUrl ต้องเป็น URL แบบ http/https เท่านั้น' });
      }
    }

    const REAPPLY_ALLOWED = new Set(['NOT_SUBMITTED', 'APPLYING', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED']);

    // ใช้ Transaction เพื่อความชัวร์ — รวม gradeSheetUrl และตรวจสถานะไว้ใน transaction เดียวกัน
    let reapplyBlocked = false;
    await prisma.$transaction(async (tx) => {
      // 2.0 ตรวจสถานะ inside transaction เพื่อป้องกัน TOCTOU race
      const freshCoop = await tx.studentCoop.findUnique({ where: { studentId: student.id }, select: { status: true } });
      if (freshCoop && !REAPPLY_ALLOWED.has(freshCoop.status)) {
        reapplyBlocked = true;
        return;
      }

      // 2.1 บันทึกไฟล์ลง Table Document
      if (docData.length > 0) {
        await tx.document.createMany({
          data: docData,
        });
      }

      // 2.2 อัปเดตสถานะใน StudentCoop เป็น APPLYING พร้อมบันทึก Job Position และผูก CoopPeriodId
      await tx.studentCoop.upsert({
        where: { studentId: student.id },
        update: {
          status: "APPLYING",
          jobPosition: jobPosition,
          coopPeriodId: parsedPeriodId,
        },
        create: {
          studentId: student.id,
          status: "APPLYING",
          jobPosition: jobPosition,
          coopPeriodId: parsedPeriodId,
        },
      });

      // 2.3 บันทึก gradeSheetUrl ลง CoopApplicationForm (ถ้ามี)
      if (safeGradeUrl) {
        await tx.coopApplicationForm.upsert({
          where: { studentId: student.id },
          update: { gradeSheetUrl: safeGradeUrl },
          create: { studentId: student.id, gradeSheetUrl: safeGradeUrl },
        });
      }
    });

    if (reapplyBlocked) {
      return res.status(409).json({ ok: false, message: "ไม่สามารถยื่นคำร้องใหม่ได้ เนื่องจากกระบวนการสหกิจดำเนินไปแล้ว" });
    }

    res.json({ ok: true, message: "ยื่นคำร้องให้ตรวจสอบเรียบร้อยแล้ว" });

    // Fire notification async without blocking response
    getStaffAndCoopTeacherIds().then(ids =>
      createNotifications(ids, {
        type: 'COOP_APPLICATION_SUBMITTED',
        title: 'นักศึกษายื่นคำร้องสหกิจ',
        message: 'มีนักศึกษายื่น/แก้ไขคำร้องสหกิจศึกษา กรุณาตรวจสอบ',
        link: '/admin/students',
        relatedId: String(userId),
      })
    ).catch(console.error);

  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
};

const updateCoopStatus = async (req, res) => {
  try {
    const { studentId, status, comment } = req.body;

    const parsedId = parseInt(studentId, 10);
    if (!studentId || isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, message: "studentId ไม่ถูกต้อง" });
    }

    const ALLOWED_STATUSES = ['APPROVED', 'REJECTED', 'EDITS_REQUIRED', 'APPLICATION_EDITS_REQUIRED', 'QUALIFIED', 'QUALIFICATION_FAILED'];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, message: "status ไม่ถูกต้อง" });
    }

    // แปลงค่า Status จาก Frontend ให้ตรงกับ Database Enum
    let dbStatus = status;
    if (status === 'APPROVED') dbStatus = 'QUALIFIED';
    else if (status === 'REJECTED') dbStatus = 'QUALIFICATION_FAILED';

    let updated;
    await prisma.$transaction(async (tx) => {
      const studentCheck = await tx.student.findUnique({ where: { id: parsedId }, select: { deletedAt: true } });
      if (!studentCheck || studentCheck.deletedAt) {
        throw Object.assign(new Error('ไม่พบนักศึกษา'), { is404: true });
      }
      const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedId }, select: { status: true } });
      const REVIEWABLE_STATUSES = ['APPLYING', 'WAITING_FOR_STAFF_CHECK'];
      if (!coop || !REVIEWABLE_STATUSES.includes(coop.status)) {
        throw Object.assign(new Error('ไม่สามารถเปลี่ยนสถานะได้ในขั้นตอนนี้'), { is400: true });
      }
      updated = await tx.studentCoop.update({
        where: { studentId: parsedId },
        data: {
          status: dbStatus,
          teacherCheckComment: comment,
          teacherCheckDate: new Date()
        }
      });
    });

    res.json({ ok: true, message: "บันทึกสถานะเรียบร้อยแล้ว", data: updated });

    // Notify student เมื่ออาจารย์เปลี่ยนสถานะ
    const statusMessages = {
      QUALIFIED: 'คำร้องของคุณผ่านการพิจารณา ✅',
      QUALIFICATION_FAILED: 'คำร้องของคุณไม่ผ่านการพิจารณา',
      APPLICATION_EDITS_REQUIRED: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ',
    };
    const msg = statusMessages[dbStatus];
    if (msg) {
      prisma.student.findUnique({ where: { id: parsedId }, select: { userId: true } })
        .then(student => {
          if (student?.userId) {
            return createNotifications([student.userId], {
              type: 'STATUS_UPDATED',
              title: 'สถานะสหกิจศึกษาอัปเดต',
              message: msg,
              link: '/student/status-tracker',
              relatedId: String(parsedId),
            });
          }
        }).catch(console.error);
    }

  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error("Update Status Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกสถานะ" });
  }
};

// backend/controllers/coopController.js

// ... imports (fs, path, prisma) ...

// ✅ ฟังก์ชันลบเอกสาร
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params; // รับ document ID
    const userId = req.user.id; // รับ user ID จาก token เพื่อความปลอดภัย

    const parsedDocId = parseInt(id, 10);
    if (isNaN(parsedDocId) || parsedDocId <= 0) {
      return res.status(400).json({ ok: false, message: 'document id ไม่ถูกต้อง' });
    }

    // 1. หาไฟล์ก่อนว่ามีอยู่จริงไหม และเป็นของนักศึกษาคนนี้จริงไหม
    const doc = await prisma.document.findUnique({
      where: { id: parsedDocId },
      include: { student: { include: { user: true } } }
    });

    if (!doc) return res.status(404).json({ ok: false, message: "ไม่พบไฟล์" });

    if (doc.student.deletedAt) {
        return res.status(403).json({ ok: false, message: "บัญชีถูกระงับการใช้งาน" });
    }

    // เช็คสิทธิ์: ต้องเป็นเจ้าของไฟล์ หรือเป็น Admin/Teacher (ถ้ามี role)
    if (doc.student.userId !== userId) {
        return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบไฟล์นี้" });
    }

    // ป้องกันลบเอกสารที่อยู่ระหว่างการตรวจสอบ
    if (doc.type === 'T002_FORM' || doc.type === 'T003_FORM') {
        const coop = await prisma.studentCoop.findUnique({
            where: { studentId: doc.studentId },
            select: { status: true }
        });
        const LOCKED_BY_T002 = new Set(['T002_SUBMITTED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED', 'INTERNSHIP_STARTED', 'COMPLETED']);
        const LOCKED_BY_T003 = new Set(['T003_SUBMITTED', 'T003_APPROVED', 'INTERNSHIP_STARTED', 'COMPLETED']);
        if (doc.type === 'T002_FORM' && coop && LOCKED_BY_T002.has(coop.status)) {
            return res.status(409).json({ ok: false, message: "ไม่สามารถลบ T002 ที่อยู่ระหว่างการตรวจสอบ" });
        }
        if (doc.type === 'T003_FORM' && coop && LOCKED_BY_T003.has(coop.status)) {
            return res.status(409).json({ ok: false, message: "ไม่สามารถลบ T003 ที่อยู่ระหว่างการตรวจสอบ" });
        }
    }

    // 2. ลบไฟล์ออกจาก Server (ถ้ามี)
    const filePath = path.join(__dirname, '../uploads', doc.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 3. ลบ Record จาก Database
    await prisma.document.delete({ where: { id: parsedDocId } });

    res.json({ ok: true, message: "ลบไฟล์สำเร็จ" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการลบไฟล์" });
  }
};

module.exports = { upload, submitCoopApplication, updateCoopStatus, deleteDocument };