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
// createCriteria  (เดิมชื่อ saveCriteria — ถูกแยกเป็น create/update ตอน batch 126)
// ---------------------------------------------------------------------------
describe('createCriteria', () => {
  test('200 – creates major and returns { ok: true, criteria }', async () => {
    const upserted = { id: '1', major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' };
    prisma.coopCriteria.upsert.mockResolvedValue(upserted);

    const req = { body: { major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' } };
    const res = makeRes();

    await createCriteria(req, res);

    expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith({
      where: { major: 'CS' },
      update: { nameTh: 'วิทยาการคอมพิวเตอร์' },
      create: { major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: upserted });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('nameTh ว่าง → เก็บเป็น null ไม่ใช่ string ว่าง', async () => {
    prisma.coopCriteria.upsert.mockResolvedValue({ id: '1', major: 'CS' });

    await createCriteria({ body: { major: '  CS  ' } }, makeRes());

    expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith({
      where: { major: 'CS' },
      update: { nameTh: null },
      create: { major: 'CS', nameTh: null },
    });
  });

  test('400 – missing major', async () => {
    const req = { body: {} };
    const res = makeRes();

    await createCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopCriteria.upsert).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.coopCriteria.upsert.mockRejectedValue(new Error('DB fail'));

    const req = { body: { major: 'CS' } };
    const res = makeRes();

    await createCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Save failed' });
  });
});

// ---------------------------------------------------------------------------
// updateCriteria — ไม่เคยมี test มาก่อน ทั้งที่เป็นครึ่งหนึ่งของ saveCriteria เดิม
// ---------------------------------------------------------------------------
describe('updateCriteria', () => {
  test('200 – updates and returns { ok: true, criteria }', async () => {
    const updated = { id: '7', major: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ' };
    prisma.coopCriteria.update.mockResolvedValue(updated);

    const req = { params: { id: '7' }, body: { major: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ' } };
    const res = makeRes();

    await updateCriteria(req, res);

    expect(prisma.coopCriteria.update).toHaveBeenCalledWith({
      where: { id: '7' },
      data: { major: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: updated });
  });

  test('400 – missing major', async () => {
    const res = makeRes();
    await updateCriteria({ params: { id: '7' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopCriteria.update).not.toHaveBeenCalled();
  });

  test('404 – P2025 (ไม่พบหลักสูตรที่จะแก้)', async () => {
    const err = new Error('not found');
    err.code = 'P2025';
    prisma.coopCriteria.update.mockRejectedValue(err);

    const res = makeRes();
    await updateCriteria({ params: { id: '99' }, body: { major: 'IT' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toMatch(/ไม่พบหลักสูตร/);
  });

  test('409 – P2002 (ชื่อหลักสูตรซ้ำ)', async () => {
    const err = new Error('duplicate');
    err.code = 'P2002';
    prisma.coopCriteria.update.mockRejectedValue(err);

    const res = makeRes();
    await updateCriteria({ params: { id: '7' }, body: { major: 'CS' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/ชื่อหลักสูตรนี้มีอยู่แล้ว/);
  });
});

// ---------------------------------------------------------------------------
// deleteCriteria
// ---------------------------------------------------------------------------
describe('deleteCriteria', () => {
  test('200 – deletes criteria and returns { ok: true }', async () => {
    prisma.coopCriteria.delete.mockResolvedValue({});

    const req = { params: { id: '1' } };
    const res = makeRes();

    await deleteCriteria(req, res);

    expect(prisma.coopCriteria.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopCriteria.delete.mockRejectedValue(new Error('DB fail'));

    const req = { params: { id: '99' } };
    const res = makeRes();

    await deleteCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false })
    );
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
