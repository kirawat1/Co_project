// เตือนก่อนปิดรับ (ปิดจริง) — เหลือไม่เกิน 3 วัน + ยังไม่ส่ง + อยู่ในขั้นที่ส่งได้
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue() }));
const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { findStudentsToRemind, runDeadlineReminders } = require('../utils/deadlineReminders');

const NOW = new Date('2026-07-01T02:00:00Z'); // 09:00 เวลาไทย 1 ก.ค.
const coop = (studentId, over = {}) => ({
  studentId, coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null, deadlineExtensions: null,
  student: { userId: 100 + studentId, major: 'CS' }, ...over,
});
const rows = (deadlines) => prisma.coopPeriodMajor.findMany.mockResolvedValue([{ periodId: 1, major: 'CS', deadlines }]);

beforeEach(() => jest.clearAllMocks());

describe('findStudentsToRemind', () => {
  test('HARD เหลือ 3 วัน + ยังไม่ส่ง → เตือน · ถามเฉพาะสถานะที่ส่งครั้งแรกได้', async () => {
    rows({ T002: { due: '2026-07-04', mode: 'HARD' } });
    prisma.studentCoop.findMany.mockResolvedValue([coop(1)]);
    expect(await findStudentsToRemind('T002', NOW, prisma)).toEqual([{ userId: 101, due: '2026-07-04' }]);
    expect(prisma.studentCoop.findMany.mock.calls[0][0].where).toMatchObject({ status: { in: ['INTERNSHIP_STARTED'] }, coopPeriodId: { not: null } });
  });

  test.each([
    ['ส่งแล้ว', { T002: { due: '2026-07-04' } }, { submittedSteps: { T002: { at: 'x' } } }],
    ['ส่งช้าได้ (SOFT)', { T002: { due: '2026-07-04', mode: 'SOFT' } }, {}],
    ['เหลือ 4 วัน', { T002: { due: '2026-07-05' } }, {}],
    ['ปิดรับชั่วคราว', { T002: { due: '2026-07-04', closed: true } }, {}],
    ['เลยกำหนดแล้ว', { T002: { due: '2026-06-30' } }, {}],
    ['รอบยังไม่ตั้งขั้นนี้', {}, {}],
  ])('%s → ไม่เตือน', async (_n, deadlines, over) => {
    rows(deadlines);
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, over)]);
    expect(await findStudentsToRemind('T002', NOW, prisma)).toEqual([]);
  });

  test('มีขยายเวลา → นับจากวันขยาย', async () => {
    rows({ T002: { due: '2026-06-20' } });
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, { deadlineExtensions: { T002: '2026-07-02' } }), coop(2, { deadlineExtensions: { T002: '2026-07-20' } })]);
    expect(await findStudentsToRemind('T002', NOW, prisma)).toEqual([{ userId: 101, due: '2026-07-02' }]);
  });

  test('วันสุดท้าย (เหลือ 0 วัน) ยังเตือน', async () => {
    rows({ T002: { due: '2026-07-01' } });
    prisma.studentCoop.findMany.mockResolvedValue([coop(1)]);
    expect(await findStudentsToRemind('T002', NOW, prisma)).toEqual([{ userId: 101, due: '2026-07-01' }]);
  });
});

describe('runDeadlineReminders', () => {
  test('แจ้งเตือนรวมตามวันปิด · relatedId = ขั้น:วันปิด (กันซ้ำวันละครั้งด้วยกลไกเดิม)', async () => {
    prisma.coopPeriodMajor.findMany.mockResolvedValue([{ periodId: 1, major: 'CS', deadlines: { T002: { due: '2026-07-04' } } }]);
    prisma.studentCoop.findMany.mockImplementation(({ where }) => Promise.resolve(where.status.in.includes('INTERNSHIP_STARTED') ? [coop(1), coop(2)] : []));
    await runDeadlineReminders(NOW, prisma);
    expect(createNotifications).toHaveBeenCalledTimes(1);
    const [ids, n] = createNotifications.mock.calls[0];
    expect(ids).toEqual([101, 102]);
    expect(n).toMatchObject({ type: 'DEADLINE_REMINDER', link: '/student/docs-t002', relatedId: 'T002:2026-07-04' });
    expect(n.message).toMatch(/4 ก\.ค\. 2569/);
  });
});
