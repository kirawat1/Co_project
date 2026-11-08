// คิวต่อนักศึกษา — ล็อกแถว Student เป็นคำสั่งแรกของ transaction ก่อนอ่านสถานะ
// คำขอพร้อมกันของนักศึกษาคนเดียวกัน (กดรัว · 2 แท็บ · อาจารย์ + เจ้าหน้าที่) จึงทำทีละคำขอ และคำขอหลังเห็นสถานะที่คำขอแรกเขียนแล้ว
// เดิม "อ่านสถานะ → ผ่านด่าน → เขียน" ไม่ล็อก: ตัดสินคำร้องพร้อมกัน 3 แบบผ่านทั้ง 3 · ส่งไฟล์ T000/ใบตอบรับรัว ๆ ได้แถวซ้ำ 6 แถว
// ต้องเป็นคำสั่งแรก: MySQL (REPEATABLE READ) จับภาพข้อมูลตอนอ่านครั้งแรก — อ่านก่อนล็อก = เห็นข้อมูลเก่าแม้รอล็อกแล้ว
// หลายคน (หนังสือรวม) ล็อกเรียงตาม id เสมอ กันสองคำขอรอกันเอง (deadlock)

async function lockStudents(tx, ids) {
  const list = [...new Set([].concat(ids).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  for (const id of list) {
    await tx.$queryRaw`SELECT id FROM Student WHERE id = ${id} FOR UPDATE`;
  }
}

module.exports = { lockStudents };
