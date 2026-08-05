// backend/routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");

router.get("/", verifyToken, companyController.getCompanies);
router.post("/", verifyToken, verifyRole('staff', 'teacher'), companyController.addCompany);
router.put("/:id", verifyToken, verifyRole('staff', 'teacher', 'student'), companyController.updateCompany);
router.delete("/:id", verifyToken, verifyRole('staff', 'teacher'), companyController.deleteCompany);

router.post("/:companyId/mentors", verifyToken, verifyRole('staff', 'teacher'), companyController.addMentor);
router.put("/mentors/:id", verifyToken, verifyRole('staff', 'teacher'), companyController.updateMentor);
router.delete("/mentors/:id", verifyToken, verifyRole('staff', 'teacher'), companyController.deleteMentor);

module.exports = router;
