// backend/routes/auth.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { signIn, getProfile, loginWithSSO, loginWithKKU, registerStudent, loginWithGoogle } = require("../controllers/authController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "ลองใหม่ภายหลัง (พยายาม login มากเกินไป)" },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "สมัครสมาชิกบ่อยเกินไป กรุณารอแล้วลองใหม่" },
});

router.post("/signin", loginLimiter, signIn);
router.post("/login/sso", loginLimiter, loginWithSSO);
// router.post("/login/kku", loginWithKKU);  // ปิดแล้ว — ใช้ Google OAuth แทน
router.post("/login/google", loginLimiter, loginWithGoogle);
router.post("/register", registerLimiter, registerStudent);

router.get("/me", verifyToken, getProfile);


module.exports = router;

