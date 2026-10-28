// __tests__/notificationHelper.test.js — ผู้รับแจ้งเตือนงานของนักศึกษา: อาจารย์ประจำวิชาเฉพาะหลักสูตรของนักศึกษา
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getStaffAndCoopTeacherIds, createNotifications } = require('../utils/notificationHelper');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 7 }]);
});

test('มีหลักสูตร → เจ้าหน้าที่ + อาจารย์ประจำวิชาที่ดูแลหลักสูตรนั้น', async () => {
  await expect(getStaffAndCoopTeacherIds('AI')).resolves.toEqual([1, 7]);
  expect(prisma.user.findMany).toHaveBeenCalledWith({
    where: { OR: [{ role: 'staff' }, { role: 'teacher', teacher: { isCoopTeacher: true, coopMajors: { some: { major: 'AI' } } } }] },
    select: { id: true },
  });
});

test.each([[null], [undefined], ['']])('ไม่มีหลักสูตร (%p) → เจ้าหน้าที่เท่านั้น (อาจารย์ประจำวิชาเห็นแต่นักศึกษาในหลักสูตรที่ดูแล)', async (major) => {
  await getStaffAndCoopTeacherIds(major);
  expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { OR: [{ role: 'staff' }] }, select: { id: true } });
});

describe('createNotifications — แจ้งเฉพาะนักศึกษา (เจ้าหน้าที่/อาจารย์ไม่มีหน้าจออ่านแจ้งเตือน ใช้ตัวเลขงานที่รอบนเมนูแทน)', () => {
  const notif = { type: 'T002_SUBMITTED', title: 't', message: 'm', link: '/x', relatedId: '5' };

  test('ผู้รับปนกัน → สร้างเฉพาะนักศึกษา', async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: 7 }]); // 1 = เจ้าหน้าที่ · 7 = นักศึกษา
    prisma.notification.findMany.mockResolvedValueOnce([]);
    prisma.notification.createMany.mockResolvedValueOnce({ count: 1 });
    await createNotifications([1, 7], notif);
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { id: { in: [1, 7] }, role: 'student' }, select: { id: true } });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ userId: 7, type: 'T002_SUBMITTED' })] });
  });

  test('ไม่มีนักศึกษาเลย (แจ้งเจ้าหน้าที่/อาจารย์) → ไม่สร้างแถว ไม่เปิด transaction', async () => {
    prisma.user.findMany.mockResolvedValueOnce([]);
    await createNotifications([1, 2], notif);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
