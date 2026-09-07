//backend/routes/announcementRoutes.js
const express = require("express");
const controller = require("../controllers/announcementController");
const { verifyToken, verifyCoopTeacherOrStaff } = require("../middlewares/authMiddleware");

const router = express.Router();

// ประกาศเขียนได้โดยเจ้าหน้าที่ และอาจารย์ประจำวิชาสหกิจ (isCoopTeacher) เท่านั้น
router.get("/", controller.getAnnouncements);
router.post("/", verifyToken, verifyCoopTeacherOrStaff, controller.upload.array("attachments"), controller.addOrUpdateAnnouncement);
router.delete("/:id", verifyToken, verifyCoopTeacherOrStaff, controller.deleteAnnouncement);

module.exports = router;
