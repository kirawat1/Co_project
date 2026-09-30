// __tests__/majorConfig.test.js — การตั้งค่าแยกหลักสูตร: ค่ากลาง + ค่าเฉพาะหลักสูตรทีละช่อง (Phase 4)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { readEffective, validateOverride, overrideKey } = require('../utils/majorConfig');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
// SystemConfig ปลอม: key → value
const store = (rows) => prisma.systemConfig.findUnique.mockImplementation(async ({ where }) =>
  (rows[where.key] !== undefined ? { key: where.key, value: JSON.stringify(rows[where.key]) } : null));
const coop = (majors) => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: majors.map((major) => ({ major })) });
  return { user: { id: 2, role: 'teacher' } };
};
const STAFF = { user: { id: 1, role: 'staff' } };

beforeEach(() => jest.clearAllMocks());

describe('readEffective — ค่ากลาง + ค่าเฉพาะหลักสูตรทีละช่อง', () => {
  test('หลักสูตรตั้งทับบางช่อง → ช่องอื่นยังใช้ค่ากลาง', async () => {
    store({ CONFIG_T007: { instructionText: 'กลาง', t007Link: 'https://g' }, 'CONFIG_T007@CS': { t007Link: 'https://cs' } });
    expect(await readEffective('CONFIG_T007', 'CS')).toEqual({ instructionText: 'กลาง', t007Link: 'https://cs' });
    expect(await readEffective('CONFIG_T007', 'AI')).toEqual({ instructionText: 'กลาง', t007Link: 'https://g' });
    expect(await readEffective('CONFIG_T007', null)).toEqual({ instructionText: 'กลาง', t007Link: 'https://g' });
  });

  test('ไม่มีทั้งค่ากลางและค่าเฉพาะ → null (ยังไม่ตั้งค่า เหมือนเดิม) · มีแค่ค่าเฉพาะก็ใช้ได้', async () => {
    store({});
    expect(await readEffective('APPLY_CONFIG', 'CS')).toBeNull();
    store({ 'APPLY_CONFIG@CS': { isOpen: false } });
    expect(await readEffective('APPLY_CONFIG', 'CS')).toEqual({ isOpen: false });
  });
});

describe('validateOverride', () => {
  test('ช่อง null = กลับไปใช้ค่ากลาง (ไม่เก็บ) · ตรวจชนิดข้อมูล', () => {
    expect(validateOverride('CONFIG_T007', { instructionText: 'x', t007Link: null })).toEqual({ instructionText: 'x' });
    expect(validateOverride('T000_CONFIG', { isOpen: true, startDate: '2026-10-01', endDate: '2026-10-31' })).toEqual({ isOpen: true, startDate: '2026-10-01', endDate: '2026-10-31' });
  });

  test.each([
    ['URL ที่ไม่ใช่ http/https', 'CONFIG_T007', { t007Link: 'javascript:alert(1)' }],
    ['ช่องที่ตั้งแยกหลักสูตรไม่ได้ (รูป T008)', 'CONFIG_T008', { imagePath: 'x.png' }],
    ['วันที่ผิดรูปแบบ', 'T000_CONFIG', { startDate: '01/10/2026' }],
    ['วันสิ้นสุดก่อนวันเริ่ม', 'T000_CONFIG', { startDate: '2026-10-31', endDate: '2026-10-01' }],
    ['เปิดรับไม่ใช่ true/false', 'T000_CONFIG', { isOpen: 'yes' }],
    ['ไม่รู้จักการตั้งค่า', 'DEAN_INFO', {}],
  ])('%s → 400', (_n, key, override) => {
    expect(() => validateOverride(key, override)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('API /api/admin/major-config', () => {
  const ctrl = require('../controllers/majorConfigController');
  beforeEach(() => prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'AI' }, { major: 'CS' }]));

  test('อาจารย์ประจำวิชา CS: ดู/ตั้งค่าของ CS ได้ · AI → 403', async () => {
    store({ GATEWAY_SETTINGS: { gradeSheetUrl: 'https://global' } });
    const ok = makeRes();
    await ctrl.getMajorConfig({ ...coop(['CS']), params: { key: 'GATEWAY_SETTINGS' }, query: { major: 'CS' } }, ok);
    const body = ok.json.mock.calls[0][0];
    expect(body.global.gradeSheetUrl).toBe('https://global');
    expect(body.global.uploadDescription).toBeTruthy(); // ค่าเริ่มต้นของฟอร์มคำร้องรวมมาด้วย
    expect(body.fields.map((f) => f.name)).toContain('gradeSheetUrl');

    const denied = makeRes();
    await ctrl.putMajorConfig({ ...coop(['CS']), params: { key: 'GATEWAY_SETTINGS' }, query: { major: 'AI' }, body: { override: {} } }, denied);
    expect(denied.status).toHaveBeenCalledWith(403);
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
  });

  test('บันทึกค่าเฉพาะหลักสูตร → key "<KEY>@<หลักสูตร>" · ล้างทุกช่อง → ลบแถว', async () => {
    const res = makeRes();
    await ctrl.putMajorConfig({ ...coop(['CS']), params: { key: 'CONFIG_T007' }, query: { major: 'CS' }, body: { override: { t007Link: 'https://cs', instructionText: null } } }, res);
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: overrideKey('CONFIG_T007', 'CS') }, create: { key: 'CONFIG_T007@CS', value: JSON.stringify({ t007Link: 'https://cs' }) },
    }));

    await ctrl.putMajorConfig({ ...STAFF, params: { key: 'CONFIG_T007' }, query: { major: 'CS' }, body: { override: { t007Link: null } } }, makeRes());
    expect(prisma.systemConfig.deleteMany).toHaveBeenCalledWith({ where: { key: 'CONFIG_T007@CS' } });
  });

  test('หน้าสรุป: บอกช่องที่แต่ละหลักสูตรตั้งทับ (อาจารย์เห็นเฉพาะหลักสูตรตัวเอง)', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([{ key: 'CONFIG_T007@CS', value: JSON.stringify({ t007Link: 'https://cs' }) }]);
    const res = makeRes();
    await ctrl.getSummary(coop(['CS']), res);
    const body = res.json.mock.calls[0][0];
    expect(body.majors).toEqual(['CS']);
    expect(body.settings.find((s) => s.key === 'CONFIG_T007').overrides).toEqual({ CS: ['ลิงก์แบบประเมิน T007'] });
  });

  test('ไม่รู้จัก key → 404 · ไม่ระบุหลักสูตร → 400', async () => {
    const r1 = makeRes();
    await ctrl.getMajorConfig({ ...STAFF, params: { key: 'NOPE' }, query: { major: 'CS' } }, r1);
    expect(r1.status).toHaveBeenCalledWith(404);
    const r2 = makeRes();
    await ctrl.getMajorConfig({ ...STAFF, params: { key: 'CONFIG_T007' }, query: {} }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
  });
});

