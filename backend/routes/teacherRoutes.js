const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const configController = require('../controllers/configController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const supervisionController = require('../controllers/supervisionController');

// --- Route สำหรับอาจารย์ดูของตัวเอง (User) ---
// (สมมติว่าคุณใช้ verifyToken แทน authMiddleware เพื่อให้เป็นมาตรฐานเดียวกัน)
router.get("/me", verifyToken, teacherController.getProfile);
router.put("/me", verifyToken, teacherController.updateProfile);
router.get('/my-students', verifyToken, teacherController.getMyStudents);

// --- Route สำหรับ Admin จัดการอาจารย์ ---
router.get("/", verifyToken, teacherController.getAllTeachers); 
router.put("/:id", verifyToken, teacherController.updateTeacherById);

// --- Config Routes ---
router.get('/config/t002', verifyToken, configController.getT002Config);
router.post('/config/t002', verifyToken, verifyRole('admin', 'teacher', 'staff'), configController.saveT002Config);

router.get('/config/t003', verifyToken, configController.getT003Config);
router.post('/config/t003', verifyToken, verifyRole('admin', 'teacher', 'staff'), configController.saveT003Config);

// --- Review Documents Routes ---
// ⚠️ ตรงนี้คือจุดที่พัง! ต้องเช็คให้ชัวร์ว่าใน teacherController มี 2 ฟังก์ชันนี้อยู่จริง
router.put('/documents/review-t002', verifyToken, teacherController.reviewT002);
router.put('/documents/review-t003', verifyToken, teacherController.reviewT003);

router.get('/supervisions', verifyToken, supervisionController.getSupervisionsForTeacher);
router.put('/supervisions/:id/review', verifyToken, supervisionController.reviewSupervision);

router.get('/stats', verifyToken, teacherController.getDashboardStats);
router.get('/latest-requests', verifyToken, teacherController.getLatestRequests);


module.exports = router;