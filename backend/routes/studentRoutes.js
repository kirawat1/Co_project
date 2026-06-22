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
router.get("/me", verifyToken, studentController.getMyProfile);

// อัปเดตข้อมูลโปรไฟล์ตัวเอง
router.put("/me", verifyToken, studentController.updateMyProfile);

// ดึงรายชื่อนักศึกษาทั้งหมด — staff/teacher เท่านั้น (ไม่ใช่นักศึกษาคนอื่นมาดูข้อมูลกัน)
router.get("/", verifyToken, verifyRole('admin', 'staff', 'teacher'), studentController.getStudents);

// ✅ Route สำหรับกดดาวน์โหลดหนังสือส่งตัว (ที่เพิ่มใหม่)
router.post('/acknowledge-dispatch', verifyToken, docController.acknowledgeDispatchDownload);
router.post('/download-placement-letter', verifyToken, studentController.downloadPlacementLetter);

router.post("/acknowledge-placement-letter",verifyToken,docController.acknowledgePlacementLetter);

router.get("/coop-periods/active", coopPeriodController.getActivePeriod);
router.get('/coop-periods', verifyToken, coopPeriodController.getAllCoopPeriods);

router.get('/doc-requirements', docReqController.getRequirements);

// ──────────────────────────────────────────
// KKU REG API Integration
// ──────────────────────────────────────────
const kkuReg = require('../services/kkuRegService');

// GET /api/students/reg-status — ตรวจว่า KKU REG API พร้อมใช้ไหม
router.get('/reg-status', verifyToken, (req, res) => {
  res.json({
    ok: true,
    configured: kkuReg.isConfigured(),
    message: kkuReg.isConfigured()
      ? "KKU REG API พร้อมใช้งาน"
      : "ยังไม่ได้ตั้งค่า KKU_REG_CLIENT_ID / KKU_REG_CLIENT_SECRET ใน .env",
  });
});

// POST /api/students/sync-from-reg — sync ข้อมูลทั้งหมดจาก KKU REG
// Body: { kkuUsername, kkuPassword }
router.post('/sync-from-reg', verifyToken, studentController.syncFromReg);

// GET /api/students/reg-semester — ดึงภาคเรียนปัจจุบันจาก KKU REG
router.get('/reg-semester', verifyToken, async (req, res) => {
  if (!kkuReg.isConfigured()) {
    return res.json({ ok: false, message: "ยังไม่ได้ตั้งค่า KKU REG API", data: null });
  }
  const data = await kkuReg.getCurrentSemester();
  res.json({ ok: !!data, data });
});

module.exports = router;