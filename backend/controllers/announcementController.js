//backend/controllers/announcementController.js
const prisma = require("../config/prismaClient");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { pdfOrImageFileFilter } = require('../utils/fileFilters');
const { getMajorScope } = require('../utils/majorScope');
const audience = require('../utils/announcementAudience');

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

// ไฟล์/ลิงก์แนบ → รูปแบบเดียวที่หน้าเว็บใช้ (มี id ของไฟล์ไว้ "เก็บไฟล์เดิม" ตอนแก้ไข)
function attachmentsOf(a) {
  const links = (() => {
    if (!a.linkUrl) return [];
    try {
      const parsed = JSON.parse(a.linkUrl);
      return Array.isArray(parsed) ? parsed : [a.linkUrl];
    } catch { return [a.linkUrl]; }
  })();
  return [
    ...a.files.map((f) => ({ id: f.id, type: f.mime.startsWith('image/') ? 'image' : 'file', name: f.name, url: `/uploads/${f.path}` })),
    ...links.map((l) => ({ type: 'link', name: l, url: l })),
  ];
}

async function authorNames(list) {
  const ids = [...new Set(list.map((a) => a.authorId).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: true, email: true, teacher: { select: { prefix: true, firstName: true, lastName: true } }, staffProfile: { select: { firstName: true, lastName: true } } },
  });
  return new Map(users.map((u) => {
    const t = u.teacher, st = u.staffProfile;
    const name = t ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim() : st ? `${st.firstName || ''} ${st.lastName || ''}`.trim() : '';
    return [u.id, name || (u.role === 'staff' ? 'เจ้าหน้าที่' : u.email)];
  }));
}

