// backend/controllers/coopController.js
const prisma = require('../config/prismaClient');
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');

// 1. ตั้งค่าการเก็บไฟล์ (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อไฟล์: เวลาปัจจุบัน-เลขสุ่ม.นามสกุลเดิม
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// 2. ฟังก์ชันยื่นคำร้อง (Submit Application)
// 2. ฟังก์ชันยื่นคำร้อง (Submit Application)
const submitCoopApplication = async (req, res) => {
  try {
    const userId = req.user.id;
    // ✅ 1. เพิ่มการรับค่า coopPeriodId ที่ส่งมาจาก Frontend
    const { jobPosition, coopPeriodId, gradeSheetUrl } = req.body;
    const files = req.files || [];

    // เช็คว่ามีข้อมูลรอบรับสมัครส่งมาด้วยหรือไม่
    if (!coopPeriodId) {
      return res.status(400).json({ ok: false, message: "ไม่พบข้อมูลรอบรับสมัคร กรุณารีเฟรชหน้าเว็บแล้วลองใหม่" });
    }

    // (Option เสริมเพื่อความปลอดภัย) เช็คว่ารอบรับสมัครนี้มีอยู่จริงและยังเปิดอยู่ไหม
    const activePeriod = await prisma.coopPeriod.findUnique({
      where: { id: Number(coopPeriodId) }
    });

    if (!activePeriod || !activePeriod.isActive) {
      return res.status(400).json({ ok: false, message: "ไม่สามารถยื่นคำร้องได้ เนื่องจากรอบรับสมัครนี้ถูกปิดไปแล้ว" });
    }

    // หา Student ID
    const student = await prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });
    }

    // ตรวจสถานะปัจจุบัน — ไม่อนุญาตให้ re-apply หากผ่านขั้นตอนไปแล้ว
    const REAPPLY_ALLOWED = new Set(['NOT_SUBMITTED', 'APPLYING', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED']);
    const existingCoop = await prisma.studentCoop.findUnique({ where: { studentId: student.id }, select: { status: true } });
    if (existingCoop && !REAPPLY_ALLOWED.has(existingCoop.status)) {
      return res.status(409).json({ ok: false, message: "ไม่สามารถยื่นคำร้องใหม่ได้ เนื่องจากกระบวนการสหกิจดำเนินไปแล้ว" });
    }

    // เตรียมข้อมูลไฟล์ (แก้ชื่อภาษาไทยเพี้ยน)
    const docData = files.map((f) => ({
      name: Buffer.from(f.originalname, "latin1").toString("utf8"), // ชื่อไฟล์เดิม (ไว้อ่าน)
      path: f.filename,                                             // ชื่อไฟล์ในระบบ (ไว้เรียก)
      type: "APPLICATION_DOC",
      studentId: student.id,
    }));

    // ใช้ Transaction เพื่อความชัวร์
    await prisma.$transaction(async (tx) => {
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
          coopPeriodId: Number(coopPeriodId), // ✅ บันทึกว่ายื่นในเทอม/ปีไหน (กรณีเคยมี record แล้ว)
        },
        create: {
          studentId: student.id,
          status: "APPLYING",
          jobPosition: jobPosition, 
          coopPeriodId: Number(coopPeriodId), // ✅ บันทึกว่ายื่นในเทอม/ปีไหน (กรณียื่นครั้งแรก)
        },
      });
    });

    // บันทึก gradeSheetUrl ลง CoopApplicationForm (ถ้ามี)
    if (gradeSheetUrl) {
      await prisma.coopApplicationForm.upsert({
        where: { studentId: student.id },
        update: { gradeSheetUrl },
        create: { studentId: student.id, gradeSheetUrl },
      });
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

    const updated = await prisma.studentCoop.update({
      where: {
        studentId: parsedId
      },
      data: {
        status: dbStatus, // ใช้ค่าที่แปลงแล้ว
        teacherCheckComment: comment, // ✅ แก้ชื่อฟิลด์ให้ตรง Schema
        teacherCheckDate: new Date()  // (Optional) บันทึกวันที่ตรวจสอบด้วยก็ดีครับ
      }
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

    // 1. หาไฟล์ก่อนว่ามีอยู่จริงไหม และเป็นของนักศึกษาคนนี้จริงไหม
    const doc = await prisma.document.findUnique({
      where: { id: parseInt(id) },
      include: { student: { include: { user: true } } }
    });

    if (!doc) return res.status(404).json({ ok: false, message: "ไม่พบไฟล์" });
    
    // เช็คสิทธิ์: ต้องเป็นเจ้าของไฟล์ หรือเป็น Admin/Teacher (ถ้ามี role)
    if (doc.student.userId !== userId) {
        return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบไฟล์นี้" });
    }

    // 2. ลบไฟล์ออกจาก Server (ถ้ามี)
    const filePath = path.join("uploads", doc.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 3. ลบ Record จาก Database
    await prisma.document.delete({ where: { id: parseInt(id) } });

    res.json({ ok: true, message: "ลบไฟล์สำเร็จ" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการลบไฟล์" });
  }
};

module.exports = { upload, submitCoopApplication, updateCoopStatus, deleteDocument };