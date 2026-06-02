// controllers/docController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');

// ------------------------------------------------------------------
// ✅ 1. Helper Function: เช็คว่าระบบเปิดรับเอกสารหรือไม่ (แก้ให้เช็คแยก T000, T002, T003)
// ------------------------------------------------------------------
const checkSystemOpen = async (docType) => {
  try {
    let configKey = "T000_CONFIG"; 
    if (docType === 'T002_FORM') configKey = "T002_CONFIG";
    else if (docType === 'T003_FORM') configKey = "T003_CONFIG";

    const config = await prisma.systemConfig.findUnique({
      where: { key: configKey }
    });
    
    if (!config) return true; // ถ้าไม่มี Config ถือว่าเปิด

    const { startDate, endDate, isOpen } = JSON.parse(config.value);

    if (!isOpen) {
        console.log(`❌ [Upload Blocked]: ${configKey} is set to isOpen = false`);
        return false;
    }

    const now = new Date();
    
    // ดัก Error กรณีแอดมินลบวันที่ทิ้ง (เป็นค่าว่าง "")
    if (startDate && startDate.trim() !== "") {
        if (new Date(startDate) > now) {
            console.log(`❌ [Upload Blocked]: ยังไม่ถึงวันเปิดรับ (${startDate})`);
            return false;
        }
    }
    
    if (endDate && endDate.trim() !== "") {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
        if (now > end) {
            console.log(`❌ [Upload Blocked]: เลยเวลาปิดรับแล้ว (${endDate})`);
            return false;
        }
    }

    return true; 
  } catch (err) {
    console.error("Check system error:", err);
    return false; 
  }
};

// Helper: หา Student ID จาก User ID
const getStudentIdFromUser = async (userId) => {
  const student = await prisma.student.findUnique({
    where: { userId: parseInt(userId) }
  });
  if (!student) throw new Error("ไม่พบข้อมูลนักศึกษาสำหรับ User นี้");
  return student.id; 
};

