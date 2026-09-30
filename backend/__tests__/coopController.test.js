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

const FUTURE = new Date(Date.now() + 30 * 86400000);

beforeEach(() => jest.clearAllMocks());

// =====================
// submitCoopApplication
// =====================
describe('submitCoopApplication', () => {
  test('400 — ไม่มี coopPeriodId', async () => {
    const req = { user: { id: 1, role: 'student' }, body: { jobPosition: 'Dev' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('400 — ยังไม่ระบุหลักสูตร → ยื่นไม่ได้ (รอบเปิดปิดแยกหลักสูตร)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, major: null });
    const req = { user: { id: 1, role: 'student' }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/หลักสูตร/);
    expect(prisma.coopPeriodMajor.findUnique).not.toHaveBeenCalled();
  });

  test('400 — รอบรับสมัครของหลักสูตรนักศึกษาปิดอยู่', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, major: 'CS' });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 1, major: 'CS', isActive: false, endDate: FUTURE });
    const req = { user: { id: 1, role: 'student' }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(prisma.coopPeriodMajor.findUnique).toHaveBeenCalledWith({ where: { periodId_major: { periodId: 1, major: 'CS' } } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — auto-close: isActive=true แต่ endDate ผ่านไปแล้ว (เจ้าหน้าที่ลืมกดปิด)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, major: 'CS' });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 1, major: 'CS', isActive: true, endDate: new Date('2020-01-01') });
    const req = { user: { id: 1, role: 'student' }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ periodId: 1, major: 'CS' }] },
      data: { isActive: false },
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — ไม่พบข้อมูลนักศึกษา', async () => {
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 1, major: 'CS', isActive: true, endDate: FUTURE });
    // ครั้งแรก = หาหลักสูตร (มี) · ครั้งที่สอง = หาข้อมูลนักศึกษา (ถูกลบไประหว่างนั้น)
    prisma.student.findUnique.mockResolvedValueOnce({ major: 'CS' }).mockResolvedValueOnce(null);

    const req = { user: { id: 1, role: 'student' }, body: { coopPeriodId: '1' }, files: [] };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ยื่นคำร้องสำเร็จ', async () => {
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 1, major: 'CS', isActive: true, endDate: FUTURE });
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, major: 'CS' });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.document.createMany.mockResolvedValue({});
    prisma.studentCoop.upsert.mockResolvedValue({ studentId: 10, status: 'APPLYING' });
    // มีผู้ติดต่อ (HR) ของบริษัทที่เลือกแล้ว — บังคับก่อนยื่น
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c1', contacts: [{ id: 'k1', companyId: 'c1' }] });

    const req = {
      user: { id: 1, role: 'student' },
      body: { coopPeriodId: '1', jobPosition: 'Backend Dev' },
      files: [],
    };
    const res = makeRes();

    await submitCoopApplication(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.studentCoop.upsert).toHaveBeenCalled();
  });

  // ผู้ติดต่อ (HR) บังคับก่อนยื่น — backend ต้องตรวจเอง (ยิง API ตรงข้ามหน้าเว็บได้)
  const setupSubmittable = () => {
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 1, major: 'CS', isActive: true, endDate: FUTURE });
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, major: 'CS' });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.document.createMany.mockResolvedValue({});
    prisma.studentCoop.upsert.mockResolvedValue({ studentId: 10, status: 'APPLYING' });
  };
  const validReq = () => ({ user: { id: 1, role: 'student' }, body: { coopPeriodId: '1', jobPosition: 'Backend Dev' }, files: [] });

  test('400 — ยังไม่มีผู้ติดต่อ (HR)', async () => {
    setupSubmittable();
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c1', contacts: [] });
    const res = makeRes();
    await submitCoopApplication(validReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/ผู้ติดต่อ/);
    expect(prisma.studentCoop.upsert).not.toHaveBeenCalled();
  });

  test('400 — ผู้ติดต่อเป็นของบริษัทเก่า (เปลี่ยนบริษัทแล้ว)', async () => {
    setupSubmittable();
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c2', contacts: [{ id: 'k1', companyId: 'c1' }] });
    const res = makeRes();
    await submitCoopApplication(validReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ผ่าน — มีผู้ติดต่อของบริษัทที่เลือก', async () => {
    setupSubmittable();
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'NOT_SUBMITTED', companyId: 'c1', contacts: [{ id: 'k1', companyId: 'c1' }] });
    const res = makeRes();
    await submitCoopApplication(validReq(), res);
    expect(res.status).not.toHaveBeenCalledWith(400);
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
    // Controller re-fetches inside $transaction: TOCTOU check needs student + coop status
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null, generalAdvisorId: null, coopAdvisorId: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'APPLYING' });
    prisma.studentCoop.update.mockResolvedValue({ studentId: 5, status: 'QUALIFIED' });

    // role: 'staff' bypasses the teacher-advisor ownership check
    const req = { body: { studentId: '5', status: 'APPROVED', comment: 'ผ่าน' }, user: { id: 99, role: 'staff' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.studentCoop.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUALIFIED' }),
    }));
  });

  test('200 — อัปเดตสถานะ REJECTED → QUALIFICATION_FAILED', async () => {
    // Controller re-fetches inside $transaction: TOCTOU check needs student + coop status
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null, generalAdvisorId: null, coopAdvisorId: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'WAITING_FOR_STAFF_CHECK' });
    prisma.studentCoop.update.mockResolvedValue({ studentId: 5, status: 'QUALIFICATION_FAILED' });

    const req = { body: { studentId: '5', status: 'REJECTED' }, user: { id: 99, role: 'staff' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(prisma.studentCoop.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'QUALIFICATION_FAILED' }),
    }));
  });

  test('403 — teacher เป็นแค่ที่ปรึกษาทั่วไป (generalAdvisorId) ไม่ใช่ที่ปรึกษาโครงงานสหกิจ → ตรวจสอบคุณสมบัติไม่ได้', async () => {
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null, generalAdvisorId: 7, coopAdvisorId: 99 });
    prisma.teacher.findUnique.mockResolvedValue({ id: 7 });

    const req = { body: { studentId: '5', status: 'APPROVED' }, user: { id: 1, role: 'teacher' } };
    const res = makeRes();

    await updateCoopStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
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
