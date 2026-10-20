// ปฏิทินของรอบ — อ่าน/ตั้ง/คัดลอกกำหนดส่ง (ค่าวิทยาลัย = เจ้าหน้าที่ · หลักสูตร = เจ้าหน้าที่ + อาจารย์ประจำวิชาที่ดูแล)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue() }));

const prisma = require('./__mocks__/prismaClient');
const {
  getDeadlines, saveDeadlines, copyDeadlines, createPeriod, updatePeriod,
} = require('../controllers/coopPeriodController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STAFF = { id: 1, role: 'staff' };
const COOP_CS = { id: 2, role: 'teacher' };
const req = (user, extra = {}) => ({ user, method: 'GET', body: {}, params: {}, query: {}, get: () => '', ...extra });
const lastJson = (res) => res.json.mock.calls[res.json.mock.calls.length - 1][0];
const FUTURE = new Date(Date.now() + 30 * 86400000);

const COLLEGE = { T000: { due: '2026-05-08', mode: 'HARD' }, T002: { due: '2026-07-03', mode: 'HARD' } };
const P1 = {
  id: 1, academicYear: '2569', semester: 1, startDate: new Date('2026-03-01T00:00:00Z'), endDate: FUTURE, deadlines: COLLEGE,
  majors: [
    { periodId: 1, major: 'AI', startDate: new Date('2026-03-01T00:00:00Z'), endDate: FUTURE, deadlines: { T000: { due: '2026-05-01' }, T002: { due: '2026-07-03', mode: 'HARD' } } },
    { periodId: 1, major: 'CS', startDate: new Date('2026-03-01T00:00:00Z'), endDate: FUTURE, deadlines: COLLEGE },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
  prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'AI' }, { major: 'CS' }]);
  prisma.coopPeriod.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === 1 ? P1 : null));
  prisma.coopPeriodMajor.findMany.mockResolvedValue(P1.majors);
  prisma.coopPeriod.update.mockResolvedValue({});
  prisma.coopPeriodMajor.update.mockResolvedValue({});
  prisma.coopPeriodMajor.upsert.mockResolvedValue({});
  prisma.systemConfig.findUnique.mockResolvedValue(null);
});

