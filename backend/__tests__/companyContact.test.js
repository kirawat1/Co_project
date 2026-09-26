jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { addContact, updateContact, deleteContact, getAllContacts } = require('../controllers/companyController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});

describe('addContact', () => {
  test('400 — ไม่มีชื่อ', async () => {
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: '  ' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.companyContact.create).not.toHaveBeenCalled();
  });

  test('400 — อีเมลผิดรูป', async () => {
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: 'สมศรี', email: 'not-an-email' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — ไม่พบบริษัท', async () => {
    prisma.company.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await addContact({ params: { companyId: 'nope' }, body: { firstName: 'สมศรี' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ตัดช่องว่าง นามสกุลว่างได้ (ชื่อคำเดียว)', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.companyContact.create.mockImplementation(({ data }) => ({ id: 'k1', ...data }));
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: ' สมศรี ', position: ' HR ' }, user: { id: 7 } }, res);
    const { data } = prisma.companyContact.create.mock.calls[0][0];
    expect(data).toMatchObject({ firstName: 'สมศรี', lastName: '', position: 'HR', companyId: 'c1', createdById: 7 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('ชื่อยาวมากถูกตัดที่ 200 ตัวอักษร', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.companyContact.create.mockImplementation(({ data }) => ({ id: 'k1', ...data }));
    const res = makeRes();
    await addContact({ params: { companyId: 'c1' }, body: { firstName: 'ก'.repeat(500) }, user: { id: 7 } }, res);
    expect(prisma.companyContact.create.mock.calls[0][0].data.firstName).toHaveLength(200);
  });
});

describe('updateContact / deleteContact', () => {
  test('404 — แก้ผู้ติดต่อที่ไม่มี', async () => {
    prisma.companyContact.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await updateContact({ params: { id: 'x' }, body: { firstName: 'ก' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ลบได้แม้มีนักศึกษาเลือกไว้ (ตารางเชื่อมลบตาม)', async () => {
    prisma.companyContact.findUnique.mockResolvedValue({ id: 'k1' });
    prisma.companyContact.delete.mockResolvedValue({ id: 'k1' });
    const res = makeRes();
    await deleteContact({ params: { id: 'k1' } }, res);
    expect(prisma.companyContact.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('getAllContacts', () => {
  test('คืนผู้ติดต่อพร้อมชื่อบริษัทและจำนวนนักศึกษาที่เลือก', async () => {
    prisma.companyContact.findMany.mockResolvedValue([{ id: 'k1', company: { id: 'c1', name: 'บ.ก' }, _count: { studentCoops: 2 } }]);
    const res = makeRes();
    await getAllContacts({}, res);
    expect(prisma.companyContact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { company: { select: { id: true, name: true } }, _count: { select: { studentCoops: true } } },
    }));
    expect(res.json.mock.calls[0][0].contacts).toHaveLength(1);
  });
});

// ผู้ติดต่อใช้เป็นผู้รับหนังสือ — นักศึกษาห้ามลบคนที่นักศึกษาคนอื่นเลือกอยู่ (กฎเดียวกับการลบบริษัท)
describe('deleteContact — สิทธิ์นักศึกษา', () => {
  beforeEach(() => {
    prisma.companyContact.findUnique.mockResolvedValue({ id: 'k1' });
    prisma.companyContact.delete.mockResolvedValue({ id: 'k1' });
  });

  test('409 — นักศึกษาลบผู้ติดต่อที่นักศึกษาคนอื่นเลือกอยู่ไม่ได้', async () => {
    prisma.studentCoop.count.mockResolvedValue(2);
    const res = makeRes();
    await deleteContact({ params: { id: 'k1' }, user: { id: 5, role: 'student' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/2 คน/);
    expect(prisma.companyContact.delete).not.toHaveBeenCalled();
    expect(prisma.studentCoop.count).toHaveBeenCalledWith({
      where: { contacts: { some: { id: 'k1' } }, student: { userId: { not: 5 } } },
    });
  });

  test('200 — นักศึกษาลบผู้ติดต่อที่มีแต่ตัวเองเลือก (หรือไม่มีใครเลือก) ได้', async () => {
    prisma.studentCoop.count.mockResolvedValue(0);
    const res = makeRes();
    await deleteContact({ params: { id: 'k1' }, user: { id: 5, role: 'student' } }, res);
    expect(prisma.companyContact.delete).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('200 — เจ้าหน้าที่ลบได้เสมอ (หน้าเมนูเตือนจำนวนก่อนแล้ว)', async () => {
    const res = makeRes();
    await deleteContact({ params: { id: 'k1' }, user: { id: 1, role: 'staff' } }, res);
    expect(prisma.studentCoop.count).not.toHaveBeenCalled();
    expect(prisma.companyContact.delete).toHaveBeenCalled();
  });
});

// ผู้รับหนังสือ = ผู้ติดต่อ "คนแรก" — ลำดับต้องแน่นอน (ตามเวลาที่เพิ่ม) ไม่ใช่ตาม UUID
describe('ลำดับผู้ติดต่อคงที่', () => {
  test('ไฟล์ export ดึงผู้ติดต่อเรียงตามเวลาที่เพิ่ม', () => {
    const { STUDENT_EXPORT_INCLUDE } = require('../utils/studentExport');
    expect(STUDENT_EXPORT_INCLUDE.coop.include.contacts).toEqual({ orderBy: { createdAt: 'asc' } });
  });

  test('ทุก include ของผู้ติดต่อในคำร้องระบุลำดับ', () => {
    const fs = require('fs');
    const path = require('path');
    const files = ['studentController', 'adminDocController', 'supervisionController', 'teacherController']
      .map((n) => path.join(__dirname, '..', 'controllers', `${n}.js`));
    const unordered = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/contacts:\s*true/.test(line)) unordered.push(`${path.basename(f)}:${i + 1}`);
      });
    }
    expect(unordered).toEqual([]);
  });
});
