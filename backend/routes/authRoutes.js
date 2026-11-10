// backend/routes/auth.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { signIn, getProfile, loginWithGoogle, changeMyPassword, logout } = require("../controllers/authController");
const { verifyToken, verifyRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// นับเฉพาะ login ที่ "ไม่สำเร็จ" — เป้าหมายคือกันเดารหัสผ่าน ไม่ใช่จำกัดคนที่ล็อกอินถูก
// นักศึกษาทั้งคณะออกเน็ตผ่าน IP เดียวกัน (NAT/nginx+ngrok):
//   - ตัวนับนับคำขอตอน "เข้า" แล้วค่อยหักคืนเมื่อสำเร็จ → เดิมนับรวมต่อ IP เพดาน 30 = เข้าพร้อมกันเกิน 30 คน คนที่เหลือโดน 429
//     ทั้งที่พิมพ์ถูก (ทดสอบโหลด 2026-11-07: 300 คนพร้อมกัน เข้าได้ 30)
//   - และพิมพ์ผิดคนละครั้งรวม 30 คน = ทั้ง IP เข้าไม่ได้ 15 นาที
// ตอนนี้: เดารหัสบัญชีเดียวได้ 30 ครั้ง / 15 นาที (ต่ออีเมล) + เพดานรวมต่อ IP 1000 ครั้ง (กันสุ่มเดาหลายบัญชี)
const LOGIN_WINDOW = 15 * 60 * 1000;
const tooMany = { ok: false, message: "ลองใหม่ภายหลัง (พยายาม login มากเกินไป)" };
const loginPerIp = rateLimit({
  windowMs: LOGIN_WINDOW, max: 1000, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false, message: tooMany,
});
const loginPerAccount = rateLimit({
  windowMs: LOGIN_WINDOW, max: 30, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false, message: tooMany,
  keyGenerator: (req) => `login:${String(req.body?.email || '').trim().toLowerCase()}`,
});

router.post("/signin", loginPerIp, loginPerAccount, signIn);
// Google ยืนยันตัวตนเอง (เดารหัสไม่ได้) — มีแค่เพดานรวมต่อ IP
router.post("/login/google", loginPerIp, loginWithGoogle);
// ล้าง cookie เปิดไฟล์ — ไม่ต้องมี token (ออกจากระบบเพราะ token หมดอายุก็ต้องล้างได้)
router.post("/logout", logout);

router.get("/me", verifyToken, getProfile);
// ไม่ใส่ loginLimiter: นักศึกษาใช้ IP เดียวกัน การตั้งรหัสใหม่ไม่ผ่านกติกา (400) จะไปกินโควตา
// login ที่ล้มเหลวของทั้งคณะ และเส้นนี้ต้องมี token ที่ login แล้วอยู่ก่อน
router.put("/me/password", verifyToken, verifyRole('student', 'teacher', 'staff'), changeMyPassword);


module.exports = router;

