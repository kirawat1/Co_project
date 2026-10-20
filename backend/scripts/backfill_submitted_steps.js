// เติม StudentCoop.submittedSteps ให้นักศึกษาที่ส่ง T000/T002/T003 ไปก่อนมีปฏิทินของรอบ
// รันครั้งเดียวหลัง deploy (รันซ้ำได้ — ไม่ทับค่าที่มีอยู่)
//   node scripts/backfill_submitted_steps.js --dry-run   ดูว่าจะเติมอะไร
//   node scripts/backfill_submitted_steps.js             เขียนจริง
require('dotenv').config();
const prisma = require('../config/prismaClient');
const { requiredDocKeys, backfillEntries } = require('../utils/submittedSteps');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const coops = await prisma.studentCoop.findMany({
    select: { studentId: true, submittedSteps: true, student: { select: { studentId: true, major: true } } },
  });
  const requiredByMajor = new Map();
  let updated = 0;
  for (const coop of coops) {
    const major = coop.student?.major || null;
    if (!requiredByMajor.has(major)) requiredByMajor.set(major, await requiredDocKeys(prisma, major));
    const docs = await prisma.document.findMany({ where: { studentId: coop.studentId }, select: { type: true, uploadedAt: true } });
    const next = backfillEntries(coop.submittedSteps, docs, requiredByMajor.get(major));
    if (!next) continue;
    updated++;
    const added = Object.keys(next).filter((k) => !(coop.submittedSteps || {})[k]);
    console.log(`${dryRun ? '[dry-run] ' : ''}${coop.student?.studentId || coop.studentId}: + ${added.map((k) => `${k} ${next[k].at}`).join(' · ')}`);
    if (!dryRun) await prisma.studentCoop.update({ where: { studentId: coop.studentId }, data: { submittedSteps: next } });
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}เติม ${updated} คน จาก ${coops.length}`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
