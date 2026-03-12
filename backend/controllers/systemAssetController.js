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

// ==========================================
// บันทึกข้อมูลคณบดี
// ==========================================
exports.saveDeanInfo = async (req, res) => {
  try {
    const { deanName, deanPosition } = req.body;
    
    // บันทึกลงตาราง SystemConfig โดยใช้ key "DEAN_INFO"
    await prisma.systemConfig.upsert({
      where: { key: "DEAN_INFO" },
      update: { value: JSON.stringify({ deanName, deanPosition }) },
      create: { key: "DEAN_INFO", value: JSON.stringify({ deanName, deanPosition }) }
    });

    res.json({ ok: true, message: "Saved Dean info" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// ==========================================
// โหลดข้อมูลคณบดี
// ==========================================
exports.getDeanInfo = async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "DEAN_INFO" }
    });

    if (config) {
      const data = JSON.parse(config.value);
      res.json({ ok: true, deanName: data.deanName, deanPosition: data.deanPosition });
    } else {
      res.json({ ok: true, deanName: "", deanPosition: "คณบดีวิทยาลัยการคอมพิวเตอร์" });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const { key } = req.params;

    // 1. ค้นหาข้อมูลใน Database เพื่อเอาชื่อไฟล์ (path)
    const asset = await prisma.systemAsset.findUnique({
      where: { key: key }
    });

    if (!asset) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลไฟล์ในระบบ" });
    }

    // 2. ลบไฟล์จริงออกจาก Folder uploads/system
    const filePath = path.join(__dirname, '../uploads/system', asset.path);
    
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Physical file deletion failed:", err);
        // ถึงลบไฟล์ในโฟลเดอร์ไม่ได้ (เช่น permission) แต่เราจะไปลบใน DB ต่อ
      }
    }

    // 3. ลบข้อมูลออกจาก Database
    await prisma.systemAsset.delete({
      where: { key: key }
    });

    res.json({ ok: true, message: "ลบไฟล์แม่แบบเรียบร้อยแล้ว" });

  } catch (error) {
    console.error("Delete Asset Error:", error);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการลบไฟล์" });
  }
};