// backend/routes/coopRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");
const coopController = require("../controllers/coopController");
const supervisionController = require("../controllers/supervisionController");
const configController = require("../controllers/configController");

// POST /api/coop/apply
router.post(
  "/apply",
  verifyToken,
  coopController.upload.array("files"),
  coopController.submitCoopApplication
);

router.delete("/documents/:id", verifyToken, coopController.deleteDocument);
router.put("/status", verifyToken, verifyRole('staff', 'teacher'), coopController.updateCoopStatus);

// Student supervision routes — วางไว้ใน coopRoutes เพื่อหลีกเลี่ยง routing ambiguity
router.get("/supervision/me", verifyToken, supervisionController.getStudentSupervision);
router.post("/supervision/propose", verifyToken, verifyRole('student'), supervisionController.proposeSupervisionDate);
// ปฏิทินนิเทศ (ทุก role เข้าถึงได้)
router.get("/supervision/calendar", verifyToken, supervisionController.getSupervisionCalendar);

// Gateway display config — readable by all authenticated users (students included)
router.get("/config/gateway", verifyToken, configController.getGatewaySettings);

// Doc requirements — read-only, accessible by all authenticated users (students need this for S_Docs)
const docReqController = require("../controllers/docRequirementController");
router.get("/doc-requirements", verifyToken, docReqController.getRequirements);

module.exports = router;