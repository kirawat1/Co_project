// backend/routes/auth.js
const express = require("express");
const { signIn, getProfile, loginWithSSO, loginWithKKU, registerStudent, loginWithGoogle } = require("../controllers/authController");


const router = express.Router();


router.post("/signin", signIn);
router.post("/login/sso", loginWithSSO);
// router.post("/login/kku", loginWithKKU);  // ปิดแล้ว — ใช้ Google OAuth แทน
router.post("/login/google", loginWithGoogle);
router.post("/register", registerStudent);     // นักศึกษาใหม่ self-register

router.get("/me", getProfile);


module.exports = router;

