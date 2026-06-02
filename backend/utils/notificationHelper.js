const prisma = require('../config/prismaClient');

async function createNotifications(userIds, { type, title, message, link, relatedId = null }) {
  if (!userIds || !userIds.length) return;

  const existing = await prisma.notification.findMany({
    where: { userId: { in: userIds }, type, relatedId: relatedId ?? null, isRead: false },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map(n => n.userId));
  const newIds = userIds.filter(id => !existingSet.has(id));
  if (!newIds.length) return;

  await prisma.notification.createMany({
    data: newIds.map(userId => ({ userId, type, title, message, link, relatedId: relatedId ?? null })),
  });
}

async function getStaffAndCoopTeacherIds() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'staff' },
        { role: 'teacher', teacher: { isCoopTeacher: true } },
      ],
    },
    select: { id: true },
  });
  return users.map(u => u.id);
}

module.exports = { createNotifications, getStaffAndCoopTeacherIds };
