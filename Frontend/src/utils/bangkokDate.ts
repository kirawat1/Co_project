// วันที่ตามเวลาไทย (YYYY-MM-DD) — ใช้แทน new Date().toISOString().slice(0, 10) ซึ่งเป็นวันตาม UTC
// (ก่อน 07:00 น. ได้วันของเมื่อวาน: หนังสือลงวันผิด · รอบที่เปิด "วันนี้" ยังยื่นคำร้องไม่ได้จนถึง 07:00)
// ตรงกับ backend/utils/applyWindow.js (bangkokDay)

export function bangkokDay(d: Date | string | number = new Date()): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

export const todayBangkok = (): string => bangkokDay(new Date());

/** อยู่ในช่วงวันเริ่ม–วันสิ้นสุด (นับทั้งวันตามเวลาไทย) */
export function inBangkokDayRange(start: Date | string | number, end: Date | string | number, now: Date = new Date()): boolean {
  const today = bangkokDay(now);
  return today >= bangkokDay(start) && today <= bangkokDay(end);
}
