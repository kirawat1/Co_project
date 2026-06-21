// backend/__tests__/criteriaController.test.js

jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const {
  getAllCriteria,
  saveCriteria,
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
      { id: 1, major: 'CS', minGpa: 2.5, minCoreGpa: 2.5, minActivityUnit: 60 },
      { id: 2, major: 'IT', minGpa: 2.0, minCoreGpa: 2.0, minActivityUnit: 60 },
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
// saveCriteria
// ---------------------------------------------------------------------------
describe('saveCriteria', () => {
  test('200 – creates major and returns { ok: true, criteria }', async () => {
    const upserted = { id: '1', major: 'CS' };
    prisma.coopCriteria.upsert.mockResolvedValue(upserted);

    const req = { body: { major: 'CS' } };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(prisma.coopCriteria.upsert).toHaveBeenCalledWith({
      where: { major: 'CS' },
      update: {},
      create: { major: 'CS' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, criteria: upserted });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('400 – missing major', async () => {
    const req = { body: {} };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopCriteria.upsert).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.coopCriteria.upsert.mockRejectedValue(new Error('DB fail'));

    const req = { body: { major: 'CS' } };
    const res = makeRes();

    await saveCriteria(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Save failed' });
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
