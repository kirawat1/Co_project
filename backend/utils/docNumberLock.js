// กันเลขที่หนังสือซ้ำเมื่อออกหนังสือพร้อมกัน
// เลิก unique ที่ช่องเลขที่แล้ว (หนังสือรวมใช้เลขเดียวกันหลายคน) → ด่านในโค้ดต้องไม่โดนแข่งกันผ่าน:
//   1) ล็อกแถว (ประเภท, เลขที่) ใน DocNumberLock — transaction อื่นที่ขอเลขเดียวกันต้องรอจนรายแรก commit/rollback
//   2) transaction ใช้ READ COMMITTED → การตรวจเลขซ้ำหลังได้ล็อกเห็นข้อมูลที่รายแรกเพิ่ง commit (REPEATABLE READ จะเห็น snapshot เก่า)
// timeout เผื่อเวลารอคิวล็อก (ค่าเริ่มต้นของ Prisma 5 วินาที)
const DOC_NUMBER_TX = { isolationLevel: 'ReadCommitted', timeout: 15000 };

async function lockDocNumber(tx, kind, number) {
  if (!number) return;
  await tx.$executeRaw`INSERT INTO DocNumberLock (kind, number) VALUES (${kind}, ${number}) ON DUPLICATE KEY UPDATE number = number`;
}

module.exports = { lockDocNumber, DOC_NUMBER_TX };
