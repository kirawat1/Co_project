// backend/controllers/configController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. ดึง Config
exports.getDocConfig = async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "T000_CONFIG" }
    });
    // ถ้าไม่มีค่า ให้ return default ปิดระบบไว้ก่อน
    const data = config ? JSON.parse(config.value) : { startDate: null, endDate: null, isOpen: false };
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching config" });
  }
};

// 2. Middleware หรือ Helper สำหรับเช็คว่าอัปโหลดได้ไหม
exports.checkSystemOpen = async () => {
    const config = await prisma.systemConfig.findUnique({ where: { key: "T000_CONFIG" } });
    if (!config) return false;
    
    const { startDate, endDate, isOpen } = JSON.parse(config.value);
    if (!isOpen) return false;

    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && now < start) return false; // ยังไม่ถึงวันเปิด
    if (end && now > end) return false;     // เลยวันปิดแล้ว

    return true;
};