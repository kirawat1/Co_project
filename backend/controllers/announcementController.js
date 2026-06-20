//backend/controllers/announcementController.js
const prisma = require("../config/prismaClient");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// Storage multer — ใช้ absolute path เพื่อให้ทำงานได้ไม่ว่า CWD จะเป็นอะไร
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, fileFilter: pdfOrImageFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

const getAnnouncements = async (req, res) => {
  try {
    const year = req.query.year;
    const major = req.query.major;

    const list = await prisma.announcement.findMany({
      where: year ? { year } : {},
      orderBy: { date: "desc" },
      include: { files: true },
    });

    // Application-level major filter: [] means all, otherwise check inclusion
    const filtered = major
      ? list.filter(a => {
          const targets = Array.isArray(a.targetMajors) ? a.targetMajors : [];
          return targets.length === 0 || targets.includes(major);
        })
      : list;

    const mapped = filtered.map(a => ({
      ...a,
      attachments: [
        ...(a.files.map(f => ({
          type: f.mime.startsWith("image/") ? "image" : "file",
          name: f.name,
          url: `/uploads/${f.path}`,
        }))),
        ...(a.linkUrl ? (() => {
          try {
            const parsed = JSON.parse(a.linkUrl);
            return Array.isArray(parsed)
              ? parsed.map(l => ({ type: "link", name: l, url: l }))
              : [{ type: "link", name: a.linkUrl, url: a.linkUrl }];
          } catch {
            return [{ type: "link", name: a.linkUrl, url: a.linkUrl }];
          }
        })() : [])
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
    const { id, title, body, date, year, linkUrls, keepFileIds, targetMajors: rawTargetMajors } = req.body;
    const files = req.files || [];

    if (!title || !date || !year)
      return res.status(400).json({ ok: false, message: "ข้อมูลไม่ครบ" });

    let targetMajors = [];
    if (rawTargetMajors) {
      try { targetMajors = JSON.parse(rawTargetMajors); } catch { targetMajors = []; }
    }

    // แปลงชื่อไฟล์ใหม่
    const annFiles = files.map(f => ({
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mime: f.mimetype,
      path: f.filename,
    }));

    const sharedData = {
      title,
      body,
      date: new Date(date),
      year,
      linkUrl: linkUrls ? JSON.stringify(JSON.parse(linkUrls)) : undefined,
      targetMajors,
    };

    if (id) {
      // UPDATE
      const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });

      // ลบไฟล์ที่ไม่อยู่ใน keepFileIds
      for (const f of ann.files) {
        if (!keepFileIds?.includes(f.id)) {
          const filePath = path.join(__dirname, '../uploads', f.path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          await prisma.annFile.delete({ where: { id: f.id } });
        }
      }

      // อัปเดตประกาศ
      const updated = await prisma.announcement.update({
        where: { id },
        data: { ...sharedData, files: { create: annFiles } },
        include: { files: true },
      });

      return res.json({ ok: true, announcement: updated });
    } else {
      // CREATE ใหม่
      const ann = await prisma.announcement.create({
        data: { ...sharedData, files: { create: annFiles } },
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