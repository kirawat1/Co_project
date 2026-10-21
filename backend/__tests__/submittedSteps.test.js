// บันทึกเวลาส่งครั้งแรกของแต่ละขั้น (StudentCoop.submittedSteps)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { markSubmitted, backfillEntries, syncT000Submission } = require('../utils/submittedSteps');

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

// ส่ง T000 ครั้งแรก: ครบหัวข้อบังคับ → รอเจ้าหน้าที่ตรวจ · ลบไฟล์จนไม่ครบ → กลับไปรอนักศึกษาส่ง
// t000Status PENDING = รอตรวจจากการส่งครั้งแรก (แยกจากการส่งแก้ที่ตั้ง EDITS_REQUIRED)
describe('syncT000Submission', () => {
  const coopIs = (status, t000Status = 'WAITING') => prisma.studentCoop.findUnique.mockResolvedValue({ status, t000Status });
  const docsAre = (...types) => prisma.document.findMany.mockResolvedValue(types.map((type) => ({ type })));

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.studentCoop.update.mockResolvedValue({});
    prisma.documentRequirement.findMany.mockResolvedValue(REQS);
  });

  test('ผ่านคุณสมบัติ + ครบหัวข้อบังคับ → รอเจ้าหน้าที่ตรวจ (ส่งครั้งแรก)', async () => {
    coopIs('QUALIFIED');
    docsAre('CP-T000', 'CP-TRANSCRIPT');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBe('SUBMITTED');
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { status: 'WAITING_FOR_STAFF_CHECK', t000Status: 'PENDING' },
    });
  });

  test('ผ่านคุณสมบัติ + ยังไม่ครบ (หัวข้อเฉพาะ AI ขาด) → ยังเป็นผ่านคุณสมบัติ', async () => {
    coopIs('QUALIFIED');
    docsAre('CP-T000', 'CP-TRANSCRIPT');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'AI' })).toBeNull();
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('รอตรวจจากการส่งครั้งแรก แล้วลบไฟล์บังคับ → กลับไปรอนักศึกษาส่ง', async () => {
    coopIs('WAITING_FOR_STAFF_CHECK', 'PENDING');
    docsAre('CP-T000');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBe('WITHDRAWN');
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { status: 'QUALIFIED', t000Status: 'WAITING' },
    });
  });

  test('รอตรวจจากการส่งแก้ (ไม่ใช่ PENDING) แล้วลบไฟล์ → สถานะไม่ถอยกลับ', async () => {
    coopIs('WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED');
    docsAre('CP-T000');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBeNull();
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test.each(['EDITS_REQUIRED', 'DOCS_APPROVED', 'APPLYING'])('สถานะ %s → ไม่แตะ', async (status) => {
    coopIs(status);
    docsAre('CP-T000', 'CP-TRANSCRIPT');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBeNull();
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  // หลักสูตรที่ไม่มีหัวข้อบังคับ: ต้องมีไฟล์ T000 อย่างน้อยหนึ่งไฟล์ (ไม่งั้นคนที่ยังไม่ได้ส่งอะไรเลยกลายเป็นรอตรวจ)
  test('ไม่มีหัวข้อบังคับ + ยังไม่มีไฟล์ T000 เลย → ไม่นับว่าส่ง', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([]);
    prisma.document.count.mockResolvedValue(0);
    coopIs('QUALIFIED');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBeNull();
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
    expect(prisma.document.count.mock.calls[0][0].where).toEqual({ studentId: 10, type: { notIn: ['T002_FORM', 'T003_FORM', 'CP-ACCEPTANCE'] } });
  });

  test('ไม่มีหัวข้อบังคับ + มีไฟล์ T000 → ส่งแล้ว', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([]);
    prisma.document.count.mockResolvedValue(1);
    coopIs('QUALIFIED');
    expect(await syncT000Submission(prisma, { studentId: 10, major: 'CS' })).toBe('SUBMITTED');
  });

  test('ล็อกแถว StudentCoop ก่อนอ่านสถานะ', async () => {
    coopIs('QUALIFIED');
    docsAre('CP-T000', 'CP-TRANSCRIPT');
    await syncT000Submission(prisma, { studentId: 10, major: 'CS' });
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.studentCoop.findUnique.mock.invocationCallOrder[0]);
  });
});
