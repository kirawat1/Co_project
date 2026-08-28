// backend/routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");

router.get("/search", verifyToken, companyController.searchCompanies);
router.get("/", verifyToken, companyController.getCompanies);
router.post("/", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addCompany);
router.put("/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateCompany);
router.delete("/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteCompany);

router.post("/:companyId/mentors", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.addMentor);
router.put("/mentors/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateMentor);
router.delete("/mentors/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.deleteMentor);

module.exports = router;
