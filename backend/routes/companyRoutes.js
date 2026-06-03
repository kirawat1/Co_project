// backend/routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.get("/", verifyToken, companyController.getCompanies);
router.post("/", verifyToken, companyController.addCompany);
router.put("/:id", verifyToken, companyController.updateCompany);
router.delete("/:id", verifyToken, companyController.deleteCompany);

router.post("/:companyId/mentors", verifyToken, companyController.addMentor);
router.put("/mentors/:id", verifyToken, companyController.updateMentor);
router.delete("/mentors/:id", verifyToken, companyController.deleteMentor);

module.exports = router;
