// API ฝั่งนักศึกษา /api/coop/config/* — รูปเดิม แต่กำหนดส่งมาจากปฏิทินของรอบของนักศึกษา
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const ctrl = require('../controllers/deadlineConfigController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const student = { user: { id: 1, role: 'student' } };
const ROW = { startDate: new Date('2026-03-01T00:00:00Z'), deadlines: { T002: { due: '2026-07-03', mode: 'HARD' }, T007: { due: '2026-10-23' } } };

function setup({ coop = { coopPeriodId: 1, status: 'INTERNSHIP_STARTED' }, configs = {}, row = ROW, major = 'CS' } = {}) {
  prisma.student.findUnique.mockResolvedValue({ id: 10, major });
  prisma.studentCoop.findUnique.mockResolvedValue(coop);
  prisma.coopPeriodMajor.findUnique.mockResolvedValue(row);
  prisma.systemConfig.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(configs[where.key] ? { key: where.key, value: JSON.stringify(configs[where.key]) } : null));
}

describe('deadlineConfigController', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-07-05T00:00:00Z')); });
  afterEach(() => jest.useRealTimers());

  test('T002 นักศึกษาในรอบ → วันของรอบ · ปิดแล้ว (HARD เลยกำหนด) · startDate = วันเริ่มของรอบ', async () => {
    setup();
    const res = makeRes();
    await ctrl.getT002Config(student, res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ isOpen: false, startDate: '2026-03-01', endDate: '2026-07-03', late: true, closed: false });
  });

  test('T000 ยังไม่เลือกรอบ → เปิด (แม้ค่าเดิมปิด)', async () => {
    setup({ coop: { coopPeriodId: null, status: 'QUALIFIED' }, configs: { T000_CONFIG: { isOpen: false } } });
    const res = makeRes();
    await ctrl.getT000Config(student, res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ isOpen: true, endDate: null });
  });

  test('T003 รอบยังไม่ตั้ง → ค่าเดิม (startDate/endDate/isOpen ตามค่าเดิม)', async () => {
    setup({ configs: { T003_CONFIG: { isOpen: true, startDate: '2026-06-01', endDate: '2026-12-27' } } });
    const res = makeRes();
    await ctrl.getT003Config(student, res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ isOpen: true, startDate: '2026-06-01', endDate: '2026-12-27' });
  });

  test('ผู้ใช้ที่ไม่ใช่นักศึกษา → ค่ากลางเดิม (ไม่มี = ปิด เหมือนเดิม)', async () => {
    setup({ configs: { T002_CONFIG: { isOpen: true, startDate: '2026-06-01', endDate: '2026-07-01' } } });
    let res = makeRes();
    await ctrl.getT002Config({ user: { id: 5, role: 'teacher' } }, res);
    expect(res.json.mock.calls[0][0]).toEqual({ isOpen: true, startDate: '2026-06-01', endDate: '2026-07-01' });
    setup();
    res = makeRes();
    await ctrl.getT002Config({ user: { id: 5, role: 'staff' } }, res);
    expect(res.json.mock.calls[0][0]).toEqual({ startDate: null, endDate: null, isOpen: false });
  });

  test('T007 → ลิงก์จากค่าเดิม + กำหนดส่งของรอบ', async () => {
    setup({ configs: { CONFIG_T007: { t007Link: 'https://f/7', deadline: '2026-09-30' } } });
    const res = makeRes();
    await ctrl.getT007Config(student, res);
    expect(res.json.mock.calls[0][0]).toEqual({ ok: true, config: { t007Link: 'https://f/7', deadline: '2026-10-23' } });
  });

  test('T008 รอบไม่มีกำหนด → คงค่าเดิมทั้งก้อน · ไม่มีอะไรเลย → config null', async () => {
    setup({ configs: { CONFIG_T008: { driveLink: 'https://d', deadline: '2026-11-01' } } });
    let res = makeRes();
    await ctrl.getT008Config(student, res);
    expect(res.json.mock.calls[0][0]).toEqual({ ok: true, config: { driveLink: 'https://d', deadline: '2026-11-01' } });
    setup({ row: null });
    res = makeRes();
    await ctrl.getT008Config(student, res);
    expect(res.json.mock.calls[0][0]).toEqual({ ok: true, config: null });
  });

  test('T005/T006 ยังไม่เลือกรอบ → กำหนดส่งเดิมยังแสดง', async () => {
    setup({ coop: { coopPeriodId: null, status: 'T003_APPROVED' }, configs: { EVALUATION_FORMS: { t005Link: 'a', deadline: '2026-10-16' } } });
    const res = makeRes();
    await ctrl.getEvaluationConfig(student, res);
    expect(res.json.mock.calls[0][0]).toEqual({ ok: true, config: { t005Link: 'a', deadline: '2026-10-16' } });
  });

  describe('apply — ช่วงยื่นคำร้อง = รอบที่เปิดของหลักสูตร', () => {
    test('มีรอบเปิด → open + วันของรอบ', async () => {
      setup();
      prisma.coopPeriodMajor.findMany.mockResolvedValue([{ periodId: 2, major: 'CS', isActive: true, startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2099-09-11T00:00:00Z') }]);
      const res = makeRes();
      await ctrl.getApplyConfig(student, res);
      const body = res.json.mock.calls[0][0];
      expect(body).toMatchObject({ isOpen: true, startDate: '2026-08-01', endDate: '2099-09-11' });
      expect(body.state).toMatchObject({ configured: true, open: true, endDate: '2099-09-11', message: null });
      expect(prisma.coopPeriodMajor.findMany.mock.calls[0][0].where).toEqual({ major: 'CS', isActive: true });
    });

    test('ไม่มีรอบเปิด → ปิด พร้อมข้อความ (ไม่สนค่า APPLY_CONFIG เดิม)', async () => {
      setup({ configs: { APPLY_CONFIG: { isOpen: true } } });
      prisma.coopPeriodMajor.findMany.mockResolvedValue([]);
      const res = makeRes();
      await ctrl.getApplyConfig(student, res);
      const body = res.json.mock.calls[0][0];
      expect(body).toMatchObject({ isOpen: false });
      expect(body.state).toMatchObject({ configured: false, open: false });
      expect(body.state.message).toMatch(/ปิดรับคำร้อง/);
    });

    test('ยังไม่ระบุหลักสูตร → ปิด', async () => {
      setup({ major: null });
      const res = makeRes();
      await ctrl.getApplyConfig(student, res);
      expect(res.json.mock.calls[0][0].state).toMatchObject({ open: false });
      expect(prisma.coopPeriodMajor.findMany).not.toHaveBeenCalled();
    });
  });
});
