// __tests__/periodFilter.test.js — ตัวกรองรอบของรายชื่อนักศึกษา (none = ยังไม่เลือกรอบ)
const { studentPeriodWhere, coopPeriodWhere, countByPeriod } = require('../utils/periodFilter');

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

test('coopPeriodWhere (ตารางคำร้อง): ตัวเลข / none = coopPeriodId null / all = ไม่กรอง / ผิด = error', () => {
  expect(coopPeriodWhere('4')).toEqual({ where: { coopPeriodId: 4 } });
  expect(coopPeriodWhere('none')).toEqual({ where: { coopPeriodId: null } });
  expect(coopPeriodWhere('all')).toEqual({ where: null });
  expect(coopPeriodWhere('x')).toHaveProperty('error');
});

test('countByPeriod: นับรวม/รอดำเนินการต่อรอบ · ไม่มีรอบ = null', () => {
  const rows = [{ p: 1, s: 'A' }, { p: 1, s: 'B' }, { p: undefined, s: 'A' }];
  expect(countByPeriod(rows, { periodOf: (r) => r.p, isPending: (r) => r.s === 'A' })).toEqual([
    { coopPeriodId: 1, count: 2, pending: 1 }, { coopPeriodId: null, count: 1, pending: 1 },
  ]);
});
