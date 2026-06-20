const prisma = require('../config/prismaClient');

// ถ้า period.isActive=true แต่ endDate ผ่านไปแล้ว (เจ้าหน้าที่ลืมกดปิด)
// ให้ปิดอัตโนมัติ (persist ลง DB) แล้วคืน period ที่ isActive=false
// เรียกใช้ทุกจุดที่เช็คว่ารอบรับสมัครเปิดอยู่หรือไม่ เพื่อกันยื่นเกินกำหนด
async function autoCloseIfExpired(period) {
  if (!period || !period.isActive || !period.endDate) return period;
  if (new Date(period.endDate) >= new Date()) return period;

  await prisma.coopPeriod.update({
    where: { id: period.id },
    data: { isActive: false },
  });
  return { ...period, isActive: false };
}

module.exports = { autoCloseIfExpired };
