const fs = require('fs');
const path = require('path');
const prisma = require('../config/prismaClient');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

/**
 * ลบไฟล์ใน backend/uploads ที่ไม่มีข้อมูลไหนอ้างถึงแล้ว — เรียกหลังลบข้อมูลใน DB สำเร็จ
 * ข้ามไฟล์ที่ยังถูกอ้างถึง (กันลบไฟล์ที่ใช้ร่วมกัน) และตัดชื่อเหลือแค่ชื่อไฟล์ (กันหลุดออกนอกโฟลเดอร์)
 * ลบไม่ได้ (ไม่มีไฟล์แล้ว/ถูกล็อก) ก็ข้ามไป ไม่ทำให้การลบข้อมูลล้มเหลว
 */
async function removeUnreferencedUploads(filenames) {
  const names = [...new Set(filenames.filter(Boolean).map((f) => path.basename(String(f))))];
  let removed = 0;
  for (const name of names) {
    const [docs, coops, supervisions] = await Promise.all([
      prisma.document.count({ where: { path: name } }),
      prisma.studentCoop.count({ where: { OR: [{ reqLetterUrl: name }, { acceptanceFileUrl: name }, { placeLetterUrl: name }] } }),
      prisma.supervisionAppointment.count({ where: { officialLetterPath: name } }),
    ]);
    if (docs + coops + supervisions > 0) continue;
    try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); removed++; } catch (_) { /* ไม่มีไฟล์แล้ว */ }
  }
  return removed;
}

module.exports = { removeUnreferencedUploads };
