// __tests__/adminDocController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  getAllStudentsForReview,
  getCoopApplications,
  getT000Config,
  getStudentsForT000,
  reviewStudentStatus,
} = require('../controllers/adminDocController');

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

// =====================
// getT000Config
// =====================
describe('getT000Config', () => {
  test('200 — คืน config ที่บันทึกไว้', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      key: 'T000_CONFIG',
      value: JSON.stringify({ startDate: '2026-01-01', endDate: '2026-06-30', isOpen: true }),
    });
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.isOpen).toBe(true);
    expect(body.startDate).toBe('2026-01-01');
  });

  test('200 — คืน default เมื่อยังไม่มี config', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.isOpen).toBe(false);
    expect(body.startDate).toBe('');
    expect(body.endDate).toBe('');
  });

  test('500 — DB error คืน 500', async () => {
    prisma.systemConfig.findUnique.mockRejectedValue(new Error('DB fail'));
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// getStudentsForT000
// =====================
describe('getStudentsForT000', () => {
  const mockStudent = {
    id: 1,
    studentId: 'u640001',
    firstName: 'ก',
    lastName: 'ข',
    major: 'CS',
    gpa: 3.5,
    advisorName: 'อ. เขียว ฟ้าคราม',
    generalAdvisor: { id: 5, prefix: 'อ.', firstName: 'เขียว', lastName: 'ฟ้าคราม' },
    coop: { status: 'WAITING_FOR_STAFF_CHECK', t000Comment: null, company: null },
    coopApplicationForm: null,
    documents: [{ uploadedAt: new Date('2026-03-01') }],
  };

  test('200 — map ข้อมูลนักศึกษาถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudent]);
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    const data = res.json.mock.calls[0][0];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].studentId).toBe('u640001');
    expect(data[0].docStatus).toBe('WAITING_FOR_STAFF_CHECK');
    expect(data[0].advisorName).toBe('อ. เขียว ฟ้าคราม');
    expect(data[0].generalAdvisor.firstName).toBe('เขียว');
  });

  test('200 — student ที่ไม่มี coop record ให้ docStatus = WAITING', async () => {
    prisma.student.findMany.mockResolvedValue([{ ...mockStudent, coop: null, documents: [] }]);
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    expect(res.json.mock.calls[0][0][0].docStatus).toBe('WAITING');
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('fail'));
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// reviewStudentStatus
// =====================
describe('reviewStudentStatus', () => {
  beforeEach(() => {
    prisma.studentCoop.upsert.mockResolvedValue({ id: 1 });
    prisma.student.findUnique.mockResolvedValue({ userId: 10 });
    prisma.notification.createMany.mockResolvedValue({ count: 1 });
  });

  test('200 — อัปเดตสถานะสำเร็จ (ไม่มีไฟล์)', async () => {
    const req = {
      body: { studentId: '1', status: 'QUALIFIED', comment: 'ผ่าน' },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    expect(prisma.studentCoop.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 1 },
        update: expect.objectContaining({ status: 'QUALIFIED', t000Comment: 'ผ่าน' }),
      })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });

  test('200 — อัปเดตพร้อม actualStartDate และ actualEndDate', async () => {
    const req = {
      body: {
        studentId: '2',
        status: 'INTERNSHIP_STARTED',
        comment: null,
        actualStartDate: '2026-06-01',
        actualEndDate: '2026-09-30',
      },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    const upsertArg = prisma.studentCoop.upsert.mock.calls[0][0];
    expect(upsertArg.update.actualStartDate).toEqual(new Date('2026-06-01'));
    expect(upsertArg.update.actualEndDate).toEqual(new Date('2026-09-30'));
  });

  test('500 — DB error คืน 500', async () => {
    prisma.studentCoop.upsert.mockRejectedValue(new Error('DB fail'));
    const req = {
      body: { studentId: '1', status: 'QUALIFIED', comment: null },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
