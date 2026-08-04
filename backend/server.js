// backend/server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
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

// เชื่อใจ reverse proxy ชั้นแรก (nginx) เพื่อให้ req.ip / X-Forwarded-For
// เป็น IP จริงของผู้ใช้ ไม่ใช่ IP ของ nginx เอง — จำเป็นสำหรับ rate-limit ให้แม่นยำต่อคน
app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, content-type sniffing, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // อนุญาต /uploads/* ให้โหลดจาก frontend
}));

// Global rate limit — ป้องกัน scraping / DDoS ระดับ API ทั้งหมด
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 500,                  // 500 req / 15 นาที / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.originalUrl === '/api/internal-status', // VM-local health check ไม่ต้อง limit
});
app.use('/api', globalLimiter);

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
// FRONTEND_URL=https://ngrok-domain.dev,http://10.198.200.107
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
