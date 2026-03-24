// backend/routes/docRoutes.js
const express = require('express');
const router = express.Router();
const docController = require('../controllers/docController');

// ✅ แก้ไข 1: Import แบบ Destructuring เพื่อดึง verifyToken ออกมาใช้ได้เลย
// และแก้ไข Path ให้ตรงกับโฟลเดอร์ middlewares (มี s)
const { verifyToken } = require('../middlewares/authMiddleware');

// ✅ แก้ไข 2: แก้ไข Path ให้ตรง (มี s)
const upload = require('../middlewares/uploadMiddleware'); 

// Route สำหรับบันทึกฟอร์ม
router.post('/save-form', verifyToken, docController.saveApplicationForm);

// Route สำหรับดึงข้อมูลฟอร์ม
router.get('/my-application', verifyToken, docController.getMyApplication);

// Route สำหรับอัปโหลดไฟล์
router.post('/upload', verifyToken, upload.single('files'), docController.uploadDocument);

router.delete('/delete/:id', verifyToken, docController.deleteDocument);

router.delete('/document/type/:docType', verifyToken, docController.deleteDocumentByType);

router.post('/t003-form', verifyToken, docController.saveT003Form);

module.exports = router;