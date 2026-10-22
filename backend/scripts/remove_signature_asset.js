// ลบไฟล์ระบบที่เลิกใช้ (ลายเซ็นคณบดี "SIGNATURE" และชนิดอื่นนอก ASSET_KEYS) — ทั้งแถวใน SystemAsset และไฟล์ใน uploads/system
// หนังสือโหลดไปลงนามจริง ไม่ใช้รูปลายเซ็นแล้ว · เดิมไฟล์นี้เปิดดูได้โดยไม่ต้อง login
// รันครั้งเดียวหลัง deploy (รันซ้ำได้):
//   node scripts/remove_signature_asset.js --dry-run   ดูว่าจะลบอะไร
//   node scripts/remove_signature_asset.js             ลบจริง
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prismaClient');
const { ASSET_KEYS } = require('../controllers/systemAssetController');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const stale = await prisma.systemAsset.findMany({ where: { key: { notIn: ASSET_KEYS } } });
  for (const a of stale) {
    const file = a.path ? path.join(__dirname, '../uploads/system', path.basename(a.path)) : null;
    const exists = !!file && fs.existsSync(file);
    console.log(`${dryRun ? '[dry-run] ' : ''}${a.key}: ลบแถว${exists ? ` + ไฟล์ ${path.basename(file)}` : ' (ไม่มีไฟล์บนดิสก์)'}`);
    if (dryRun) continue;
    await prisma.systemAsset.delete({ where: { key: a.key } });
    if (exists) fs.unlinkSync(file);
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}ลบ ${stale.length} รายการ (เก็บไว้: ${ASSET_KEYS.join(', ')})`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
