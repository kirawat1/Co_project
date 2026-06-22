//backend/routes/announcementRoutes.js
const express = require("express");
const controller = require("../controllers/announcementController");
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", controller.getAnnouncements);
router.post("/", verifyToken, verifyRole('admin', 'staff'), controller.upload.array("attachments"), controller.addOrUpdateAnnouncement);
router.delete("/:id", verifyToken, verifyRole('admin', 'staff'), controller.deleteAnnouncement);

module.exports = router;
