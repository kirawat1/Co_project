// ล้างข้อมูลสะสมที่ไม่ใช้แล้ว — วันละครั้ง (เริ่มหลัง server ขึ้น 1 นาที)
// การแจ้งเตือนที่อ่านแล้วเกิน 180 วัน: ไม่มีหน้าไหนแสดงแล้ว (กระดิ่งแสดงล่าสุด) แต่ตารางโตทุกการเปลี่ยนสถานะ × ทุกคนที่เกี่ยวข้อง
// ยังไม่อ่าน = เก็บไว้ (ผู้ใช้ยังไม่เห็น) · ปรับวันได้ด้วย NOTIFICATION_RETENTION_DAYS
const prisma = require('../config/prismaClient');

const DAY = 86400000;

function retentionDays() {
  const n = Number.parseInt(process.env.NOTIFICATION_RETENTION_DAYS, 10);
  return Number.isFinite(n) && n >= 30 ? n : 180; // ต่ำกว่า 30 วันน่าจะพิมพ์ผิด — ใช้ค่าเริ่ม
}

async function pruneReadNotifications(now = new Date(), days = retentionDays()) {
  const { count } = await prisma.notification.deleteMany({
    where: { isRead: true, createdAt: { lt: new Date(now.getTime() - days * DAY) } },
  });
  return count;
}

async function runRetention() {
  const removed = await pruneReadNotifications();
  if (removed) console.log(`[retention] ลบการแจ้งเตือนที่อ่านแล้วเกิน ${retentionDays()} วัน: ${removed} รายการ`);
}

function startRetentionJob({ firstDelayMs = 60_000, intervalMs = DAY } = {}) {
  const tick = () => runRetention().catch((err) => console.error('[retention]', err));
  const first = setTimeout(tick, firstDelayMs);
  const every = setInterval(tick, intervalMs);
  first.unref?.();
  every.unref?.();
  return { first, every };
}

module.exports = { pruneReadNotifications, retentionDays, runRetention, startRetentionJob };
