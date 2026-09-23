const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { verifyToken } = require('../middlewares/authMiddleware');
const feedbackController = require('../controllers/feedbackController');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// ภาพหน้าจอที่แนบมากับเรื่องที่แจ้ง — เก็บที่เดียวกับไฟล์อื่น แต่จำกัดขนาดเล็กกว่า (ภาพแคปหน้าจอ ไม่ใช่เอกสาร)
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: pdfOrImageFileFilter,
});

// ผู้ใช้ที่ล็อกอินแล้วทุก role แจ้งเรื่องได้
router.post('/', verifyToken, upload.single('image'), feedbackController.submitFeedback);
router.get('/me', verifyToken, feedbackController.getMyFeedback);

module.exports = router;
