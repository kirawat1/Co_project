// backend/controllers/coopController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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
const submitCoopApplication = async (req, res) => {
  try {
    const userId = req.user.id;
    // ✅ 1. เปลี่ยนมารับค่า jobPosition ตามที่ Frontend ส่งมา
    const { jobPosition } = req.body; 
    const files = req.files || [];

    // หา Student ID
    const student = await prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลนักศึกษา" });
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

      // 2.2 อัปเดตสถานะใน StudentCoop เป็น APPLYING พร้อมบันทึก Job Position
      await tx.studentCoop.upsert({
        where: { studentId: student.id },
        update: {
          status: "APPLYING", 
          jobPosition: jobPosition, // ✅ 2. บันทึกลักษณะงานลงไปในการ Update
        },
        create: {
          studentId: student.id,
          status: "APPLYING",
          jobPosition: jobPosition, // ✅ 3. บันทึกลักษณะงานลงไปในการ Create (เผื่อเพิ่งเคยยื่นครั้งแรก)
        },
      });
    });

    res.json({ ok: true, message: "ยื่นคำร้องให้อาจารย์ตรวจสอบเรียบร้อยแล้ว" });

  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
};

const updateCoopStatus = async (req, res) => {
  try {
    const { studentId, status, comment } = req.body;

    // 1. แปลงค่า Status จาก Frontend ให้ตรงกับ Database Enum
    let dbStatus = status;
    
    if (status === 'APPROVED') {
      dbStatus = 'QUALIFIED'; // ✅ APPROVED -> QUALIFIED
    } else if (status === 'REJECTED') {
      dbStatus = 'QUALIFICATION_FAILED'; // ✅ REJECTED -> QUALIFICATION_FAILED
    } else if (status === 'EDITS_REQUIRED') {
      dbStatus = 'EDITS_REQUIRED'; // อันนี้ตรงกันอยู่แล้ว
    }

    // 2. อัปเดตข้อมูล (แก้ชื่อฟิลด์ teacherComment -> teacherCheckComment)
    const updated = await prisma.studentCoop.update({
      where: {
        studentId: parseInt(studentId) // มั่นใจว่าเป็น Int
      },
      data: {
        status: dbStatus, // ใช้ค่าที่แปลงแล้ว
        teacherCheckComment: comment, // ✅ แก้ชื่อฟิลด์ให้ตรง Schema
        teacherCheckDate: new Date()  // (Optional) บันทึกวันที่ตรวจสอบด้วยก็ดีครับ
      }
    });

    res.json({ ok: true, message: "บันทึกสถานะเรียบร้อยแล้ว", data: updated });

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