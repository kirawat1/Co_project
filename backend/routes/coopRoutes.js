// backend/routes/coopRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const coopController = require("../controllers/coopController");
const supervisionController = require("../controllers/supervisionController");

// POST /api/coop/apply
router.post(
  "/apply",
  verifyToken,
  coopController.upload.array("files"),
  coopController.submitCoopApplication
);

router.delete("/documents/:id", verifyToken, coopController.deleteDocument);
router.put("/status", verifyToken, coopController.updateCoopStatus);

// Student supervision routes — วางไว้ใน coopRoutes เพื่อหลีกเลี่ยง routing ambiguity
router.get("/supervision/me", verifyToken, supervisionController.getStudentSupervision);
router.post("/supervision/propose", verifyToken, supervisionController.proposeSupervisionDate);
// ปฏิทินนิเทศ (ทุก role เข้าถึงได้)
router.get("/supervision/calendar", verifyToken, supervisionController.getSupervisionCalendar);

module.exports = router;