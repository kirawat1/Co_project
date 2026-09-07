// backend/routes/auth.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { signIn, getProfile, loginWithSSO, loginWithKKU, registerStudent, loginWithGoogle } = require("../controllers/authController");
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// นับเฉพาะ login ที่ "ไม่สำเร็จ" — เป้าหมายคือกันเดารหัสผ่าน ไม่ใช่จำกัดคนที่ล็อกอินถูก
// สำคัญเพราะนักศึกษาทั้งคณะออกเน็ตผ่าน IP เดียวกัน (NAT/nginx+ngrok) ถ้านับครั้งที่สำเร็จด้วย
// การล็อกอินปกติ 30 คนแรกจะทำให้ที่เหลือเข้าระบบไม่ได้ยาว 15 นาที
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
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
router.post("/register", verifyToken, verifyRole('staff'), registerStudent);

router.get("/me", verifyToken, getProfile);


module.exports = router;

