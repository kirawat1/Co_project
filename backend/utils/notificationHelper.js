const prisma = require('../config/prismaClient');

async function createNotifications(userIds, { type, title, message, link, relatedId = null }) {
  if (!userIds || !userIds.length) return;

  await prisma.$transaction(async (tx) => {
    // ต้องเทียบ message ด้วย — ไม่งั้นแจ้งเตือนคนละเหตุการณ์ที่ใช้ type/relatedId เดียวกัน
    // (เช่น STATUS_UPDATED ทุกสถานะของ นศ. คนเดียวกัน) จะถูกกลืนหายเงียบ ๆ
    // ตราบใดที่ นศ. ยังไม่กดอ่านอันแรก
    const existing = await tx.notification.findMany({
      where: { userId: { in: userIds }, type, message, relatedId: relatedId ?? null, isRead: false },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map(n => n.userId));
    const newIds = userIds.filter(id => !existingSet.has(id));
    if (!newIds.length) return;

    await tx.notification.createMany({
      data: newIds.map(userId => ({ userId, type, title, message, link, relatedId: relatedId ?? null })),
    });
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
