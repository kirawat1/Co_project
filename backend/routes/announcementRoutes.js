const express = require("express");
const controller = require("../controllers/announcementController");

const router = express.Router();

router.get("/", controller.getAnnouncements);
router.post("/", controller.upload.array("attachments"), controller.addAnnouncement);
router.delete("/:id", controller.deleteAnnouncement);

module.exports = router;
