const prisma = require("../config/prismaClient");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Storage multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

const getAnnouncements = async (req, res) => {
  try {
    const year = req.query.year;
    const list = await prisma.announcement.findMany({
      where: year ? { year } : {},
      orderBy: { date: "desc" },
      include: { files: true },
    });

    // map ไฟล์ให้เป็น url
    const mapped = list.map(a => ({
      ...a,
      attachments: [
        ...(a.files.map(f => ({
          type: f.mime.startsWith("image/") ? "image" : "file",
          name: f.name,
          url: `http://localhost:5000/uploads/${f.path}`
        }))),
        ...(a.linkUrl ? [{ type: "link", name: a.linkUrl, url: a.linkUrl }] : [])
      ]
    }));

    res.json({ ok: true, list: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

const addOrUpdateAnnouncement = async (req, res) => {
  try {
    const { id, title, body, date, year, linkUrls, keepFileIds } = req.body;
    const files = req.files || [];

    if (!title || !date || !year)
      return res.status(400).json({ ok: false, message: "ข้อมูลไม่ครบ" });

    // แปลงชื่อไฟล์ใหม่
    const annFiles = files.map(f => ({
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mime: f.mimetype,
      path: f.filename,
    }));

    if (id) {
      // UPDATE
      const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });

      // ลบไฟล์ที่ไม่อยู่ใน keepFileIds
      for (const f of ann.files) {
        if (!keepFileIds?.includes(f.id)) {
          const filePath = path.join("uploads", f.path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          await prisma.annFile.delete({ where: { id: f.id } });
        }
      }

      // อัปเดตประกาศ
      const updated = await prisma.announcement.update({
        where: { id },
        data: {
          title,
          body,
          date: new Date(date),
          year,
          linkUrl: linkUrls ? JSON.stringify(JSON.parse(linkUrls)) : undefined,
          files: { create: annFiles },
        },
        include: { files: true },
      });

      return res.json({ ok: true, announcement: updated });
    } else {
      // CREATE ใหม่
      const ann = await prisma.announcement.create({
        data: {
          title,
          body,
          date: new Date(date),
          year,
          linkUrl: linkUrls ? JSON.stringify(JSON.parse(linkUrls)) : undefined,
          files: { create: annFiles },
        },
        include: { files: true },
      });
      return res.json({ ok: true, announcement: ann });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
    if (!ann) return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });

    for (const f of ann.files) {
      const filePath = path.join("uploads", f.path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.announcement.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

module.exports = { getAnnouncements, addOrUpdateAnnouncement, deleteAnnouncement, upload };
//backend/controllers/announcementController.js