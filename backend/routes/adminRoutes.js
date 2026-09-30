const express = require('express');
const router = express.Router();

const { verifyToken, verifyRole, verifyCoopTeacherOrStaff } = require('../middlewares/authMiddleware');
const prisma = require('../config/prismaClient');
const { studentInScope, majorFieldInScope, lettersStaffOnly } = require('../middlewares/majorScopeGuards');

const upload = require('../middlewares/uploadMiddleware');
const systemUpload = require('../middlewares/systemUploadMiddleware');

const adminDocController = require('../controllers/adminDocController');
const auditLogController = require('../controllers/auditLogController');
const systemAssetController = require('../controllers/systemAssetController');
const coopPeriodController = require("../controllers/coopPeriodController");
const adminDashboardController = require('../controllers/adminDashboardController');
const criteriaController = require('../controllers/criteriaController');
const docReqController = require('../controllers/docRequirementController');
const configController = require('../controllers/configController');
const supervisionController = require('../controllers/supervisionController');
const teacherController = require('../controllers/teacherController');
const studentImportController = require('../controllers/studentImportController');
const studentController = require('../controllers/studentController');
const staffController = require('../controllers/staffController');
const multerMemory = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// สิทธิ์ 3 ระดับ (role ตรงกับ Prisma enum — lowercase):
//   STAFF_ONLY              — ออกหนังสือ, รหัสผ่าน, เกณฑ์/หลักสูตร, ตั้งค่าระบบ (ผู้ลงนาม/แม่แบบ), บัญชีเจ้าหน้าที่, logs
//   verifyCoopTeacherOrStaff — งานจัดการ (อาจารย์ประจำวิชาทำแทนเจ้าหน้าที่ได้)
//   ADMIN_ROLES             — อ่านอย่างเดียวที่หน้าอาจารย์ทั่วไปต้องใช้ (รอบสหกิจ, รายชื่อหลักสูตร, นักศึกษาที่ตัวเองดูแล)
const ADMIN_ROLES = ['teacher', 'staff'];
const STAFF_ONLY = ['staff'];

// ==========================================
// T000 — เอกสารใบสมัคร
// ==========================================
router.get('/config/t000', verifyToken, verifyCoopTeacherOrStaff, adminDocController.getT000Config);
router.post('/config/t000', verifyToken, verifyCoopTeacherOrStaff, adminDocController.saveT000Config);
router.get('/t000/students', verifyToken, verifyCoopTeacherOrStaff, adminDocController.getStudentsForT000);

// บันทึกการใช้งาน (ใครทำอะไร) — เจ้าหน้าที่เท่านั้น
// เรื่องที่ผู้ใช้แจ้งเข้ามา (ปุ่มแจ้งปัญหา)
const feedbackController = require('../controllers/feedbackController');
router.get('/feedback', verifyToken, verifyRole(...STAFF_ONLY), feedbackController.listFeedback);
router.patch('/feedback/:id', verifyToken, verifyRole(...STAFF_ONLY), feedbackController.updateFeedback);

router.get('/logs/export', verifyToken, verifyRole(...STAFF_ONLY), auditLogController.exportAuditLogs);
router.get('/logs/actors', verifyToken, verifyRole(...STAFF_ONLY), auditLogController.getAuditActors);
router.get('/logs', verifyToken, verifyRole(...STAFF_ONLY), auditLogController.getAuditLogs);
router.put('/doc/:id/status', verifyToken, verifyCoopTeacherOrStaff, adminDocController.updateDocStatus);
router.post('/t000/approve-all', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.body?.studentId), adminDocController.approveAllDocs);
// ตรวจเอกสาร T000 — ออกหนังสือ (สถานะ/เลขที่/วันที่หนังสือ) เจ้าหน้าที่เท่านั้น (lettersStaffOnly)
router.put('/t000/review', verifyToken, verifyCoopTeacherOrStaff, upload.single('file'), lettersStaffOnly, studentInScope((r) => r.body?.studentId), adminDocController.reviewStudentStatus);
router.post('/t000/acceptance-received', verifyToken, verifyCoopTeacherOrStaff, upload.single('file'), studentInScope((r) => r.body?.studentId), adminDocController.markAcceptanceReceived);
router.post('/t000/acceptance-replace', verifyToken, verifyCoopTeacherOrStaff, upload.single('file'), studentInScope((r) => r.body?.studentId), adminDocController.replaceAcceptanceFile);
router.put('/t000/letter-pending', verifyToken, verifyRole(...STAFF_ONLY), adminDocController.markLetterPending);

// System Assets (ไม่ต้องการ auth — เป็นข้อมูล public เช่น โลโก้)
router.get('/assets', systemAssetController.getAllAssets);
router.post('/assets', verifyToken, verifyRole(...STAFF_ONLY), systemUpload.single('file'), systemAssetController.updateAsset);
router.delete('/assets/:key', verifyToken, verifyRole(...STAFF_ONLY), systemAssetController.deleteAsset);

