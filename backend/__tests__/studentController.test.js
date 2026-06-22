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

const {
  softDeleteStudent,
  getTrashedStudents,
  restoreStudent,
  permanentlyDeleteStudent,
} = require('../controllers/studentController');

describe('softDeleteStudent', () => {
  test('200 — ตั้ง deletedAt ให้นักศึกษาที่มีอยู่', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
    prisma.student.update.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('404 — อยู่ในถังขยะอยู่แล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('getTrashedStudents', () => {
  test('200 — คืนรายชื่อที่ deletedAt ไม่เป็น null', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 1, deletedAt: new Date() }]);

    const req = {};
    const res = makeRes();

    await getTrashedStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: { not: null } },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: expect.any(Array) }));
  });
});

describe('restoreStudent', () => {
  test('200 — ล้าง deletedAt', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    prisma.student.update.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: null },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('404 — ไม่ได้อยู่ในถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('permanentlyDeleteStudent', () => {
  test('200 — ลบจริงเมื่ออยู่ในถังขยะแล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    prisma.student.delete.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('400 — ปฏิเสธถ้ายังไม่ได้ย้ายไปถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });
});

const { updateStudentBasicInfo } = require('../controllers/studentController');

describe('updateStudentBasicInfo', () => {
  test('200 — แก้ไขข้อมูลพื้นฐาน ไม่แก้ email', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1, firstName: 'ใหม่' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' }),
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 — แก้ email ด้วย → อัปเดต User.email ด้วย', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.user.findFirst.mockResolvedValue(null); // ไม่ชนกับใคร
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1 });
    prisma.user.update.mockResolvedValue({ id: 10, email: 'new@kkumail.com' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'new@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { email: 'new@kkumail.com' },
    });
  });

  test('409 — email ใหม่ชนกับ user อื่น', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 99 });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'taken@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' }, body: { firstName: 'ก' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400 — studentId ซ้ำ (P2002)', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002', meta: { target: 'studentId' } });
    prisma.$transaction.mockRejectedValue(p2002);

    const req = { params: { id: '1' }, body: { firstName: 'ก', studentId: 'u640001' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
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
