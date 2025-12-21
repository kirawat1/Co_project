// backend/routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const authMiddleware = require("../middleware/auth"); // จาก auth.js

router.get("/", authMiddleware, companyController.getCompanies);
router.post("/", authMiddleware, companyController.addCompany);
router.put("/:id", authMiddleware, companyController.updateCompany);
router.delete("/:id", authMiddleware, companyController.deleteCompany);

router.post("/:companyId/mentors", authMiddleware, companyController.addMentor);
router.put("/mentors/:id", authMiddleware, companyController.updateMentor);
router.delete("/mentors/:id", authMiddleware, companyController.deleteMentor);

module.exports = router;
