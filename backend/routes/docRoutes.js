// backend/routes/docRoutes.js
const express = require('express');
const router = express.Router();
const docController = require('../controllers/docController');

// ✅ แก้ไข 1: Import แบบ Destructuring เพื่อดึง verifyToken ออกมาใช้ได้เลย
// และแก้ไข Path ให้ตรงกับโฟลเดอร์ middlewares (มี s)
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// ✅ แก้ไข 2: แก้ไข Path ให้ตรง (มี s)
const upload = require('../middlewares/uploadMiddleware'); 

// Route สำหรับบันทึกฟอร์ม
router.post('/save-form', verifyToken, verifyRole('student'), docController.saveApplicationForm);

// Route สำหรับดึงข้อมูลฟอร์ม
router.get('/my-application', verifyToken, verifyRole('student'), docController.getMyApplication);

// Route สำหรับอัปโหลดไฟล์
router.post('/upload', verifyToken, verifyRole('student'), upload.single('files'), docController.uploadDocument);

router.delete('/delete/:id', verifyToken, verifyRole('student'), docController.deleteDocument);

router.delete('/document/type/:docType', verifyToken, verifyRole('student'), docController.deleteDocumentByType);

// รูปถ่ายในใบสมัคร T000 — รับเฉพาะรูป JPG/PNG ไม่เกิน 5 MB (หน้าเว็บย่อ/ครอปมาให้แล้ว)
const multer = require('multer');
const pathMod = require('path');
const formPhotoController = require('../controllers/formPhotoController');
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, pathMod.join(__dirname, '../uploads')),
    filename: (_req, file, cb) => cb(null, `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}${pathMod.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png'].includes(file.mimetype)
      && ['.jpg', '.jpeg', '.png'].includes(pathMod.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('รองรับเฉพาะรูป JPG หรือ PNG'), ok);
  },
});
router.post('/form-photo', verifyToken, verifyRole('student'), (req, res, next) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'รูปใหญ่เกิน 5 MB' : (err.message || 'อัปโหลดรูปไม่สำเร็จ');
    res.status(400).json({ ok: false, message });
  });
}, formPhotoController.uploadFormPhoto);
router.delete('/form-photo', verifyToken, verifyRole('student'), formPhotoController.deleteFormPhoto);

router.post('/t002-form', verifyToken, verifyRole('student'), docController.saveT002Form);
router.post('/t003-form', verifyToken, verifyRole('student'), docController.saveT003Form);

module.exports = router;