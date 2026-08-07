// backend/controllers/configController.js
const prisma = require('../config/prismaClient');
const path = require('path');
const fs = require('fs');

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

        for (const [field, val] of [['t005Link', t005Link], ['t006Link', t006Link], ['templateLink', templateLink]]) {
            if (val && !safeUrl(val)) {
                return res.status(400).json({ ok: false, message: `${field} ต้องเป็น URL แบบ http/https เท่านั้น` });
            }
        }

        // จับมัดรวมเป็น Object
        const payload = {
            instructionText,
            ccEmails,
            t005Link: safeUrl(t005Link) || null,
            t006Link: safeUrl(t006Link) || null,
            templateLink: safeUrl(templateLink) || null,
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
        if (t007Link && !safeUrl(t007Link)) {
            return res.status(400).json({ ok: false, message: 't007Link ต้องเป็น URL แบบ http/https เท่านั้น' });
        }
        const payload = { instructionText, t007Link: safeUrl(t007Link) || null };

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
        if (driveLink && !safeUrl(driveLink)) {
            if (req.file) { try { fs.unlinkSync(path.join(__dirname, '../uploads/system', req.file.filename)); } catch(_){} }
            return res.status(400).json({ ok: false, message: 'driveLink ต้องเป็น URL แบบ http/https เท่านั้น' });
        }

        let imagePath = existingImage || null;
        if (req.file) {
            imagePath = req.file.filename;
        }

        let oldImagePath = null;
        const payload = { instructionText, driveLink: safeUrl(driveLink) || null, imagePath };

        await prisma.$transaction(async (tx) => {
            if (req.file) {
                const old = await tx.systemConfig.findUnique({ where: { key: 'CONFIG_T008' } });
                if (old) {
                    try { const prev = JSON.parse(old.value); oldImagePath = prev.imagePath || null; } catch (_) {}
                }
            }
            await tx.systemConfig.upsert({
                where: { key: 'CONFIG_T008' },
                update: { value: JSON.stringify(payload) },
                create: { key: 'CONFIG_T008', value: JSON.stringify(payload) }
            });
        });

        res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว", imagePath });

        // ลบรูปเก่าหลัง upsert สำเร็จ
        if (oldImagePath && oldImagePath !== req.file?.filename) {
            const oldPath = path.join(__dirname, '../uploads/system', oldImagePath);
            if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (_) {}
        }
    } catch (err) {
        if (req.file) { try { fs.unlinkSync(path.join(__dirname, '../uploads/system', req.file.filename)); } catch(_){} }
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

// ==========================================
// Gateway Settings — ข้อความและลิงก์ใน S_Gateway
// ==========================================
const GATEWAY_DEFAULTS = {
    gradeSheetDescription: 'กรุณา Make a Copy แบบฟอร์มด้านล่าง กรอกข้อมูลให้ครบ แล้วนำลิงก์ที่แชร์มาใส่ในช่องด้านล่าง',
    gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/1HGWTsoScRc3XU0abUn6J9TgyFksAoi1V/copy',
    gradeSheetLinkText: '📋 Make a Copy แบบฟอร์ม',
    uploadDescription: 'เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)'
};

const ALLOWED_URL_PROTOCOLS = ['https:', 'http:'];
function safeUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
        const u = new URL(raw.trim());
        return ALLOWED_URL_PROTOCOLS.includes(u.protocol) ? raw.trim() : null;
    } catch { return null; }
}

exports.getGatewaySettings = async (req, res) => {
    try {
        const config = await prisma.systemConfig.findUnique({ where: { key: 'GATEWAY_SETTINGS' } });
        let parsed = {};
        if (config) {
            try {
                const p = JSON.parse(config.value);
                if (p && typeof p === 'object' && !Array.isArray(p)) parsed = p;
            } catch { /* corrupted value — fall back to defaults */ }
        }
        const data = { ...GATEWAY_DEFAULTS, ...parsed };
        res.json({ ok: true, data });
    } catch (err) {
        console.error('Error getting gateway settings:', err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

exports.updateGatewaySettings = async (req, res) => {
    try {
        const { gradeSheetDescription, gradeSheetUrl, gradeSheetLinkText, uploadDescription } = req.body;

        // Validate URL protocol to prevent stored XSS via javascript: href
        if (typeof gradeSheetLinkText === 'string' && !gradeSheetLinkText.trim()) {
            return res.status(400).json({ ok: false, message: 'gradeSheetLinkText ต้องไม่ว่างเปล่า' });
        }
        if (gradeSheetUrl) {
            const safe = safeUrl(gradeSheetUrl);
            if (!safe) {
                return res.status(400).json({ ok: false, message: 'gradeSheetUrl ต้องเป็น URL แบบ http/https เท่านั้น' });
            }
        }

        const payload = {
            gradeSheetDescription: typeof gradeSheetDescription === 'string' ? gradeSheetDescription.slice(0, 500) : GATEWAY_DEFAULTS.gradeSheetDescription,
            gradeSheetUrl: safeUrl(gradeSheetUrl) || GATEWAY_DEFAULTS.gradeSheetUrl,
            gradeSheetLinkText: typeof gradeSheetLinkText === 'string' ? gradeSheetLinkText.slice(0, 100) : GATEWAY_DEFAULTS.gradeSheetLinkText,
            uploadDescription: typeof uploadDescription === 'string' ? uploadDescription.slice(0, 300) : GATEWAY_DEFAULTS.uploadDescription,
        };

        await prisma.systemConfig.upsert({
            where: { key: 'GATEWAY_SETTINGS' },
            update: { value: JSON.stringify(payload) },
            create: { key: 'GATEWAY_SETTINGS', value: JSON.stringify(payload) }
        });
        res.json({ ok: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error updating gateway settings:', err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};