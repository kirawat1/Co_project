const express = require('express');
const router = express.Router();

const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

const upload = require('../middlewares/uploadMiddleware');
const systemUpload = require('../middlewares/systemUploadMiddleware');

const adminDocController = require('../controllers/adminDocController');
const systemAssetController = require('../controllers/systemAssetController');
const coopPeriodController = require("../controllers/coopPeriodController");
const adminDashboardController = require('../controllers/adminDashboardController');
const criteriaController = require('../controllers/criteriaController');
const docReqController = require('../controllers/docRequirementController');
const configController = require('../controllers/configController');
const supervisionController = require('../controllers/supervisionController');
const teacherController = require('../controllers/teacherController');
const kkuReg = require('../services/kkuRegService');

// สิทธิ์ที่อนุญาตจัดการระบบ (ต้องตรงกับ Prisma enum — lowercase)
const ADMIN_ROLES = ['admin', 'teacher', 'staff'];
const STAFF_ONLY = ['admin', 'staff'];

// ==========================================
// T000 — เอกสารใบสมัคร
// ==========================================
router.get('/config/t000', verifyToken, adminDocController.getT000Config);
router.post('/config/t000', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.saveT000Config);
router.get('/t000/students', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.getStudentsForT000);
router.put('/doc/:id/status', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.updateDocStatus);
router.post('/t000/approve-all', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.approveAllDocs);
router.put('/t000/review', verifyToken, verifyRole(...ADMIN_ROLES), upload.single('file'), adminDocController.reviewStudentStatus);

// System Assets (ไม่ต้องการ auth — เป็นข้อมูล public เช่น โลโก้)
router.get('/assets', systemAssetController.getAllAssets);
router.post('/assets', verifyToken, verifyRole(...ADMIN_ROLES), systemUpload.single('file'), systemAssetController.updateAsset);
router.delete('/assets/:key', verifyToken, verifyRole(...ADMIN_ROLES), systemAssetController.deleteAsset);

// Coop Period
router.get("/coop-periods", coopPeriodController.getPeriods);
router.post("/coop-periods", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.createPeriod);
router.put("/coop-periods/:id", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.updatePeriod);
router.patch("/coop-periods/:id/toggle", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.togglePeriod);
router.delete("/coop-periods/:id", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.deletePeriod);
router.get("/coop-periods/active", coopPeriodController.getActivePeriod);
router.get("/coop-periods/all", coopPeriodController.getAllCoopPeriods);

// Dashboard
router.get('/dashboard-stats', verifyToken, verifyRole(...ADMIN_ROLES), adminDashboardController.getDashboardStats);

// Criteria
router.get('/majors', criteriaController.getMajorList);
router.get('/criteria', criteriaController.getAllCriteria);
router.post('/criteria', verifyToken, verifyRole(...ADMIN_ROLES), criteriaController.saveCriteria);
router.put('/criteria/:id', verifyToken, verifyRole(...ADMIN_ROLES), criteriaController.saveCriteria);
router.delete('/criteria/:id', verifyToken, verifyRole(...ADMIN_ROLES), criteriaController.deleteCriteria);

// GET /api/admin/courses/search?q=<text> — ค้นหาวิชาจาก KKU course catalog สำหรับ admin เลือกใส่เกณฑ์
router.get('/courses/search', verifyToken, verifyRole(...ADMIN_ROLES), async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ ok: true, courses: [] });

  if (!kkuReg.isConfigured()) {
    return res.json({ ok: false, courses: [], message: "KKU REG API ยังไม่ได้ตั้งค่า — กรอกรหัสวิชาด้วยตนเอง" });
  }

  try {
    const courses = await kkuReg.searchCourses(q);
    res.json({ ok: true, courses });
  } catch (err) {
    console.error("[admin course search]", err);
    res.json({ ok: false, courses: [], message: "ค้นหาไม่สำเร็จ" });
  }
});

// Coop Applications
router.get('/coop-applications', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.getCoopApplications);
router.patch('/coop-applications/:id/status', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.updateCoopApplicationStatus);

// Doc Requirements
router.get('/doc-requirements', docReqController.getRequirements);
router.post('/doc-requirements', verifyToken, verifyRole(...ADMIN_ROLES), docReqController.createRequirement);
router.put('/doc-requirements/:id', verifyToken, verifyRole(...ADMIN_ROLES), docReqController.updateRequirement);
router.delete('/doc-requirements/:id', verifyToken, verifyRole(...ADMIN_ROLES), docReqController.deleteRequirement);

// Dean Info
router.get('/config/dean-info', systemAssetController.getDeanInfo);
router.post('/config/dean-info', verifyToken, verifyRole(...ADMIN_ROLES), systemAssetController.saveDeanInfo);

// Students Review
router.get('/students', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.getAllStudentsForReview);
router.put('/documents/review-t002', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.reviewT002);
router.put('/documents/review-t003', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.reviewT003);

// Config
router.get('/config/t002', verifyToken, configController.getT002Config);
router.post('/config/t002', verifyToken, verifyRole(...ADMIN_ROLES), configController.saveT002Config);

router.get('/config/t003', verifyToken, configController.getT003Config);
router.post('/config/t003', verifyToken, verifyRole(...ADMIN_ROLES), configController.saveT003Config);

router.get('/config/evaluation', verifyToken, configController.getEvaluationConfig);
router.put('/config/evaluation', verifyToken, verifyRole(...ADMIN_ROLES), configController.updateEvaluationConfig);

router.get('/config/t007', verifyToken, configController.getT007Config);
router.put('/config/t007', verifyToken, verifyRole(...ADMIN_ROLES), configController.updateT007Config);

router.get('/config/t008', verifyToken, configController.getT008Config);
router.put('/config/t008', verifyToken, verifyRole(...ADMIN_ROLES), systemUpload.single('image'), configController.updateT008Config);

// Supervision
router.put('/supervisions/:id/co-teachers', verifyToken, verifyRole(...ADMIN_ROLES), supervisionController.assignCoTeachers);

// ==========================================
// TEACHER MANAGEMENT — เจ้าหน้าที่จัดการอาจารย์
// ==========================================
router.post('/teachers', verifyToken, verifyRole(...STAFF_ONLY), teacherController.createTeacher);
router.put('/teachers/:id', verifyToken, verifyRole(...STAFF_ONLY), teacherController.adminUpdateTeacher);
router.delete('/teachers/:id', verifyToken, verifyRole(...STAFF_ONLY), teacherController.deleteTeacher);
router.put('/teachers/:id/password', verifyToken, verifyRole(...STAFF_ONLY), teacherController.resetTeacherPassword);

module.exports = router;
