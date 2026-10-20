// __tests__/applyWindow.test.js — ข้อความบอกนักศึกษาว่าทำไมยื่นคำร้องไม่ได้ + วันที่แบบไทย
// (ช่วงยื่นคำร้อง = รอบรับสมัครของหลักสูตร — APPLY_CONFIG เดิมเลิกใช้ตั้งแต่ปฏิทินของรอบ)
const { applyWindowMessage, thaiDate } = require('../utils/applyWindow');

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
