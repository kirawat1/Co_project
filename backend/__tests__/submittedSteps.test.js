// บันทึกเวลาส่งครั้งแรกของแต่ละขั้น (StudentCoop.submittedSteps)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { markSubmitted, backfillEntries } = require('../utils/submittedSteps');

describe('backfillEntries (เติมเวลาส่งของคนที่ส่งก่อนมีระบบนี้)', () => {
  const d = (type, iso) => ({ type, uploadedAt: new Date(iso) });

  test('T002/T003 จากเวลาอัปโหลดแบบฟอร์ม · ติด backfill', () => {
    expect(backfillEntries(null, [d('T002_FORM', '2026-07-01T00:00:00Z'), d('T003_FORM', '2026-07-15T00:00:00Z')], ['CP-T000'])).toEqual({
      T002: { at: '2026-07-01T00:00:00.000Z', backfill: true },
      T003: { at: '2026-07-15T00:00:00.000Z', backfill: true },
    });
  });

  test('T000 ครบหัวข้อบังคับ → เวลาของไฟล์ล่าสุด · ไม่ครบ → ไม่เติม', () => {
    const docs = [d('CP-T000', '2026-05-01T00:00:00Z'), d('CP-TRANSCRIPT', '2026-05-03T00:00:00Z')];
    expect(backfillEntries({}, docs, ['CP-T000', 'CP-TRANSCRIPT'])).toEqual({ T000: { at: '2026-05-03T00:00:00.000Z', backfill: true } });
    expect(backfillEntries({}, docs, ['CP-T000', 'CP-TRANSCRIPT', 'CP-CV'])).toBeNull();
  });

  test('ไม่มีหัวข้อบังคับเลย → ไม่เติม T000 (บอกไม่ได้ว่าส่งครบเมื่อไหร่)', () => {
    expect(backfillEntries({}, [d('CP-CV', '2026-05-01T00:00:00Z')], [])).toBeNull();
  });

  test('มีค่าอยู่แล้ว → ไม่ทับ · คงขั้นอื่น · ไม่มีอะไรเปลี่ยน → null', () => {
    const existing = { T002: { at: '2026-06-30T00:00:00.000Z' } };
    expect(backfillEntries(existing, [d('T002_FORM', '2026-07-01T00:00:00Z')], [])).toBeNull();
    expect(backfillEntries(existing, [d('T003_FORM', '2026-07-15T00:00:00Z')], [])).toEqual({
      T002: { at: '2026-06-30T00:00:00.000Z' }, T003: { at: '2026-07-15T00:00:00.000Z', backfill: true },
    });
  });
});

const NOW = new Date('2026-07-01T03:00:00Z');
const REQS = [
  { docKey: 'CP-T000', majorRules: [] }, // หัวข้อกลาง
  { docKey: 'CP-TRANSCRIPT', majorRules: [] },
  { docKey: 'CP-PORTFOLIO', majorRules: [{ major: 'AI', excluded: false }] }, // เฉพาะ AI
];

describe('markSubmitted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.studentCoop.update.mockResolvedValue({});
    prisma.documentRequirement.findMany.mockResolvedValue(REQS);
  });

  test('T002 ครั้งแรก → บันทึกเวลา', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T002', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { submittedSteps: { T002: { at: NOW.toISOString() } } },
    });
  });

  test('ส่งแก้แต่ยังไม่มีเวลาของขั้น (ส่งก่อนเติมย้อนหลัง) → บันทึกแบบไม่นับว่าช้า (backfill)', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T002', major: 'CS', now: NOW, resubmission: true });
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { submittedSteps: { T002: { at: NOW.toISOString(), backfill: true } } },
    });
  });

  test('ล็อกแถว StudentCoop ก่อนอ่าน (อัปโหลดพร้อมกันไม่ทับกัน)', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T002', major: 'CS', now: NOW });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.studentCoop.findUnique.mock.invocationCallOrder[0]);
  });

  test('มีเวลาของขั้นนั้นแล้ว (ส่งแก้) → ไม่ทับ', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: { T002: { at: '2026-06-01T00:00:00.000Z' } } });
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T002', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('คงเวลาของขั้นอื่นไว้', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: { T000: { at: 'a', backfill: true } } });
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T003', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update.mock.calls[0][0].data.submittedSteps)
      .toEqual({ T000: { at: 'a', backfill: true }, T003: { at: NOW.toISOString() } });
  });

  test('T000 ยังไม่ครบหัวข้อบังคับ → ไม่บันทึก', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    prisma.document.findMany.mockResolvedValue([{ type: 'CP-T000' }]);
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T000', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('T000 ครบหัวข้อบังคับของหลักสูตรตัวเอง (หัวข้อเฉพาะหลักสูตรอื่นไม่นับ) → บันทึก', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    prisma.document.findMany.mockResolvedValue([{ type: 'CP-T000' }, { type: 'CP-TRANSCRIPT' }]);
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T000', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { submittedSteps: { T000: { at: NOW.toISOString() } } },
    });
    expect(prisma.documentRequirement.findMany.mock.calls[0][0].where).toEqual({ isActive: true, isRequired: true });
  });

  test('T000 หลักสูตร AI ต้องมีหัวข้อเฉพาะ AI ด้วย', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ submittedSteps: null });
    prisma.document.findMany.mockResolvedValue([{ type: 'CP-T000' }, { type: 'CP-TRANSCRIPT' }]);
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T000', major: 'AI', now: NOW });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('ไม่มี StudentCoop → ไม่ทำอะไร', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue(null);
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T002', major: 'CS', now: NOW });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('ขั้นที่ไม่ได้ส่งในระบบ (T007) → ไม่ทำอะไร', async () => {
    await markSubmitted(prisma, { studentId: 10, stepKey: 'T007', major: 'CS', now: NOW });
    expect(prisma.studentCoop.findUnique).not.toHaveBeenCalled();
  });
});
