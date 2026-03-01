const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const visitController = require("../controllers/visitController");

router.get("/student/:studentId", authMiddleware, visitController.getVisitsByStudent);
router.post("/", authMiddleware, visitController.createVisit);
router.put("/:id/toggle", authMiddleware, visitController.toggleVisitStatus);
router.delete("/:id", authMiddleware, visitController.deleteVisit);

module.exports = router;