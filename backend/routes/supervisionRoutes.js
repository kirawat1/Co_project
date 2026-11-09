const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supervisionController = require('../controllers/supervisionController');
const supervisionEvalController = require('../controllers/supervisionEvalController');
const configController = require('../controllers/configController');
const { verifyToken, verifyRole, verifyCoopTeacherOrStaff } = require('../middlewares/authMiddleware');
const { pdfOrImageFileFilter, withContentCheck } = require('../utils/fileFilters');

// --- ตั้งค่าโฟลเดอร์อัปโหลดสำหรับหนังสือนิเทศ ---
const SUPERVISION_UPLOAD_DIR = path.join(__dirname, '../uploads/supervision');
if (!fs.existsSync(SUPERVISION_UPLOAD_DIR)) fs.mkdirSync(SUPERVISION_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, SUPERVISION_UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // นามสกุลจริงของไฟล์ (fileFilter ตรวจแล้วว่าเป็น PDF/รูป) — เดิมตั้ง .pdf ทุกไฟล์ ฉบับลงนามที่เป็นรูปเปิดไม่ได้
        cb(null, 'SUPERVISION_LETTER_' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});
const upload = withContentCheck(multer({ storage, fileFilter: pdfOrImageFileFilter, limits: { fileSize: 50 * 1024 * 1024 } })); // ตรวจเนื้อไฟล์จริงต่อท้าย


// ================= ROUTE สำหรับ ADMIN + อาจารย์ประจำวิชา =================
router.get('/admin/supervision-periods', verifyToken, verifyCoopTeacherOrStaff, supervisionController.getSupervisionPeriods);
router.post('/admin/supervision-periods', verifyToken, verifyCoopTeacherOrStaff, supervisionController.saveSupervisionPeriod);
router.get('/admin/supervisions', verifyToken, verifyCoopTeacherOrStaff, supervisionController.getAllSupervisions);
router.get('/admin/supervisions/export', verifyToken, verifyCoopTeacherOrStaff, supervisionController.exportSupervisionSchedule);
router.put('/admin/supervisions/:id/confirmed-date', verifyToken, verifyCoopTeacherOrStaff, supervisionController.updateConfirmedDate);
// ออกหนังสือขอนิเทศ (ร่าง/ฉบับลงนาม) — เจ้าหน้าที่เท่านั้น อาจารย์ประจำวิชาสหกิจออกหนังสือไม่ได้ (ยังดูไฟล์/จัดการอาจารย์ร่วมได้)
router.post('/admin/supervisions/:id/upload-letter', verifyToken, verifyRole('staff'), upload.single('file'), supervisionController.uploadOfficialLetter);
router.put('/admin/supervisions/:id/letter-pending', verifyToken, verifyRole('staff'), supervisionController.markSupervisionLetterPending);
router.put('/admin/supervisions/:id/complete', verifyToken, verifyCoopTeacherOrStaff, supervisionController.completeSupervision);

// แบบประเมินการนิเทศ (ลิงก์ให้อาจารย์ผู้นิเทศ) — อาจารย์ประจำวิชา/เจ้าหน้าที่
router.get('/admin/supervision-eval/config', verifyToken, verifyCoopTeacherOrStaff, configController.getSupervisionEvalConfig);
router.put('/admin/supervision-eval/config', verifyToken, verifyRole('staff'), configController.updateSupervisionEvalConfig); // ค่ากลาง — ค่าเฉพาะหลักสูตรที่ /admin/major-config
router.get('/admin/supervision-eval', verifyToken, verifyCoopTeacherOrStaff, supervisionEvalController.listEvalAppointments);
router.post('/admin/supervision-eval/send', verifyToken, verifyCoopTeacherOrStaff, supervisionEvalController.sendEval);


// NOTE: Student supervision routes (/coop/supervision/me, /coop/supervision/propose)
// ถูกย้ายไปอยู่ใน coopRoutes.js แล้ว เพื่อหลีกเลี่ยง routing ambiguity

// ================= ROUTE สำหรับ TEACHER =================
// NOTE: GET /teacher/supervisions, PUT /teacher/supervisions/:id/review, and
// PUT /teacher/supervisions/:id/complete are handled by teacherRoutes.js (mounted at /api/teacher)
// and would be shadowed here — removed to avoid dead code.

module.exports = router;