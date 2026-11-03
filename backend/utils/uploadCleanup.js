const fs = require('fs');
const path = require('path');
const prisma = require('../config/prismaClient');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const SUPERVISION_PREFIX = 'supervision/';

/**
 * ลบไฟล์ใน backend/uploads ที่ไม่มีข้อมูลไหนอ้างถึงแล้ว — เรียกหลังลบข้อมูลใน DB สำเร็จ
 * ข้ามไฟล์ที่ยังถูกอ้างถึง (กันลบไฟล์ที่ใช้ร่วมกัน) และตัดชื่อเหลือแค่ชื่อไฟล์ (กันหลุดออกนอกโฟลเดอร์)
 * ลบไม่ได้ (ไม่มีไฟล์แล้ว/ถูกล็อก) ก็ข้ามไป ไม่ทำให้การลบข้อมูลล้มเหลว
 * "supervision/<ชื่อไฟล์>" = หนังสือขอนิเทศ (เก็บใน uploads/supervision — หนังสือรวมของกลุ่มใช้ไฟล์เดียวกัน)
 *   เดิมส่งชื่อเปล่ามา แล้วลบที่ uploads/ ซึ่งไม่ใช่ที่อยู่จริง — ลบนักศึกษาถาวรแล้วไฟล์หนังสือขอนิเทศค้าง
 */
async function removeUnreferencedUploads(filenames) {
  const items = new Map();
  for (const raw of filenames.filter(Boolean).map(String)) {
    const supervision = raw.startsWith(SUPERVISION_PREFIX);
    const name = path.basename(raw);
    items.set(`${supervision ? SUPERVISION_PREFIX : ''}${name}`, { name, supervision });
  }
  let removed = 0;
  for (const { name, supervision } of items.values()) {
    const refs = supervision
      ? [prisma.supervisionAppointment.count({ where: { officialLetterPath: name } })]
      : [
        prisma.document.count({ where: { path: name } }),
        prisma.studentCoop.count({ where: { OR: [{ reqLetterUrl: name }, { acceptanceFileUrl: name }, { placeLetterUrl: name }] } }),
      ];
    if ((await Promise.all(refs)).some((n) => n > 0)) continue;
    try { fs.unlinkSync(path.join(UPLOAD_DIR, supervision ? 'supervision' : '', name)); removed++; } catch (_) { /* ไม่มีไฟล์แล้ว */ }
  }
  return removed;
}

module.exports = { removeUnreferencedUploads, SUPERVISION_PREFIX };
