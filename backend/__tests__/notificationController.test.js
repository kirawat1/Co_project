// __tests__/notificationController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { markRead, markAllRead } = require('../controllers/notificationController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('markRead — อ่านเฉพาะแจ้งเตือนของเมนูที่กด', () => {
  test('200 — อัปเดตเฉพาะชนิดที่ส่งมา ของผู้ใช้คนนี้', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    const res = makeRes();
    await markRead({ userId: 7, body: { types: ['T002_SUBMITTED', 'T003_SUBMITTED'] } }, res);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, isRead: false, type: { in: ['T002_SUBMITTED', 'T003_SUBMITTED'] } },
      data: { isRead: true },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, count: 2 });
  });

  test.each([
    [{}],
    [{ types: [] }],
    [{ types: 'T002_SUBMITTED' }],
    [{ types: ['bad type!'] }],
    [{ types: Array.from({ length: 21 }, (_, i) => `T${i}`) }],
  ])('400 — types ไม่ถูกต้อง %#', async (body) => {
    const res = makeRes();
    await markRead({ userId: 7, body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });
});

describe('markAllRead', () => {
  test('200 — อ่านทั้งหมดของผู้ใช้คนนี้', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 5 });
    const res = makeRes();
    await markAllRead({ userId: 7 }, res);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 7, isRead: false }, data: { isRead: true } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