// Coop Period
router.get("/coop-periods", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.getPeriods);
router.post("/coop-periods", verifyToken, verifyCoopTeacherOrStaff, coopPeriodController.createPeriod);
router.put("/coop-periods/:id", verifyToken, verifyCoopTeacherOrStaff, coopPeriodController.updatePeriod);
router.patch("/coop-periods/:id/toggle", verifyToken, verifyCoopTeacherOrStaff, coopPeriodController.togglePeriod);
router.delete("/coop-periods/:id", verifyToken, verifyCoopTeacherOrStaff, coopPeriodController.deletePeriod);
router.get("/coop-periods/active", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.getActivePeriod);
router.get("/coop-periods/all", verifyToken, verifyRole(...ADMIN_ROLES), coopPeriodController.getAllCoopPeriods);

// Dashboard
router.get('/dashboard-stats', verifyToken, verifyCoopTeacherOrStaff, adminDashboardController.getDashboardStats);

// Criteria
router.get('/majors', verifyToken, verifyRole(...ADMIN_ROLES), criteriaController.getMajorList);
router.get('/criteria', verifyToken, verifyCoopTeacherOrStaff, criteriaController.getAllCriteria);
router.post('/criteria', verifyToken, verifyRole(...STAFF_ONLY), criteriaController.createCriteria);
router.put('/criteria/:id', verifyToken, verifyRole(...STAFF_ONLY), criteriaController.updateCriteria);
router.delete('/criteria/:id', verifyToken, verifyRole(...STAFF_ONLY), criteriaController.deleteCriteria);

// POST /api/admin/students/import-preview — parse Excel และคืน preview โดยไม่เขียน DB
router.post(
  '/students/import-preview',
  verifyToken,
  verifyRole(...STAFF_ONLY),
  multerMemory.single('file'),
  studentImportController.previewStudents
);

// POST /api/admin/students/import-excel — นำเข้าข้อมูลนักศึกษาจาก Excel
router.post(
  '/students/import-excel',
  verifyToken,
  verifyRole(...STAFF_ONLY),
  multerMemory.single('file'),
  studentImportController.importStudents
);

// GET /api/admin/students/export — export รายชื่อนักศึกษาเป็น Excel
router.get(
  '/students/export',
  verifyToken,
  verifyCoopTeacherOrStaff,
  studentController.exportStudents
);

// GET /api/admin/my-scope — หลักสูตรที่ผู้ใช้จัดการได้ { all: เจ้าหน้าที่, majors: หลักสูตรที่อาจารย์ประจำวิชาดูแล }
router.get('/my-scope', verifyToken, verifyRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { getMajorScope } = require('../utils/majorScope');
// สิทธิ์จริง (ไม่สนตัวกรองหลักสูตรบนแถบบน)
    const scope = await getMajorScope(req, { ignoreFilter: true });
    res.json({ ok: true, all: scope.all, majors: scope.majors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
});

// GET /api/admin/students/majors — distinct majors for announcement targeting
router.get('/students/majors', verifyToken, verifyCoopTeacherOrStaff, async (req, res) => {
  try {
    const { getMajorScope, studentWhere } = require('../utils/majorScope');
    // อาจารย์ประจำวิชาประกาศได้เฉพาะหลักสูตรที่ดูแล
    const rows = await prisma.student.findMany({
      where: { AND: [{ major: { not: null }, deletedAt: null }, studentWhere(await getMajorScope(req))] },
      select: { major: true },
      distinct: ['major'],
      orderBy: { major: 'asc' },
    });
    res.json({ ok: true, majors: rows.map(r => r.major).filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
});

// POST /api/admin/students/create — เพิ่มนักศึกษาทีละคน
router.post('/students/create', verifyToken, verifyCoopTeacherOrStaff, majorFieldInScope('major', { required: true }), studentController.createStudentSingle);

// Students: Edit basic info — staff only (ไม่ใช่ teacher แม้ ADMIN_ROLES ปกติจะรวม teacher ด้วย)
router.put('/students/:id', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.params.id), majorFieldInScope('major'), studentController.updateStudentBasicInfo);
// รีเซ็ตรหัสผ่านนักศึกษากลับเป็นรหัสนักศึกษา (ลืมรหัสผ่าน)
router.patch('/students/:id/reset-password', verifyToken, verifyRole(...STAFF_ONLY), studentController.resetStudentPassword);
router.post('/students/:id/password/reveal', verifyToken, verifyRole(...STAFF_ONLY), studentController.revealStudentPassword);

// Students: Trash — ย้ายไปถังขยะ / กู้คืน / ลบถาวร (ลบถาวรได้เฉพาะคนที่อยู่ในถังขยะแล้ว)
router.delete('/students/:id', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.params.id), studentController.softDeleteStudent);
router.get('/students/trash', verifyToken, verifyCoopTeacherOrStaff, studentController.getTrashedStudents);
router.post('/students/:id/restore', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.params.id), studentController.restoreStudent);
router.delete('/students/:id/permanent', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.params.id), studentController.permanentlyDeleteStudent);

