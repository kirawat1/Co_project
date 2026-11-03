// สคริปต์ย้ายสถานะ T002/T003 แบบเก่า -> INTERNSHIP_STARTED
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { migrateInternshipForms } = require('../scripts/migrate_internship_forms');

// เอกสารล่าสุดตามนักศึกษา+ชนิด: docs[`${studentId}:${type}`] = { id, status }
let coops;
let docs;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
  prisma.studentCoop.findMany.mockImplementation(async () => coops);
  prisma.document.findFirst.mockImplementation(async ({ where }) => docs[`${where.studentId}:${where.type}`] || null);
  prisma.studentCoop.updateMany.mockResolvedValue({ count: 0 });
  prisma.document.update.mockResolvedValue({});
});

describe('migrateInternshipForms', () => {
  test('dry-run: รายงานครบ แต่ไม่เขียนอะไรเลย', async () => {
    coops = [
      { studentId: 1, status: 'T002_SUBMITTED' },
      { studentId: 2, status: 'T002_EDITS_REQUIRED' },
      { studentId: 3, status: 'T003_APPROVED' },
    ];
    docs = {
      '2:T002_FORM': { id: 20, status: 'WAITING' },
      '3:T003_FORM': { id: 30, status: 'WAITING' },
    };
    const r = await migrateInternshipForms(prisma, { dryRun: true });
    expect(r.moved).toBe(3);
    expect(r.byStatus).toEqual({ T002_SUBMITTED: 1, T002_EDITS_REQUIRED: 1, T003_APPROVED: 1 });
    expect(r.docFixes).toEqual([
      { studentId: 2, type: 'T002_FORM', from: 'WAITING', to: 'REJECTED' },
      { studentId: 3, type: 'T003_FORM', from: 'WAITING', to: 'APPROVED' },
    ]);
    expect(r.missingFile).toEqual([{ studentId: 1, status: 'T002_SUBMITTED' }]);
    expect(prisma.studentCoop.updateMany).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('รันจริง: ย้ายสถานะหลัก + แก้ไฟล์ตามกติกา ในทรานแซกชันเดียว', async () => {
    coops = [
      { studentId: 1, status: 'T002_SUBMITTED' },
      { studentId: 2, status: 'T002_EDITS_REQUIRED' },
      { studentId: 3, status: 'T003_EDITS_REQUIRED' },
      { studentId: 4, status: 'T003_APPROVED' },
      { studentId: 5, status: 'T003_SUBMITTED' },
      { studentId: 6, status: 'T003_APPROVED' },
    ];
    docs = {
      '1:T002_FORM': { id: 10, status: 'WAITING' },
      '2:T002_FORM': { id: 20, status: 'WAITING' },
      '3:T003_FORM': { id: 30, status: 'WAITING' },
      '4:T003_FORM': { id: 40, status: 'WAITING' },
      '5:T003_FORM': { id: 50, status: 'WAITING' },
      '6:T003_FORM': { id: 60, status: 'APPROVED' }, // ถูกต้องอยู่แล้ว ไม่แก้
    };
    const r = await migrateInternshipForms(prisma, { dryRun: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(r.moved).toBe(6);
    expect(r.missingFile).toEqual([]);
    expect(r.docFixes).toEqual([
      { studentId: 2, type: 'T002_FORM', from: 'WAITING', to: 'REJECTED' },
      { studentId: 3, type: 'T003_FORM', from: 'WAITING', to: 'REJECTED' },
      { studentId: 4, type: 'T003_FORM', from: 'WAITING', to: 'APPROVED' },
    ]);
    expect(prisma.document.update).toHaveBeenCalledTimes(3);
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 20 }, data: { status: 'REJECTED' } });
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 40 }, data: { status: 'APPROVED' } });
    expect(prisma.studentCoop.updateMany).toHaveBeenCalledWith({
      where: { status: { in: expect.arrayContaining(['T002_SUBMITTED', 'T003_APPROVED']) } },
      data: { status: 'INTERNSHIP_STARTED' },
    });
  });

  test('รันซ้ำบนข้อมูลที่ย้ายแล้ว: moved 0 และไม่มี docFixes', async () => {
    coops = [];
    docs = {};
    const r = await migrateInternshipForms(prisma, { dryRun: false });
    expect(r).toEqual({ byStatus: {}, moved: 0, docFixes: [], missingFile: [] });
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});
