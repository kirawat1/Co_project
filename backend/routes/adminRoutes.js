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
const coopPeriodController = require("../controllers/coopPeriodController");
const adminDashboardController = require('../controllers/adminDashboardController');
const criteriaController = require('../controllers/criteriaController');
const docReqController = require('../controllers/docRequirementController');
const configController = require('../controllers/configController');
const supervisionController = require('../controllers/supervisionController');

// ==========================================
// Group 1: จัดการเอกสารและการตั้งค่า (T000)
// ==========================================

// Config วันเปิด-ปิดระบบ
router.get('/config/t000', verifyToken, adminDocController.getT000Config);
router.post('/config/t000', verifyToken, verifyRole('teacher', 'staff'), adminDocController.saveT000Config);
router.get('/t000/students', verifyToken, adminDocController.getStudentsForT000);
router.put('/doc/:id/status', verifyToken, adminDocController.updateDocStatus);
router.post('/t000/approve-all', verifyToken, adminDocController.approveAllDocs);
router.put('/t000/review', verifyToken, upload.single('file'), adminDocController.reviewStudentStatus);

router.get('/assets', systemAssetController.getAllAssets);
router.post('/assets', systemUpload.single('file'), systemAssetController.updateAsset);

// Coop Period
router.get("/coop-periods", coopPeriodController.getPeriods);
router.post("/coop-periods", coopPeriodController.createPeriod);
router.put("/coop-periods/:id", coopPeriodController.updatePeriod);
router.patch("/coop-periods/:id/toggle", coopPeriodController.togglePeriod);
router.delete("/coop-periods/:id", coopPeriodController.deletePeriod);
router.get("/coop-periods/active", coopPeriodController.getActivePeriod);
router.get("/coop-periods/all", coopPeriodController.getAllCoopPeriods);

router.get('/dashboard-stats', adminDashboardController.getDashboardStats);

router.get('/majors', criteriaController.getMajorList);
router.get('/criteria', criteriaController.getAllCriteria);
router.post('/criteria', criteriaController.saveCriteria); // ใช้เซฟตอนเพิ่มสาขาใหม่ (หรือ Upsert)
router.put('/criteria/:id', criteriaController.saveCriteria); // ใช้ตอนกดอัปเดตเกณฑ์
router.delete('/criteria/:id', criteriaController.deleteCriteria); // ใช้ตอนกดลบสาขา


router.get('/coop-applications', adminDocController.getCoopApplications);
router.patch('/coop-applications/:id/status', adminDocController.updateCoopApplicationStatus);


router.get('/doc-requirements', docReqController.getRequirements);
router.post('/doc-requirements', docReqController.createRequirement);
router.put('/doc-requirements/:id', docReqController.updateRequirement);
router.delete('/doc-requirements/:id', docReqController.deleteRequirement);

router.get('/config/dean-info', systemAssetController.getDeanInfo);
router.post('/config/dean-info', systemAssetController.saveDeanInfo);

router.delete('/assets/:key', systemAssetController.deleteAsset);

router.get('/students', verifyToken, adminDocController.getAllStudentsForReview);

router.put('/documents/review-t002', verifyToken, adminDocController.reviewT002);

router.put('/documents/review-t003', verifyToken, adminDocController.reviewT003);

router.get('/config/t002', verifyToken, configController.getT002Config);
router.post('/config/t002', verifyToken, verifyRole('admin', 'teacher', 'staff'), configController.saveT002Config);

router.get('/config/t003', verifyToken, configController.getT003Config);
router.post('/config/t003', verifyToken, verifyRole('admin', 'teacher', 'staff'), configController.saveT003Config);

router.get('/config/evaluation', verifyToken, configController.getEvaluationConfig);
router.put('/config/evaluation', verifyToken, verifyRole('teacher', 'staff'), configController.updateEvaluationConfig);

router.get('/config/t007', verifyToken, configController.getT007Config);
router.put('/config/t007', verifyToken, verifyRole('teacher', 'staff'), configController.updateT007Config);

router.get('/config/t008', verifyToken, configController.getT008Config);
router.put('/config/t008', verifyToken, systemUpload.single('image'), configController.updateT008Config);

router.put('/supervisions/:id/co-teachers', verifyToken, supervisionController.assignCoTeachers);

module.exports = router;