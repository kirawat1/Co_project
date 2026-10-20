// หากำหนดส่งของนักศึกษาจากรอบ × หลักสูตร (ปฏิทินของรอบ) + ค่าเดิมใน SystemConfig เมื่อรอบยังไม่ตั้ง
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { resolveDeadline } = require('../utils/resolveDeadline');

const at = (iso) => new Date(iso);
const ROWS = {
  '1|CS': { startDate: new Date('2026-03-01T00:00:00Z'), deadlines: { T002: { due: '2026-07-03', mode: 'HARD' }, T003: { due: '2026-07-17' }, T007: { due: '2026-10-23' } } },
  '2|CS': { startDate: new Date('2026-08-15T00:00:00Z'), deadlines: { T002: { due: '2026-12-11', mode: 'HARD' } } },
  '1|AI': { startDate: new Date('2026-03-01T00:00:00Z'), deadlines: { T002: { due: '2026-07-03', closed: true } } },
};

function setup({ coop, major = 'CS', configs = {} }) {
  prisma.studentCoop.findUnique.mockResolvedValue(coop);
  prisma.student.findUnique.mockResolvedValue({ major });
  prisma.coopPeriodMajor.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(ROWS[`${where.periodId_major.periodId}|${where.periodId_major.major}`] || null));
  prisma.systemConfig.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(configs[where.key] ? { key: where.key, value: JSON.stringify(configs[where.key]) } : null));
}

