// ป้ายส่งช้า / เลยกำหนดยังไม่ส่ง ของทั้งรายการ — โหลดแถวรอบ × หลักสูตรครั้งเดียว
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { deadlineFlagsFor } = require('../utils/deadlineFlags');

const NOW = new Date('2026-07-10T00:00:00Z');
const st = (id, major, coop) => ({ id, major, coop });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.coopPeriodMajor.findMany.mockResolvedValue([
    { periodId: 1, major: 'CS', deadlines: { T002: { due: '2026-07-03', mode: 'SOFT' } } },
    { periodId: 2, major: 'CS', deadlines: { T002: { due: '2026-12-11' } } },
  ]);
  prisma.systemConfig.findUnique.mockImplementation(({ where }) => Promise.resolve(
    where.key === 'T002_CONFIG' ? { key: 'T002_CONFIG', value: JSON.stringify({ isOpen: true, endDate: '2026-07-01' }) } : null));
});

test('แต่ละคนใช้กำหนดของรอบตัวเอง · รอบที่ยังไม่ตั้ง → วันสิ้นสุดเดิม · ไม่มีรอบ → ไม่มีป้าย', async () => {
  const flags = await deadlineFlagsFor([
    st(10, 'CS', { coopPeriodId: 1, status: 'T002_SUBMITTED', submittedSteps: { T002: { at: '2026-07-05T00:00:00.000Z' } } }),
    st(11, 'CS', { coopPeriodId: 2, status: 'INTERNSHIP_STARTED', submittedSteps: null }),
    st(12, 'AI', { coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null }),
    st(13, 'CS', { coopPeriodId: null, status: 'INTERNSHIP_STARTED', submittedSteps: null }),
    st(14, 'CS', null),
  ], 'T002', prisma, NOW);
  expect(flags.get(10)).toEqual({ due: '2026-07-03', late: true, overdueNotSubmitted: false });
  expect(flags.get(11)).toEqual({ due: '2026-12-11', late: false, overdueNotSubmitted: false });
  expect(flags.get(12)).toEqual({ due: '2026-07-01', late: false, overdueNotSubmitted: true });
  expect(flags.get(13)).toEqual({ due: null, late: false, overdueNotSubmitted: false });
  expect(flags.get(14)).toEqual({ due: null, late: false, overdueNotSubmitted: false });
  expect(prisma.coopPeriodMajor.findMany).toHaveBeenCalledTimes(1);
});

test('รายการว่าง → ไม่ query', async () => {
  expect((await deadlineFlagsFor([], 'T002', prisma, NOW)).size).toBe(0);
  expect(prisma.coopPeriodMajor.findMany).not.toHaveBeenCalled();
});
