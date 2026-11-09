// id ที่ใช้ค้นในฐานข้อมูลได้จริง — จำนวนเต็มบวกไม่เกินช่วงของคอลัมน์ Int ใน MySQL (2,147,483,647)
// เดิมตรวจแค่ isNaN / <= 0: "99999999999999999999" ผ่านด่าน แล้ว Prisma โยน error ตอนค้น → ตอบ 500 แทน 400
const MAX_DB_INT = 2147483647;

function isDbId(n) {
  return Number.isInteger(n) && n > 0 && n <= MAX_DB_INT;
}

module.exports = { isDbId, MAX_DB_INT };