describe('getDeadlines', () => {
  test('เจ้าหน้าที่: ค่าวิทยาลัย + ทุกหลักสูตร + ค่าเดิมที่ใช้อยู่ + แก้ค่าวิทยาลัยได้', async () => {
    // ค่าเดิมโหลดครั้งเดียว (ค่ากลาง + ค่าทับของทุกหลักสูตรที่เห็น)
    prisma.systemConfig.findMany.mockResolvedValue([
      { key: 'T002_CONFIG', value: JSON.stringify({ isOpen: true, startDate: '2026-06-01', endDate: '2026-12-28' }) },
      { key: 'T002_CONFIG@AI', value: JSON.stringify({ endDate: '2026-12-31' }) },
      { key: 'CONFIG_T007', value: JSON.stringify({ t007Link: 'x', deadline: '2026-10-23' }) },
    ]);
    const res = makeRes();
    await getDeadlines(req(STAFF, { params: { id: '1' } }), res);
    expect(prisma.systemConfig.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.systemConfig.findUnique).not.toHaveBeenCalled();
    const body = lastJson(res);
    expect(body).toMatchObject({ ok: true, canEditCollege: true, college: COLLEGE, period: { id: 1, academicYear: '2569', semester: 1 } });
    expect(body.majors.map((m) => m.major)).toEqual(['AI', 'CS']);
    expect(body.majors[1]).toMatchObject({ major: 'CS', deadlines: COLLEGE, startDate: '2026-03-01' });
    expect(body.legacy.CS.T002).toEqual({ isOpen: true, startDate: '2026-06-01', endDate: '2026-12-28' });
    expect(body.legacy.AI.T002).toEqual({ isOpen: true, startDate: '2026-06-01', endDate: '2026-12-31' });
    expect(body.legacy.CS.T000).toBeNull();
    expect(body.legacy.CS.T007).toEqual({ deadline: '2026-10-23' });
  });

  test('อาจารย์ประจำวิชา CS: เห็นเฉพาะ CS · แก้ค่าวิทยาลัยไม่ได้', async () => {
    const res = makeRes();
    await getDeadlines(req(COOP_CS, { params: { id: '1' } }), res);
    const body = lastJson(res);
    expect(body.canEditCollege).toBe(false);
    expect(body.majors.map((m) => m.major)).toEqual(['CS']);
  });

  test('ไม่พบรอบ → 404', async () => {
    const res = makeRes();
    await getDeadlines(req(STAFF, { params: { id: '9' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('saveDeadlines', () => {
  test('ค่าวิทยาลัย (เจ้าหน้าที่) → ใช้กับหลักสูตรที่ติ๊กเท่านั้น', async () => {
    const next = { ...COLLEGE, T002: { due: '2026-07-10', mode: 'HARD' } };
    const res = makeRes();
    await saveDeadlines(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { major: '', deadlines: next, applyTo: ['CS'] } }), res);
    expect(lastJson(res)).toMatchObject({ ok: true, updated: ['CS'] });
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { deadlines: next } });
    expect(prisma.coopPeriodMajor.update).toHaveBeenCalledTimes(1);
    expect(prisma.coopPeriodMajor.update).toHaveBeenCalledWith({
      where: { periodId_major: { periodId: 1, major: 'CS' } }, data: { deadlines: next },
    });
  });

  test('applyTo มีหลักสูตรที่ไม่อยู่ในรอบ → 400', async () => {
    const res = makeRes();
    await saveDeadlines(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { major: '', deadlines: COLLEGE, applyTo: ['DS'] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopPeriod.update).not.toHaveBeenCalled();
  });

  test('อาจารย์ประจำวิชาแก้ค่าวิทยาลัย → 403', async () => {
    const res = makeRes();
    await saveDeadlines(req(COOP_CS, { method: 'PUT', params: { id: '1' }, body: { major: '', deadlines: COLLEGE } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.coopPeriod.update).not.toHaveBeenCalled();
  });

  test('อาจารย์ประจำวิชา CS แก้ CS ได้ · แก้ AI → 403', async () => {
    const mine = { T003: { due: '2026-07-17', mode: 'SOFT', closed: false } };
    prisma.coopPeriodMajor.findUnique.mockResolvedValue(P1.majors[1]);
    let res = makeRes();
    await saveDeadlines(req(COOP_CS, { method: 'PUT', params: { id: '1' }, body: { major: 'CS', deadlines: mine } }), res);
    expect(lastJson(res)).toMatchObject({ ok: true });
    expect(prisma.coopPeriodMajor.update).toHaveBeenCalledWith({
      where: { periodId_major: { periodId: 1, major: 'CS' } }, data: { deadlines: mine },
    });
    res = makeRes();
    await saveDeadlines(req(COOP_CS, { method: 'PUT', params: { id: '1' }, body: { major: 'AI', deadlines: mine } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('หลักสูตรที่ยังไม่อยู่ในรอบ → 404 ไม่สร้างแถวให้ (เพิ่มหลักสูตรเข้ารอบที่ตารางรอบก่อน)', async () => {
    prisma.coopPeriodMajor.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await saveDeadlines(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { major: 'CS', deadlines: { T002: { due: '2026-07-03' } } } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.coopPeriodMajor.upsert).not.toHaveBeenCalled();
    expect(prisma.coopPeriodMajor.update).not.toHaveBeenCalled();
  });

  test('รูปผิด → 400', async () => {
    const res = makeRes();
    await saveDeadlines(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { major: 'CS', deadlines: { T007: { due: '2026-10-23', mode: 'HARD' } } } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ไม่ระบุ major เลย → 400 (ต้องบอกว่าเป็นค่าวิทยาลัยหรือหลักสูตร)', async () => {
    const res = makeRes();
    await saveDeadlines(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { deadlines: COLLEGE } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('copyDeadlines', () => {
  const P0 = {
    id: 5, academicYear: '2568', semester: 1, deadlines: { T000: { due: '2025-05-08' }, T007: { due: '2025-10-23' } },
    majors: [{ periodId: 5, major: 'CS', deadlines: { T002: { due: '2025-07-03', mode: 'SOFT' }, T003: { due: '2025-07-17' } } },
      { periodId: 5, major: 'AI', deadlines: { T002: { due: '2025-07-01' } } }],
  };
  const P2 = { id: 2, academicYear: '2569', semester: 2, deadlines: null, majors: [] };
  beforeEach(() => {
    prisma.coopPeriod.findUnique.mockImplementation(({ where }) => Promise.resolve({ 1: P1, 5: P0, 2: P2 }[where.id] || null));
  });

  test('เจ้าหน้าที่: เลื่อนปีตามผลต่าง · ไม่ทับขั้นที่ปลายทางมีค่า', async () => {
    const res = makeRes();
    await copyDeadlines(req(STAFF, { method: 'POST', params: { id: '1' }, body: { fromPeriodId: 5 } }), res);
    expect(lastJson(res)).toMatchObject({ ok: true });
    // ค่าวิทยาลัย: T000 มีแล้ว (คงไว้) · T007 ใหม่
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { deadlines: { ...COLLEGE, T007: { due: '2026-10-23' } } } });
    // CS: T002 มีแล้ว (คงไว้) · T003 ใหม่ (+1 ปี)
    expect(prisma.coopPeriodMajor.update).toHaveBeenCalledWith({
      where: { periodId_major: { periodId: 1, major: 'CS' } }, data: { deadlines: { ...COLLEGE, T003: { due: '2026-07-17' } } },
    });
    const body = lastJson(res);
    expect(body.copied).toBe(2);
    expect(body.kept).toBe(3); // วิทยาลัย T000 · CS T002 · AI T002
  });

  test('อาจารย์ประจำวิชา CS: คัดลอกเฉพาะ CS ไม่แตะค่าวิทยาลัย/AI', async () => {
    const res = makeRes();
    await copyDeadlines(req(COOP_CS, { method: 'POST', params: { id: '1' }, body: { fromPeriodId: 5 } }), res);
    expect(prisma.coopPeriod.update).not.toHaveBeenCalled();
    expect(prisma.coopPeriodMajor.update.mock.calls.map((c) => c[0].where.periodId_major.major)).toEqual(['CS']);
  });

  test('ต่างเทอม → 400 · รอบเดียวกัน → 400', async () => {
    let res = makeRes();
    await copyDeadlines(req(STAFF, { method: 'POST', params: { id: '2' }, body: { fromPeriodId: 5 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    res = makeRes();
    await copyDeadlines(req(STAFF, { method: 'POST', params: { id: '1' }, body: { fromPeriodId: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('แถวหลักสูตรใหม่ได้ค่าวิทยาลัยติดไป', () => {
  test('createPeriod: รอบมีค่าวิทยาลัยแล้ว → แถวที่เพิ่มได้ deadlines', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, deadlines: COLLEGE });
    prisma.coopPeriodMajor.findMany.mockResolvedValue([]);
    prisma.coopPeriodMajor.createMany.mockResolvedValue({ count: 1 });
    prisma.coopPeriod.findMany.mockResolvedValue([{ ...P1, majors: [] }]);
    const res = makeRes();
    await createPeriod(req(COOP_CS, { method: 'POST', body: { academicYear: '2569', semester: 1, startDate: '2026-03-01', endDate: '2026-04-17' } }), res);
    expect(prisma.coopPeriodMajor.createMany.mock.calls[0][0].data[0]).toMatchObject({ major: 'CS', deadlines: COLLEGE });
  });

  test('updatePeriod (หลักสูตรยังไม่มีแถว) → สร้างแถวพร้อม deadlines', async () => {
    prisma.coopPeriod.findMany.mockResolvedValue([P1]);
    const res = makeRes();
    await updatePeriod(req(COOP_CS, { method: 'PUT', params: { id: '1' }, body: { major: 'CS', startDate: '2026-03-01', endDate: '2026-04-17' } }), res);
    expect(prisma.coopPeriodMajor.upsert.mock.calls[0][0].create).toMatchObject({ major: 'CS', deadlines: COLLEGE });
  });
});
