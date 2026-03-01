// backend/controllers/systemAssetController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ดึงรายการไฟล์ทั้งหมด
exports.getAllAssets = async (req, res) => {
  try {
    const assets = await prisma.systemAsset.findMany();
    res.json({ ok: true, assets });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Error fetching assets" });
  }
};

// อัปโหลด/เปลี่ยนไฟล์
exports.updateAsset = async (req, res) => {
  try {
    const { key, label } = req.body;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // 1. หาไฟล์เดิมเพื่อลบทิ้ง (ถ้ามี)
    const oldAsset = await prisma.systemAsset.findUnique({ where: { key } });
    if (oldAsset && oldAsset.path) {
      const oldPath = path.join(__dirname, '../uploads/system', oldAsset.path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // 2. บันทึกข้อมูลใหม่
    const updated = await prisma.systemAsset.upsert({
      where: { key },
      update: {
        path: req.file.filename,
        mimeType: req.file.mimetype,
        label: label || oldAsset?.label // ถ้าไม่ส่ง label มา ให้ใช้ของเดิม
      },
      create: {
        key,
        label: label || key,
        path: req.file.filename,
        mimeType: req.file.mimetype
      }
    });

    res.json({ ok: true, asset: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Upload failed" });
  }
};