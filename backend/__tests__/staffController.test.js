// __tests__/staffController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('bcryptjs', () => ({ hash: jest.fn(() => Promise.resolve('hashed-password')) }));

const prisma = require('./__mocks__/prismaClient');
const {
  listStaff,
  createStaff,
  resetPassword,
  deleteStaff,
} = require('../controllers/staffController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// ===========================
// listStaff
// ===========================
describe('listStaff', () => {
  test('200 — returns staff list with profiles', async () => {
    const staff = [{ id: 1, username: 'a', role: 'staff', staffProfile: { firstName: 'A' } }];
    prisma.user.findMany.mockResolvedValue(staff);

    const res = makeRes();
    await listStaff({}, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'staff' } })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, staff });
  });

  test('500 — DB error', async () => {
    prisma.user.findMany.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    await listStaff({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ===========================
// createStaff
// ===========================
describe('createStaff', () => {
  const validBody = { username: 'newstaff', email: 'new@x.com', password: 'abc123', firstName: 'ก', lastName: 'ข', phone: '0800000000' };

  test('400 — missing required fields', async () => {
    const req = { body: { username: 'x' } };
    const res = makeRes();
    await createStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('409 — username or email already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 1 });
    const req = { body: validBody };
    const res = makeRes();
    await createStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('201 — creates user + staffProfile atomically, returns full record', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 5 });
    const full = { id: 5, username: 'newstaff', role: 'staff', staffProfile: { firstName: 'ก', lastName: 'ข' } };
    prisma.user.findUnique.mockResolvedValue(full);

    const req = { body: validBody };
    const res = makeRes();
    await createStaff(req, res);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: 'newstaff', role: 'staff', password: 'hashed-password' }) })
    );
    expect(prisma.staffProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 5, firstName: 'ก', lastName: 'ข' }) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, staff: full });
  });

  test('phone is optional — defaults to null', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 6 });
    prisma.user.findUnique.mockResolvedValue({ id: 6 });

    const { phone, ...noPhone } = validBody;
    const req = { body: noPhone };
    const res = makeRes();
    await createStaff(req, res);

    expect(prisma.staffProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null }) })
    );
  });
});

// ===========================
// resetPassword
// ===========================
describe('resetPassword', () => {
  test('400 — invalid id', async () => {
    const req = { params: { id: 'abc' }, body: { password: 'abcdef' } };
    const res = makeRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — password too short', async () => {
    const req = { params: { id: '1' }, body: { password: '123' } };
    const res = makeRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('404 — target is not a staff account (prevents cross-role reset)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 9, role: 'teacher' });
    const req = { params: { id: '9' }, body: { password: 'abcdef' } };
    const res = makeRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('404 — staff not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' }, body: { password: 'abcdef' } };
    const res = makeRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — resets password successfully', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 3, role: 'staff' });
    const req = { params: { id: '3' }, body: { password: 'newpassword' } };
    const res = makeRes();
    await resetPassword(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { password: 'hashed-password' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

// ===========================
// deleteStaff
// ===========================
describe('deleteStaff', () => {
  test('400 — invalid id', async () => {
    const req = { params: { id: 'x' }, user: { id: 1 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ป้องกัน regression ของบั๊กที่พบระหว่างตรวจระบบ 2026-09-07: เจ้าหน้าที่ลบบัญชีตัวเองได้
  // โดยไม่มี guard เลย (ทดสอบยืนยันจริงผ่าน API ก่อนแก้ — ได้ 200 และ user record หายจริง)
  test('400 — refuses self-delete', async () => {
    const req = { params: { id: '7' }, user: { id: 7 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  test('404 — target not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const req = { params: { id: '10' }, user: { id: 1 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404 — target is not a staff account (prevents cross-role delete)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 10, role: 'teacher' });
    const req = { params: { id: '10' }, user: { id: 1 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  // ป้องกัน regression ของบั๊กที่พบระหว่างตรวจระบบ: ลบเจ้าหน้าที่คนสุดท้ายได้ ทำให้ไม่มีใคร
  // เข้าจัดการระบบได้อีกเลย (ระบบจริงมีแค่ 3 คนตอนตรวจพบ — ความเสี่ยงไม่ใช่ทฤษฎี)
  test('400 — refuses deleting the last remaining staff account', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 20, role: 'staff' });
    prisma.user.count.mockResolvedValue(1);
    const req = { params: { id: '20' }, user: { id: 1 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  test('200 — deletes a different staff account when more than one remains', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 20, role: 'staff' });
    prisma.user.count.mockResolvedValue(3);
    const req = { params: { id: '20' }, user: { id: 1 } };
    const res = makeRes();
    await deleteStaff(req, res);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 20 } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
