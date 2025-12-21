// backend/routes/auth.js
const express = require("express");
const { signIn, getProfile } = require("../controllers/authController");

const router = express.Router();


router.post("/signin", signIn);

router.get("/me", getProfile); 

module.exports = router;
