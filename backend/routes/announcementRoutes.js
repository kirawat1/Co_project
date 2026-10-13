//backend/routes/announcementRoutes.js
const express = require("express");
const controller = require("../controllers/announcementController");
const { verifyToken, verifyCoopTeacherOrStaff } = require("../middlewares/authMiddleware");

const router = express.Router();

// ประกาศเขียนได้โดยเจ้าหน้าที่ และอาจารย์ประจำวิชาสหกิจ (isCoopTeacher) เท่านั้น
// อ่านประกาศต้อง login (เดิมเปิดสาธารณะ — หน้าที่ใช้ทุกหน้า login แล้ว)
router.get("/", verifyToken, controller.getAnnouncements);
// การ์ดห้อง (รอบ × หลักสูตร) — ทุก role ที่ login (ห้องที่เห็นตัดสินใน controller)
router.get("/rooms", verifyToken, controller.getRooms);
router.patch("/:id/pin", verifyToken, verifyCoopTeacherOrStaff, controller.setPinned);
router.post("/", verifyToken, verifyCoopTeacherOrStaff, controller.upload.array("attachments"), controller.addOrUpdateAnnouncement);
router.delete("/:id", verifyToken, verifyCoopTeacherOrStaff, controller.deleteAnnouncement);

module.exports = router;
