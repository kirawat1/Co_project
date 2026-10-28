// __tests__/notificationHelper.test.js — ผู้รับแจ้งเตือนงานของนักศึกษา: อาจารย์ประจำวิชาเฉพาะหลักสูตรของนักศึกษา
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');

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
