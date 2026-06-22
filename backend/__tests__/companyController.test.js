// backend/__tests__/companyController.test.js

jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const {
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  addMentor,
} = require('../controllers/companyController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getCompanies
// ---------------------------------------------------------------------------
describe('getCompanies', () => {
  test('200 – returns array directly (no ok wrapper)', async () => {
    const fakeCompanies = [
      { id: 'c1', name: 'Company A', mentors: [] },
      { id: 'c2', name: 'Company B', mentors: [{ id: 'm1', firstName: 'John' }] },
    ];
    prisma.company.findMany.mockResolvedValue(fakeCompanies);

    const req = {};
    const res = makeRes();

    await getCompanies(req, res);

    expect(prisma.company.findMany).toHaveBeenCalledWith({
      include: { mentors: true },
      orderBy: { id: 'desc' },
    });
    // Returns array directly — no { ok, data } wrapper
    expect(res.json).toHaveBeenCalledWith(fakeCompanies);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addCompany
// ---------------------------------------------------------------------------
describe('addCompany', () => {
  test('200 – creates company and returns { ok: true, company }', async () => {
    const newCompany = {
      id: 'c1',
      name: 'New Corp',
      nameEn: 'New Corp EN',
      createdById: 42,
    };
    prisma.company.create.mockResolvedValue(newCompany);

    const req = {
      user: { id: 42 },
      body: {
        name: 'New Corp',
        nameEn: 'New Corp EN',
        address: '123 Main St',
        addressNo: '1',
        moo: '',
        soi: '',
        road: 'Main',
        subDistrict: 'Sub',
        district: 'Dist',
        province: 'Prov',
        zipcode: '12345',
        email: 'info@corp.com',
        phone: '0812345678',
        fax: '',
        website: 'https://corp.com',
        pastYears: null,
        contactPerson: 'John',
        contactPosition: 'Manager',
      },
    };
    const res = makeRes();

    await addCompany(req, res);

    expect(prisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'New Corp', createdById: 42 }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, company: newCompany });
  });

  test('400 – DB error returns { ok: false, message }', async () => {
    prisma.company.create.mockRejectedValue(new Error('DB fail'));

    const req = {
      user: { id: 1 },
      body: { name: 'Bad Corp' },
    };
    const res = makeRes();

    await addCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เพิ่มบริษัทไม่สำเร็จ' });
  });
});

// ---------------------------------------------------------------------------
// updateCompany
// ---------------------------------------------------------------------------
describe('updateCompany', () => {
  test('404 – company not found', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    const req = {
      params: { id: 'nonexistent' },
      user: { id: 1 },
      body: {},
    };
    const res = makeRes();

    await updateCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่พบบริษัท' });
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  test('403 – not staff and not creator', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });

    const req = {
      params: { id: 'c1' },
      user: { id: 5 },
      body: { name: 'Changed' },
    };
    const res = makeRes();

    await updateCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่มีสิทธิ์แก้ไขบริษัทนี้' });
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  test('200 – staff user can update any company', async () => {
    const updatedCompany = { id: 'c1', name: 'Updated Corp' };
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 10, role: 'staff' });
    prisma.company.update.mockResolvedValue(updatedCompany);

    const req = {
      params: { id: 'c1' },
      user: { id: 10 },
      body: {
        name: 'Updated Corp',
        nameEn: '',
        address: '',
        addressNo: '',
        moo: '',
        soi: '',
        road: '',
        subDistrict: '',
        district: '',
        province: '',
        zipcode: '',
        email: '',
        phone: '',
        fax: '',
        website: '',
        pastYears: null,
        contactPerson: '',
        contactPosition: '',
      },
    };
    const res = makeRes();

    await updateCompany(req, res);

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ name: 'Updated Corp' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, company: updatedCompany });
  });

  test('200 – creator (non-staff) can update their own company', async () => {
    const updatedCompany = { id: 'c2', name: 'My Corp Updated' };
    prisma.company.findUnique.mockResolvedValue({ id: 'c2', createdById: 7 });
    prisma.user.findUnique.mockResolvedValue({ id: 7, role: 'teacher' });
    prisma.company.update.mockResolvedValue(updatedCompany);

    const req = {
      params: { id: 'c2' },
      user: { id: 7 },
      body: { name: 'My Corp Updated' },
    };
    const res = makeRes();

    await updateCompany(req, res);

    expect(prisma.company.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, company: updatedCompany });
  });
});

// ---------------------------------------------------------------------------
// deleteCompany
// ---------------------------------------------------------------------------
describe('deleteCompany', () => {
  test('404 – company not found', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    const req = {
      params: { id: 'nonexistent' },
      user: { id: 1 },
    };
    const res = makeRes();

    await deleteCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่พบบริษัท' });
    expect(prisma.company.delete).not.toHaveBeenCalled();
  });

  test('403 – not staff and not creator', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });

    const req = {
      params: { id: 'c1' },
      user: { id: 5 },
    };
    const res = makeRes();

    await deleteCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่มีสิทธิ์ลบบริษัทนี้' });
    expect(prisma.company.delete).not.toHaveBeenCalled();
  });

  test('200 – staff user can delete any company', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 10, role: 'staff' });
    prisma.company.delete.mockResolvedValue({});

    const req = {
      params: { id: 'c1' },
      user: { id: 10 },
    };
    const res = makeRes();

    await deleteCompany(req, res);

    expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'ลบบริษัทและพี่เลี้ยงสำเร็จ' });
  });

  test('200 – creator (non-staff) can delete their own company', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c2', createdById: 7 });
    prisma.user.findUnique.mockResolvedValue({ id: 7, role: 'teacher' });
    prisma.company.delete.mockResolvedValue({});

    const req = {
      params: { id: 'c2' },
      user: { id: 7 },
    };
    const res = makeRes();

    await deleteCompany(req, res);

    expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: 'c2' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'ลบบริษัทและพี่เลี้ยงสำเร็จ' });
  });
});

