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
