const { getStatusLabelTh } = require('../utils/coopStatusLabels');

describe('getStatusLabelTh', () => {
  test('คืน label ภาษาไทยตรงกับ status ที่รู้จัก', () => {
    expect(getStatusLabelTh('QUALIFIED')).toBe('ผ่านคุณสมบัติ');
    expect(getStatusLabelTh('INTERNSHIP_STARTED')).toBe('ออกฝึกสหกิจ');
    expect(getStatusLabelTh('COMPLETED')).toBe('นิเทศเสร็จสิ้น');
  });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status เป็น null/undefined', () => {
    expect(getStatusLabelTh(null)).toBe('ยังไม่ยื่นสหกิจ');
    expect(getStatusLabelTh(undefined)).toBe('ยังไม่ยื่นสหกิจ');
  });

  test('คืน "ยังไม่ยื่นสหกิจ" เมื่อ status ไม่อยู่ใน map', () => {
    expect(getStatusLabelTh('SOME_UNKNOWN_STATUS')).toBe('ยังไม่ยื่นสหกิจ');
  });
});
