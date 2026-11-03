// ตรวจ T002 ย้อนหลัง — นักศึกษาส่ง T003 ไปก่อน T002 ถูกตรวจ (เดิมตรวจ T002 ไม่ได้อีก: "ไม่สามารถตรวจสอบซ้ำได้ในสถานะนี้")
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn().mockReturnValue(false), unlinkSync: jest.fn() }));

const prisma = require('./__mocks__/prismaClient');
const { applyT002Review } = require('../utils/t002Review');
const { resolveDeadline } = require('../utils/resolveDeadline');
const adminDoc = require('../controllers/adminDocController');
const docController = require('../controllers/docController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const coopIs = (status) => prisma.studentCoop.findUnique.mockResolvedValue({ status, coopPeriodId: 1, t000Status: null, deadlineExtensions: null, submittedSteps: null });
const t002Is = (status) => {
  const doc = status ? { id: 7, type: 'T002_FORM', status, path: 'old.pdf' } : null;
  prisma.document.findFirst.mockResolvedValue(doc);
  return doc;
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  prisma.studentCoop.update.mockResolvedValue({});
  prisma.document.update.mockResolvedValue({});
});

describe('applyT002Review', () => {
  test.each(['T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED'])('ขั้น %s + ไฟล์ T002 ยังไม่ถูกตรวจ → ผ่าน/ตีกลับได้ ขั้น T003 ไม่ถอย', async (status) => {
    coopIs(status);
    t002Is('WAITING');
    expect(await applyT002Review(prisma, { studentId: 10, reject: false })).toEqual({ late: true });
    expect(prisma.document.update).toHaveBeenLastCalledWith({ where: { id: 7 }, data: { status: 'APPROVED', rejectReason: null } });
    await applyT002Review(prisma, { studentId: 10, reject: true, comment: 'แก้ข้อ 2' });
    expect(prisma.document.update).toHaveBeenLastCalledWith({ where: { id: 7 }, data: { status: 'REJECTED', rejectReason: 'แก้ข้อ 2' } });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('ขั้น T003 แต่ไฟล์ T002 ตรวจแล้ว (ผ่าน/ตีกลับรอแก้) → 400 · ไม่มีไฟล์ → 400', async () => {
    coopIs('T003_SUBMITTED');
    for (const s of ['APPROVED', 'REJECTED', null]) {
      t002Is(s);
      await expect(applyT002Review(prisma, { studentId: 10, reject: false })).rejects.toMatchObject({ is400: true });
    }
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test('ตรวจตามปกติ (T002_SUBMITTED): ผ่าน = สถานะคงเดิม · ตีกลับ = T002_EDITS_REQUIRED · รอนักศึกษาแก้ 400', async () => {
    coopIs('T002_SUBMITTED');
    t002Is('WAITING');
    expect(await applyT002Review(prisma, { studentId: 10, reject: true, comment: 'x' })).toEqual({ late: false });
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { status: 'T002_EDITS_REQUIRED' } });
    coopIs('T002_EDITS_REQUIRED');
    await expect(applyT002Review(prisma, { studentId: 10, reject: false })).rejects.toMatchObject({ is400: true });
  });
});

describe('reviewT002 (เจ้าหน้าที่) — ตรวจย้อนหลังผ่าน endpoint', () => {
  test('ขั้น T003_SUBMITTED + ไฟล์รอตรวจ → 200 (เดิม 400)', async () => {
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null, userId: 5 });
    coopIs('T003_SUBMITTED');
    t002Is('WAITING');
    const res = makeRes();
    await adminDoc.reviewT002({ body: { studentId: 10, status: 'T002_SUBMITTED' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('ส่ง T002 ใหม่หลังถูกตีกลับย้อนหลัง', () => {
  const upload = () => ({ body: { docType: 'T002_FORM' }, file: { path: '/tmp/t.pdf', filename: 't.pdf', originalname: 't.pdf' }, user: { id: 1 } });
  beforeEach(() => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null, major: 'CS' });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ startDate: new Date('2026-01-01'), deadlines: { T002: { due: '2020-01-01', mode: 'HARD' } } }); // เลยกำหนดแล้ว
    prisma.document.delete.mockResolvedValue({});
    prisma.document.create.mockResolvedValue({ id: 8 });
    prisma.coopT002Form.findUnique.mockResolvedValue(null);
  });

  test('ขั้น T003 + T002 ถูกตีกลับ → ส่งได้แม้เลยกำหนด · ขั้น T003 ไม่ถอย', async () => {
    coopIs('T003_SUBMITTED');
    t002Is('REJECTED');
    const res = makeRes();
    await docController.uploadDocument(upload(), res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(prisma.studentCoop.update.mock.calls.filter(([a]) => a.data.status)).toEqual([]);
  });

  test('ขั้น T003 + T002 ยังรอตรวจ/ผ่านแล้ว → ส่งไม่ได้', async () => {
    coopIs('T003_SUBMITTED');
    for (const s of ['WAITING', 'APPROVED']) {
      t002Is(s);
      const res = makeRes();
      await docController.uploadDocument(upload(), res);
      expect([400, 403]).toContain(res.status.mock.calls[0][0]);
    }
  });

  test('resolveDeadline: T002 ถูกตีกลับย้อนหลัง = ส่งแก้ (ไม่ติดกำหนด) · ไฟล์ยังไม่ถูกตีกลับ = ตามกำหนด', async () => {
    coopIs('T003_APPROVED');
    t002Is('REJECTED');
    expect(await resolveDeadline('T002', { studentId: 10, major: 'CS' }, prisma)).toMatchObject({ canSubmit: true, resubmission: true });
    t002Is('APPROVED');
    expect(await resolveDeadline('T002', { studentId: 10, major: 'CS' }, prisma)).toMatchObject({ canSubmit: false, resubmission: false });
  });
});
