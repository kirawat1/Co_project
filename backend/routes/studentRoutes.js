// routes/studentRoutes.js
const express = require("express");
const router = express.Router();

// ✅ 1. Import verifyToken ให้ถูกต้อง (ลบ authMiddleware ตัวเก่าออก)
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

const studentController = require('../controllers/studentController');
const docController = require('../controllers/docController');
const coopPeriodController = require("../controllers/coopPeriodController");
const docReqController = require('../controllers/docRequirementController');

// --- Routes ---

// ดึงข้อมูลโปรไฟล์ตัวเอง
router.get("/me", verifyToken, verifyRole('student'), studentController.getMyProfile);

// อัปเดตข้อมูลโปรไฟล์ตัวเอง
router.put("/me", verifyToken, verifyRole('student'), studentController.updateMyProfile);

// ดึงรายชื่อนักศึกษาทั้งหมด — staff/teacher เท่านั้น (ไม่ใช่นักศึกษาคนอื่นมาดูข้อมูลกัน)
router.get("/", verifyToken, verifyRole('staff', 'teacher'), studentController.getStudents);

// ✅ Route สำหรับกดดาวน์โหลดหนังสือส่งตัว (ที่เพิ่มใหม่)
router.post('/acknowledge-dispatch', verifyToken, verifyRole('student'), docController.acknowledgeDispatchDownload);
router.post('/download-placement-letter', verifyToken, verifyRole('student'), studentController.downloadPlacementLetter);

router.get("/coop-periods/active", verifyToken, coopPeriodController.getActivePeriod);
router.get('/coop-periods', verifyToken, coopPeriodController.getAllCoopPeriods);

router.get('/doc-requirements', verifyToken, docReqController.getRequirements);

// ──────────────────────────────────────────
// KKU REG API Integration
// ──────────────────────────────────────────
module.exports = router;