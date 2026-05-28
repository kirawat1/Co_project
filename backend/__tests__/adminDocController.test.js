// __tests__/adminDocController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const { getAllStudentsForReview } = require('../controllers/adminDocController');

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
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].data).toHaveLength(2);
  });

  test('200 — กรองตาม coopPeriodId=3', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[1]]);
    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { coop: { coopPeriodId: 3 } } })
    );
    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
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
