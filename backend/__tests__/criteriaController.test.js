// backend/__tests__/criteriaController.test.js

jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const {
  getAllCriteria,
  createCriteria,
  updateCriteria,
  deleteCriteria,
  getMajorList,
} = require('../controllers/criteriaController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getAllCriteria
// ---------------------------------------------------------------------------
describe('getAllCriteria', () => {
  test('200 – returns { ok: true, criteria }', async () => {
    const fakeCriteria = [
      { id: 1, major: 'CS' },
      { id: 2, major: 'IT' },
    ];
    prisma.coopCriteria.findMany.mockResolvedValue(fakeCriteria);

    const req = {};
    const res = makeRes();

    await getAllCriteria(req, res);

    expect(prisma.coopCriteria.findMany).toHaveBeenCalledWith({
      orderBy: { major: 'asc' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: fakeCriteria });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopCriteria.findMany.mockRejectedValue(new Error('DB fail'));

    const req = {};
    const res = makeRes();

    await getAllCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false })
    );
  });
});

// ---------------------------------------------------------------------------
// createCriteria — สร้างเท่านั้น (เดิม upsert: รหัสที่มีอยู่แล้ว = ทับชื่อไทยเงียบ ๆ)
// ---------------------------------------------------------------------------
describe('createCriteria', () => {
  test('200 – creates major and returns { ok: true, criteria }', async () => {
    prisma.coopCriteria.create.mockResolvedValue({ id: 'c1', major: 'DS', nameTh: 'วิทยาการข้อมูล' });
    const res = makeRes();
    await createCriteria({ body: { major: ' DS ', nameTh: ' วิทยาการข้อมูล ' } }, res);
    expect(prisma.coopCriteria.create).toHaveBeenCalledWith({ data: { major: 'DS', nameTh: 'วิทยาการข้อมูล' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('nameTh ว่าง → เก็บเป็น null ไม่ใช่ string ว่าง', async () => {
    prisma.coopCriteria.create.mockResolvedValue({ id: 'c1', major: 'DS', nameTh: null });
    await createCriteria({ body: { major: 'DS', nameTh: '   ' } }, makeRes());
    expect(prisma.coopCriteria.create.mock.calls[0][0].data.nameTh).toBeNull();
  });

  test('400 – missing major', async () => {
    const res = makeRes();
    await createCriteria({ body: { major: '  ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopCriteria.create).not.toHaveBeenCalled();
  });

  // /scrutinize 2026-11-04: รหัสซ้ำต้องบอก ไม่ใช่ทับชื่อหลักสูตรเดิม
  test('409 – รหัสที่มีอยู่แล้ว (P2002) · ไม่ทับข้อมูลเดิม', async () => {
    prisma.coopCriteria.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = makeRes();
    await createCriteria({ body: { major: 'CS', nameTh: 'ชื่อใหม่' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.coopCriteria.upsert).not.toHaveBeenCalled();
    expect(prisma.coopCriteria.update).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.coopCriteria.create.mockRejectedValueOnce(new Error('DB down'));
    const res = makeRes();
    await createCriteria({ body: { major: 'DS' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ---------------------------------------------------------------------------
// updateCriteria — เปลี่ยนรหัส = ตามแก้ทุกที่ (ผู้ใช้ตัดสิน 2026-11-04)
// ---------------------------------------------------------------------------
describe('updateCriteria', () => {
  test('200 – แก้ชื่อไทย (รหัสเดิม) ไม่แตะนักศึกษา/อาจารย์/ประกาศ/ค่าตั้ง', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'CS' });
    prisma.coopCriteria.update.mockResolvedValue({ id: 'c1', major: 'CS', nameTh: 'ใหม่' });
    const res = makeRes();
    await updateCriteria({ params: { id: 'c1' }, body: { major: 'CS', nameTh: 'ใหม่' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.student.updateMany).not.toHaveBeenCalled();
    expect(prisma.teacher.updateMany).not.toHaveBeenCalled();
  });

  test('เปลี่ยนรหัส CS → CS2: นักศึกษา · อาจารย์ · ประกาศที่ระบุหลักสูตร · ค่าตั้งค่า @CS · ชื่อจับคู่ตอนนำเข้า ตามไปหมด', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'CS' });
    prisma.coopCriteria.update.mockResolvedValue({ id: 'c1', major: 'CS2' });
    prisma.announcement.findMany.mockResolvedValueOnce([{ id: 'a1', targetMajors: ['CS', 'AI'] }, { id: 'a2', targetMajors: ['AI'] }, { id: 'a3', targetMajors: [] }]);
    prisma.systemConfig.findMany.mockResolvedValueOnce([{ key: 'CONFIG_T007@CS', value: '{"t007Link":"x"}' }]);
    prisma.systemConfig.findUnique.mockResolvedValueOnce({ key: 'MAJOR_IMPORT_ALIASES', value: JSON.stringify({ 'วิทยาการคอมพิวเตอร์': 'CS', อื่น: 'AI' }) });
    const res = makeRes();
    await updateCriteria({ params: { id: 'c1' }, body: { major: 'CS2', nameTh: 'วิทยาการคอมพิวเตอร์' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.student.updateMany).toHaveBeenCalledWith({ where: { major: 'CS' }, data: { major: 'CS2' } });
    expect(prisma.teacher.updateMany).toHaveBeenCalledWith({ where: { major: 'CS' }, data: { major: 'CS2' } });
    expect(prisma.announcement.update).toHaveBeenCalledTimes(1);
    expect(prisma.announcement.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { targetMajors: ['CS2', 'AI'] } });
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'CONFIG_T007@CS2' } }));
    expect(prisma.systemConfig.delete).toHaveBeenCalledWith({ where: { key: 'CONFIG_T007@CS' } });
    expect(JSON.parse(prisma.systemConfig.update.mock.calls[0][0].data.value)).toEqual({ 'วิทยาการคอมพิวเตอร์': 'CS2', อื่น: 'AI' });
  });

  test('400 – missing major', async () => {
    const res = makeRes();
    await updateCriteria({ params: { id: 'c1' }, body: { major: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 – ไม่พบหลักสูตรที่จะแก้', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await updateCriteria({ params: { id: 'nope' }, body: { major: 'X' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('409 – รหัสใหม่ซ้ำหลักสูตรอื่น (P2002) · ไม่ตามแก้อะไร', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'CS' });
    prisma.coopCriteria.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = makeRes();
    await updateCriteria({ params: { id: 'c1' }, body: { major: 'AI' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteCriteria — ยังมีคนใช้ = ห้ามลบ (ผู้ใช้ตัดสิน 2026-11-04)
// ---------------------------------------------------------------------------
describe('deleteCriteria', () => {
  test('200 – หลักสูตรที่ไม่มีใครใช้ ลบได้ + ล้างค่าตั้งค่า @major', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'TYPO' });
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.announcement.findMany.mockResolvedValueOnce([{ targetMajors: ['CS'] }]);
    const res = makeRes();
    await deleteCriteria({ params: { id: 'c1' } }, res);
    expect(prisma.coopCriteria.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(prisma.systemConfig.deleteMany).toHaveBeenCalledWith({ where: { key: { endsWith: '@TYPO' } } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 – ลบแล้วชื่อจับคู่ตอนนำเข้าที่ชี้ไปหลักสูตรนี้ถูกเอาออก (ชื่ออื่นคงเดิม)', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'TYPO' });
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.announcement.findMany.mockResolvedValueOnce([]);
    prisma.systemConfig.findUnique.mockResolvedValueOnce({ key: 'MAJOR_IMPORT_ALIASES', value: JSON.stringify({ 'ชื่อผิด': 'TYPO', 'วิทยาการคอมพิวเตอร์': 'CS' }) });
    const res = makeRes();
    await deleteCriteria({ params: { id: 'c1' } }, res);
    expect(prisma.systemConfig.update).toHaveBeenCalledWith({ where: { key: 'MAJOR_IMPORT_ALIASES' }, data: { value: JSON.stringify({ 'วิทยาการคอมพิวเตอร์': 'CS' }) } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test.each([
    ['นักศึกษา', () => prisma.student.count.mockResolvedValue(3), 'students'],
    ['อาจารย์', () => prisma.teacher.count.mockResolvedValue(1), 'teachers'],
    ['รอบที่ตั้งค่าไว้', () => prisma.coopPeriodMajor.count.mockResolvedValueOnce(2), 'rounds'],
    ['หัวข้อ T000', () => prisma.documentRequirementMajor.count.mockResolvedValueOnce(1), 'docRules'],
    ['อาจารย์ประจำวิชา', () => prisma.coopTeacherMajor.count.mockResolvedValueOnce(1), 'coopTeachers'],
    ['ประกาศ', () => prisma.announcement.findMany.mockResolvedValueOnce([{ targetMajors: ['CS'] }]), 'announcements'],
  ])('409 – ยังมี%sใช้อยู่ · ไม่ลบ · บอกจำนวน', async (_, arrange, key) => {
    prisma.coopCriteria.findUnique.mockResolvedValue({ id: 'c1', major: 'CS' });
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.announcement.findMany.mockResolvedValue([]);
    arrange();
    const res = makeRes();
    await deleteCriteria({ params: { id: 'c1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'MAJOR_IN_USE' });
    expect(res.json.mock.calls[0][0].usage[key]).toBeGreaterThan(0);
    expect(prisma.coopCriteria.delete).not.toHaveBeenCalled();
  });

  test('404 – ไม่พบหลักสูตร', async () => {
    prisma.coopCriteria.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await deleteCriteria({ params: { id: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopCriteria.findUnique.mockRejectedValueOnce(new Error('DB down'));
    const res = makeRes();
    await deleteCriteria({ params: { id: 'c1' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});


// ---------------------------------------------------------------------------
// getMajorList
// ---------------------------------------------------------------------------
describe('getMajorList', () => {
  test('200 – returns { ok: true, majors: [...] }', async () => {
    prisma.coopCriteria.findMany.mockResolvedValue([
      { major: 'CS' },
      { major: 'IT' },
      { major: 'SE' },
    ]);

    const req = {};
    const res = makeRes();

    await getMajorList(req, res);

    expect(prisma.coopCriteria.findMany).toHaveBeenCalledWith({
      select: { major: true },
      orderBy: { major: 'asc' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, majors: ['CS', 'IT', 'SE'] });
  });

  test('500 – DB error returns { ok: false }', async () => {
    prisma.coopCriteria.findMany.mockRejectedValue(new Error('DB fail'));

    const req = {};
    const res = makeRes();

    await getMajorList(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
