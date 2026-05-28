// backend/__tests__/coopPeriodController.test.js

jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const {
  getPeriods,
  createPeriod,
  updatePeriod,
  togglePeriod,
  deletePeriod,
  getActivePeriod,
} = require('../controllers/coopPeriodController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getPeriods
// ---------------------------------------------------------------------------
describe('getPeriods', () => {
  test('200 – returns { ok: true, periods }', async () => {
    const fakePeriods = [
      { id: 1, academicYear: '2567', semester: 1, isActive: true },
      { id: 2, academicYear: '2566', semester: 2, isActive: false },
    ];
    prisma.coopPeriod.findMany.mockResolvedValue(fakePeriods);

    const req = {};
    const res = makeRes();

    await getPeriods(req, res);

    expect(prisma.coopPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, periods: fakePeriods });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopPeriod.findMany.mockRejectedValue(new Error('DB fail'));

    const req = {};
    const res = makeRes();

    await getPeriods(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false })
    );
  });
});

// ---------------------------------------------------------------------------
// createPeriod
// ---------------------------------------------------------------------------
describe('createPeriod', () => {
  test('400 – duplicate academicYear+semester returns error', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, academicYear: '2567', semester: 1 });

    const req = {
      body: {
        academicYear: '2567',
        semester: '1',
        startDate: '2024-06-01',
        endDate: '2024-10-31',
      },
    };
    const res = makeRes();

    await createPeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false })
    );
    expect(prisma.coopPeriod.create).not.toHaveBeenCalled();
  });

  test('200 – creates period and returns { ok: true, period }', async () => {
    const newPeriod = { id: 3, academicYear: '2568', semester: 1 };
    prisma.coopPeriod.findUnique.mockResolvedValue(null);
    prisma.coopPeriod.create.mockResolvedValue(newPeriod);

    const req = {
      body: {
        academicYear: '2568',
        semester: '1',
        startDate: '2025-06-01',
        endDate: '2025-10-31',
      },
    };
    const res = makeRes();

    await createPeriod(req, res);

    expect(prisma.coopPeriod.findUnique).toHaveBeenCalledWith({
      where: {
        academicYear_semester: { academicYear: '2568', semester: 1 },
      },
    });
    expect(prisma.coopPeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ academicYear: '2568', semester: 1 }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, period: newPeriod });
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(null);
    prisma.coopPeriod.create.mockRejectedValue(new Error('DB fail'));

    const req = {
      body: { academicYear: '2568', semester: '2', startDate: '2025-11-01', endDate: '2026-03-31' },
    };
    const res = makeRes();

    await createPeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ---------------------------------------------------------------------------
// updatePeriod
// ---------------------------------------------------------------------------
describe('updatePeriod', () => {
  test('200 – updates period and returns { ok: true, period }', async () => {
    const updated = { id: 1, academicYear: '2567', semester: 2 };
    prisma.coopPeriod.update.mockResolvedValue(updated);

    const req = {
      params: { id: '1' },
      body: {
        academicYear: '2567',
        semester: '2',
        startDate: '2024-11-01',
        endDate: '2025-03-31',
      },
    };
    const res = makeRes();

    await updatePeriod(req, res);

    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ academicYear: '2567', semester: 2 }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, period: updated });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false, error }', async () => {
    prisma.coopPeriod.update.mockRejectedValue(new Error('Not found'));

    const req = {
      params: { id: '99' },
      body: { academicYear: '2567', semester: '1', startDate: '2024-06-01', endDate: '2024-10-31' },
    };
    const res = makeRes();

    await updatePeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ---------------------------------------------------------------------------
// togglePeriod
// ---------------------------------------------------------------------------
describe('togglePeriod', () => {
  test('200 – activating a period deactivates others first', async () => {
    const updated = { id: 1, isActive: true };
    prisma.coopPeriod.updateMany.mockResolvedValue({ count: 2 });
    prisma.coopPeriod.update.mockResolvedValue(updated);

    const req = { params: { id: '1' }, body: { isActive: true } };
    const res = makeRes();

    await togglePeriod(req, res);

    // Should call updateMany to deactivate others
    expect(prisma.coopPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: { not: 1 } },
      data: { isActive: false },
    });
    // Then update the target
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { isActive: true },
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
  });

  test('200 – deactivating a period does NOT call updateMany', async () => {
    const updated = { id: 1, isActive: false };
    prisma.coopPeriod.update.mockResolvedValue(updated);

    const req = { params: { id: '1' }, body: { isActive: false } };
    const res = makeRes();

    await togglePeriod(req, res);

    expect(prisma.coopPeriod.updateMany).not.toHaveBeenCalled();
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { isActive: false } })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('500 – DB error returns { ok: false }', async () => {
    prisma.coopPeriod.update.mockRejectedValue(new Error('DB fail'));

    const req = { params: { id: '1' }, body: { isActive: false } };
    const res = makeRes();

    await togglePeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ---------------------------------------------------------------------------
// deletePeriod
// ---------------------------------------------------------------------------
describe('deletePeriod', () => {
  test('200 – deletes period and returns { ok: true }', async () => {
    prisma.coopPeriod.delete.mockResolvedValue({});

    const req = { params: { id: '1' } };
    const res = makeRes();

    await deletePeriod(req, res);

    expect(prisma.coopPeriod.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test('500 – DB error returns { ok: false }', async () => {
    prisma.coopPeriod.delete.mockRejectedValue(new Error('DB fail'));

    const req = { params: { id: '99' } };
    const res = makeRes();

    await deletePeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ---------------------------------------------------------------------------
// getActivePeriod
// ---------------------------------------------------------------------------
describe('getActivePeriod', () => {
  test('200 – returns { ok: true, period } when active period found', async () => {
    const activePeriod = { id: 1, academicYear: '2567', semester: 1, isActive: true };
    prisma.coopPeriod.findFirst.mockResolvedValue(activePeriod);

    const req = {};
    const res = makeRes();

    await getActivePeriod(req, res);

    expect(prisma.coopPeriod.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, period: activePeriod });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('200 – returns { ok: true, period: null } when no active period', async () => {
    prisma.coopPeriod.findFirst.mockResolvedValue(null);

    const req = {};
    const res = makeRes();

    await getActivePeriod(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, period: null });
  });

  test('500 – DB error returns { ok: false }', async () => {
    prisma.coopPeriod.findFirst.mockRejectedValue(new Error('DB fail'));

    const req = {};
    const res = makeRes();

    await getActivePeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