// ---------------------------------------------------------------------------
// addMentor
// ---------------------------------------------------------------------------
describe('addMentor', () => {
  test('200 – creates mentor and returns { ok: true, mentor }', async () => {
    const newMentor = {
      id: 'm1',
      firstName: 'Alice',
      lastName: 'Smith',
      department: 'Engineering',
      position: 'Senior Dev',
      email: 'alice@corp.com',
      phone: '0812345678',
    };
    prisma.mentor.create.mockResolvedValue(newMentor);
    prisma.user.findUnique.mockResolvedValue({ id: 42, role: 'staff' });

    const req = {
      params: { companyId: 'c1' },
      user: { id: 42 },
      body: {
        firstName: 'Alice',
        lastName: 'Smith',
        department: 'Engineering',
        position: 'Senior Dev',
        email: 'alice@corp.com',
        phone: '0812345678',
      },
    };
    const res = makeRes();

    await addMentor(req, res);

    expect(prisma.mentor.create).toHaveBeenCalledWith({
      data: {
        firstName: 'Alice',
        lastName: 'Smith',
        department: 'Engineering',
        position: 'Senior Dev',
        email: 'alice@corp.com',
        phone: '0812345678',
        company: { connect: { id: 'c1' } },
        createdBy: { connect: { id: 42 } },
      },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, mentor: newMentor });
  });

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.mentor.create.mockRejectedValue(new Error('DB fail'));
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'staff' });

    const req = {
      params: { companyId: 'c1' },
      user: { id: 1 },
      body: {
        firstName: 'Bob',
        lastName: 'Jones',
        department: 'HR',
        position: 'Manager',
        email: 'bob@corp.com',
        phone: '0812345679',
      },
    };
    const res = makeRes();

    await addMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มพี่เลี้ยง',
    });
  });

  test('403 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัท', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });

    const req = {
      params: { companyId: 'c1' },
      user: { id: 5 },
      body: { firstName: 'X', lastName: 'Y' },
    };
    const res = makeRes();

    await addMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.mentor.create).not.toHaveBeenCalled();
  });

  test('200 – เจ้าของบริษัท (ไม่ใช่ staff) เพิ่มพี่เลี้ยงของบริษัทตัวเองได้', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 7 });
    prisma.mentor.create.mockResolvedValue({ id: 'm2' });

    const req = {
      params: { companyId: 'c1' },
      user: { id: 7 },
      body: { firstName: 'X', lastName: 'Y' },
    };
    const res = makeRes();

    await addMentor(req, res);

    expect(prisma.mentor.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mentor: { id: 'm2' } });
  });
});

// ---------------------------------------------------------------------------
// updateMentor / deleteMentor
// ---------------------------------------------------------------------------
const { updateMentor, deleteMentor } = require('../controllers/companyController');

describe('updateMentor', () => {
  test('404 – ไม่พบพี่เลี้ยง', async () => {
    prisma.mentor.findUnique.mockResolvedValue(null);

    const req = { params: { id: 'm1' }, user: { id: 1 }, body: {} };
    const res = makeRes();

    await updateMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.mentor.update).not.toHaveBeenCalled();
  });

  test('403 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัทที่พี่เลี้ยงคนนี้ผูกอยู่', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });

    const req = { params: { id: 'm1' }, user: { id: 5 }, body: { firstName: 'X' } };
    const res = makeRes();

    await updateMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.mentor.update).not.toHaveBeenCalled();
  });

  test('200 – staff แก้พี่เลี้ยงของบริษัทใดก็ได้', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 10, role: 'staff' });
    prisma.mentor.update.mockResolvedValue({ id: 'm1', firstName: 'Updated' });

    const req = { params: { id: 'm1' }, user: { id: 10 }, body: { firstName: 'Updated' } };
    const res = makeRes();

    await updateMentor(req, res);

    expect(prisma.mentor.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mentor: { id: 'm1', firstName: 'Updated' } });
  });
});

describe('deleteMentor', () => {
  test('404 – ไม่พบพี่เลี้ยง', async () => {
    prisma.mentor.findUnique.mockResolvedValue(null);

    const req = { params: { id: 'm1' }, user: { id: 1 } };
    const res = makeRes();

    await deleteMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.mentor.delete).not.toHaveBeenCalled();
  });

  test('403 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัทที่พี่เลี้ยงคนนี้ผูกอยู่', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'teacher' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });

    const req = { params: { id: 'm1' }, user: { id: 5 } };
    const res = makeRes();

    await deleteMentor(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.mentor.delete).not.toHaveBeenCalled();
  });

  test('200 – เจ้าของบริษัทลบพี่เลี้ยงของบริษัทตัวเองได้', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 7, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 7 });
    prisma.mentor.delete.mockResolvedValue({});

    const req = { params: { id: 'm1' }, user: { id: 7 } };
    const res = makeRes();

    await deleteMentor(req, res);

    expect(prisma.mentor.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
