const prisma = require('../config/prismaClient');

// เวลาที่รอบรับสมัครปิดจริง = สิ้นวันปิดรับสมัครตามเวลาไทย (23:59:59.999 +07:00)
// หน้าจอส่งวันปิดเป็น "YYYY-MM-DD" ซึ่งถูกเก็บเป็นเที่ยงคืน UTC (= 07:00 เวลาไทย)
// เดิมเทียบกับค่านั้นตรงๆ รอบจึงปิดตั้งแต่ 07:00 ของวันสุดท้าย และกด "เปิดรับสมัคร" ในวันนั้นแล้ว
// จะถูกปิดกลับทันทีตอนโหลดรายการใหม่แบบไม่มี error
function periodCloseAt(endDate) {
  const thaiDay = new Date(endDate).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
  return new Date(`${thaiDay}T23:59:59.999+07:00`);
}

function isPeriodExpired(period, now = new Date()) {
  if (!period || !period.endDate) return false;
  return now > periodCloseAt(period.endDate);
}

// ถ้า period.isActive=true แต่เลยวันปิดรับสมัครแล้ว (เจ้าหน้าที่ลืมกดปิด)
// ให้ปิดอัตโนมัติ (persist ลง DB) แล้วคืน period ที่ isActive=false
// เรียกใช้ทุกจุดที่เช็คว่ารอบรับสมัครเปิดอยู่หรือไม่ เพื่อกันยื่นเกินกำหนด
async function autoCloseIfExpired(period) {
  if (!period || !period.isActive || !isPeriodExpired(period)) return period;

  await prisma.coopPeriod.update({
    where: { id: period.id },
    data: { isActive: false },
  });
  return { ...period, isActive: false };
}

module.exports = { autoCloseIfExpired, isPeriodExpired, periodCloseAt };
