// __tests__/docRequirementController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');
const {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
} = require('../controllers/docRequirementController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// =====================
// getRequirements
// =====================
describe('getRequirements', () => {
  test('200 — คืนรายการเอกสารทั้งหมดเรียงตาม id', async () => {
    const mockList = [
      { id: 1, docKey: 'T000', title: 'ใบสมัคร', description: null, isRequired: true, isActive: true },
      { id: 2, docKey: 'T002', title: 'แบบรายงาน', description: 'รายงานงาน', isRequired: false, isActive: true },
    ];
    prisma.documentRequirement.findMany.mockResolvedValue(mockList);

    const req = {};
    const res = makeRes();
    await getRequirements(req, res);

    expect(prisma.documentRequirement.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { id: 'asc' } });
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.requirements).toHaveLength(2);
    expect(body.requirements[0].docKey).toBe('T000');
  });

  test('200 — คืน array ว่างเมื่อไม่มีข้อมูล', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([]);
    const req = {};
    const res = makeRes();
    await getRequirements(req, res);
    expect(res.json.mock.calls[0][0].requirements).toHaveLength(0);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.documentRequirement.findMany.mockRejectedValue(new Error('DB fail'));
    const req = {};
    const res = makeRes();
    await getRequirements(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].ok).toBe(false);
  });
});

// =====================
// createRequirement
// =====================
describe('createRequirement', () => {
  const baseBody = {
    docKey: 'T003',
    title: 'โครงร่าง',
    description: 'รายละเอียด',
    isRequired: true,
    isActive: true,
  };

  test('200 — สร้าง requirement ใหม่สำเร็จ', async () => {
    const created = { id: 3, ...baseBody };
    prisma.documentRequirement.create.mockResolvedValue(created);

    const req = { body: baseBody };
    const res = makeRes();
    await createRequirement(req, res);

    expect(prisma.documentRequirement.create).toHaveBeenCalledWith({
      data: baseBody,
    });
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.requirement.docKey).toBe('T003');
  });

  test('400 — P2002 unique constraint (docKey ซ้ำ) คืน 400', async () => {
    const err = new Error('Unique constraint');
    err.code = 'P2002';
    prisma.documentRequirement.create.mockRejectedValue(err);

    const req = { body: baseBody };
    const res = makeRes();
    await createRequirement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/ซ้ำ/);
  });

  test('500 — error อื่นคืน 500', async () => {
    prisma.documentRequirement.create.mockRejectedValue(new Error('Unknown'));
    const req = { body: baseBody };
    const res = makeRes();
    await createRequirement(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// updateRequirement
// =====================
describe('updateRequirement', () => {
  test('200 — อัปเดตข้อมูลสำเร็จ', async () => {
    const updated = { id: 2, docKey: 'T002', title: 'แก้ไขแล้ว', description: null, isRequired: true, isActive: false };
    prisma.documentRequirement.update.mockResolvedValue(updated);

    const req = {
      params: { id: '2' },
      body: { docKey: 'T002', title: 'แก้ไขแล้ว', description: null, isRequired: true, isActive: false },
    };
    const res = makeRes();
    await updateRequirement(req, res);

    expect(prisma.documentRequirement.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: expect.objectContaining({ title: 'แก้ไขแล้ว' }),
    });
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].requirement.title).toBe('แก้ไขแล้ว');
  });

  test('500 — DB error คืน 500', async () => {
    prisma.documentRequirement.update.mockRejectedValue(new Error('fail'));
    const req = { params: { id: '99' }, body: {} };
    const res = makeRes();
    await updateRequirement(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// deleteRequirement
// =====================
describe('deleteRequirement', () => {
  test('200 — ลบสำเร็จ', async () => {
    prisma.documentRequirement.delete.mockResolvedValue({ id: 1 });
    const req = { params: { id: '1' } };
    const res = makeRes();
    await deleteRequirement(req, res);

    expect(prisma.documentRequirement.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.documentRequirement.delete.mockRejectedValue(new Error('fail'));
    const req = { params: { id: '999' } };
    const res = makeRes();
    await deleteRequirement(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
