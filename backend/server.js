// backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config(); // ✅ เรียกก่อน

const app = express(); // ✅ ต้องมาก่อนใช้ app.use

// -----------------------------
// Routes import
// -----------------------------
const authRouter = require("./routes/authRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const companyRoutes = require("./routes/companyRoutes");
const studentRoutes = require("./routes/studentRoutes");
const authMiddleware = require('./middlewares/auth');
const coopRoutes = require("./routes/coopRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const criteriaRoutes = require("./routes/criteriaRoutes");
const docRoutes = require('./routes/docRoutes');
const adminRouter = require('./routes/adminRoutes');
const supervisionRoutes = require('./routes/supervisionRoutes');
// -----------------------------

const PORT = process.env.PORT || 5000;
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// -----------------------------
// Middleware
// -----------------------------
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------
// Routes
// -----------------------------
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
app.use('/api', supervisionRoutes); //
// -----------------------------
// Test route
// -----------------------------
app.get("/", (req, res) =>
  res.send("API Server is running OK")
);

// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
