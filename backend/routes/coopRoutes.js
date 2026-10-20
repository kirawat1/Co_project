// backend/routes/coopRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");
const coopController = require("../controllers/coopController");
const supervisionController = require("../controllers/supervisionController");
const configController = require("../controllers/configController");
const criteriaController = require("../controllers/criteriaController");

// GET /api/coop/departments — สาขาวิชาพร้อมชื่อไทย (accessible ทุก role)
router.get("/departments", verifyToken, criteriaController.getDepartmentsWithNames);

// POST /api/coop/apply
router.post(
  "/apply",
  verifyToken,
  verifyRole('student'),
  coopController.upload.array("files"),
  coopController.submitCoopApplication
);

router.delete("/documents/:id", verifyToken, verifyRole('student'), coopController.deleteDocument);
router.put("/status", verifyToken, verifyRole('staff', 'teacher'), coopController.updateCoopStatus);

// Student supervision routes — วางไว้ใน coopRoutes เพื่อหลีกเลี่ยง routing ambiguity
router.get("/supervision/me", verifyToken, verifyRole('student'), supervisionController.getStudentSupervision);
router.post("/supervision/propose", verifyToken, verifyRole('student'), supervisionController.proposeSupervisionDate);
// ปฏิทินนิเทศ (ทุก role เข้าถึงได้)
router.get("/supervision/calendar", verifyToken, supervisionController.getSupervisionCalendar);
router.get("/supervision/company-queue", verifyToken, verifyRole("student"), supervisionController.getCompanySupervisionQueue);

// Gateway display config — readable by all authenticated users (students included)
router.get("/config/gateway", verifyToken, configController.getGatewaySettings);

// กำหนดส่ง/ช่วงรับของนักศึกษา — รูปเดิม แต่คำนวณจากปฏิทินของรอบของนักศึกษา (ปฏิทินของรอบ)
const deadlineConfigController = require("../controllers/deadlineConfigController");
router.get("/config/t000", verifyToken, deadlineConfigController.getT000Config);
router.get("/config/t002", verifyToken, deadlineConfigController.getT002Config);
router.get("/config/apply", verifyToken, deadlineConfigController.getApplyConfig);
router.get("/config/t003", verifyToken, deadlineConfigController.getT003Config);

// T005/T006 evaluation, T007, T008 — ลิงก์แบบฟอร์มเดิม + กำหนดส่งของรอบ
router.get("/config/evaluation", verifyToken, deadlineConfigController.getEvaluationConfig);
router.get("/config/t007", verifyToken, deadlineConfigController.getT007Config);
router.get("/config/t008", verifyToken, deadlineConfigController.getT008Config);

// Doc requirements — read-only, accessible by all authenticated users (students need this for S_Docs)
const docReqController = require("../controllers/docRequirementController");
router.get("/doc-requirements", verifyToken, docReqController.getRequirements);

module.exports = router;