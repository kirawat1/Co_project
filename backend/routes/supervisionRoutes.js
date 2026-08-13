const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supervisionController = require('../controllers/supervisionController');
const { verifyToken, verifyRole, verifyCoopTeacherOrStaff } = require('../middlewares/authMiddleware');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// --- ตั้งค่าโฟลเดอร์อัปโหลดสำหรับหนังสือนิเทศ ---
const SUPERVISION_UPLOAD_DIR = path.join(__dirname, '../uploads/supervision');
if (!fs.existsSync(SUPERVISION_UPLOAD_DIR)) fs.mkdirSync(SUPERVISION_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, SUPERVISION_UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'SUPERVISION_LETTER_' + uniqueSuffix + '.pdf');
    }
});
const upload = multer({ storage, fileFilter: pdfOrImageFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });


// ================= ROUTE สำหรับ ADMIN + อาจารย์ประจำวิชา =================
router.get('/admin/supervision-periods', verifyToken, verifyCoopTeacherOrStaff, supervisionController.getSupervisionPeriods);
router.post('/admin/supervision-periods', verifyToken, verifyCoopTeacherOrStaff, supervisionController.saveSupervisionPeriod);
router.get('/admin/supervisions', verifyToken, verifyCoopTeacherOrStaff, supervisionController.getAllSupervisions);
router.put('/admin/supervisions/:id/confirmed-date', verifyToken, verifyCoopTeacherOrStaff, supervisionController.updateConfirmedDate);
router.post('/admin/supervisions/:id/upload-letter', verifyToken, verifyCoopTeacherOrStaff, upload.single('file'), supervisionController.uploadOfficialLetter);
router.put('/admin/supervisions/:id/complete', verifyToken, verifyCoopTeacherOrStaff, supervisionController.completeSupervision);


// NOTE: Student supervision routes (/coop/supervision/me, /coop/supervision/propose)
// ถูกย้ายไปอยู่ใน coopRoutes.js แล้ว เพื่อหลีกเลี่ยง routing ambiguity

// ================= ROUTE สำหรับ TEACHER =================
// NOTE: GET /teacher/supervisions, PUT /teacher/supervisions/:id/review, and
// PUT /teacher/supervisions/:id/complete are handled by teacherRoutes.js (mounted at /api/teacher)
// and would be shadowed here — removed to avoid dead code.

module.exports = router;