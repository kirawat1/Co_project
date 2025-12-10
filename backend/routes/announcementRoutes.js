// backend/routes/announcementRoutes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const announcementController = require('../controllers/announcementController');

// ใช้ middleware ตรวจสอบ Token และ Admin สำหรับทุก Route ในไฟล์นี้
router.use(protect, adminOnly); 

// GET All, POST Create
router.route('/')
    .get(announcementController.getAllAnnouncements)
    .post(announcementController.createAnnouncement);

// PUT Update, DELETE Delete
router.route('/:id')
    .put(announcementController.updateAnnouncement)
    .delete(announcementController.deleteAnnouncement);

module.exports = router;