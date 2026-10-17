// __tests__/periodFilter.test.js — ตัวกรองรอบของรายชื่อนักศึกษา (none = ยังไม่เลือกรอบ)
const { studentPeriodWhere } = require('../utils/periodFilter');

test.each([undefined, '', 'all'])('%p → ไม่กรอง (ทุกคน)', (v) => {
  expect(studentPeriodWhere(v)).toEqual({ where: null });
});

test('ตัวเลข → รอบนั้น', () => {
  expect(studentPeriodWhere('3')).toEqual({ where: { coop: { coopPeriodId: 3 } } });
});

test('none → ยังไม่เคยยื่นคำร้อง หรือมีข้อมูลสหกิจแต่ยังไม่ผูกรอบ', () => {
  expect(studentPeriodWhere('none')).toEqual({ where: { OR: [{ coop: null }, { coop: { coopPeriodId: null } }] } });
});

test.each(['abc', '0', '-1', '1.5'])('%p → error', (v) => {
  expect(studentPeriodWhere(v)).toHaveProperty('error');
});