describe('นักศึกษาได้ค่าของหลักสูตรตัวเอง', () => {
  test('ลิงก์ T007: นักศึกษา CS ได้ลิงก์ของ CS · AI ได้ค่ากลาง · เจ้าหน้าที่ได้ค่ากลาง', async () => {
    const { getT007Config } = require('../controllers/configController');
    store({ CONFIG_T007: { t007Link: 'https://g' }, 'CONFIG_T007@CS': { t007Link: 'https://cs' } });
    const run = async (req) => { const res = makeRes(); await getT007Config(req, res); return res.json.mock.calls[0][0].config.t007Link; };
    prisma.student.findUnique.mockResolvedValueOnce({ major: 'CS' });
    expect(await run({ user: { id: 9, role: 'student' } })).toBe('https://cs');
    prisma.student.findUnique.mockResolvedValueOnce({ major: 'AI' });
    expect(await run({ user: { id: 9, role: 'student' } })).toBe('https://g');
    expect(await run({ ...STAFF })).toBe('https://g');
  });

  test('ช่วงยื่นคำร้อง: CS ปิดไว้เฉพาะหลักสูตร → นักศึกษา CS เห็นปิด / AI เห็นเปิด', async () => {
    const { getApplyConfig } = require('../controllers/configController');
    store({ APPLY_CONFIG: { isOpen: true, startDate: null, endDate: null }, 'APPLY_CONFIG@CS': { isOpen: false } });
    const state = async (major) => {
      prisma.student.findUnique.mockResolvedValueOnce({ major });
      const res = makeRes();
      await getApplyConfig({ user: { id: 9, role: 'student' } }, res);
      return res.json.mock.calls[0][0].state.open;
    };
    expect(await state('CS')).toBe(false);
    expect(await state('AI')).toBe(true);
  });
});

describe('แบบประเมินการนิเทศแยกหลักสูตร', () => {
  test('หลักสูตรที่ยังไม่มีลิงก์ไม่ถูกส่ง (ข้าม) · หลักสูตรที่มีลิงก์ส่งตามปกติ', async () => {
    jest.resetModules();
    jest.doMock('../utils/notificationHelper', () => ({ createNotifications: jest.fn() }));
    const { sendEvalForAppointments } = require('../utils/supervisionEval');
    const { createNotifications } = require('../utils/notificationHelper');
    const p = require('../config/prismaClient');
    p.systemConfig.findUnique.mockImplementation(async ({ where }) =>
      (where.key === 'CONFIG_SUPERVISION_EVAL@CS' ? { value: JSON.stringify({ evalLink: 'https://cs' }) } : null));
    p.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacher: { userId: 11 }, coTeachers: [], student: { major: 'CS', firstName: 'ก' } },
      { id: 2, teacher: { userId: 12 }, coTeachers: [], student: { major: 'AI', firstName: 'ข' } },
    ]);
    const results = await sendEvalForAppointments([1, 2]);
    expect(results.find((r) => r.id === 2).skipped).toBeTruthy();
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(createNotifications).toHaveBeenCalledWith([11], expect.anything());
  });
});
