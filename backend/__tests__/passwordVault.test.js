// __tests__/passwordVault.test.js — เจ้าหน้าที่กดดูรหัสผ่านนักศึกษา/อาจารย์
const bcrypt = require('bcryptjs');

jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: jest.fn() })),
}));

const {
  encryptPassword, decryptPassword, passwordEncFor, revealPassword, DEFAULT_TEACHER_PASSWORD,
} = require('../utils/passwordVault');
const { signIn, changeMyPassword } = require('../controllers/authController');
const { revealStudentPassword, resetStudentPassword } = require('../controllers/studentController');
const { revealTeacherPassword, resetTeacherPassword } = require('../controllers/teacherController');
const { describeRequest } = require('../utils/auditActions');

const makeRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() };
  return res;
};
const hash = (p) => bcrypt.hash(p, 4);

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.PASSWORD_VIEW_KEY;
});

describe('encryptPassword / decryptPassword', () => {
  test('เข้ารหัสแล้วถอดกลับได้ค่าเดิม (รวมภาษาไทย/อักขระพิเศษ)', () => {
    for (const p of ['Abc#1234', '653380123-4', 'รหัสไทย!@#', ':colon:in:it:']) {
      const enc = encryptPassword(p);
      expect(enc).not.toContain(p);
      expect(decryptPassword(enc)).toBe(p);
    }
  });

  test('เข้ารหัสค่าเดิมสองครั้งได้ไม่ซ้ำกัน (iv สุ่ม)', () => {
    expect(encryptPassword('Same#123')).not.toBe(encryptPassword('Same#123'));
  });

  test('ข้อมูลถูกแก้ / คีย์เปลี่ยน / รูปแบบผิด → null ไม่ throw', () => {
    const enc = encryptPassword('Abc#1234');
    const parts = enc.split(':');
    const flipped = Buffer.from(parts[3], 'base64');
    flipped[0] ^= 1;
    expect(decryptPassword([parts[0], parts[1], parts[2], flipped.toString('base64')].join(':'))).toBeNull();

    process.env.PASSWORD_VIEW_KEY = 'another-key';
    expect(decryptPassword(enc)).toBeNull();
    delete process.env.PASSWORD_VIEW_KEY;

    for (const bad of [null, undefined, '', 'garbage', 'v2:a:b:c', 'v1:only']) expect(decryptPassword(bad)).toBeNull();
    expect(encryptPassword('')).toBeNull();
    expect(encryptPassword(null)).toBeNull();
  });

  test('passwordEncFor เก็บเฉพาะนักศึกษา/อาจารย์ — เจ้าหน้าที่ไม่เก็บ', () => {
    expect(decryptPassword(passwordEncFor('student', 'Abc#1234'))).toBe('Abc#1234');
    expect(decryptPassword(passwordEncFor('TEACHER', 'Abc#1234'))).toBe('Abc#1234');
    expect(passwordEncFor('staff', 'Abc#1234')).toBeNull();
    expect(passwordEncFor(undefined, 'Abc#1234')).toBeNull();
  });
});

describe('revealPassword', () => {
  test('ไม่มีรหัสผ่าน (เข้าด้วย Google) → none', async () => {
    expect(await revealPassword({ role: 'student', password: null })).toEqual({ password: null, source: 'none' });
  });

  test('สำเนาตรงกับ hash ปัจจุบัน → stored', async () => {
    const user = { role: 'student', password: await hash('Mine#999'), passwordEnc: encryptPassword('Mine#999') };
    expect(await revealPassword(user, { studentId: '653380123-4' })).toEqual({ password: 'Mine#999', source: 'stored' });
  });

  test('สำเนาค้าง (hash ถูกเปลี่ยนทางอื่น) → ไม่แสดงรหัสเก่า', async () => {
    const user = { role: 'teacher', password: await hash('New#Pass1'), passwordEnc: encryptPassword('Old#Pass1') };
    expect(await revealPassword(user)).toEqual({ password: null, source: 'unknown' });
  });

  test('นักศึกษายังใช้รหัสเริ่มต้น (รหัสนักศึกษา) → default + backfill', async () => {
    const user = { role: 'student', password: await hash('653380123-4'), passwordEnc: null };
    const r = await revealPassword(user, { studentId: '6533801234' });
    expect(r.password).toBe('653380123-4');
    expect(r.source).toBe('default');
    expect(decryptPassword(r.backfill)).toBe('653380123-4');
  });

  test('อาจารย์ยังใช้รหัสจาก seed → default', async () => {
    const user = { role: 'teacher', password: await hash(DEFAULT_TEACHER_PASSWORD), passwordEnc: null };
    expect(await revealPassword(user)).toMatchObject({ password: DEFAULT_TEACHER_PASSWORD, source: 'default' });
  });

  test('ตั้งเองก่อนมีระบบนี้ → unknown', async () => {
    const user = { role: 'student', password: await hash('Self#Set1'), passwordEnc: null };
    expect(await revealPassword(user, { studentId: '653380123-4' })).toEqual({ password: null, source: 'unknown' });
  });
});

