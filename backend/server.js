// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require("path");

const authRouter = require('./routes/authRoutes');
const announcementRoutes = require("./routes/announcementRoutes");
const companyRoutes = require("./routes/companyRoutes");


dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// -----------------------------
// Middleware
// -----------------------------
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

app.use(express.json()); // ต้องมาก่อน router
app.use(express.urlencoded({ extended: true })); // form-urlencoded

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



// -----------------------------
// Routes
// -----------------------------
app.use("/api/auth", authRouter);
app.use("/api/companies", companyRoutes);
app.use("/api/announcements", announcementRoutes);

// -----------------------------
// Test route
// -----------------------------
app.get("/", (req, res) => res.send("API Server is running OK"));

// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



