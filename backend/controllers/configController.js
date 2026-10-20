// backend/controllers/configController.js
const prisma = require('../config/prismaClient');
const path = require('path');
const fs = require('fs');
const { getEvalConfig, CONFIG_KEY: SUPERVISION_EVAL_KEY } = require('../utils/supervisionEval');

exports.getEvaluationConfig = async (req, res) => {
    try {
        // นักศึกษาได้ค่าของหลักสูตรตัวเอง · บทบาทอื่นได้ค่ากลาง
        const config = await readEffective('EVALUATION_FORMS', await callerMajor(req));
        if (config) {
            return res.json({ ok: true, config });
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
// กำหนดส่ง (YYYY-MM-DD) — ว่าง = ไม่มีกำหนดส่ง · undefined = รูปแบบผิด
function parseDeadline(v) {
    if (v === undefined || v === null || v === '') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : undefined;
}

exports.updateEvaluationConfig = async (req, res) => {
    try {
        // รับค่ามาจากหน้า A_DocT005_006
        const { instructionText, ccEmails, t005Link, t006Link, templateLink } = req.body;
        const deadline = parseDeadline(req.body.deadline);
        if (deadline === undefined) return res.status(400).json({ ok: false, message: 'กำหนดส่งต้องเป็นวันที่ (YYYY-MM-DD)' });

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
            deadline,
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
        const config = await readEffective('CONFIG_T007', await callerMajor(req));

        if (config) {
            return res.json({ ok: true, config });
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
        const deadline = parseDeadline(req.body.deadline);
        if (deadline === undefined) return res.status(400).json({ ok: false, message: 'กำหนดส่งต้องเป็นวันที่ (YYYY-MM-DD)' });
        const payload = { instructionText, t007Link: safeUrl(t007Link) || null, deadline };

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
// แบบประเมินการนิเทศ (สำหรับอาจารย์ผู้นิเทศ) — ลิงก์เดียว + โหมดส่งเอง/อัตโนมัติ
// ==========================================
exports.getSupervisionEvalConfig = async (req, res) => {
    try {
        res.json({ ok: true, config: await getEvalConfig() });
    } catch (err) {
        console.error("Error getting supervision eval config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

exports.updateSupervisionEvalConfig = async (req, res) => {
    try {
        const { instructionText, evalLink, autoSend } = req.body;
        if (evalLink && !safeUrl(evalLink)) {
            return res.status(400).json({ ok: false, message: 'ลิงก์แบบประเมินต้องเป็น URL แบบ http/https เท่านั้น' });
        }
        const payload = {
            instructionText: typeof instructionText === 'string' ? instructionText.slice(0, 2000) : '',
            evalLink: safeUrl(evalLink) || null,
            autoSend: autoSend === true,
        };
        await prisma.systemConfig.upsert({
            where: { key: SUPERVISION_EVAL_KEY },
            update: { value: JSON.stringify(payload) },
            create: { key: SUPERVISION_EVAL_KEY, value: JSON.stringify(payload) }
        });
        res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว", config: payload });
    } catch (err) {
        console.error("Error updating supervision eval config:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};

// ==========================================
// 1. ดึงข้อมูล T008
// ==========================================
exports.getT008Config = async (req, res) => {
    try {
        const config = await readEffective('CONFIG_T008', await callerMajor(req));

        if (config) {
            return res.json({ ok: true, config });
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
        const deadline = parseDeadline(req.body.deadline);
        if (deadline === undefined) {
            if (req.file) { try { fs.unlinkSync(path.join(__dirname, '../uploads/system', req.file.filename)); } catch(_){} }
            return res.status(400).json({ ok: false, message: 'กำหนดส่งต้องเป็นวันที่ (YYYY-MM-DD)' });
        }

        let imagePath = existingImage || null;
        if (req.file) {
            imagePath = req.file.filename;
        }

        let oldImagePath = null;
        const payload = { instructionText, driveLink: safeUrl(driveLink) || null, imagePath, deadline };

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
// Gateway Settings — ข้อความและลิงก์ใน S_Gateway
// ==========================================
// ค่าเริ่มต้นฟอร์มคำร้อง — อยู่ใน utils/majorConfig.js (หน้าตั้งค่าแยกหลักสูตรใช้ร่วม)
const { GATEWAY_DEFAULTS, readEffective, callerMajor } = require('../utils/majorConfig');

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
        // ค่าเริ่มต้น + ค่ากลาง + ค่าเฉพาะหลักสูตรของนักศึกษา (ค่าที่เสียอ่านไม่ได้ → ใช้ค่าเริ่มต้น)
        const data = { ...GATEWAY_DEFAULTS, ...((await readEffective('GATEWAY_SETTINGS', await callerMajor(req))) || {}) };
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