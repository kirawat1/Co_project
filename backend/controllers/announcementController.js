const prisma = require("../config/prismaClient");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

const getAnnouncements = async (req, res) => {
  try {
    const year = req.query.year;
    const list = await prisma.announcement.findMany({
      where: year ? { year } : {},
      orderBy: { date: "asc" },
      include: { files: true },
    });
    res.json({ ok: true, list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

const addAnnouncement = async (req, res) => {
  try {
    const { title, date, year, body, linkUrl } = req.body;
    const files = req.files || [];

    if (!title || !date || !year)
      return res.status(400).json({ ok: false, message: "ข้อมูลไม่ครบ" });

    const annFiles = files.map(f => {
      // แปลงชื่อไฟล์ให้เป็น UTF-8 ปลอดภัย
      const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');

      console.log("originalname:", f.originalname);
      console.log("safeName:", safeName);

      return {
        name: safeName,
        mime: f.mimetype,
        path: f.filename,
      };
    });

    const ann = await prisma.announcement.create({
      data: {
        title,
        date: new Date(date),
        year,
        body,
        linkUrl,
        files: { create: annFiles },
      },
      include: { files: true },
    });

    res.json({ ok: true, announcement: ann });
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

module.exports = { getAnnouncements, addAnnouncement, deleteAnnouncement, upload };
