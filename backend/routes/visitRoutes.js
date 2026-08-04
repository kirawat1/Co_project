const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");
const visitController = require("../controllers/visitController");

router.get("/student/:studentId", verifyToken, verifyRole('teacher', 'staff'), visitController.getVisitsByStudent);
router.post("/", verifyToken, verifyRole('teacher', 'staff'), visitController.createVisit);
router.put("/:id/toggle", verifyToken, verifyRole('teacher', 'staff'), visitController.toggleVisitStatus);
router.delete("/:id", verifyToken, verifyRole('teacher', 'staff'), visitController.deleteVisit);

module.exports = router;