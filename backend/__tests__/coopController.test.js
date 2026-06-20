// __tests__/coopController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const { submitCoopApplication, updateCoopStatus, deleteDocument } = require('../controllers/coopController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// =====================
// submitCoopApplication
// =====================
describe('submitCoopApplication', () => {
  test('400 — ไม่มี coopPeriodId', async () => {
    const req = { user: { id: 1 }, body: { jobPosition: 'Dev' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('400 — รอบรับสมัครปิดแล้ว', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, isActive: false });
    const req = { user: { id: 1 }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — auto-close: isActive=true แต่ endDate ผ่านไปแล้ว (เจ้าหน้าที่ลืมกดปิด)', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({
      id: 1,
      isActive: true,
      endDate: new Date('2020-01-01'),
    });
    prisma.coopPeriod.update.mockResolvedValue({});
    const req = { user: { id: 1 }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(prisma.coopPeriod.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — ไม่พบข้อมูลนักศึกษา', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, isActive: true });
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { user: { id: 1 }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ยื่นคำร้องสำเร็จ', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, isActive: true });
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.document.createMany.mockResolvedValue({});
    prisma.studentCoop.upsert.mockResolvedValue({ studentId: 10, status: 'APPLYING' });

    const req = {
      user: { id: 1 },
      body: { coopPeriodId: '1', jobPosition: 'Backend Dev' },
      files: [],
    };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.studentCoop.upsert).toHaveBeenCalled();
  });
});

// =====================
// updateCoopStatus
// =====================
describe('updateCoopStatus', () => {
  test('400 — studentId ไม่ถูกต้อง (ข้อความ)', async () => {
    const req = { body: { studentId: 'abc', status: 'APPROVED' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — studentId เป็น 0', async () => {
    const req = { body: { studentId: '0', status: 'APPROVED' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — status ไม่ถูกต้อง', async () => {
    const req = { body: { studentId: '5', status: 'HACK' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 — อัปเดตสถานะ APPROVED → QUALIFIED', async () => {
    prisma.studentCoop.update.mockResolvedValue({ studentId: 5, status: 'QUALIFIED' });

    const req = { body: { studentId: '5', status: 'APPROVED', comment: 'ผ่าน' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.studentCoop.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUALIFIED' }),
    }));
  });

  test('200 — อัปเดตสถานะ REJECTED → QUALIFICATION_FAILED', async () => {
    prisma.studentCoop.update.mockResolvedValue({ studentId: 5, status: 'QUALIFICATION_FAILED' });

    const req = { body: { studentId: '5', status: 'REJECTED' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(prisma.studentCoop.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUALIFICATION_FAILED' }),
    }));
  });
});

// =====================
// deleteDocument
// =====================
describe('deleteDocument (coopController)', () => {
  test('404 — ไม่พบเอกสาร', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    const req = { params: { id: '99' }, user: { id: 1 } };
    const res = makeRes();

    await deleteDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('403 — ไม่ใช่เจ้าของไฟล์', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 1,
      path: 'test.pdf',
      student: { userId: 99, user: { id: 99 } },
    });

    const req = { params: { id: '1' }, user: { id: 1 } }; // userId 1 ≠ 99
    const res = makeRes();

    await deleteDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('200 — ลบเอกสารสำเร็จ', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 1,
      path: 'nonexistent_file.pdf',
      student: { userId: 1, user: { id: 1 } },
    });
    prisma.document.delete.mockResolvedValue({});

    const req = { params: { id: '1' }, user: { id: 1 } };
    const res = makeRes();

    await deleteDocument(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
