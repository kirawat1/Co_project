const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const configController = require('../controllers/configController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const supervisionController = require('../controllers/supervisionController');

// --- Route สำหรับอาจารย์ดูของตัวเอง (User) ---
// (สมมติว่าคุณใช้ verifyToken แทน authMiddleware เพื่อให้เป็นมาตรฐานเดียวกัน)
router.get("/me", verifyToken, teacherController.getProfile);
router.put("/me", verifyToken, verifyRole('teacher', 'staff'), teacherController.updateProfile);
router.get("/prefixes", verifyToken, verifyRole('teacher', 'staff'), teacherController.getTeacherPrefixes);
router.get('/my-students', verifyToken, verifyRole('teacher'), teacherController.getMyStudents);
router.get('/students/export', verifyToken, verifyRole('teacher'), teacherController.exportMyStudents);

// --- Route สำหรับ Admin จัดการอาจารย์ ---
// GET / เปิดให้ทุก role ดึงได้ตั้งใจ (นักศึกษาใช้เลือกอาจารย์ที่ปรึกษาในหน้าโปรไฟล์)
router.get("/", verifyToken, teacherController.getAllTeachers);
// PUT /:id แก้ข้อมูลอาจารย์คนอื่น — staff เท่านั้น
router.put("/:id", verifyToken, verifyRole('staff'), teacherController.updateTeacherById);

// --- Config Routes ---
router.get('/config/t002', verifyToken, configController.getT002Config);
router.post('/config/t002', verifyToken, verifyRole('teacher', 'staff'), configController.saveT002Config);

router.get('/config/t003', verifyToken, configController.getT003Config);
router.post('/config/t003', verifyToken, verifyRole('teacher', 'staff'), configController.saveT003Config);

// --- Review Documents Routes ---
router.put('/documents/review-t002', verifyToken, verifyRole('teacher', 'staff'), teacherController.reviewT002);
router.put('/documents/review-t003', verifyToken, verifyRole('teacher', 'staff'), teacherController.reviewT003);

router.get('/supervisions', verifyToken, verifyRole('teacher', 'staff'), supervisionController.getSupervisionsForTeacher);
router.put('/supervisions/:id/review', verifyToken, verifyRole('teacher', 'staff'), supervisionController.reviewSupervision);

router.get('/stats', verifyToken, verifyRole('teacher', 'staff'), teacherController.getDashboardStats);
router.get('/latest-requests', verifyToken, verifyRole('teacher', 'staff'), teacherController.getLatestRequests);


module.exports = router;