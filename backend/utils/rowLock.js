// คิวต่อนักศึกษา — ล็อกแถว Student เป็นคำสั่งแรกของ transaction ก่อนอ่านสถานะ
// คำขอพร้อมกันของนักศึกษาคนเดียวกัน (กดรัว · 2 แท็บ · อาจารย์ + เจ้าหน้าที่) จึงทำทีละคำขอ และคำขอหลังเห็นสถานะที่คำขอแรกเขียนแล้ว
// เดิม "อ่านสถานะ → ผ่านด่าน → เขียน" ไม่ล็อก: ตัดสินคำร้องพร้อมกัน 3 แบบผ่านทั้ง 3 · ส่งไฟล์ T000/ใบตอบรับรัว ๆ ได้แถวซ้ำ 6 แถว
// ต้องเป็นคำสั่งแรก: MySQL (REPEATABLE READ) จับภาพข้อมูลตอนอ่านครั้งแรก — อ่านก่อนล็อก = เห็นข้อมูลเก่าแม้รอล็อกแล้ว
// หลายคน (หนังสือรวม) ล็อกเรียงตาม id เสมอ กันสองคำขอรอกันเอง (deadlock)

const { isDbId } = require('./dbId');
const idList = (ids) => [...new Set([].concat(ids).map(Number).filter(isDbId))].sort((a, b) => a - b);

async function lockStudents(tx, ids) {
  for (const id of idList(ids)) {
    await tx.$queryRaw`SELECT id FROM Student WHERE id = ${id} FOR UPDATE`;
  }
}

// ── นิเทศ ──────────────────────────────────────────────────────────────
// คิวต่ออาจารย์ — ล็อกแถว Teacher ของผู้นิเทศหลัก + อาจารย์ร่วม ก่อนตรวจเวลาชน
// เดิมตรวจเวลาชนแบบอ่านอย่างเดียว: อาจารย์คนเดียวกดยืนยันนักศึกษา 2 คนเวลาทับกันพร้อมกัน → ผ่านทั้งคู่ (นัดซ้อน)
// ใช้คู่กับ LOCK_TX (ReadCommitted) — คำสั่งอ่านหลังได้ล็อกเห็นนัดที่อีกคำขอเพิ่งบันทึก จึงล็อกหลังอ่านข้อมูลนัดได้
// ลำดับล็อกทั้งระบบ: อาจารย์ (เรียง id) → นัด (เรียง id) — ทุกเส้นทางเรียงแบบเดียวกัน กันรอกันเอง
async function lockTeachers(tx, ids) {
  for (const id of idList(ids)) {
    await tx.$queryRaw`SELECT id FROM Teacher WHERE id = ${id} FOR UPDATE`;
  }
}

// คิวต่อนัด — กดซ้ำ/หลายคนกดพร้อมกันกับนัดเดียวกัน (จบนิเทศ · อัปโหลดหนังสือ · แก้รายชื่ออาจารย์ร่วม) ทำทีละคำขอ
async function lockAppointments(tx, ids) {
  for (const id of idList(ids)) {
    await tx.$queryRaw`SELECT id FROM SupervisionAppointment WHERE id = ${id} FOR UPDATE`;
  }
}

const LOCK_TX = { isolationLevel: 'ReadCommitted', timeout: 15000 };

module.exports = { lockStudents, lockTeachers, lockAppointments, LOCK_TX };