describe('revealStudentPassword / revealTeacherPassword', () => {
  test('นักศึกษา: คืนรหัส + no-store + ไม่มี passwordEnc/hash ใน response', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({
      studentId: '653380123-4', deletedAt: null,
      user: { id: 7, role: 'student', password: await hash('Mine#999'), passwordEnc: encryptPassword('Mine#999') },
    });
    const res = makeRes();
    await revealStudentPassword({ params: { id: '3' } }, res);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { password: 'Mine#999', source: 'stored' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('นักศึกษา: รหัสเริ่มต้นที่ยังไม่มีสำเนา → เก็บสำเนาให้ครั้งเดียว', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({
      studentId: '653380123-4', deletedAt: null,
      user: { id: 7, role: 'student', password: await hash('653380123-4'), passwordEnc: null },
    });
    prisma.user.update.mockResolvedValueOnce({});
    const res = makeRes();
    await revealStudentPassword({ params: { id: '3' } }, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { password: '653380123-4', source: 'default' } });
    const saved = prisma.user.update.mock.calls[0][0];
    expect(saved.where).toEqual({ id: 7 });
    expect(decryptPassword(saved.data.passwordEnc)).toBe('653380123-4');
  });

  test('นักศึกษา: ไม่พบ / อยู่ในถังขยะ / id ผิด', async () => {
    let res = makeRes();
    prisma.student.findUnique.mockResolvedValueOnce(null);
    await revealStudentPassword({ params: { id: '3' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);

    res = makeRes();
    prisma.student.findUnique.mockResolvedValueOnce({ studentId: '1', deletedAt: new Date(), user: { id: 1, role: 'student', password: 'x' } });
    await revealStudentPassword({ params: { id: '3' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);

    res = makeRes();
    await revealStudentPassword({ params: { id: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('อาจารย์: คืนรหัส / ไม่พบ 404', async () => {
    prisma.teacher.findUnique.mockResolvedValueOnce({
      user: { id: 9, role: 'teacher', password: await hash('Tea#Pass1'), passwordEnc: encryptPassword('Tea#Pass1') },
    });
    let res = makeRes();
    await revealTeacherPassword({ params: { id: '5' } }, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { password: 'Tea#Pass1', source: 'stored' } });

    prisma.teacher.findUnique.mockResolvedValueOnce(null);
    res = makeRes();
    await revealTeacherPassword({ params: { id: '5' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('ทุกทางที่ตั้งรหัสผ่านเก็บสำเนาคู่กับ hash', () => {
  test('login สำเร็จ: ยังไม่มีสำเนา → เก็บ · มีแล้วตรงกัน → ไม่เขียนซ้ำ · เจ้าหน้าที่ไม่เก็บ', async () => {
    const pw = 'Login#123';
    const h = await hash(pw);

    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 's@kku.ac.th', role: 'student', password: h, passwordEnc: null, student: { deletedAt: null } });
    prisma.user.update.mockResolvedValueOnce({});
    let res = makeRes();
    await signIn({ body: { email: 's@kku.ac.th', password: pw, role: 'student' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(decryptPassword(prisma.user.update.mock.calls[0][0].data.passwordEnc)).toBe(pw);

    prisma.user.update.mockClear();
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 's@kku.ac.th', role: 'student', password: h, passwordEnc: encryptPassword(pw), student: { deletedAt: null } });
    res = makeRes();
    await signIn({ body: { email: 's@kku.ac.th', password: pw, role: 'student' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.user.update).not.toHaveBeenCalled();

    prisma.user.findFirst.mockResolvedValueOnce({ id: 2, email: 'a@kku.ac.th', role: 'staff', password: h, passwordEnc: null });
    res = makeRes();
    await signIn({ body: { email: 'a@kku.ac.th', password: pw, role: 'staff' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('login: เก็บสำเนาไม่สำเร็จ ไม่ขวางการเข้าสู่ระบบ', async () => {
    const pw = 'Login#123';
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 's@kku.ac.th', role: 'teacher', password: await hash(pw), passwordEnc: null });
    prisma.user.update.mockRejectedValueOnce(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await signIn({ body: { email: 's@kku.ac.th', password: pw, role: 'teacher' } }, res);
    spy.mockRestore();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, token: expect.any(String) }));
  });

  test('login รหัสผิด: ไม่เก็บอะไร', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 's@kku.ac.th', role: 'student', password: await hash('Right#123'), passwordEnc: null, student: { deletedAt: null } });
    const res = makeRes();
    await signIn({ body: { email: 's@kku.ac.th', password: 'Wrong#123', role: 'student' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('เปลี่ยนรหัสเอง: นักศึกษาเก็บ · เจ้าหน้าที่ล้างเป็น null', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, role: 'student', password: await hash('Old#Pass1'), student: { deletedAt: null } });
    prisma.user.update.mockResolvedValueOnce({});
    let res = makeRes();
    await changeMyPassword({ user: { id: 1 }, body: { currentPassword: 'Old#Pass1', newPassword: 'New#Pass1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(decryptPassword(prisma.user.update.mock.calls[0][0].data.passwordEnc)).toBe('New#Pass1');

    prisma.user.update.mockClear();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: 'staff', password: await hash('Old#Pass1') });
    prisma.user.update.mockResolvedValueOnce({});
    res = makeRes();
    await changeMyPassword({ user: { id: 2 }, body: { currentPassword: 'Old#Pass1', newPassword: 'New#Pass1' } }, res);
    expect(prisma.user.update.mock.calls[0][0].data.passwordEnc).toBeNull();
  });

  test('เจ้าหน้าที่รีเซ็ตรหัสนักศึกษา/อาจารย์ → สำเนาเป็นรหัสใหม่', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({ userId: 7, studentId: '653380123-4', deletedAt: null });
    prisma.user.update.mockResolvedValueOnce({});
    let res = makeRes();
    await resetStudentPassword({ params: { id: '3' } }, res);
    expect(decryptPassword(prisma.user.update.mock.calls[0][0].data.passwordEnc)).toBe('653380123-4');

    prisma.user.update.mockClear();
    prisma.teacher.findUnique.mockResolvedValueOnce({ id: 5, userId: 9 });
    prisma.user.update.mockResolvedValueOnce({});
    res = makeRes();
    await resetTeacherPassword({ params: { id: '5' }, body: { newPassword: 'Tea#Pass9' } }, res);
    expect(decryptPassword(prisma.user.update.mock.calls[0][0].data.passwordEnc)).toBe('Tea#Pass9');
  });
});

describe('audit log', () => {
  test('ทุกครั้งที่ดูรหัสผ่านถูกบันทึกเป็นชื่อการกระทำที่อ่านออก + เป้าหมาย', () => {
    expect(describeRequest({ method: 'POST', path: '/api/admin/students/12/password/reveal' }))
      .toMatchObject({ action: 'ดูรหัสผ่านนักศึกษา', targetType: 'นักศึกษา', targetId: '12' });
    expect(describeRequest({ method: 'POST', path: '/api/admin/teachers/4/password/reveal' }))
      .toMatchObject({ action: 'ดูรหัสผ่านอาจารย์', targetType: 'อาจารย์', targetId: '4' });
    expect(describeRequest({ method: 'PUT', path: '/api/admin/teachers/4/password', body: { newPassword: 'x' } }))
      .toMatchObject({ action: 'รีเซ็ตรหัสผ่านอาจารย์', targetType: 'อาจารย์', targetId: '4' });
  });
});
