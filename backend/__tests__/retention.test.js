// __tests__/retention.test.js — ล้างการแจ้งเตือนที่อ่านแล้วนานเกิน (ยังไม่อ่าน = เก็บไว้)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { pruneReadNotifications, retentionDays } = require('../utils/retention');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.NOTIFICATION_RETENTION_DAYS;
  prisma.notification.deleteMany.mockResolvedValue({ count: 7 });
});

test('ลบเฉพาะที่อ่านแล้ว และเก่ากว่า 180 วัน', async () => {
  const now = new Date('2026-10-17T00:00:00Z');
  expect(await pruneReadNotifications(now)).toBe(7);
  expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
    where: { isRead: true, createdAt: { lt: new Date('2026-04-20T00:00:00Z') } },
  });
});

test.each([
  ['365', 365],
  [undefined, 180],
  ['7', 180], // ต่ำกว่า 30 วัน = น่าจะพิมพ์ผิด ไม่ลบเกลี้ยง
  ['abc', 180],
])('NOTIFICATION_RETENTION_DAYS=%s → %i วัน', (v, days) => {
  if (v !== undefined) process.env.NOTIFICATION_RETENTION_DAYS = v;
  expect(retentionDays()).toBe(days);
});
