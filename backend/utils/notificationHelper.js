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

// เจ้าหน้าที่ + อาจารย์ประจำวิชาที่ดูแลหลักสูตรของนักศึกษา (major) · ไม่ระบุหลักสูตร = เจ้าหน้าที่เท่านั้น
// (เดิมส่งอาจารย์ประจำวิชาทุกคนทุกหลักสูตร — อาจารย์ AI ได้แจ้งเตือนของนักศึกษา CS ที่หน้ารายการของตัวเองไม่แสดง)
async function getStaffAndCoopTeacherIds(major) {
  const or = [{ role: 'staff' }];
  if (major) or.push({ role: 'teacher', teacher: { isCoopTeacher: true, coopMajors: { some: { major } } } });
  const users = await prisma.user.findMany({ where: { OR: or }, select: { id: true } });
  return users.map(u => u.id);
}

// เฉพาะเจ้าหน้าที่ — งานที่อาจารย์ไม่มีหน้าจัดการ (ตรวจเอกสาร T000 / ใบตอบรับ)
async function getStaffIds() {
  const users = await prisma.user.findMany({ where: { role: 'staff' }, select: { id: true } });
  return users.map(u => u.id);
}

module.exports = { createNotifications, getStaffAndCoopTeacherIds, getStaffIds };
