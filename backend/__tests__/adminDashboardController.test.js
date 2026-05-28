// backend/__tests__/adminDashboardController.test.js

jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const { getDashboardStats } = require('../controllers/adminDashboardController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getDashboardStats
// ---------------------------------------------------------------------------
describe('getDashboardStats', () => {
  test('200 – year=all: uses student.count() for totalStudents, no coop filter', async () => {
    const fakeCoops = [
      { status: 'APPLYING' },
      { status: 'QUALIFIED' },
      { status: 'QUALIFICATION_FAILED' },
    ];
    prisma.studentCoop.findMany.mockResolvedValue(fakeCoops);
    prisma.student.count.mockResolvedValue(150);
    prisma.announcement.count.mockResolvedValue(10);

    const req = { query: { year: 'all' } };
    const res = makeRes();

    await getDashboardStats(req, res);

    // With year=all, filter should be {}
    expect(prisma.studentCoop.findMany).toHaveBeenCalledWith({ where: {} });
    // Should use student.count() not coops.length
    expect(prisma.student.count).toHaveBeenCalled();
    expect(prisma.announcement.count).toHaveBeenCalledWith();

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        totalStudents: 150,
        submittedStudents: 3,
        totalAnnouncements: 10,
        totalDailyLogs: 0,
        waiting: 1,   // APPLYING
        approved: 1,  // QUALIFIED
        rejected: 1,  // QUALIFICATION_FAILED
        specialRequests: 0,
      }),
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('200 – no year param: behaves same as year=all (uses student.count())', async () => {
    const fakeCoops = [];
    prisma.studentCoop.findMany.mockResolvedValue(fakeCoops);
    prisma.student.count.mockResolvedValue(200);
    prisma.announcement.count.mockResolvedValue(5);

    const req = { query: {} };
    const res = makeRes();

    await getDashboardStats(req, res);

    expect(prisma.studentCoop.findMany).toHaveBeenCalledWith({ where: {} });
    expect(prisma.student.count).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        totalStudents: 200,
        submittedStudents: 0,
        totalAnnouncements: 5,
        waiting: 0,
        approved: 0,
        rejected: 0,
      }),
    });
  });

  test('200 – specific year: uses coops.length for totalStudents, filters by year', async () => {
    const fakeCoops = [
      { status: 'WAITING_FOR_STAFF_CHECK' },
      { status: 'DOCS_APPROVED' },
      { status: 'DOCS_APPROVED' },
      { status: 'APPLICATION_EDITS_REQUIRED' },
    ];
    prisma.studentCoop.findMany.mockResolvedValue(fakeCoops);
    prisma.announcement.count.mockResolvedValue(3);

    const req = { query: { year: '2567' } };
    const res = makeRes();

    await getDashboardStats(req, res);

    // With a specific year, filter should include coopPeriod.academicYear
    expect(prisma.studentCoop.findMany).toHaveBeenCalledWith({
      where: { coopPeriod: { academicYear: '2567' } },
    });
    // Should NOT call student.count() — uses coops.length instead
    expect(prisma.student.count).not.toHaveBeenCalled();
    // Should filter announcements by year
    expect(prisma.announcement.count).toHaveBeenCalledWith({
      where: { year: '2567' },
    });

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        totalStudents: 4,        // coops.length
        submittedStudents: 4,    // coops.length
        totalAnnouncements: 3,
        waiting: 1,              // WAITING_FOR_STAFF_CHECK
        approved: 2,             // DOCS_APPROVED x2
        rejected: 1,             // APPLICATION_EDITS_REQUIRED
        totalDailyLogs: 0,
        specialRequests: 0,
      }),
    });
  });

  test('200 – mixed statuses are counted correctly', async () => {
    const fakeCoops = [
      { status: 'APPLYING' },
      { status: 'WAITING_FOR_STAFF_CHECK' },
      { status: 'WAITING_FOR_PLACEMENT_LETTER' },
      { status: 'WAITING_FOR_STAFF_CHECK_LETTER' },
      { status: 'QUALIFIED' },
      { status: 'DOCS_APPROVED' },
      { status: 'REQ_LETTER_ISSUED' },
      { status: 'ACCEPTANCE_CHECKED' },
      { status: 'PLACEMENT_LETTER_ISSUED' },
      { status: 'INTERNSHIP_STARTED' },
      { status: 'QUALIFICATION_FAILED' },
      { status: 'APPLICATION_EDITS_REQUIRED' },
      { status: 'EDITS_REQUIRED' },
      { status: 'UNKNOWN_STATUS' }, // Should not be counted in any group
    ];
    prisma.studentCoop.findMany.mockResolvedValue(fakeCoops);
    prisma.student.count.mockResolvedValue(100);
    prisma.announcement.count.mockResolvedValue(0);

    const req = { query: { year: 'all' } };
    const res = makeRes();

    await getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        totalStudents: 100,
        submittedStudents: 14,
        waiting: 4,   // APPLYING, WAITING_FOR_STAFF_CHECK, WAITING_FOR_PLACEMENT_LETTER, WAITING_FOR_STAFF_CHECK_LETTER
        approved: 6,  // QUALIFIED, DOCS_APPROVED, REQ_LETTER_ISSUED, ACCEPTANCE_CHECKED, PLACEMENT_LETTER_ISSUED, INTERNSHIP_STARTED
        rejected: 3,  // QUALIFICATION_FAILED, APPLICATION_EDITS_REQUIRED, EDITS_REQUIRED
      }),
    });
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.studentCoop.findMany.mockRejectedValue(new Error('DB fail'));

    const req = { query: {} };
    const res = makeRes();

    await getDashboardStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false })
    );
  });
});
