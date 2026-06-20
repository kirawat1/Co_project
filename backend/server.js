// backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const rateLimit = require("express-rate-limit");

dotenv.config();

// ตรวจสอบ env ที่จำเป็นก่อน start server
const REQUIRED_ENV = ["JWT_SECRET", "DATABASE_URL", "FRONTEND_URL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();

// -----------------------------
// Routes import
// -----------------------------
const authRouter = require("./routes/authRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const companyRoutes = require("./routes/companyRoutes");
const studentRoutes = require("./routes/studentRoutes");
const coopRoutes = require("./routes/coopRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const criteriaRoutes = require("./routes/criteriaRoutes");
const docRoutes = require('./routes/docRoutes');
const adminRouter = require('./routes/adminRoutes');
const supervisionRoutes = require('./routes/supervisionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
// -----------------------------

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// -----------------------------
// Middleware
// -----------------------------
const allowedOrigins = [FRONTEND_URL];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit สำหรับ login/register endpoint เท่านั้น (ป้องกัน brute force / spam)
// ไม่รวม GET /me เพราะถูกเรียกทุก page load
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 30,                   // 30 ครั้ง / 15 นาที
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "ลองใหม่ภายหลัง (พยายาม login มากเกินไป)" },
});

// Rate limit เฉพาะ register — ป้องกัน spam สร้าง account
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ชั่วโมง
  max: 10,                   // 10 ครั้ง / ชั่วโมง ต่อ IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "สมัครสมาชิกบ่อยเกินไป กรุณารอแล้วลองใหม่" },
});

// static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------
// Routes
// -----------------------------
// /api/auth/me ไม่จำกัด (ถูกเรียกทุกหน้า) — limiter ใช้กับ signin/sso เท่านั้น
app.use("/api/auth/signin", loginLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth", authRouter);
app.use("/api/companies", companyRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/coop", coopRoutes);
app.use("/api/visits", require("./routes/visitRoutes"));
app.use("/api/teacher", teacherRoutes);
app.use("/api/criteria", criteriaRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/teachers', teacherRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/status', require('./routes/statusRoutes'));
app.use('/api/internal-status', require('./routes/internalStatusRoutes'));
app.use('/api', supervisionRoutes); //
// -----------------------------
// Test route
// -----------------------------
app.get("/", (_req, res) => res.send("API Server is running OK"));

// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
