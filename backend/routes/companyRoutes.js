// backend/routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { verifyToken, verifyRole, verifyCoopTeacherOrStaff } = require("../middlewares/authMiddleware");

router.get("/search", verifyToken, companyController.searchCompanies);
router.post("/bulk", verifyToken, verifyRole('staff'), companyController.bulkImportCompanies);
router.get("/", verifyToken, companyController.getCompanies);
router.post("/", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addCompany);
// ผู้ติดต่อ (HR) — วางก่อน "/:id" ไม่ให้ "/contacts" ถูกจับเป็น id บริษัท
// อาจารย์ประจำวิชามีเมนูผู้ติดต่อ (HR) ในหน้าจัดการหลักสูตร — เดิม staff อย่างเดียว อาจารย์เปิดแล้วขึ้น "โหลดไม่สำเร็จ"
router.get("/contacts", verifyToken, verifyCoopTeacherOrStaff, companyController.getAllContacts);
router.post("/:companyId/contacts", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addContact);
router.put("/contacts/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateContact);
router.delete("/contacts/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteContact);

router.put("/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateCompany);
router.delete("/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteCompany);

router.post("/:companyId/mentors", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addMentor);
router.put("/mentors/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateMentor);
router.delete("/mentors/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteMentor);

module.exports = router;
