// __tests__/adminDocController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getAllStudentsForReview, getCoopApplications } = require('../controllers/adminDocController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getAllStudentsForReview', () => {
  const mockStudents = [
    { id: 1, studentId: 'u640001', firstName: 'ก', coop: { coopPeriodId: 2, company: null }, documents: [] },
    { id: 2, studentId: 'u640002', firstName: 'ข', coop: { coopPeriodId: 3, company: null }, documents: [] },
  ];

  test('200 — คืนนักศึกษาทั้งหมดเมื่อไม่มี coopPeriodId', async () => {
    prisma.student.findMany.mockResolvedValue(mockStudents);
    prisma.student.count.mockResolvedValue(2);
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].data).toHaveLength(2);
    expect(res.json.mock.calls[0][0].meta).toMatchObject({ total: 2, page: 1 });
  });

  test('200 — กรองตาม coopPeriodId=3', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[1]]);
    prisma.student.count.mockResolvedValue(1);
    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }, { coop: { coopPeriodId: 3 } }] } })
    );
    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
  });

  test('200 — กรองตาม status ที่ใช้ใน dashboard นับจำนวน', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[0]]);
    prisma.student.count.mockResolvedValue(7);
    const req = { query: { status: 'T002_SUBMITTED', limit: '1' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ deletedAt: null }, { coop: { status: 'T002_SUBMITTED' } }] },
        take: 1,
      })
    );
    expect(res.json.mock.calls[0][0].meta.total).toBe(7);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB error'));
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].ok).toBe(false);
  });
});

describe('getCoopApplications', () => {
  test('200 — กรอง student ที่ถูก soft-delete ออก', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([{ id: 1, status: 'QUALIFIED' }]);
    const req = {};
    const res = makeRes();

    await getCoopApplications(req, res);

    expect(prisma.studentCoop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['NOT_SUBMITTED'] }, student: { deletedAt: null } },
      })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });
});
