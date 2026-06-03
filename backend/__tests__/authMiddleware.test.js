// __tests__/authMiddleware.test.js
const jwt = require('jsonwebtoken');

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
  test('ผ่าน — token ถูกต้อง', () => {
    const token = jwt.sign({ id: 1, role: 'STUDENT' }, SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, role: 'STUDENT' });
    expect(req.userId).toBe(1);
  });

  test('ปฏิเสธ — ไม่มี Authorization header', () => {
    const { req, res, next } = makeReqResNext();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('ปฏิเสธ — token หมดอายุ', () => {
    const token = jwt.sign({ id: 1, role: 'STUDENT' }, SECRET, { expiresIn: '-1s' });
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('ปฏิเสธ — token ไม่ถูกต้อง (ลงนามด้วย secret ผิด)', () => {
    const token = jwt.sign({ id: 1 }, 'wrong_secret');
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = `Bearer ${token}`;

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('ปฏิเสธ — format ผิด (ไม่มี Bearer) → 401 เพราะ token ขาดหาย', () => {
    const { req, res, next } = makeReqResNext();
    req.headers.authorization = 'invalid-format'; // split(" ")[1] = undefined → token missing

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
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
