const express = require("express");
const router = express.Router();
const criteriaController = require("../controllers/criteriaController");

router.get('/criteria', criteriaController.getAllCriteria);

// ดึงแยกตามสาขา (ของเดิมคุณที่ใช้ query string ?major=CS)
router.get('/criteria/single', criteriaController.getCriteria);

// สร้างใหม่ หรือ อัปเดต (ใช้ Controller แบบ Upsert ตัวเดียวกันได้เลย)
router.post('/criteria', criteriaController.saveCriteria);
router.put('/criteria/:id', criteriaController.saveCriteria); // ใช้ตัวเดียวกันเพราะอิงจากชื่อ major

// ลบสาขา
router.delete('/criteria/:id', criteriaController.deleteCriteria);
module.exports = router;