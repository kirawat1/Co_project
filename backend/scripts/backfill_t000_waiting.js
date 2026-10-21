// นักศึกษาที่อัปโหลด T000 ครบหัวข้อบังคับไปก่อนระบบเปลี่ยนสถานะให้ (ยังค้าง "ผ่านคุณสมบัติ")
//   → "รอเจ้าหน้าที่ตรวจ" (WAITING_FOR_STAFF_CHECK, t000Status PENDING) เหมือนส่งครบตอนนี้ — ขึ้นในรายการรอตรวจหน้า T000
// รันครั้งเดียวหลัง deploy (รันซ้ำได้ — คนที่ย้ายแล้วไม่อยู่ในสถานะผ่านคุณสมบัติ) · ไม่ส่งแจ้งเตือน
//   node scripts/backfill_t000_waiting.js --dry-run   ดูว่าจะย้ายใคร
//   node scripts/backfill_t000_waiting.js             เขียนจริง
require('dotenv').config();
const prisma = require('../config/prismaClient');
const { t000Complete, syncT000Submission } = require('../utils/submittedSteps');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const coops = await prisma.studentCoop.findMany({
    where: { status: 'QUALIFIED', student: { deletedAt: null } },
    select: { studentId: true, student: { select: { studentId: true, major: true } } },
  });
  let moved = 0;
  for (const coop of coops) {
    const major = coop.student?.major || null;
    const label = coop.student?.studentId || coop.studentId;
    if (dryRun) {
      if (!(await t000Complete(prisma, coop.studentId, major))) continue;
    } else {
      const result = await prisma.$transaction((tx) => syncT000Submission(tx, { studentId: coop.studentId, major }), { isolationLevel: 'ReadCommitted' });
      if (result !== 'SUBMITTED') continue;
    }
    moved++;
    console.log(`${dryRun ? '[dry-run] ' : ''}${label} (${major || 'ไม่ระบุหลักสูตร'}): ผ่านคุณสมบัติ → รอเจ้าหน้าที่ตรวจ`);
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}ย้าย ${moved} คน จาก ${coops.length} คนที่ยังเป็นผ่านคุณสมบัติ`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