// Coop Applications
router.get('/coop-applications', verifyToken, verifyCoopTeacherOrStaff, adminDocController.getCoopApplications);
router.patch('/coop-applications/:id/status', verifyToken, verifyCoopTeacherOrStaff, adminDocController.updateCoopApplicationStatus);

// Doc Requirements
router.get('/doc-requirements', verifyToken, verifyCoopTeacherOrStaff, docReqController.getAllRequirements);
router.post('/doc-requirements', verifyToken, verifyCoopTeacherOrStaff, docReqController.createRequirement);
router.put('/doc-requirements/:id', verifyToken, verifyCoopTeacherOrStaff, docReqController.updateRequirement);
router.delete('/doc-requirements/:id', verifyToken, verifyCoopTeacherOrStaff, docReqController.deleteRequirement);

// Dean Info
router.get('/config/dean-info', systemAssetController.getDeanInfo);
router.post('/config/dean-info', verifyToken, verifyRole(...STAFF_ONLY), systemAssetController.saveDeanInfo);

// Students Review
router.get('/students', verifyToken, verifyRole(...ADMIN_ROLES), adminDocController.getAllStudentsForReview);
router.put('/documents/review-t002', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.body?.studentId), adminDocController.reviewT002);
router.put('/documents/review-t003', verifyToken, verifyCoopTeacherOrStaff, studentInScope((r) => r.body?.studentId), adminDocController.reviewT003);

// Config
router.get('/config/t002', verifyToken, verifyCoopTeacherOrStaff, configController.getT002Config);
router.post('/config/t002', verifyToken, verifyCoopTeacherOrStaff, configController.saveT002Config);

router.get('/config/t003', verifyToken, verifyCoopTeacherOrStaff, configController.getT003Config);
router.post('/config/t003', verifyToken, verifyCoopTeacherOrStaff, configController.saveT003Config);
// ช่วงเวลายื่นคำร้องสหกิจ — แก้ได้เฉพาะเจ้าหน้าที่
router.get('/config/apply', verifyToken, verifyCoopTeacherOrStaff, configController.getApplyConfig);
router.post('/config/apply', verifyToken, verifyRole(...STAFF_ONLY), configController.saveApplyConfig);

router.get('/config/evaluation', verifyToken, verifyCoopTeacherOrStaff, configController.getEvaluationConfig);
router.put('/config/evaluation', verifyToken, verifyCoopTeacherOrStaff, configController.updateEvaluationConfig);

router.get('/config/t007', verifyToken, verifyCoopTeacherOrStaff, configController.getT007Config);
router.put('/config/t007', verifyToken, verifyCoopTeacherOrStaff, configController.updateT007Config);

router.get('/config/t008', verifyToken, verifyCoopTeacherOrStaff, configController.getT008Config);
router.put('/config/t008', verifyToken, verifyCoopTeacherOrStaff, systemUpload.single('image'), configController.updateT008Config);

router.get('/config/gateway', verifyToken, verifyCoopTeacherOrStaff, configController.getGatewaySettings);
router.put('/config/gateway', verifyToken, verifyCoopTeacherOrStaff, configController.updateGatewaySettings);

// Supervision
router.put('/supervisions/:id/co-teachers', verifyToken, verifyCoopTeacherOrStaff, supervisionController.assignCoTeachers);

// ==========================================
// STAFF MANAGEMENT — จัดการบัญชีเจ้าหน้าที่
// ==========================================
router.get('/staff', verifyToken, verifyRole(...STAFF_ONLY), staffController.listStaff);
router.post('/staff', verifyToken, verifyRole(...STAFF_ONLY), staffController.createStaff);
router.patch('/staff/:id/password', verifyToken, verifyRole(...STAFF_ONLY), staffController.resetPassword);
router.delete('/staff/:id', verifyToken, verifyRole(...STAFF_ONLY), staffController.deleteStaff);

// ==========================================
// TEACHER MANAGEMENT — เจ้าหน้าที่จัดการอาจารย์
// ==========================================
router.post('/teachers', verifyToken, verifyRole(...STAFF_ONLY), teacherController.createTeacher);
// อาจารย์ประจำวิชาแก้ข้อมูลอาจารย์ในหลักสูตรที่ดูแลได้ (ไม่รวมรหัสผ่าน/การกำหนดอาจารย์ประจำวิชา — ดูใน controller)
router.put('/teachers/:id', verifyToken, verifyCoopTeacherOrStaff, teacherController.adminUpdateTeacher);
router.delete('/teachers/:id', verifyToken, verifyRole(...STAFF_ONLY), teacherController.deleteTeacher);
router.put('/teachers/:id/password', verifyToken, verifyRole(...STAFF_ONLY), teacherController.resetTeacherPassword);
router.post('/teachers/:id/password/reveal', verifyToken, verifyRole(...STAFF_ONLY), teacherController.revealTeacherPassword);

module.exports = router;
