const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const visitController = require("../controllers/visitController");

router.get("/student/:studentId", verifyToken, visitController.getVisitsByStudent);
router.post("/", verifyToken, visitController.createVisit);
router.put("/:id/toggle", verifyToken, visitController.toggleVisitStatus);
router.delete("/:id", verifyToken, visitController.deleteVisit);

module.exports = router;