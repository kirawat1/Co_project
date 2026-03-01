// backend/routes/coopRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const coopController = require("../controllers/coopController");

// POST /api/coop/apply
router.post(
  "/apply",
  authMiddleware,                 // 1. ตรวจ Login
  coopController.upload.array("files"), // 2. รับไฟล์ (ชื่อ field = files)
  coopController.submitCoopApplication  // 3. ทำงาน Controller
);

router.delete("/documents/:id", authMiddleware, coopController.deleteDocument);
router.put("/status", authMiddleware, coopController.updateCoopStatus);

module.exports = router;