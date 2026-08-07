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

    if (!title || !date || !year) {
      files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
      return res.status(400).json({ ok: false, message: "ข้อมูลไม่ครบ" });
    }

    // Validate linkUrls early — before any DB I/O — so bad input returns 400 without
    // leaving multer-uploaded files orphaned on disk (F2: null not undefined; F3: try/catch)
    let parsedLinkUrls = null;
    if (linkUrls) {
      let parsed;
      try { parsed = JSON.parse(linkUrls); } catch {
        files.forEach(f => { try { fs.unlinkSync(path.join(__dirname, '../uploads', f.filename)); } catch {} });
        return res.status(400).json({ ok: false, message: 'linkUrls มี JSON ไม่ถูกต้อง' });
      }
      const badUrl = parsed.find(u => !/^https?:\/\//i.test(u));
      if (badUrl) {
        files.forEach(f => { try { fs.unlinkSync(path.join(__dirname, '../uploads', f.filename)); } catch {} });
        return res.status(400).json({ ok: false, message: `URL ไม่ปลอดภัย: "${badUrl}" — รองรับเฉพาะ http:// และ https://` });
      }
      parsedLinkUrls = parsed;
    }

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
      linkUrl: parsedLinkUrls ? JSON.stringify(parsedLinkUrls) : null,
      targetMajors,
    };

    if (id) {
      // UPDATE
      const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) {
        files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
        return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });
      }

      let parsedKeepFileIds = [];
      if (keepFileIds) {
        try { parsedKeepFileIds = JSON.parse(keepFileIds); } catch { parsedKeepFileIds = []; }
      }
      const toDelete = ann.files.filter(f => !parsedKeepFileIds.includes(f.id));

      let updated;
      await prisma.$transaction(async (tx) => {
        if (toDelete.length > 0) {
          await tx.annFile.deleteMany({ where: { id: { in: toDelete.map(f => f.id) } } });
        }
        updated = await tx.announcement.update({
          where: { id },
          data: { ...sharedData, files: { create: annFiles } },
          include: { files: true },
        });
      });

      // Delete old files from disk after transaction commits — each in try/catch to prevent
      // error propagation into outer catch (which would incorrectly delete the newly-committed files)
      toDelete.forEach(f => {
        const filePath = path.join(__dirname, '../uploads', f.path);
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
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
    // Only delete new uploaded files if the transaction never committed (i.e., they are not yet in the DB)
    // res.json() would already have been called above if the transaction committed
    (req.files || []).forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบประกาศ' });
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    let filesToClean = [];
    let statusErr = null;
    await prisma.$transaction(async (tx) => {
      const ann = await tx.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) { statusErr = { code: 404, msg: "ไม่พบประกาศ" }; throw new Error('not-found'); }
      filesToClean = ann.files;
      await tx.announcement.delete({ where: { id } });
    }).catch((err) => { if (!statusErr) throw err; });
    if (statusErr) return res.status(statusErr.code).json({ ok: false, message: statusErr.msg });

    for (const f of filesToClean) {
      const filePath = path.join(__dirname, '../uploads', f.path);
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
    }

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบประกาศ' });
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

module.exports = { getAnnouncements, addOrUpdateAnnouncement, deleteAnnouncement, upload };
//backend/controllers/announcementController.js