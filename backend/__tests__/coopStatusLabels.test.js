const { getStatusLabelTh } = require('../utils/coopStatusLabels');

describe('getStatusLabelTh', () => {
  test('คืน label ภาษาไทยตรงกับ status ที่รู้จัก', () => {
    expect(getStatusLabelTh('QUALIFIED')).toBe('ผ่านคุณสมบัติ');
    expect(getStatusLabelTh('INTERNSHIP_STARTED')).toBe('ส่งเอกสารฝึกสหกิจ');
    // COMPLETED เป็น SupervisionStatus ไม่ใช่ CoopStatus — ถูกลบออกจาก map แล้ว
  });

  test.each(['T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED'])(
    'สถานะเก่า %s แสดงป้ายเดียวกับ INTERNSHIP_STARTED', (st) => {
      expect(getStatusLabelTh(st)).toBe('ส่งเอกสารฝึกสหกิจ');
    });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status เป็น null/undefined', () => {
    expect(getStatusLabelTh(null)).toBe('ยังไม่ยื่นสหกิจ');
    expect(getStatusLabelTh(undefined)).toBe('ยังไม่ยื่นสหกิจ');
  });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status ไม่อยู่ใน map', () => {
    expect(getStatusLabelTh('SOME_UNKNOWN_STATUS')).toBe('ยังไม่ยื่นสหกิจ');
  });
});
