// ลบแจ้งเตือนของเจ้าหน้าที่/อาจารย์ที่ค้างอยู่ — ไม่มีหน้าจอไหนแสดงแล้ว (เมนูใช้ตัวเลขงานที่รอจริงตั้งแต่ 2026-10-28)
// และระบบหยุดสร้างแจ้งเตือนให้ผู้ที่ไม่ใช่นักศึกษาแล้ว (utils/notificationHelper.js) · แจ้งเตือนของนักศึกษาไม่ถูกแตะ
// รันครั้งเดียวหลัง deploy (รันซ้ำได้):
//   node scripts/prune_staff_notifications.js --dry-run   ดูว่าจะลบกี่แถว
//   node scripts/prune_staff_notifications.js             ลบจริง
require('dotenv').config();
const prisma = require('../config/prismaClient');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  let total = 0;
  for (const role of ['staff', 'teacher']) {
    const [all, unread] = await Promise.all([
      prisma.notification.count({ where: { user: { role } } }),
      prisma.notification.count({ where: { user: { role }, isRead: false } }),
    ]);
    console.log(`${dryRun ? '[dry-run] ' : ''}${role}: ${all} แถว (ยังไม่อ่าน ${unread})`);
    total += all;
  }
  const students = await prisma.notification.count({ where: { user: { role: 'student' } } });
  if (!dryRun) {
    const { count } = await prisma.notification.deleteMany({ where: { user: { role: { in: ['staff', 'teacher'] } } } });
    total = count;
  }
  console.log(`${dryRun ? '[dry-run] จะลบ' : 'ลบแล้ว'} ${total} แถว · แจ้งเตือนของนักศึกษาคงไว้ ${students} แถว`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
