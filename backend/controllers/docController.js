const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------
// ✅ 1. Helper Function: เช็คว่าระบบเปิดรับเอกสารหรือไม่
// ------------------------------------------------------------------
const checkSystemOpen = async () => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "T000_CONFIG" }
    });
    
    // ถ้าไม่มี Config ให้ถือว่าปิดระบบ (เพื่อความปลอดภัย)
    if (!config) return false; 

    const { startDate, endDate, isOpen } = JSON.parse(config.value);

    // เช็คสวิตช์เปิด/ปิดหลัก
    if (!isOpen) return false;

    // เช็คช่วงเวลา
    const now = new Date();
    
    // ถ้ามีวันเริ่ม และยังไม่ถึง -> ปิด
    if (startDate && new Date(startDate) > now) return false; 
    
    // ถ้ามีวันจบ และเลยเวลาแล้ว -> ปิด (ให้ส่งได้จนถึง 23:59:59 ของวันจบ)
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
        if (now > end) return false;
    }

    return true; // ผ่านทุกเงื่อนไข -> เปิด
  } catch (err) {
    console.error("Check system error:", err);
    return false; // Error -> ปิดไว้ก่อน
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
    // 1. เช็คไฟล์ก่อน
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาเลือกไฟล์" });
    }
    
    // 2. เช็คระบบเปิดรับ (ยกเว้นใบตอบรับ ให้ส่งได้ตลอด)
    const { docType } = req.body;
    const isOpen = await checkSystemOpen();
    
    if (docType !== 'CP-ACCEPTANCE' && !isOpen) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ ok: false, message: "⛔ ระบบปิดรับเอกสารแล้ว (หรือยังไม่เปิด)" });
    }

    const userId = req.user.id; 
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // 3. ค้นหา Student ID
    const student = await prisma.student.findUnique({
      where: { userId: parseInt(userId) }
    });

    if (!student) {
        fs.unlinkSync(req.file.path); 
        return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษาในระบบ" });
    }

    // 4. Map ประเภทเอกสาร
    let dbType = 'OTHER';
    switch (docType) {
        case 'CP-T000': dbType = 'T000_SIGNED'; break;
        case 'CP-TRANSCRIPT': dbType = 'TRANSCRIPT'; break;
        case 'CP-CV': dbType = 'CV'; break;
        case 'CP-STUDENT_CARD': dbType = 'STUDENT_CARD'; break;
        case 'CP-CITIZEN_CARD': dbType = 'CITIZEN_CARD'; break;
        case 'CP-ACCEPTANCE': dbType = 'ACCEPTANCE_FORM'; break;
        case 'CP-PARENTAL_CONSENT': dbType = 'PARENTAL_CONSENT'; break;
        default: dbType = 'OTHER';
    }

    // (Optional) ลบไฟล์เก่าประเภทเดียวกันทิ้งก่อน
    const oldDoc = await prisma.document.findFirst({
        where: { studentId: student.id, type: dbType }
    });
    if (oldDoc) {
        const oldPath = path.join(__dirname, '../uploads', oldDoc.path);
        if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch(e){} }
        await prisma.document.delete({ where: { id: oldDoc.id } });
    }

    // 5. บันทึกลง Database (Document Table)
    const newDoc = await prisma.document.create({
      data: {
        studentId: student.id,
        name: originalName, 
        path: req.file.filename,
        type: dbType,
        status: 'PENDING'
      }
    });

    // 6. ✅ อัปเดตสถานะ StudentCoop (เฉพาะใบตอบรับ)
    if (dbType === 'ACCEPTANCE_FORM') {
        await prisma.studentCoop.upsert({
            where: { studentId: student.id },
            update: {
                acceptanceFileUrl: req.file.filename,
                // เปลี่ยนสถานะเป็น "รอเจ้าหน้าที่ตรวจใบตอบรับ"
                status: 'WAITING_FOR_STAFF_CHECK_LETTER' 
            },
            create: {
                studentId: student.id,
                acceptanceFileUrl: req.file.filename,
                status: 'WAITING_FOR_STAFF_CHECK_LETTER'
            }
        });
    }

    res.json({ ok: true, message: "อัปโหลดสำเร็จ", data: newDoc });

  } catch (err) {
    console.error("Upload Error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการอัปโหลด" });
  }
};

// ==========================================
// 5. ลบเอกสาร
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

    // 1. ลบไฟล์ออกจากโฟลเดอร์
    const filePath = path.join(__dirname, '../uploads', doc.path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) { console.warn("Delete file error:", e); }
    }

    // 2. ลบออกจาก Database
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
      fs.unlinkSync(filePath);
    }

    // ลบ DB
    await prisma.document.delete({ where: { id: doc.id } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};
