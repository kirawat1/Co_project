// __tests__/authController.test.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock prisma ก่อน require controller
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');

// Mock google-auth-library (hoisted by Jest)
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

const { OAuth2Client } = require('google-auth-library');
const { signIn, getProfile, loginWithGoogle, registerStudent } = require('../controllers/authController');

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// =====================
// signIn
// =====================
describe('signIn', () => {
  test('400 — ขาด field บังคับ', async () => {
    const req = { body: { email: 'a@a.com' } }; // ขาด password และ role
    const res = makeRes();

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('400 — role ไม่ถูกต้อง', async () => {
    const req = { body: { email: 'a@a.com', password: '1234', role: 'hacker' } };
    const res = makeRes();

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('401 — ไม่พบผู้ใช้', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const req = { body: { email: 'notfound@kku.ac.th', password: '1234', role: 'student' } };
    const res = makeRes();

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('401 — รหัสผ่านผิด', async () => {
    const hashed = await bcrypt.hash('correct_password', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 1, email: 'user@kku.ac.th', role: 'student', password: hashed, student: null,
    });

    const req = { body: { email: 'user@kku.ac.th', password: 'wrong_password', role: 'student' } };
    const res = makeRes();

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — login สำเร็จ (student)', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      email: 'student@kku.ac.th',
      role: 'student',
      password: hashed,
      student: { studentId: 'u640001', firstName: 'ทดสอบ', lastName: 'ระบบ' },
    });

    const req = { body: { email: 'student@kku.ac.th', password: 'secret', role: 'student' } };
    const res = makeRes();

    await signIn(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      token: expect.any(String),
    }));
    // ตรวจว่า token ถอดรหัสได้ถูกต้อง
    const call = res.json.mock.calls[0][0];
    const decoded = jwt.verify(call.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(1);
  });

  test('200 — login สำเร็จแม้กรอก email ตัวพิมพ์ใหญ่ผสม (lowercase ก่อนค้นหา)', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      email: 'student@kku.ac.th',
      role: 'student',
      password: hashed,
      student: { studentId: 'u640001', firstName: 'ทดสอบ', lastName: 'ระบบ' },
    });

    const req = { body: { email: 'Student@KKU.ac.th', password: 'secret', role: 'student' } };
    const res = makeRes();

    await signIn(req, res);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'student@kku.ac.th', role: 'student' },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('ไม่ส่ง password กลับไปใน response', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 1, email: 'user@kku.ac.th', role: 'student', password: hashed, student: null,
    });

    const req = { body: { email: 'user@kku.ac.th', password: 'secret', role: 'student' } };
    const res = makeRes();

    await signIn(req, res);

    const responseBody = JSON.stringify(res.json.mock.calls[0][0]);
    expect(responseBody).not.toContain('secret');
    expect(responseBody).not.toContain(hashed);
  });
});

// =====================
// getProfile
// =====================
describe('getProfile', () => {
  // หมายเหตุ: getProfile ใช้ req.user (set โดย verifyToken middleware แล้ว) แทนการ verify JWT เอง
  // การทดสอบ 401 (no token) ครอบคลุมโดย auth.routes.test.js แล้ว

  test('404 — ไม่พบ user ใน DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const req = { user: { id: 99 } };
    const res = makeRes();

    await getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — คืน profile student ถูกต้อง', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'student@kku.ac.th',
      role: 'student',
      username: 'u640001',
      student: {
        studentId: 'u640001', firstName: 'ทดสอบ', lastName: 'ระบบ',
        firstNameEn: 'Test', lastNameEn: 'System',
        prefix: 'MR', phone: null, email: null,
        year: '4', gpa: 3.5, major: 'CS', studyProgram: null,
      },
      teacher: null,
    });

    const req = { user: { id: 1 } };
    const res = makeRes();

    await getProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.user.studentId).toBe('u640001');
    expect(body.user).not.toHaveProperty('password');
  });
});

