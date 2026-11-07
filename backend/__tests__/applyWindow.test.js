// __tests__/applyWindow.test.js — ข้อความบอกนักศึกษาว่าทำไมยื่นคำร้องไม่ได้ + วันที่แบบไทย
// (ช่วงยื่นคำร้อง = รอบรับสมัครของหลักสูตร — APPLY_CONFIG เดิมเลิกใช้ตั้งแต่ปฏิทินของรอบ)
const { applyWindowMessage, thaiDate, applyState, notStartedYet } = require('../utils/applyWindow');

describe('applyWindowMessage', () => {
  const range = { startDate: '2026-10-01', endDate: '2026-10-15' };

  test('เปิดอยู่ / ไม่มีสถานะ → ไม่มีข้อความ', () => {
    expect(applyWindowMessage({ open: true })).toBeNull();
    expect(applyWindowMessage(null)).toBeNull();
  });

  test('ยังไม่ถึง / เลยกำหนด → บอกช่วงเป็นวันที่ไทย', () => {
    expect(applyWindowMessage({ ...range, open: false, reason: 'NOT_YET' })).toBe('ยังไม่ถึงช่วงเวลายื่นคำร้อง (ช่วงยื่นคำร้อง 1 ต.ค. 2569 ถึง 15 ต.ค. 2569)');
    expect(applyWindowMessage({ ...range, open: false, reason: 'ENDED' })).toBe('ปิดรับคำร้องแล้ว (ช่วงยื่นคำร้อง 1 ต.ค. 2569 ถึง 15 ต.ค. 2569)');
  });

  test('ไม่มีรอบเปิด → ปิดรับคำร้อง', () => {
    expect(applyWindowMessage({ open: false, reason: 'CLOSED' })).toBe('ขณะนี้ปิดรับคำร้องขอเข้าร่วมสหกิจศึกษา');
  });
});

describe('thaiDate', () => {
  test('YYYY-MM-DD → วัน เดือนย่อ พ.ศ. · ว่าง → null', () => {
    expect(thaiDate('2026-07-03')).toBe('3 ก.ค. 2569');
    expect(thaiDate('')).toBeNull();
  });
});

// ผู้ใช้ตัดสิน 2026-11-05: ต้องเปิดสวิตช์ "และ" ถึงวันเปิดรับสมัคร (เวลาไทย) แล้ว
describe('applyState', () => {
  const at = (iso) => new Date(iso);
  const row = (start, extra = {}) => ({ isActive: true, startDate: at(start), endDate: at('2026-12-31T17:00:00Z'), ...extra });

  test('ไม่มีรอบ / ปิดสวิตช์ → CLOSED', () => {
    expect(applyState(null)).toMatchObject({ configured: false, open: false, reason: 'CLOSED' });
    expect(applyState(row('2026-10-01T00:00:00Z', { isActive: false }))).toMatchObject({ configured: true, open: false, reason: 'CLOSED' });
  });

  test('ยังไม่ถึงวันเปิด → NOT_YET พร้อมวัน · ถึงวันเปิดแล้ว (นับตามวันที่ไทย) → open', () => {
    // วันเปิด 10 พ.ย. (00:00 น. ไทย = 9 พ.ย. 17:00 UTC)
    const r = row('2026-11-09T17:00:00Z');
    expect(applyState(r, at('2026-11-09T16:59:00Z'))).toMatchObject({ open: false, reason: 'NOT_YET', startDate: '2026-11-10', endDate: '2027-01-01' });
    expect(applyState(r, at('2026-11-09T17:00:00Z'))).toMatchObject({ open: true, reason: null });
    expect(notStartedYet(r, at('2026-11-09T16:59:00Z'))).toBe(true);
  });

  test('ไม่มีวันเปิด → ถือว่าเริ่มแล้ว', () => {
    expect(applyState({ isActive: true, startDate: null, endDate: null })).toMatchObject({ open: true });
  });
});