// ==========================================
// 2. บันทึกข้อมูลฟอร์มใบสมัคร
// ==========================================
exports.saveApplicationForm = async (req, res) => {
  try {
    const userId = req.user.id; 
    
    let realStudentId;
    try {
        realStudentId = await getStudentIdFromUser(userId);
    } catch (e) {
        return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา (กรุณาติดต่อ Admin)" });
    }

    const {
      contactAddress, contactPhone, contactEmail,
      emergencyName, emergencyRelation, emergencyJob,
      emergencyWorkplace, emergencyAddress, emergencyPhone, emergencyEmail,
      startDate, endDate, 
      careerObjective1, careerObjective2, careerObjective3 
    } = req.body;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const form = await prisma.coopApplicationForm.upsert({
      where: { studentId: realStudentId }, 
      update: {
        contactAddress, contactPhone, contactEmail,
        emergencyName, emergencyRelation, emergencyJob,
        emergencyWorkplace, emergencyAddress, emergencyPhone, emergencyEmail,
        startDate: start,
        endDate: end,
        careerObjective1, careerObjective2, careerObjective3
      },
      create: {
        studentId: realStudentId, 
        contactAddress, contactPhone, contactEmail,
        emergencyName, emergencyRelation, emergencyJob,
        emergencyWorkplace, emergencyAddress, emergencyPhone, emergencyEmail,
        startDate: start,
        endDate: end,
        careerObjective1, careerObjective2, careerObjective3
      }
    });

    res.json({ ok: true, message: "บันทึกข้อมูลเรียบร้อย", data: form });

  } catch (err) {
    console.error("Save Form Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
};

// ==========================================
// 3. ดึงข้อมูลฟอร์ม
// ==========================================
exports.getMyApplication = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await prisma.student.findUnique({
        where: { userId: parseInt(userId) }
    });

    if (!student) {
        return res.status(404).json({ ok: false, message: "Student Profile not found" });
    }
    
    const form = await prisma.coopApplicationForm.findUnique({
      where: { studentId: student.id } 
    });

    let formattedForm = { ...form };
    if (form) {
        if (form.startDate) formattedForm.startDate = form.startDate.toISOString().split('T')[0];
        if (form.endDate) formattedForm.endDate = form.endDate.toISOString().split('T')[0];
    }

    res.json({ ok: true, form: formattedForm });

  } catch (err) {
    console.error("Get Application Error:", err);
    res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลได้" });
  }
};
// ==========================================
// 4. อัปโหลดเอกสาร (และเปลี่ยนสถานะ)
// ==========================================
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: "กรุณาเลือกไฟล์" });
    
    const { docType } = req.body;

    // เช็คระบบเปิดรับ (ยกเว้นใบตอบรับ ให้ส่งได้ตลอด)
    const isOpen = await checkSystemOpen(docType);
    if (docType !== 'CP-ACCEPTANCE' && !isOpen) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        // 🔴 ถ้าติด 403 ตรงนี้ ให้ลองดูใน Terminal ของ Backend มันจะบอกสาเหตุ
        return res.status(403).json({ ok: false, message: "⛔ ระบบปิดรับเอกสารประเภทนี้แล้ว (หรือเกินกำหนดเวลา)" });
    }

    const userId = req.user.id; 
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const student = await prisma.student.findUnique({
      where: { userId: parseInt(userId) }
    });

    if (!student) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษาในระบบ" });
    }

    const dbType = docType;

    const oldDoc = await prisma.document.findFirst({
        where: { studentId: student.id, type: dbType }
    });
    if (oldDoc) {
        const oldPath = path.join(__dirname, '../uploads', oldDoc.path);
        if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch(e){} }
        await prisma.document.delete({ where: { id: oldDoc.id } });
    }

    const newDoc = await prisma.document.create({
      data: {
        studentId: student.id,
        name: originalName, 
        path: req.file.filename,
        type: dbType, 
        status: 'WAITING',
        rejectReason: null 
      }
    });

    if (dbType === 'CP-ACCEPTANCE') {
        await prisma.studentCoop.upsert({
            where: { studentId: student.id },
            update: { acceptanceFileUrl: req.file.filename, status: 'WAITING_FOR_STAFF_CHECK_LETTER' },
            create: { studentId: student.id, acceptanceFileUrl: req.file.filename, status: 'WAITING_FOR_STAFF_CHECK_LETTER' }
        });
    } else if (dbType === 'T002_FORM') {
        await prisma.studentCoop.upsert({
            where: { studentId: student.id },
            update: { status: 'T002_SUBMITTED' },
            create: { studentId: student.id, status: 'T002_SUBMITTED' }
        });
    } else if (dbType === 'T003_FORM') {
        await prisma.studentCoop.upsert({
            where: { studentId: student.id },
            update: { status: 'T003_SUBMITTED' },
            create: { studentId: student.id, status: 'T003_SUBMITTED' }
        });
    } else {
        const coop = await prisma.studentCoop.findUnique({ where: { studentId: student.id } });
        if (coop && (coop.status === "EDITS_REQUIRED" || coop.status === "APPLICATION_EDITS_REQUIRED")) {
            await prisma.studentCoop.update({
                where: { studentId: student.id },
                data: { status: "WAITING_FOR_STAFF_CHECK" }
            });
        }
    }

    res.json({ ok: true, message: "อัปโหลดสำเร็จ", data: newDoc });

    // Notify staff + isCoopTeacher เมื่อนักศึกษาส่งเอกสาร
    const notifyTypes = {
      'T002_FORM': { type: 'T002_SUBMITTED', title: 'นักศึกษาส่ง T002', message: 'มีนักศึกษาส่งเอกสาร T002 แบบแจ้งรายละเอียดงาน กรุณาตรวจสอบ', link: '/admin/students' },
      'T003_FORM': { type: 'T003_SUBMITTED', title: 'นักศึกษาส่ง T003', message: 'มีนักศึกษาส่งเอกสาร T003 โครงร่างรายงาน กรุณาตรวจสอบ', link: '/admin/students' },
      'CP-ACCEPTANCE': { type: 'ACCEPTANCE_UPLOADED', title: 'นักศึกษาอัปโหลดใบตอบรับ', message: 'มีนักศึกษาอัปโหลดใบตอบรับจากบริษัท กรุณาตรวจสอบ', link: '/admin/students' },
    };
    const notif = notifyTypes[dbType] || (newDoc.status === 'WAITING_FOR_STAFF_CHECK' ? { type: 'T000_SUBMITTED', title: 'นักศึกษาส่งเอกสาร T000', message: 'มีนักศึกษาส่งเอกสาร T000 กรุณาตรวจสอบ', link: '/admin/students' } : null);
    if (notif) {
      getStaffAndCoopTeacherIds().then(ids =>
        createNotifications(ids, { ...notif, relatedId: String(student.userId) })
      ).catch(console.error);
    }

  } catch (err) {
    console.error("Upload Error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการอัปโหลด" });
  }
};

