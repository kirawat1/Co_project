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

// ผู้ใช้ตัดสิน 2026-11-05: ยื่นได้เมื่อรอบของหลักสูตรเปิดรับ (isActive — ปิดเองเมื่อเลยวันปิด) "และ" ถึงวันเปิดรับสมัครแล้ว
// (เดิมดูแค่สวิตช์เปิด — เจ้าหน้าที่เปิดรอบไว้ล่วงหน้า นักศึกษายื่นได้ก่อนวันเปิดรับสมัคร)
const bangkokDay = (d) => (d ? new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }) : null);
const notStartedYet = (row, now = new Date()) => {
  const start = bangkokDay(row?.startDate);
  return !!start && bangkokDay(now) < start;
};
/** สถานะช่วงยื่นคำร้องจากแถว CoopPeriodMajor (null = หลักสูตรนี้ยังไม่ได้ตั้ง/ไม่มีรอบที่เปิด) */
function applyState(row, now = new Date()) {
  if (!row || !row.isActive) return { configured: !!row, open: false, reason: 'CLOSED', startDate: bangkokDay(row?.startDate), endDate: bangkokDay(row?.endDate) };
  const startDate = bangkokDay(row.startDate);
  const endDate = bangkokDay(row.endDate);
  if (notStartedYet(row, now)) return { configured: true, open: false, reason: 'NOT_YET', startDate, endDate };
  return { configured: true, open: true, reason: null, startDate, endDate };
}

module.exports = { applyWindowMessage, thaiDate, applyState, notStartedYet };
