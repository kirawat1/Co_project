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
    expect(validateOverride('CONFIG_SUPERVISION_EVAL', { autoSend: true })).toEqual({ autoSend: true });
  });

  test.each([
    ['URL ที่ไม่ใช่ http/https', 'CONFIG_T007', { t007Link: 'javascript:alert(1)' }],
    ['ช่องที่ตั้งแยกหลักสูตรไม่ได้ (รูป T008)', 'CONFIG_T008', { imagePath: 'x.png' }],
    ['ส่งอัตโนมัติไม่ใช่ true/false', 'CONFIG_SUPERVISION_EVAL', { autoSend: 'yes' }],
    // ปฏิทินของรอบ: วันรับเอกสาร/ยื่นคำร้อง/กำหนดส่งแบบฟอร์ม ตั้งที่หน้ารอบสหกิจ ไม่ใช่ค่าแยกหลักสูตรที่นี่แล้ว
    ['ช่วงรับเอกสาร T000 (ย้ายไปปฏิทินของรอบ)', 'T000_CONFIG', { isOpen: true }],
    ['ช่วงยื่นคำร้อง (ตั้งที่รอบรับสมัคร)', 'APPLY_CONFIG', { isOpen: true }],
    ['กำหนดส่งแบบฟอร์ม T005/T006 (ย้ายไปปฏิทินของรอบ)', 'EVALUATION_FORMS', { deadline: '2026-10-16' }],
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

// ── เช็กลิสต์ความพร้อมของหลักสูตร (เพิ่มหลักสูตรใหม่แล้วต้องตั้งอะไรบ้าง) ──
describe('getReadiness — ความพร้อมของหลักสูตร', () => {
  const ctrl = require('../controllers/majorConfigController');
  const setup = ({ criteria, periodRows = [], coopTeachers = [], teachers = [], students = [], reqs = [] }) => {
    prisma.coopCriteria.findMany.mockResolvedValue(criteria);
    prisma.coopPeriod.findFirst.mockResolvedValue({ id: 9, academicYear: '2569', semester: 2 });
    prisma.coopPeriodMajor.findMany.mockResolvedValue(periodRows);
    prisma.coopTeacherMajor.findMany.mockResolvedValue(coopTeachers);
    prisma.teacher.groupBy.mockResolvedValue(teachers);
    prisma.student.groupBy.mockResolvedValue(students);
    prisma.documentRequirement.findMany.mockResolvedValue(reqs);
  };
  const run = async (req) => { const res = makeRes(); await ctrl.getReadiness(req, res); return res.json.mock.calls[0][0]; };
  const check = (item, key) => item.checks.find((c) => c.key === key);
  const n = (major, c) => ({ major, _count: { _all: c } });

  test('หลักสูตรใหม่ที่ยังไม่ตั้งอะไร → ยังไม่พร้อม · บอกข้อที่ขาด', async () => {
    setup({ criteria: [{ major: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ' }] });
    const body = await run(STAFF);
    const it = body.items[0];
    expect(it.ready).toBe(false);
    expect(check(it, 'period')).toMatchObject({ required: true, ok: false, label: 'ตั้งรอบ 2/2569' });
    expect(check(it, 'coopTeacher')).toMatchObject({ required: true, ok: false });
    expect(check(it, 'teachers')).toMatchObject({ required: false, ok: false });
  });

  test('ตั้งรอบล่าสุด + มีอาจารย์ประจำวิชา → พร้อม (ข้อที่ไม่จำเป็นขาดได้)', async () => {
    setup({
      criteria: [{ major: 'CS', nameTh: null }],
      periodRows: [{ major: 'CS', isActive: true }],
      coopTeachers: [{ major: 'CS', teacher: { firstName: 'ก', lastName: 'ข' } }],
    });
    const it = (await run(STAFF)).items[0];
    expect(it.ready).toBe(true);
    expect(check(it, 'period').detail).toBe('เปิดรับสมัครอยู่');
    expect(check(it, 'coopTeacher').detail).toBe('ก ข');
    expect(check(it, 'docs').ok).toBe(false);
  });

  test('นับหัวข้อเอกสาร: ทุกหลักสูตร · เฉพาะหลักสูตร · หลักสูตรที่ปิดหัวข้อกลาง', async () => {
    setup({
      criteria: [{ major: 'AI', nameTh: null }, { major: 'CS', nameTh: null }],
      reqs: [
        { id: 1, majorRules: [] }, // ทุกหลักสูตร
        { id: 2, majorRules: [{ major: 'CS', excluded: false }] }, // เฉพาะ CS
        { id: 3, majorRules: [{ major: 'AI', excluded: true }] }, // ทุกหลักสูตร ยกเว้น AI
      ],
    });
    const body = await run(STAFF);
    expect(check(body.items.find((i) => i.major === 'AI'), 'docs').detail).toBe('1 หัวข้อ');
    expect(check(body.items.find((i) => i.major === 'CS'), 'docs').detail).toBe('3 หัวข้อ');
  });

  test('เจ้าหน้าที่: เห็นชื่อหลักสูตรที่อาจารย์/นักศึกษาใช้แต่ยังไม่เพิ่ม + นักศึกษาไม่ระบุหลักสูตร', async () => {
    setup({ criteria: [{ major: 'CS', nameTh: null }], teachers: [n('CS', 40), n('IT', 15), n('GIS', 5)], students: [n('CS', 300), n('IT', 2), n(null, 4)] });
    const body = await run(STAFF);
    expect(body.unregistered).toEqual([{ major: 'GIS', teachers: 5, students: 0 }, { major: 'IT', teachers: 15, students: 2 }]);
    expect(body.studentsWithoutMajor).toBe(4);
    expect(body.items[0].students).toBe(300);
  });

  test('อาจารย์ประจำวิชา: เฉพาะหลักสูตรที่ดูแล · ไม่เห็นรายการหลักสูตรที่ยังไม่เพิ่ม', async () => {
    const req = coop(['AI']);
    setup({ criteria: [{ major: 'AI', nameTh: null }, { major: 'CS', nameTh: null }], teachers: [n('IT', 15)], students: [n(null, 4)] });
    prisma.coopCriteria.findMany.mockImplementation(async ({ where } = {}) =>
      [{ major: 'AI', nameTh: null }, { major: 'CS', nameTh: null }].filter((c) => !where?.major?.in || where.major.in.includes(c.major)));
    const body = await run(req);
    expect(body.items.map((i) => i.major)).toEqual(['AI']);
    expect(body.unregistered).toEqual([]);
    expect(body.studentsWithoutMajor).toBe(0);
  });
});
