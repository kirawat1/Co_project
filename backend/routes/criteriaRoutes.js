const express = require("express");
const router = express.Router();
const criteriaController = require("../controllers/criteriaController");
// const { authMiddleware } = require("../middlewares/auth"); // ถ้ามี auth ให้เปิดใช้

// router.get("/", authMiddleware, criteriaController.getCriteria);
// router.post("/", authMiddleware, criteriaController.saveCriteria);

// ถ้ายังไม่ทำ auth ให้ใช้แบบนี้ไปก่อน
router.get("/", criteriaController.getCriteria);
router.post("/", criteriaController.saveCriteria);

module.exports = router;