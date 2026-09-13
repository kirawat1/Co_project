// __tests__/studentPassword.test.js — รหัสผ่านนักศึกษา: ค่าเริ่มต้น, เพิ่มทีละคน, รีเซ็ตโดยเจ้าหน้าที่, เปลี่ยนเอง
const bcrypt = require('bcryptjs');

jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');

const { defaultStudentPassword, hashDefaultStudentPassword } = require('../utils/studentPassword');
const { createStudentSingle, resetStudentPassword } = require('../controllers/studentController');
const { changeMyPassword } = require('../controllers/authController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('defaultStudentPassword', () => {
  test('รหัสที่มีขีดอยู่แล้ว → ใช้ตามนั้น', () => {
    expect(defaultStudentPassword('653380123-4')).toBe('653380123-4');
  });
  test('10 หลักไม่มีขีด → เติมขีดก่อนหลักสุดท้าย', () => {
    expect(defaultStudentPassword('6533801234')).toBe('653380123-4');
  });
  test('ตัดช่องว่างหัวท้าย', () => {
    expect(defaultStudentPassword('  653380123-4 ')).toBe('653380123-4');
  });
  test('ค่าว่าง → ว่าง', () => {
    expect(defaultStudentPassword(null)).toBe('');
  });
});

describe('hashDefaultStudentPassword', () => {
  test('ได้ bcrypt hash ที่ตรวจกับรหัสนักศึกษาแบบมีขีดผ่าน แต่แบบไม่มีขีดไม่ผ่าน', async () => {
    const hash = await hashDefaultStudentPassword('653380123-4');
    expect(hash).toMatch(/^\$2[ab]\$/);
    expect(await bcrypt.compare('653380123-4', hash)).toBe(true);
    expect(await bcrypt.compare('6533801234', hash)).toBe(false);
  });
  test('ไม่มีรหัสนักศึกษา → null (ไม่สร้างรหัสผ่านว่าง)', async () => {
    expect(await hashDefaultStudentPassword('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('createStudentSingle', () => {
  test('201 — บัญชีใหม่มีรหัสผ่านเริ่มต้นเป็นรหัสนักศึกษา', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 5, email: 'a@kkumail.com', student: { studentId: '663380001-1' } });

    const req = { body: { studentId: ' 663380001-1 ', firstName: 'ก', lastName: 'ข', email: 'A@kkumail.com' } };
    const res = makeRes();
    await createStudentSingle(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(await bcrypt.compare('663380001-1', data.password)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('resetStudentPassword', () => {
  test('400 — id ไม่ใช่ตัวเลข', async () => {
    const res = makeRes();
    await resetStudentPassword({ params: { id: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await resetStudentPassword({ params: { id: '9' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('404 — นักศึกษาอยู่ในถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ userId: 3, studentId: '663380001-1', deletedAt: new Date() });
    const res = makeRes();
    await resetStudentPassword({ params: { id: '9' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('200 — ตั้งรหัสผ่านของบัญชีนักศึกษากลับเป็นรหัสนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue({ userId: 3, studentId: '663380001-1', deletedAt: null });
    prisma.user.update.mockResolvedValue({});
    const res = makeRes();
    await resetStudentPassword({ params: { id: '9' } }, res);

    expect(prisma.student.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9 } }));
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 3 });
    expect(await bcrypt.compare('663380001-1', arg.data.password)).toBe(true);
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('changeMyPassword', () => {
  const STRONG = 'NewPass#2026';
  let currentHash;
  beforeAll(async () => { currentHash = await bcrypt.hash('663380001-1', 4); });

  const student = () => ({ id: 3, role: 'student', password: currentHash, student: { studentId: '663380001-1', deletedAt: null } });

  test('400 — ไม่กรอกรหัสผ่านปัจจุบัน/ใหม่', async () => {
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { newPassword: STRONG } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('400 (ไม่ใช่ 401 ที่ทำให้หน้าเว็บ logout) — รหัสผ่านปัจจุบันผิด', async () => {
    prisma.user.findUnique.mockResolvedValue(student());
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { currentPassword: 'wrong', newPassword: STRONG } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/รหัสผ่านปัจจุบันไม่ถูกต้อง/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('400 — รหัสผ่านใหม่ไม่ผ่านกติกา', async () => {
    prisma.user.findUnique.mockResolvedValue(student());
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { currentPassword: '663380001-1', newPassword: 'short' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('400 — บัญชียังไม่มีรหัสผ่าน', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...student(), password: null });
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { currentPassword: 'x', newPassword: STRONG } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบบัญชี / นักศึกษาถูกลบ', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...student(), student: { studentId: '663380001-1', deletedAt: new Date() } });
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { currentPassword: '663380001-1', newPassword: STRONG } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('200 — เปลี่ยนสำเร็จ รหัสใหม่ใช้ได้ รหัสเดิมใช้ไม่ได้', async () => {
    prisma.user.findUnique.mockResolvedValue(student());
    prisma.user.update.mockResolvedValue({});
    const res = makeRes();
    await changeMyPassword({ user: { id: 3 }, body: { currentPassword: '663380001-1', newPassword: STRONG } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 3 });
    expect(await bcrypt.compare(STRONG, arg.data.password)).toBe(true);
    expect(await bcrypt.compare('663380001-1', arg.data.password)).toBe(false);
  });
});
