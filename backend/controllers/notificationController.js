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
