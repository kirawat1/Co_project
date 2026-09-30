// __tests__/coopPeriodHelper.test.js — รอบรับสมัครปิดเมื่อไหร่
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');
const { periodCloseAt, isPeriodExpired } = require('../utils/coopPeriodHelper');

beforeEach(() => jest.clearAllMocks());

// หน้าจอเจ้าหน้าที่ส่งวันที่แบบ "YYYY-MM-DD" → Prisma เก็บเป็นเที่ยงคืน UTC (= 07:00 เวลาไทย)
const END = new Date('2026-09-13'); // วันปิดรับสมัคร 13 ก.ย. 2569

describe('periodCloseAt', () => {
  test('ปิดตอนสิ้นวันปิดรับสมัครตามเวลาไทย (23:59:59.999 +07:00)', () => {
    expect(periodCloseAt(END).toISOString()).toBe('2026-09-13T16:59:59.999Z');
  });
});

describe('isPeriodExpired', () => {
  test('วันสุดท้าย 07:30 เวลาไทย → ยังไม่หมดเขต (เดิมปิดไปแล้วตั้งแต่ 07:00)', () => {
    expect(isPeriodExpired({ endDate: END }, new Date('2026-09-13T07:30:00+07:00'))).toBe(false);
  });
  test('วันสุดท้าย 23:59 เวลาไทย → ยังไม่หมดเขต', () => {
    expect(isPeriodExpired({ endDate: END }, new Date('2026-09-13T23:59:00+07:00'))).toBe(false);
  });
  test('เที่ยงคืนวันถัดไปเวลาไทย → หมดเขต', () => {
    expect(isPeriodExpired({ endDate: END }, new Date('2026-09-14T00:00:00+07:00'))).toBe(true);
  });
  test('ไม่มีวันปิด → ไม่หมดเขต', () => {
    expect(isPeriodExpired({ endDate: null }, new Date())).toBe(false);
  });
});
