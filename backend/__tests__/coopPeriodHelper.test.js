// __tests__/coopPeriodHelper.test.js — รอบรับสมัครปิดเมื่อไหร่
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');
const { periodCloseAt, isPeriodExpired, autoCloseIfExpired } = require('../utils/coopPeriodHelper');

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

describe('autoCloseIfExpired', () => {
  afterEach(() => jest.useRealTimers());

  test('วันสุดท้ายตอนเย็น → ไม่ปิดอัตโนมัติ', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-13T19:00:00+07:00') });
    const p = { id: 1, isActive: true, endDate: END };
    expect(await autoCloseIfExpired(p)).toEqual(p);
    expect(prisma.coopPeriod.update).not.toHaveBeenCalled();
  });

  test('เลยวันปิดแล้ว → ปิดใน DB และคืน isActive=false', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-14T00:30:00+07:00') });
    prisma.coopPeriod.update.mockResolvedValue({});
    const result = await autoCloseIfExpired({ id: 1, isActive: true, endDate: END });
    expect(result.isActive).toBe(false);
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: false } });
  });
});
