// backend/controllers/configController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. ดึง Config
exports.getDocConfig = async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "T000_CONFIG" }
    });
    // ถ้าไม่มีค่า ให้ return default ปิดระบบไว้ก่อน
    const data = config ? JSON.parse(config.value) : { startDate: null, endDate: null, isOpen: false };
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching config" });
  }
};

// 2. Middleware หรือ Helper สำหรับเช็คว่าอัปโหลดได้ไหม
exports.checkSystemOpen = async () => {
    const config = await prisma.systemConfig.findUnique({ where: { key: "T000_CONFIG" } });
    if (!config) return false;
    
    const { startDate, endDate, isOpen } = JSON.parse(config.value);
    if (!isOpen) return false;

    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && now < start) return false; // ยังไม่ถึงวันเปิด
    if (end && now > end) return false;     // เลยวันปิดแล้ว

    return true;
};

exports.getEvaluationConfig = async (req, res) => {
    try {
        // ค้นหาข้อมูลที่มี key ว่า EVALUATION_FORMS
        const configRecord = await prisma.systemConfig.findUnique({
            where: { key: 'EVALUATION_FORMS' }
        });

        // ถ้ามีข้อมูล ให้แปลงจาก String กลับเป็น JSON Object
        if (configRecord && configRecord.value) {
            return res.json({ ok: true, config: JSON.parse(configRecord.value) });
        } else {
            // ถ้ายังไม่มีข้อมูลในระบบเลย ส่ง null กลับไป (เดี๋ยว Frontend จะใช้ค่า Default เอง)
            return res.json({ ok: true, config: null });
        }
    } catch (err) {
        console.error("Error getting evaluation config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// 2. บันทึก/อัปเดตข้อมูลแบบประเมิน (เฉพาะเจ้าหน้าที่/แอดมินเรียกใช้)
// ==========================================
exports.updateEvaluationConfig = async (req, res) => {
    try {
        // รับค่ามาจากหน้า A_DocT005_006
        const { instructionText, ccEmails, t005Link, t006Link, templateLink } = req.body;
        
        // จับมัดรวมเป็น Object
        const payload = {
            instructionText,
            ccEmails,
            t005Link,
            t006Link,
            templateLink
        };

        // ใช้คำสั่ง upsert (ถ้ามีข้อมูลอยู่แล้วให้อัปเดต ถ้ายังไม่มีให้สร้างใหม่)
        await prisma.systemConfig.upsert({
            where: { key: 'EVALUATION_FORMS' },
            update: { value: JSON.stringify(payload) }, // แปลง JSON เป็น String ก่อนบันทึก
            create: { 
                key: 'EVALUATION_FORMS', 
                value: JSON.stringify(payload) 
            }
        });

        res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" });
    } catch (err) {
        console.error("Error updating evaluation config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};


// ==========================================
// 1. ดึงข้อมูล T007 (นักศึกษา และ เจ้าหน้าที่เรียกใช้)
// ==========================================
exports.getT007Config = async (req, res) => {
    try {
        const configRecord = await prisma.systemConfig.findUnique({
            where: { key: 'CONFIG_T007' }
        });

        if (configRecord && configRecord.value) {
            return res.json({ ok: true, config: JSON.parse(configRecord.value) });
        } else {
            return res.json({ ok: true, config: null });
        }
    } catch (err) {
        console.error("Error getting T007 config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// 2. บันทึกข้อมูล T007 (เฉพาะเจ้าหน้าที่/แอดมิน)
// ==========================================
exports.updateT007Config = async (req, res) => {
    try {
        const { instructionText, t007Link } = req.body;
        const payload = { instructionText, t007Link };

        await prisma.systemConfig.upsert({
            where: { key: 'CONFIG_T007' },
            update: { value: JSON.stringify(payload) },
            create: { key: 'CONFIG_T007', value: JSON.stringify(payload) }
        });

        res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" });
    } catch (err) {
        console.error("Error updating T007 config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// 1. ดึงข้อมูล T008
// ==========================================
exports.getT008Config = async (req, res) => {
    try {
        const configRecord = await prisma.systemConfig.findUnique({
            where: { key: 'CONFIG_T008' }
        });

        if (configRecord && configRecord.value) {
            return res.json({ ok: true, config: JSON.parse(configRecord.value) });
        } else {
            return res.json({ ok: true, config: null });
        }
    } catch (err) {
        console.error("Error getting T008 config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// 2. บันทึกข้อมูล T008 (พร้อมรับไฟล์รูปภาพ)
// ==========================================
exports.updateT008Config = async (req, res) => {
    try {
        const { instructionText, driveLink, existingImage } = req.body;
        
        // ถ้ารูปภาพมีการอัปโหลดเข้ามาใหม่ ให้ใช้ชื่อไฟล์ใหม่ แต่ถ้าไม่มีให้ใช้ชื่อไฟล์เดิม
        let imagePath = existingImage || null;
        if (req.file) {
            imagePath = req.file.filename; // ได้ชื่อไฟล์จาก Middleware systemUpload
        }

        const payload = { instructionText, driveLink, imagePath };

        await prisma.systemConfig.upsert({
            where: { key: 'CONFIG_T008' },
            update: { value: JSON.stringify(payload) },
            create: { key: 'CONFIG_T008', value: JSON.stringify(payload) }
        });

        res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว", imagePath });
    } catch (err) {
        console.error("Error updating T008 config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// จัดการเวลา T002
// ==========================================
exports.getT002Config = async (req, res) => {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: "T002_CONFIG" }
        });
        const data = config ? JSON.parse(config.value) : { startDate: null, endDate: null, isOpen: false };
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: "Error fetching T002 config" });
    }
};

exports.saveT002Config = async (req, res) => {
    try {
        const { startDate, endDate, isOpen } = req.body;
        const payload = { startDate, endDate, isOpen };
        
        await prisma.systemConfig.upsert({
            where: { key: "T002_CONFIG" },
            update: { value: JSON.stringify(payload) },
            create: { key: "T002_CONFIG", value: JSON.stringify(payload) }
        });
        res.json({ ok: true, message: "บันทึกเวลา T002 สำเร็จ" });
    } catch (err) {
        res.status(500).json({ message: "Error saving T002 config" });
    }
};

// ==========================================
// จัดการเวลา T003
// ==========================================
exports.getT003Config = async (req, res) => {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: "T003_CONFIG" }
        });
        const data = config ? JSON.parse(config.value) : { startDate: null, endDate: null, isOpen: false };
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: "Error fetching T003 config" });
    }
};

exports.saveT003Config = async (req, res) => {
    try {
        const { startDate, endDate, isOpen } = req.body;
        const payload = { startDate, endDate, isOpen };
        
        await prisma.systemConfig.upsert({
            where: { key: "T003_CONFIG" },
            update: { value: JSON.stringify(payload) },
            create: { key: "T003_CONFIG", value: JSON.stringify(payload) }
        });
        res.json({ ok: true, message: "บันทึกเวลา T003 สำเร็จ" });
    } catch (err) {
        res.status(500).json({ message: "Error saving T003 config" });
    }
};