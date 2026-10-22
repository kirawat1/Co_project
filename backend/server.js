// backend/server.js
require("./config/timezone"); // เวลาไทยทั้งระบบ — ก่อนทุกอย่าง (ดูเหตุผลในไฟล์)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const { createApiLimiter } = require("./middlewares/rateLimit");

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

// เชื่อใจ reverse proxy ชั้นแรก (nginx) เพื่อให้ req.ip / X-Forwarded-For
// เป็น IP จริงของผู้ใช้ ไม่ใช่ IP ของ nginx เอง — จำเป็นสำหรับ rate-limit ให้แม่นยำต่อคน
// จำนวน proxy ที่อยู่หน้าเซิร์ฟเวอร์จริง — production: ngrok agent → nginx = 2 (ตั้งทับได้ด้วย TRUST_PROXY_HOPS)
// ต้องตรงกับของจริง: น้อยไปจะได้ IP ของ proxy เอง (rate limit รวมกันทุกคน) มากไปจะโดนปลอม IP ผ่าน X-Forwarded-For
const TRUST_PROXY_HOPS = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
app.set('trust proxy', Number.isFinite(TRUST_PROXY_HOPS) && TRUST_PROXY_HOPS >= 0 ? TRUST_PROXY_HOPS : 2);

// Security headers (XSS, clickjacking, content-type sniffing, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // อนุญาต /uploads/* ให้โหลดจาก frontend
}));

// Global rate limit — 2000 req / 15 นาที ต่อผู้ใช้ที่ login (ยังไม่ login = ต่อ IP) · ปรับได้ด้วย API_RATE_LIMIT_MAX
// เดิมนับต่อ IP: ผู้ใช้เข้าผ่านเน็ตมหาวิทยาลัย/VPN แชร์ IP กัน ช่วงปิดส่งจะโดนบล็อกทั้งกลุ่ม (middlewares/rateLimit.js)
app.use('/api', createApiLimiter({
  max: Number(process.env.API_RATE_LIMIT_MAX) > 0 ? Number(process.env.API_RATE_LIMIT_MAX) : 2000,
}));

// บันทึกการใช้งาน — ใครทำอะไร (ทุก request ที่เปลี่ยนข้อมูล + การเข้าสู่ระบบ)
const { auditLogger, startLogRetentionJob } = require('./middlewares/auditLogger');
app.use('/api', auditLogger);

// -----------------------------
// Routes import
// -----------------------------
const authRouter = require("./routes/authRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const companyRoutes = require("./routes/companyRoutes");
const studentRoutes = require("./routes/studentRoutes");
const coopRoutes = require("./routes/coopRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
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
// รองรับหลาย origin: FRONTEND_URL คั่นด้วยคอมมา เช่น
// FRONTEND_URL=https://coop.computing.kku.ac.th,http://10.198.200.107
const allowedOrigins = FRONTEND_URL.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------
// Routes
// -----------------------------
// loginLimiter และ registerLimiter ถูกผูกตรง route ใน authRoutes.js แล้ว
app.use("/api/auth", authRouter);
app.use("/api/companies", companyRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/coop", coopRoutes);
app.use("/api/visits", require("./routes/visitRoutes"));
app.use("/api/teacher", teacherRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/teachers', teacherRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/status', require('./routes/statusRoutes'));
app.use('/api/internal-status', require('./routes/internalStatusRoutes'));
app.use('/api', supervisionRoutes); //
// -----------------------------
// Test route
// -----------------------------
app.get("/", (_req, res) => res.send("API Server is running OK"));
app.use(require('./middlewares/errorHandler')); // ต้องอยู่หลังทุก route

// -----------------------------
startLogRetentionJob(); // ลบบันทึกการใช้งานที่เกิน 1 ปี
require('./utils/announcementAudience').startAnnouncementScheduler(); // ประกาศตั้งเวลา: ถึงเวลาแล้วแจ้งนักศึกษา (ทุก 1 นาที)
require('./utils/retention').startRetentionJob(); // ล้างการแจ้งเตือนที่อ่านแล้วเกิน 180 วัน (วันละครั้ง)
require('./utils/deadlineReminders').startDeadlineReminderJob(); // เตือนนักศึกษาก่อนปิดรับ 3 วัน (ปฏิทินของรอบ · วันละครั้ง)
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
