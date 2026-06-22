// __tests__/studentController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

jest.mock('../services/kkuRegService', () => ({
  isConfigured: jest.fn(() => false),
  syncStudentAll: jest.fn(),
  getStudentToken: jest.fn(),
  getGradeList: jest.fn(),
  getCurrentSemester: jest.fn(),
}));

const prisma = require('./__mocks__/prismaClient');
const { getStudents, getMyProfile } = require('../controllers/studentController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// =====================
// getStudents — pagination
// =====================
describe('getStudents', () => {
  const mockStudents = [
    { id: 1, studentId: 'u640001', firstName: 'ก', lastName: 'ข' },
    { id: 2, studentId: 'u640002', firstName: 'ค', lastName: 'ง' },
  ];

  test('200 — คืน list + meta pagination', async () => {
    prisma.student.findMany.mockResolvedValue(mockStudents);
    prisma.student.count.mockResolvedValue(2);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ total: 2, page: 1, limit: 50, totalPages: 1 });
  });

  test('200 — page 2 ส่ง skip ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(60);

    const req = { query: { page: '2', limit: '10' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
    }));

    const body = res.json.mock.calls[0][0];
    expect(body.meta.page).toBe(2);
    expect(body.meta.totalPages).toBe(6);
  });

  test('200 — limit ไม่เกิน 100', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: { limit: '9999' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
    }));
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB connection lost'));
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('200 — กรองตาม coopPeriodId ส่ง where ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 1, studentId: 'u640001', firstName: 'ก', lastName: 'ข' },
    ]);
    prisma.student.count.mockResolvedValue(1);

    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ deletedAt: null }, { coop: { coopPeriodId: 3 } }] },
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
  });

  test('200 — ไม่มี coopPeriodId ก็ยังกรอง deletedAt: null เสมอ', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
  });
});

// =====================
// getMyProfile
// =====================
describe('getMyProfile', () => {
  test('200 — ส่ง student profile กลับมา', async () => {
    const studentData = {
      id: 1,
      studentId: 'u640001',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      coop: { company: { id: 5, name: 'Test Co', mentors: [] }, mentor: null },
      coopApplicationForm: null,
      documents: [],
      emails: [],
      user: { email: 'student@kku.ac.th' },
      t003Form: null,
    };
    prisma.student.findUnique.mockResolvedValue(studentData);

    const req = { userId: 1 };
    const res = makeRes();

    await getMyProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.studentId).toBe('u640001');
    expect(body.company).toBeDefined();
  });

  test('200 — คืน default profile เมื่อไม่มีข้อมูลนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'user@kku.ac.th' });

    const req = { userId: 1 };
    const res = makeRes();

    await getMyProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.studentId).toBe('');
    expect(body.userEmail).toBe('user@kku.ac.th');
  });
});

// =====================
// exportStudents
// =====================
describe('exportStudents', () => {
  test('200 — ส่งไฟล์ xlsx กลับ พร้อม Content-Type และ Content-Disposition ที่ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        studentId: '643021218',
        prefix: 'MR',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        major: 'CS',
        year: '4',
        coop: { status: 'QUALIFIED', company: { name: 'บริษัท ทดสอบ' } },
        generalAdvisor: null,
        coopAdvisor: null,
      },
    ]);

    const req = { query: {} };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      include: {
        coop: { include: { company: true } },
        generalAdvisor: { select: { firstName: true, lastName: true } },
        coopAdvisor: { select: { firstName: true, lastName: true } },
      },
    }));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="students_')
    );
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  test('200 — filter ตาม coopPeriodId เมื่อระบุ (ไม่ใช่ "all")', async () => {
    prisma.student.findMany.mockResolvedValue([]);

    const req = { query: { coopPeriodId: '5' } };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coop: { coopPeriodId: 5 } },
    }));
  });

  test('500 — DB error คืน { ok: false }', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB fail'));

    const req = { query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
