const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supervisionController = require('../controllers/supervisionController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

const ADMIN_ROLES = ['admin', 'staff'];

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
const upload = multer({ storage: storage });


// ================= ROUTE สำหรับ ADMIN =================
router.get('/admin/supervision-periods', verifyToken, verifyRole(...ADMIN_ROLES), supervisionController.getSupervisionPeriods);
router.post('/admin/supervision-periods', verifyToken, verifyRole(...ADMIN_ROLES), supervisionController.saveSupervisionPeriod);
router.get('/admin/supervisions', verifyToken, verifyRole(...ADMIN_ROLES), supervisionController.getAllSupervisions);
router.put('/admin/supervisions/:id/confirmed-date', verifyToken, verifyRole(...ADMIN_ROLES), supervisionController.updateConfirmedDate);
router.post('/admin/supervisions/:id/upload-letter', verifyToken, verifyRole(...ADMIN_ROLES), upload.single('file'), supervisionController.uploadOfficialLetter);


// NOTE: Student supervision routes (/coop/supervision/me, /coop/supervision/propose)
// ถูกย้ายไปอยู่ใน coopRoutes.js แล้ว เพื่อหลีกเลี่ยง routing ambiguity

// ================= ROUTE สำหรับ TEACHER =================
router.put('/teacher/supervisions/:id/review', verifyToken, supervisionController.reviewSupervision);
router.get('/teacher/supervisions', verifyToken, supervisionController.getTeacherSupervisions);

module.exports = router;