// GET /api/announcements?year=&room= — ห้อง = รอบ × หลักสูตร (room = รหัสหลักสูตร หรือ GLOBAL)
// นักศึกษา: ไม่สน year/room ที่ส่งมา — ใช้รอบและหลักสูตรของตัวเองเสมอ
const getAnnouncements = async (req, res) => {
  try {
    const viewer = await audience.viewerOf(req);
    if (viewer.kind === 'none') return res.json({ ok: true, list: [], viewer: { kind: 'none' } });
    const year = viewer.kind === 'student' ? viewer.year : (req.query.year ? String(req.query.year) : null);
    const room = viewer.kind === 'student' ? null : (req.query.room ? String(req.query.room) : null);
    if (viewer.kind === 'student' && !year) return res.json({ ok: true, list: [], viewer: { kind: 'student', year: null, majors: viewer.majors } });

    const now = new Date();
    const list = (await prisma.announcement.findMany({
      where: year ? { year } : {},
      orderBy: [{ pinned: 'desc' }, { date: 'desc' }, { createdAt: 'desc' }],
      include: { files: true },
    })).filter((a) => audience.canSee(viewer, a, now) && audience.inRoom(a, room));

    const names = await authorNames(list);
    res.json({
      ok: true,
      viewer: { kind: viewer.kind, year, majors: viewer.majors, writeMajors: viewer.writeMajors },
      list: list.map((a) => {
        const targets = audience.targetsOf(a);
        return {
          id: a.id, title: a.title, body: a.body, date: a.date, year: a.year,
          targetMajors: targets, linkUrl: a.linkUrl,
          pinned: a.pinned, publishAt: a.publishAt, scheduled: !audience.isPublished(a, now),
          createdAt: a.createdAt, updatedAt: a.updatedAt,
          author: a.authorId ? names.get(a.authorId) || null : null,
          canEdit: audience.canWrite(viewer, targets),
          attachments: attachmentsOf(a),
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาด" });
  }
};

// GET /api/announcements/rooms?year= — การ์ดห้อง: จำนวนประกาศ · ปักหมุด · ล่าสุด (เฉพาะห้องที่ผู้ดูเข้าได้)
const getRooms = async (req, res) => {
  try {
    const viewer = await audience.viewerOf(req);
    const year = viewer.kind === 'student' ? viewer.year : (req.query.year ? String(req.query.year) : null);
    const rooms = await audience.roomsFor(viewer);
    const now = new Date();
    const list = (await prisma.announcement.findMany({ where: year ? { year } : {}, select: { targetMajors: true, pinned: true, date: true, publishAt: true, year: true } }))
      .filter((a) => audience.canSee(viewer, a, now));
    const years = viewer.kind === 'student'
      ? (year ? [year] : [])
      : [...new Set((await prisma.announcement.findMany({ select: { year: true }, distinct: ['year'] })).map((a) => a.year))];
    res.json({
      ok: true,
      year,
      years,
      viewer: { kind: viewer.kind, majors: viewer.majors, writeMajors: viewer.writeMajors },
      rooms: rooms.map((room) => {
        const inside = list.filter((a) => (room === audience.GLOBAL_ROOM ? audience.isGlobal(a) : audience.inRoom(a, room)));
        const own = room === audience.GLOBAL_ROOM ? inside : inside.filter((a) => !audience.isGlobal(a));
        return {
          room,
          count: inside.length,
          ownCount: own.length,                 // ไม่นับประกาศส่วนกลางที่ขึ้นทุกห้อง
          pinned: inside.filter((a) => a.pinned).length,
          scheduled: inside.filter((a) => !audience.isPublished(a, now)).length,
          latest: inside.reduce((m, a) => (!m || new Date(a.date) > new Date(m) ? a.date : m), null),
          canPost: room === audience.GLOBAL_ROOM ? viewer.kind === 'staff' : audience.canWrite(viewer, [room]),
        };
      }),
    });
  } catch (err) {
    console.error('[getRooms]', err);
    res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาด' });
  }
};

// PATCH /api/announcements/:id/pin { pinned }
const setPinned = async (req, res) => {
  try {
    const viewer = await audience.viewerOf(req);
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id }, select: { targetMajors: true } });
    if (!ann) return res.status(404).json({ ok: false, message: 'ไม่พบประกาศ' });
    if (!audience.canWrite(viewer, audience.targetsOf(ann))) return res.status(403).json({ ok: false, message: 'ปักหมุดได้เฉพาะประกาศของหลักสูตรที่คุณดูแล' });
    const pinned = req.body?.pinned === true;
    await prisma.announcement.update({ where: { id: req.params.id }, data: { pinned } });
    res.json({ ok: true, pinned });
  } catch (err) {
    console.error('[setPinned]', err);
    res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาด' });
  }
};

const addOrUpdateAnnouncement = async (req, res) => {
  try {
    const { id, title, body, date, year, linkUrls, keepFileIds, targetMajors: rawTargetMajors, pinned, publishAt: rawPublishAt } = req.body;
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
    if (!Array.isArray(targetMajors)) targetMajors = [];

    // อาจารย์ประจำวิชา: ต้องเลือกหลักสูตรเป้าหมาย และเลือกได้เฉพาะหลักสูตรที่ดูแล (ประกาศ "ทุกหลักสูตร" = งานเจ้าหน้าที่)
    const scope = await getMajorScope(req);
    const allowed = (majors) => scope.all || (majors.length > 0 && majors.every((m) => scope.majors.includes(m)));
    if (!allowed(targetMajors)) {
      files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
      return res.status(403).json({ ok: false, message: `ประกาศได้เฉพาะหลักสูตรที่คุณดูแล (${scope.majors.join(', ') || '-'})` });
    }

    // ตั้งเวลาเผยแพร่ — ว่าง = ทันที · วันเวลาไม่ถูกต้อง → 400
    let publishAt = null;
    if (rawPublishAt) {
      publishAt = new Date(rawPublishAt);
      if (isNaN(publishAt.getTime())) {
        files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
        return res.status(400).json({ ok: false, message: 'เวลาเผยแพร่ไม่ถูกต้อง' });
      }
      if (publishAt <= new Date()) publishAt = null; // เวลาผ่านไปแล้ว = เผยแพร่เลย
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
      ...(pinned !== undefined ? { pinned: pinned === true || pinned === 'true' } : {}),
      publishAt,
    };

    if (id) {
      // UPDATE
      const ann = await prisma.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) {
        files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
        return res.status(404).json({ ok: false, message: "ไม่พบประกาศ" });
      }
      if (!allowed(Array.isArray(ann.targetMajors) ? ann.targetMajors : [])) {
        files.forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) {} });
        return res.status(403).json({ ok: false, message: 'แก้ได้เฉพาะประกาศของหลักสูตรที่คุณดูแล' });
      }

      let parsedKeepFileIds = [];
      if (keepFileIds) {
        try {
          const parsed = JSON.parse(keepFileIds);
          parsedKeepFileIds = Array.isArray(parsed) ? parsed : [];
        } catch { parsedKeepFileIds = []; }
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

      // เลื่อนเวลาเผยแพร่ของประกาศที่ยังไม่ได้แจ้ง → ให้งานตั้งเวลาแจ้งตอนถึงเวลาใหม่ · ถึงเวลาแล้ว → แจ้งเลย
      audience.notifyIfDue(updated.id).catch((e) => console.error('[announcement notify]', e));
      return res.json({ ok: true, announcement: updated });
    } else {
      // CREATE ใหม่
      const ann = await prisma.announcement.create({
        data: { ...sharedData, authorId: req.user?.id ?? null, files: { create: annFiles } },
        include: { files: true },
      });
      // เผยแพร่ทันที → แจ้งนักศึกษาเลย · ตั้งเวลา → งานตั้งเวลาแจ้งตอนถึงเวลา
      audience.notifyIfDue(ann.id).catch((e) => console.error('[announcement notify]', e));
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
    const scope = await getMajorScope(req);
    await prisma.$transaction(async (tx) => {
      const ann = await tx.announcement.findUnique({ where: { id }, include: { files: true } });
      if (!ann) { statusErr = { code: 404, msg: "ไม่พบประกาศ" }; throw new Error('not-found'); }
      const targets = Array.isArray(ann.targetMajors) ? ann.targetMajors : [];
      if (!scope.all && !(targets.length > 0 && targets.every((m) => scope.majors.includes(m)))) {
        statusErr = { code: 403, msg: 'ลบได้เฉพาะประกาศของหลักสูตรที่คุณดูแล' }; throw new Error('forbidden');
      }
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

module.exports = { getAnnouncements, getRooms, setPinned, addOrUpdateAnnouncement, deleteAnnouncement, upload };
//backend/controllers/announcementController.js