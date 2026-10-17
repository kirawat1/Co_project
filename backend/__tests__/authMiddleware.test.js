// __tests__/authMiddleware.test.js
const jwt = require('jsonwebtoken');

// session (บัญชียังอยู่/เวอร์ชัน token) ทดสอบละเอียดใน session.test.js — ที่นี่ดูว่า middleware ใช้ผลอย่างไร
jest.mock('../utils/session', () => ({ checkSession: jest.fn(async () => true) }));
const { checkSession } = require('../utils/session');

// โหลด middleware หลังจาก setup.js ตั้งค่า JWT_SECRET แล้ว
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

const SECRET = process.env.JWT_SECRET;

function makeReqResNext() {
  const req = { headers: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('verifyToken middleware', () => {
  test('ผ่าน — token ถูกต้อง', async () => {
    const token = jwt.sign({ id: 1, role: 'STUDENT' }, SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, role: 'STUDENT' });
    expect(req.userId).toBe(1);
  });

  test('ปฏิเสธ — ไม่มี Authorization header', async () => {
    const { req, res, next } = makeReqResNext();

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('ปฏิเสธ — token หมดอายุ', async () => {
    const token = jwt.sign({ id: 1, role: 'STUDENT' }, SECRET, { expiresIn: '-1s' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('ปฏิเสธ — token ไม่ถูกต้อง (ลงนามด้วย secret ผิด)', async () => {
    const token = jwt.sign({ id: 1 }, 'wrong_secret');
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('ปฏิเสธ — format ผิด (ไม่มี Bearer) → 401 เพราะ token ขาดหาย', async () => {
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = 'invalid-format'; // split(" ")[1] = undefined → token missing

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('ปฏิเสธ — บัญชีถูกลบ/เปลี่ยนสิทธิ์/เพิกถอน session (checkSession = false) → 401', async () => {
    checkSession.mockResolvedValueOnce(false);
    const token = jwt.sign({ id: 1, role: 'staff' }, SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;
    await verifyToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('DB มีปัญหาตอนตรวจ session → 503 (ไม่ใช่ 401 ที่ทำให้หน้าเว็บเด้งออก)', async () => {
    checkSession.mockRejectedValueOnce(new Error('db down'));
    const token = jwt.sign({ id: 1, role: 'staff' }, SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    await verifyToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe('verifyRole middleware', () => {
  test('ผ่าน — role ตรงกับที่อนุญาต', () => {
    const { req, res, next } = makeReqResNext();
    req.user = { id: 1, role: 'ADMIN' };

    verifyRole('ADMIN', 'TEACHER')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('ปฏิเสธ — role ไม่ตรง → 403 (มีสิทธิ์ไม่พอ ไม่ใช่ token เสีย)', () => {
    const { req, res, next } = makeReqResNext();
    req.user = { id: 1, role: 'STUDENT' };

    verifyRole('ADMIN', 'TEACHER')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('ปฏิเสธ — ไม่มี req.user → 403', () => {
    const { req, res, next } = makeReqResNext();

    verifyRole('ADMIN')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