// =====================
// loginWithGoogle
// =====================
describe('loginWithGoogle', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 – valid kkumail token issues JWT', async () => {
    const mockVerify = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'test@kkumail.com', email_verified: true }),
    });
    OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerify }));

    prisma.user.findFirst.mockResolvedValue({ id: 1, email: 'test@kkumail.com', role: 'student', student: { deletedAt: null } });

    const req = { body: { id_token: 'valid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, token: expect.any(String) }));
  });

  test('403 – non-KKU email rejected', async () => {
    const mockVerify = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'user@gmail.com', email_verified: true }),
    });
    OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerify }));

    const req = { body: { id_token: 'valid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('401 – email not found in system', async () => {
    const mockVerify = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'notfound@kkumail.com', email_verified: true }),
    });
    OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerify }));

    prisma.user.findFirst.mockResolvedValue(null);

    const req = { body: { id_token: 'valid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 – student is soft-deleted (in trash)', async () => {
    const mockVerify = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'trashed@kkumail.com', email_verified: true }),
    });
    OAuth2Client.mockImplementation(() => ({ verifyIdToken: mockVerify }));

    prisma.user.findFirst.mockResolvedValue({
      id: 1, email: 'trashed@kkumail.com', role: 'student',
      student: { deletedAt: new Date('2026-01-01') },
    });

    const req = { body: { id_token: 'valid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('400 – missing id_token', async () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await loginWithGoogle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// =====================
// registerStudent
// =====================
describe('registerStudent', () => {
  function makeReq(overrides = {}) {
    return {
      body: {
        studentId: '640212186',
        firstName: 'ทดสอบ',
        lastName: 'ระบบ',
        email: 'test@kkumail.com',
        password: 'Test@12345678',
        ...overrides,
      },
    };
  }

  test('400 — ขาด field บังคับ (firstName ว่าง)', async () => {
    const req = makeReq({ firstName: '' });
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].ok).toBe(false);
  });

  test('400 — password ไม่ใช่เลข 13 หลัก', async () => {
    const req = makeReq({ password: 'short' });
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/8/);
  });

  test('400 — email ไม่ใช่ KKU domain', async () => {
    const req = makeReq({ email: 'user@gmail.com' });
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/kkumail|kku\.ac\.th/i);
  });

  test('400 — รองรับ @kku.ac.th ด้วย', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 5, email: 'u64@kku.ac.th', role: 'student',
      student: { studentId: '640000001', firstName: 'ก', lastName: 'ข' },
    });
    const req = makeReq({ email: 'u64@kku.ac.th' });
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });

  test('409 — email ซ้ำในระบบ', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 1 });
    const req = makeReq();
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/อีเมล/);
  });

  test('409 — studentId ซ้ำในระบบ', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue({ id: 9 });
    const req = makeReq();
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/รหัสนักศึกษา/);
  });

  test('200 — สมัครสมาชิกสำเร็จ คืน token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 10, email: 'test@kkumail.com', role: 'student',
      student: { studentId: '640212186', firstName: 'ทดสอบ', lastName: 'ระบบ' },
    });
    const req = makeReq();
    const res = makeRes();
    await registerStudent(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.studentId).toBe('640212186');
  });

  test('200 — password ถูก hash ก่อน create (ไม่เก็บ plaintext)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 11, email: 'test@kkumail.com', role: 'student',
      student: { studentId: '640212186', firstName: 'ทดสอบ', lastName: 'ระบบ' },
    });
    const req = makeReq();
    const res = makeRes();
    await registerStudent(req, res);
    const createArg = prisma.user.create.mock.calls[0][0];
    expect(createArg.data.password).not.toBe('Test@12345678');
    expect(createArg.data.password).toMatch(/^\$2[aby]\$/);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(new Error('DB down'));
    const req = makeReq();
    const res = makeRes();
    await registerStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
