const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const teacherController = require("../controllers/teacherController");

// --- Route สำหรับอาจารย์ดูของตัวเอง (User) ---
router.get("/me", authMiddleware, teacherController.getProfile);
router.put("/me", authMiddleware, teacherController.updateProfile);

// --- Route สำหรับ Admin จัดการอาจารย์ ---
// GET /api/teacher -> ดูทั้งหมด
router.get("/", authMiddleware, teacherController.getAllTeachers); 

// PUT /api/teacher/:id -> แก้ไขรายคน (ต้องวางไว้หลัง /me)
router.put("/:id", authMiddleware, teacherController.updateTeacherById);

module.exports = router;