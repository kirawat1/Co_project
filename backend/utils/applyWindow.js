/**
 * applyWindow.js — ข้อความเรื่องช่วงยื่นคำร้องสหกิจ
 *
 * ช่วงยื่นคำร้อง = รอบรับสมัครของหลักสูตรที่เปิดอยู่ (CoopPeriodMajor — ปิดเองเมื่อเลยวันปิด) ตั้งที่หน้ารอบสหกิจที่เดียว
 * (เดิมมี APPLY_CONFIG ตั้งซ้อนอีกชั้น — เลิกใช้ตั้งแต่ปฏิทินของรอบ)
 */

// ข้อความบอกนักศึกษาว่าทำไมยื่นไม่ได้ — ใช้ทั้ง API และหน้าเว็บ
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}
function applyWindowMessage(state) {
  if (!state || state.open) return null;
  const range = state.startDate || state.endDate
    ? ` (ช่วงยื่นคำร้อง ${thaiDate(state.startDate) || '-'} ถึง ${thaiDate(state.endDate) || '-'})`
    : '';
  if (state.reason === 'NOT_YET') return `ยังไม่ถึงช่วงเวลายื่นคำร้อง${range}`;
  if (state.reason === 'ENDED') return `ปิดรับคำร้องแล้ว${range}`;
  return 'ขณะนี้ปิดรับคำร้องขอเข้าร่วมสหกิจศึกษา';
}

module.exports = { applyWindowMessage, thaiDate };
