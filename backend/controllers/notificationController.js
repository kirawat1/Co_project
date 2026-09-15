const prisma = require('../config/prismaClient');

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, isRead: false },
    });
    res.json({ ok: true, count });
  } catch (err) {
    console.error('[getUnreadCount]', err);
    res.status(500).json({ ok: false, count: 0 });
  }
};

// GET /api/notifications/counts — จำนวน unread แยกตาม type (สำหรับ badge แต่ละ menu item)
exports.getCounts = async (req, res) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.userId, isRead: false },
      select: { type: true },
    });
    const counts = {};
    for (const n of notifs) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    res.json({ ok: true, counts });
  } catch (err) {
    console.error('[getCounts]', err);
    res.status(500).json({ ok: false, counts: {} });
  }
};

// POST /api/notifications/mark-read { types: [...] } — กดเมนูไหน อ่านเฉพาะแจ้งเตือนของเมนูนั้น
// (เดิมกดเมนูใดก็ markAllRead ป้ายเมนูอื่นหายไปด้วย)
exports.markRead = async (req, res) => {
  try {
    const { types } = req.body || {};
    const valid = Array.isArray(types) && types.length > 0 && types.length <= 20
      && types.every((t) => typeof t === 'string' && /^[A-Z0-9_]{1,50}$/.test(t));
    if (!valid) return res.status(400).json({ ok: false, message: 'types ไม่ถูกต้อง' });

    const result = await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false, type: { in: types } },
      data: { isRead: true },
    });
    res.json({ ok: true, count: result.count });
  } catch (err) {
    console.error('[markRead]', err);
    res.status(500).json({ ok: false });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[markAllRead]', err);
    res.status(500).json({ ok: false });
  }
};
