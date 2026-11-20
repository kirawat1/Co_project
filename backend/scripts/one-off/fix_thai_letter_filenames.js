// แก้ชื่อไฟล์หนังสือฉบับลงนามที่เพี้ยน (เช่น "à¸«à¸à¸±à¸à¸ªà¸·à¸­..." แทน "หนังสือ...")
// สาเหตุ: ออกหนังสือ (เดี่ยว/รวม) เก็บชื่อไฟล์จาก multer ตรง ๆ ซึ่งเป็น latin1 — แก้โค้ดแล้ว 2026-11-21 (adminDocController uploadedName)
// แปลงกลับได้ครบ (ไบต์ UTF-8 เดิมยังอยู่) · แก้เฉพาะแถวที่แปลงแล้วได้ข้อความสมบูรณ์ ไม่มีตัวอักษรเสีย · รันซ้ำได้
//   node scripts/one-off/fix_thai_letter_filenames.js --dry-run   ดูว่าจะแก้แถวไหน
//   node scripts/one-off/fix_thai_letter_filenames.js             แก้จริง
require('dotenv').config();
const prisma = require('../../config/prismaClient');

// ตัวอักษรไทยใน UTF-8 ขึ้นต้นด้วยไบต์ E0 B8 / E0 B9 → อ่านเป็น latin1 ได้ "à¸" / "à¹"
const GARBLED = /à[¸¹]/;

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const rows = await prisma.document.findMany({
    where: { OR: [{ name: { contains: 'à¸' } }, { name: { contains: 'à¹' } }] },
    select: { id: true, type: true, name: true },
  });
  let fixed = 0, skipped = 0;
  for (const d of rows) {
    if (!GARBLED.test(d.name)) continue;
    const name = Buffer.from(d.name, 'latin1').toString('utf8');
    if (name.includes('�') || !/[฀-๿]/.test(name)) { skipped++; console.log(`ข้าม #${d.id} (แปลงแล้วไม่สมบูรณ์): ${d.name}`); continue; }
    console.log(`${dryRun ? '[dry-run] ' : ''}#${d.id} ${d.type}: ${name}`);
    if (!dryRun) await prisma.document.update({ where: { id: d.id }, data: { name } });
    fixed++;
  }
  console.log(`${dryRun ? '[dry-run] จะแก้' : 'แก้แล้ว'} ${fixed} แถว${skipped ? ` · ข้าม ${skipped} แถว` : ''}`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
