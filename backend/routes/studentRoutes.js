// routes/studentRoutes.js
const express = require("express");
const router = express.Router();

// ✅ 1. Import verifyToken ให้ถูกต้อง (ลบ authMiddleware ตัวเก่าออก)
const { verifyToken } = require('../middlewares/authMiddleware');

const studentController = require('../controllers/studentController');
const docController = require('../controllers/docController');
const coopPeriodController = require("../controllers/coopPeriodController");
const docReqController = require('../controllers/docRequirementController');

// --- Routes ---

// ดึงข้อมูลโปรไฟล์ตัวเอง
router.get("/me", verifyToken, studentController.getMyProfile);

// อัปเดตข้อมูลโปรไฟล์ตัวเอง
router.put("/me", verifyToken, studentController.updateMyProfile);

// ดึงรายชื่อนักศึกษา (ถ้ามี)
router.get("/", verifyToken, studentController.getStudents);

// ✅ Route สำหรับกดดาวน์โหลดหนังสือส่งตัว (ที่เพิ่มใหม่)
router.post('/acknowledge-dispatch', verifyToken, docController.acknowledgeDispatchDownload);
router.post('/download-placement-letter', verifyToken, studentController.downloadPlacementLetter);

router.post("/acknowledge-placement-letter",verifyToken,docController.acknowledgePlacementLetter);

router.get("/coop-periods/active", coopPeriodController.getActivePeriod);
router.get('/coop-periods', verifyToken, coopPeriodController.getAllCoopPeriods);

router.get('/doc-requirements', docReqController.getRequirements);


module.exports = router;