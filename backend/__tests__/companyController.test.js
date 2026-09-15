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
  bulkImportCompanies,
} = require('../controllers/companyController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getCompanies
// ---------------------------------------------------------------------------
describe('getCompanies', () => {
  test('200 – returns { ok: true, data: [...] }', async () => {
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
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: fakeCompanies });
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

  test.each([
    ['www.scb.co.th', 'https://www.scb.co.th'],
    ['scb.co.th/th/home', 'https://scb.co.th/th/home'],
    ['  http://scb.co.th ', 'http://scb.co.th'],
    ['HTTPS://SCB.CO.TH', 'HTTPS://SCB.CO.TH'],
    ['', null],
  ])('website "%s" ไม่มี http(s):// → เติม https:// ให้ (เดิมได้ 400 เพิ่มบริษัทไม่ได้)', async (input, saved) => {
    prisma.company.create.mockResolvedValue({ id: 'c1' });
    const res = makeRes();
    await addCompany({ user: { id: 1 }, body: { name: 'Corp', website: input } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.company.create.mock.calls[0][0].data.website).toBe(saved);
  });

  test.each(['javascript:alert(1)', 'ftp://scb.co.th', 'ไม่มีเว็บ', 'scb co th'])(
    '400 – website "%s" ไม่ใช่ลิงก์เว็บ → ไม่บันทึก',
    async (input) => {
      const res = makeRes();
      await addCompany({ user: { id: 1 }, body: { name: 'Corp', website: input } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.company.create).not.toHaveBeenCalled();
    },
  );

  test('500 – DB error returns { ok: false, message }', async () => {
    prisma.company.create.mockRejectedValue(new Error('DB fail'));

    const req = {
      user: { id: 1 },
      body: { name: 'Bad Corp' },
    };
    const res = makeRes();

    await addCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เพิ่มบริษัทไม่สำเร็จ' });
  });
});

// ---------------------------------------------------------------------------
// bulkImportCompanies
// ---------------------------------------------------------------------------
describe('bulkImportCompanies', () => {
  test('ชื่อใหม่ – สร้างบริษัท', async () => {
    prisma.company.findFirst.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'c1' });

    const req = { user: { id: 7 }, body: { companies: [{ name: ' New Corp ', province: 'ขอนแก่น', pastYears: '2558' }] } };
    const res = makeRes();

    await bulkImportCompanies(req, res);

    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { name: 'New Corp' } });
    expect(prisma.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'New Corp', province: 'ขอนแก่น', pastYears: '2558', createdById: 7 }),
    });
    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, created: 1, updated: 0, skipped: 0 });
  });

  test('ชื่อซ้ำกับที่มีอยู่ – เติมเฉพาะช่องที่ยังว่าง ไม่ทับข้อมูลเดิม', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'c9', name: 'Old Corp',
      address: null, addressNo: '99', road: '', subDistrict: '   ',
      province: 'ขอนแก่น', zipcode: null, pastYears: '2558',
    });
    prisma.company.update.mockResolvedValue({});

    const req = {
      user: { id: 7 },
      body: {
        companies: [{
          name: 'Old Corp',
          address: '123 ถ.มิตรภาพ ต.ในเมือง 40000',
          addressNo: '123',
          road: 'มิตรภาพ',
          subDistrict: 'ในเมือง',
          province: 'กรุงเทพมหานคร',
          zipcode: '40000',
          pastYears: '2560',
        }],
      },
    };
    const res = makeRes();

    await bulkImportCompanies(req, res);

    expect(prisma.company.create).not.toHaveBeenCalled();
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'c9' },
      data: {
        address: '123 ถ.มิตรภาพ ต.ในเมือง 40000',
        road: 'มิตรภาพ',
        subDistrict: 'ในเมือง',
        zipcode: '40000',
      },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, created: 0, updated: 1, skipped: 0 });
  });

  test('ชื่อซ้ำและไม่มีช่องไหนให้เติม – ข้าม ไม่เขียน DB', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'c9', name: 'Full Corp', province: 'ขอนแก่น', zipcode: '40000', pastYears: '2558' });

    const req = { user: { id: 7 }, body: { companies: [{ name: 'Full Corp', province: 'ขอนแก่น', zipcode: '40002', moo: '', pastYears: '2561' }] } };
    const res = makeRes();

    await bulkImportCompanies(req, res);

    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(prisma.company.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, created: 0, updated: 0, skipped: 1 });
  });

  test('บริษัทเดิมยังไม่มีปี – เติมปีจากไฟล์ให้', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'c3', name: 'No Year Corp', pastYears: null });
    prisma.company.update.mockResolvedValue({});

    const req = { user: { id: 7 }, body: { companies: [{ name: 'No Year Corp', pastYears: '2563' }] } };
    const res = makeRes();

    await bulkImportCompanies(req, res);

    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: 'c3' }, data: { pastYears: '2563' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, created: 0, updated: 1, skipped: 0 });
  });

  test('ไม่มีชื่อ – ข้าม', async () => {
    const req = { user: { id: 7 }, body: { companies: [{ name: '  ', province: 'ขอนแก่น' }] } };
    const res = makeRes();

    await bulkImportCompanies(req, res);

    expect(prisma.company.findFirst).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, created: 0, updated: 0, skipped: 1 });
  });

  test('400 – ไม่มีรายการ', async () => {
    const res = makeRes();
    await bulkImportCompanies({ user: { id: 7 }, body: { companies: [] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
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

  // ข้อมูลบริษัทเป็นข้อมูลกลาง — ผู้ใช้ที่ล็อกอินแล้วแก้ไขบริษัทของใครก็ได้
  // (สิทธิ์เจ้าของยังคงบังคับใช้กับการ "ลบ" เท่านั้น)
  test('200 – student can update a company created by someone else', async () => {
    const updatedCompany = { id: 'c1', name: 'Changed' };
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.company.update.mockResolvedValue(updatedCompany);

    const req = {
      params: { id: 'c1' },
      user: { id: 5 },
      body: { name: 'Changed' },
    };
    const res = makeRes();

    await updateCompany(req, res);

    expect(prisma.company.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, company: updatedCompany });
  });

  test('200 – แก้ไขบริษัท website ไม่มี https:// → เติมให้ (เดิมได้ 400)', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.company.update.mockResolvedValue({ id: 'c1' });
    const res = makeRes();
    await updateCompany({ params: { id: 'c1' }, user: { id: 5 }, body: { name: 'Corp', website: 'www.scb.co.th' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.company.update.mock.calls[0][0].data.website).toBe('https://www.scb.co.th');
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

  // ใครก็ลบได้ (อัปเดตข้อมูลบริษัทต่อจากรุ่นก่อน) — แต่ถ้ามีนักศึกษาคนอื่นเลือกบริษัทนี้อยู่ ห้ามลบ (ลบแล้วนักศึกษาเหล่านั้นหลุดจากบริษัท)
  test('200 – ไม่ใช่ staff และไม่ใช่คนเพิ่ม ลบได้ถ้าไม่มีนักศึกษาคนอื่นเลือกบริษัทนี้', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.studentCoop.count.mockResolvedValue(0);
    prisma.company.delete.mockResolvedValue({});

    const res = makeRes();
    await deleteCompany({ params: { id: 'c1' }, user: { id: 5 } }, res);

    expect(prisma.studentCoop.count).toHaveBeenCalledWith({ where: { companyId: 'c1', student: { userId: { not: 5 } } } });
    expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'ลบบริษัทและพี่เลี้ยงสำเร็จ' });
  });

  test('409 – ไม่ใช่ staff และมีนักศึกษาคนอื่นเลือกบริษัทนี้อยู่ → ไม่ลบ ให้แก้ไขแทน', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 5 });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'teacher' });
    prisma.studentCoop.count.mockResolvedValue(3);

    const res = makeRes();
    await deleteCompany({ params: { id: 'c1' }, user: { id: 5 } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/3 คน/);
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
    expect(prisma.studentCoop.count).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'ลบบริษัทและพี่เลี้ยงสำเร็จ' });
  });

  test('200 – creator (non-staff) can delete their own company', async () => {
    prisma.studentCoop.count.mockResolvedValue(0);
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

  test('200 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัท ก็เพิ่มพี่เลี้ยงได้ (อัปเดตข้อมูลต่อจากรุ่นก่อน)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.mentor.create.mockResolvedValue({ id: 'm9' });

    const res = makeRes();
    await addMentor({ params: { companyId: 'c1' }, user: { id: 5 }, body: { firstName: 'X', lastName: 'Y' } }, res);

    expect(prisma.mentor.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mentor: { id: 'm9' } });
  });

  test('404 – ไม่พบบริษัท', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    const res = makeRes();
    await addMentor({ params: { companyId: 'nope' }, user: { id: 5 }, body: { firstName: 'X', lastName: 'Y' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
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

  test('200 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัท ก็แก้พี่เลี้ยงได้', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'student' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.mentor.update.mockResolvedValue({ id: 'm1', firstName: 'X' });

    const res = makeRes();
    await updateMentor({ params: { id: 'm1' }, user: { id: 5 }, body: { firstName: 'X' } }, res);

    expect(prisma.mentor.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mentor: { id: 'm1', firstName: 'X' } });
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

  test('200 – ไม่ใช่ staff และไม่ใช่เจ้าของบริษัท ก็ลบพี่เลี้ยงได้', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1' });
    prisma.user.findUnique.mockResolvedValue({ id: 5, role: 'teacher' });
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', createdById: 99 });
    prisma.mentor.delete.mockResolvedValue({});

    const res = makeRes();
    await deleteMentor({ params: { id: 'm1' }, user: { id: 5 } }, res);

    expect(prisma.mentor.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
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