// ==========================================
// (แก้ฟังก์ชันนี้ด้วย เพราะของเดิมมันติด Switch Case อยู่)
// ==========================================
exports.deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // รับ document ID

    const doc = await prisma.document.findUnique({
      where: { id: parseInt(id) },
      include: { student: true } 
    });

    if (!doc) {
      return res.status(404).json({ ok: false, message: "ไม่พบเอกสาร" });
    }

    // Check ownership
    if (doc.student.userId !== userId) {
      return res.status(403).json({ ok: false, message: "ไม่มีสิทธิ์ลบไฟล์นี้" });
    }

    // ลบไฟล์ออกจากโฟลเดอร์
    const filePath = path.join(__dirname, '../uploads', doc.path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) { console.warn("Delete file error:", e); }
    }

    // ลบออกจาก Database
    await prisma.document.delete({
      where: { id: parseInt(id) }
    });

    res.json({ ok: true, message: "ลบเอกสารเรียบร้อยแล้ว" });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการลบไฟล์" });
  }
};

// ==========================================
// 6. รับทราบการดาวน์โหลด (เปลี่ยนสถานะ)
// ==========================================
exports.acknowledgeDispatchDownload = async (req, res) => {
  try {
    const userId = req.user.id;

    // หา Student ID ก่อน
    const student = await prisma.student.findUnique({
        where: { userId: parseInt(userId) }
    });

    if (!student) {
        return res.status(404).json({ message: "Student not found" });
    }

    // อัปเดตสถานะเป็น WAITING_FOR_PLACEMENT_LETTER (รอเอาไปยื่น)
    await prisma.studentCoop.update({
      where: { studentId: student.id },
      data: {
        status: 'WAITING_FOR_PLACEMENT_LETTER' 
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update status failed" });
  }
};

// ==========================================
// 7. รับทราบการดาวน์โหลดหนังสือส่งตัว
// ==========================================
exports.acknowledgePlacementLetter = async (req, res) => {
  
  try {
    const userId = req.user.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    // หา student
    const student = await prisma.student.findUnique({
      where: { userId: parseInt(userId) }
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // อัปเดตสถานะ (เช่น INTERNSHIP_STARTED)
    await prisma.studentCoop.update({
      where: { studentId: student.id },
      data: {
        status
      }
    });

    res.json({
      ok: true,
      newStatus: status
    });
  } catch (err) {
    console.error("acknowledgePlacementLetter error:", err);
    res.status(500).json({ message: "Update placement letter status failed" });
  }
  
};

exports.deleteDocumentByType = async (req, res) => {
  try {
    const userId = req.user.id;
    const { docType } = req.params;

    const student = await prisma.student.findUnique({
      where: { userId: parseInt(userId) }
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // map docType → dbType
    let dbType;
    switch (docType) {
      case 'CP-CV': dbType = 'CV'; break;
      case 'CP-T000': dbType = 'T000_SIGNED'; break;
      case 'CP-TRANSCRIPT': dbType = 'TRANSCRIPT'; break;
      case 'CP-STUDENT_CARD': dbType = 'STUDENT_CARD'; break;
      case 'CP-CITIZEN_CARD': dbType = 'CITIZEN_CARD'; break;
      case 'CP-PARENTAL_CONSENT': dbType = 'PARENTAL_CONSENT'; break;
      default:
        return res.status(400).json({ message: "Invalid docType" });
    }

    const doc = await prisma.document.findFirst({
      where: {
        studentId: student.id,
        type: dbType
      }
    });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // ลบไฟล์
    const filePath = path.join(__dirname, '../uploads', doc.path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.warn("Delete file error:", e); }
    }

    // ลบ DB
    await prisma.document.delete({ where: { id: doc.id } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};

// บันทึกข้อมูลร่าง T003
exports.saveT003Form = async (req, res) => {
    try {
        // หา studentId จาก user id
        const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
        if (!student) return res.status(404).json({ ok: false, message: "Student not found" });

        const { 
            reportTitleTh, reportTitleEn, objectives, expectedOutcomes, 
            significance, references, methodology, scope, otherSuggestions, workPlan 
        } = req.body;

        // อัปเดตหรือสร้างใหม่ (Upsert)
        const t003 = await prisma.coopT003Form.upsert({
            where: { studentId: student.id },
            update: {
                reportTitleTh, reportTitleEn, objectives, expectedOutcomes,
                significance, references, methodology, scope, otherSuggestions,
                workPlan: workPlan // Prisma จะแปลงเป็น JSON ให้อัตโนมัติ
            },
            create: {
                studentId: student.id,
                reportTitleTh, reportTitleEn, objectives, expectedOutcomes,
                significance, references, methodology, scope, otherSuggestions,
                workPlan: workPlan
            }
        });

        res.json({ ok: true, data: t003 });
    } catch (err) {
        console.error("Save T003 Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
};