describe('resolveDeadline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('สองรอบพร้อมกัน → แต่ละคนได้กำหนดของรอบตัวเอง', async () => {
    const now = at('2026-07-05T00:00:00Z');
    setup({ coop: { coopPeriodId: 1, status: 'INTERNSHIP_STARTED' } });
    expect(await resolveDeadline('T002', { studentId: 10 }, prisma, now))
      .toMatchObject({ source: 'ROUND', periodId: 1, due: '2026-07-03', canSubmit: false, late: true });
    setup({ coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } });
    expect(await resolveDeadline('T002', { studentId: 11 }, prisma, now))
      .toMatchObject({ source: 'ROUND', periodId: 2, due: '2026-12-11', canSubmit: true, late: false });
  });

  test('ส่งแก้ (T002_EDITS_REQUIRED) หลัง HARD due → ส่งได้', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'T002_EDITS_REQUIRED' } });
    expect(await resolveDeadline('T002', { studentId: 10 }, prisma, at('2026-07-05T00:00:00Z')))
      .toMatchObject({ canSubmit: true, late: false });
  });

  test('T000 ระหว่างส่งแก้ (WAITING_FOR_STAFF_CHECK หลังส่งแก้ไฟล์แรก) → ยังนับเป็นการส่งแก้', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'WAITING_FOR_STAFF_CHECK' } });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ startDate: new Date('2026-03-01T00:00:00Z'), deadlines: { T000: { due: '2026-05-08' } } });
    expect(await resolveDeadline('T000', { studentId: 10 }, prisma, at('2026-07-20T00:00:00Z')))
      .toMatchObject({ canSubmit: true, late: false });
  });

  test('ขยายเวลา T002 → ส่ง T002 ได้ถึงวันขยาย แต่ไม่เปิด T003', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'T002_SUBMITTED', deadlineExtensions: { T002: '2026-07-31' } } });
    const now = at('2026-07-20T00:00:00Z');
    expect(await resolveDeadline('T002', { studentId: 10 }, prisma, now)).toMatchObject({ canSubmit: true, extensionUntil: '2026-07-31' });
    expect(await resolveDeadline('T003', { studentId: 10 }, prisma, now)).toMatchObject({ canSubmit: false, extensionUntil: null });
    expect(await resolveDeadline('T002', { studentId: 10 }, prisma, at('2026-08-01T00:00:00Z'))).toMatchObject({ canSubmit: false });
  });

  test('ปิดรับชั่วคราว (AI) → ส่งครั้งแรกไม่ได้แม้ยังไม่ถึง due และมีขยายเวลา', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'INTERNSHIP_STARTED', deadlineExtensions: { T002: '2026-07-31' } }, major: 'AI' });
    expect(await resolveDeadline('T002', { studentId: 10 }, prisma, at('2026-06-01T00:00:00Z')))
      .toMatchObject({ closed: true, canSubmit: false });
  });

  test('ไม่มีรอบ (coopPeriodId = null) → ไม่มีกำหนด ส่งได้ แม้ค่าเดิมปิดอยู่', async () => {
    setup({ coop: { coopPeriodId: null, status: 'QUALIFIED' }, configs: { T000_CONFIG: { isOpen: false } } });
    expect(await resolveDeadline('T000', { studentId: 10 }, prisma, at('2026-07-05T00:00:00Z')))
      .toMatchObject({ source: 'NO_ROUND', periodId: null, canSubmit: true, configured: false });
  });

  test('ยังไม่มี StudentCoop → ไม่มีกำหนด', async () => {
    setup({ coop: null });
    expect(await resolveDeadline('T000', { studentId: 10 }, prisma, at('2026-07-05T00:00:00Z')))
      .toMatchObject({ source: 'NO_ROUND', canSubmit: true });
  });

  describe('รอบยังไม่ตั้งขั้นนั้น → ค่าเดิม (ตรรกะ checkSystemOpen)', () => {
    const now = at('2026-07-05T05:00:00Z');

    test('isOpen=false → ปิด · ค่าทับของหลักสูตรมาก่อนค่ากลาง', async () => {
      setup({ coop: { coopPeriodId: 1, status: 'QUALIFIED' }, configs: { T000_CONFIG: { isOpen: true }, 'T000_CONFIG@CS': { isOpen: false } } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now)).toMatchObject({ source: 'LEGACY', canSubmit: false });
    });

    test('ยังไม่ถึงวันเริ่ม → ปิด · startDate ส่งกลับตามค่าเดิม', async () => {
      setup({ coop: { coopPeriodId: 1, status: 'QUALIFIED' }, configs: { T000_CONFIG: { isOpen: true, startDate: '2026-07-10', endDate: '2026-07-31' } } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now))
        .toMatchObject({ source: 'LEGACY', canSubmit: false, startDate: '2026-07-10', due: '2026-07-31' });
    });

    test('ไม่มีค่าเลย → เปิด', async () => {
      setup({ coop: { coopPeriodId: 1, status: 'QUALIFIED' } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now)).toMatchObject({ source: 'LEGACY', canSubmit: true });
    });

    test.each(['EDITS_REQUIRED', 'APPLICATION_EDITS_REQUIRED'])('T000 ส่งแก้ (%s) → ผ่านแม้ปิด', async (status) => {
      setup({ coop: { coopPeriodId: 1, status }, configs: { T000_CONFIG: { isOpen: false } } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now)).toMatchObject({ canSubmit: true });
    });

    test('ขยายเวลาใช้ได้กับค่าเดิมที่หมดเขต (แต่ไม่ชนะ isOpen=false)', async () => {
      setup({ coop: { coopPeriodId: 1, status: 'QUALIFIED', deadlineExtensions: { T000: '2026-07-31' } }, configs: { T000_CONFIG: { isOpen: true, endDate: '2026-07-01' } } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now)).toMatchObject({ canSubmit: true, late: true });
      setup({ coop: { coopPeriodId: 1, status: 'QUALIFIED', deadlineExtensions: { T000: '2026-07-31' } }, configs: { T000_CONFIG: { isOpen: false } } });
      expect(await resolveDeadline('T000', { studentId: 10 }, prisma, now)).toMatchObject({ canSubmit: false });
    });

    test('T007 ค่าเดิม = deadline ของ CONFIG_T007', async () => {
      setup({ coop: { coopPeriodId: 2, status: 'T003_APPROVED' }, configs: { CONFIG_T007: { t007Link: 'x', deadline: '2026-10-23' } } });
      expect(await resolveDeadline('T007', { studentId: 10 }, prisma, now)).toMatchObject({ source: 'LEGACY', due: '2026-10-23', canSubmit: true });
    });
  });

  test('ROUND: startDate = วันเริ่มของแถวรอบ (YYYY-MM-DD เวลาไทย) · T007 แสดงวันอย่างเดียว', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'T003_APPROVED' } });
    expect(await resolveDeadline('T007', { studentId: 10 }, prisma, at('2026-11-01T00:00:00Z')))
      .toMatchObject({ source: 'ROUND', startDate: '2026-03-01', due: '2026-10-23', late: true });
  });

  test('ใช้ major ที่ส่งมาแทนการค้นหา', async () => {
    setup({ coop: { coopPeriodId: 1, status: 'INTERNSHIP_STARTED' }, major: 'CS' });
    const r = await resolveDeadline('T002', { studentId: 10, major: 'AI' }, prisma, at('2026-06-01T00:00:00Z'));
    expect(r).toMatchObject({ closed: true });
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });
});
