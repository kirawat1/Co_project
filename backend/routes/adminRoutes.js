const express = require('express');
const router = express.Router();

// Import Middleware ตรวจสอบสิทธิ์ (ถ้าคุณมีไฟล์นี้อยู่แล้ว)
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// ✅ 1. Import Middleware อัปโหลดไฟล์ (ต้องมี 2 ไฟล์นี้ใน folder middleware)
const upload = require('../middlewares/uploadMiddleware'); // สำหรับไฟล์นักศึกษา (เก็บใน uploads/)
const systemUpload = require('../middlewares/systemUploadMiddleware'); // สำหรับไฟล์ระบบ (เก็บใน uploads/system/)

// ✅ 2. Import Controllers
const adminDocController = require('../controllers/adminDocController');
const systemAssetController = require('../controllers/systemAssetController');


// ==========================================
// Group 1: จัดการเอกสารและการตั้งค่า (T000)
// ==========================================

// Config วันเปิด-ปิดระบบ
router.get('/config/t000', verifyToken, adminDocController.getT000Config);
router.post('/config/t000', verifyToken, verifyRole('teacher', 'staff'), adminDocController.saveT000Config);

// ดึงรายชื่อนักศึกษา
router.get('/t000/students', verifyToken, adminDocController.getStudentsForT000);

// อัปเดตสถานะไฟล์รายใบ (ผ่าน/ไม่ผ่าน)
router.put('/doc/:id/status', verifyToken, adminDocController.updateDocStatus);

// อนุมัติเอกสารทั้งหมด (One Click)
router.post('/t000/approve-all', verifyToken, adminDocController.approveAllDocs);

// ⭐️ สำคัญ: Review & บันทึกหนังสือส่งตัว (มีการแนบไฟล์ PDF กลับมา)
// ใช้ 'upload' (ตัวเดิม) เพื่อเก็บไฟล์ลง folder uploads/ (รวมกับไฟล์ นศ.)
router.put('/t000/review', verifyToken, upload.single('file'), adminDocController.reviewStudentStatus);


// ==========================================
// Group 2: จัดการไฟล์แม่แบบ (System Assets)
// ==========================================

// ดึงรายการไฟล์แม่แบบ (ตราครุฑ, ลายเซ็น ฯลฯ)
router.get('/assets', systemAssetController.getAllAssets);

// ⭐️ สำคัญ: อัปโหลดไฟล์แม่แบบใหม่
// ใช้ 'systemUpload' (ตัวใหม่) เพื่อเก็บไฟล์ลง folder uploads/system/
router.post('/assets', systemUpload.single('file'), systemAssetController.updateAsset);


module.exports = router;