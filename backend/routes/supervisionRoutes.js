const express = require('express');
const router = express.Router();
const multer = require('multer');
const supervisionController = require('../controllers/supervisionController');
const { verifyToken } = require('../middlewares/authMiddleware');

// --- ตั้งค่าโฟลเดอร์อัปโหลดสำหรับหนังสือนิเทศ ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/supervision/') 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'SUPERVISION_LETTER_' + uniqueSuffix + '.pdf');
    }
});
const upload = multer({ storage: storage });


// ================= ROUTE สำหรับ ADMIN =================
router.get('/admin/supervision-periods', verifyToken, supervisionController.getSupervisionPeriods);
router.post('/admin/supervision-periods', verifyToken, supervisionController.saveSupervisionPeriod);
router.get('/admin/supervisions', verifyToken, supervisionController.getAllSupervisions);
router.post('/admin/supervisions/:id/upload-letter', verifyToken, upload.single('file'), supervisionController.uploadOfficialLetter);


// ================= ROUTE สำหรับ STUDENT =================
router.get('/coop/supervision/me', verifyToken, supervisionController.getStudentSupervision);
router.post('/coop/supervision/propose', verifyToken, supervisionController.proposeSupervisionDate);


// ================= ROUTE สำหรับ TEACHER =================
router.put('/teacher/supervisions/:id/review', verifyToken, supervisionController.reviewSupervision);
router.get('/teacher/supervisions', verifyToken, supervisionController.getTeacherSupervisions);

module.exports = router;