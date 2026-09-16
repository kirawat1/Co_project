jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('../config/prismaClient');
const { describeRequest, sanitizeBody } = require('../utils/auditActions');
const { auditLogger, purgeOldLogs } = require('../middlewares/auditLogger');

// res จำลองที่จับ event 'finish' ได้เหมือน express
function makeRes(statusCode = 200) {
  const handlers = {};
  return {
    statusCode,
    locals: {},
    json: jest.fn(function (payload) { this._json = payload; return this; }),
    on: (ev, fn) => { handlers[ev] = fn; },
    finish: async () => { await handlers.finish?.(); await new Promise((r) => setImmediate(r)); },
  };
}
const makeReq = (over = {}) => ({
  method: 'POST',
  originalUrl: '/api/companies',
  headers: {},
  socket: { remoteAddress: '127.0.0.1' },
  body: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({ id: 1 });
  prisma.user.findUnique.mockResolvedValue({
    username: 'staff01', email: 's@kku.ac.th',
    student: null, teacher: null, staffProfile: { firstName: 'สมหญิง', lastName: 'ใจดี' },
  });
});

describe('describeRequest — ตั้งชื่อการกระทำเป็นภาษาคน', () => {
  test('เส้นทางที่รู้จัก ได้ชื่อไทย + เป้าหมายจาก body', () => {
    const d = describeRequest({ method: 'PUT', path: '/api/admin/t000/review', body: { studentId: 42 } });
    expect(d.action).toBe('ตรวจเอกสาร / เปลี่ยนสถานะนักศึกษา');
    expect(d).toMatchObject({ targetType: 'นักศึกษา', targetId: '42' });
  });

  test('ดึง id เป้าหมายจาก path ได้', () => {
    const d = describeRequest({ method: 'PUT', path: '/api/admin/supervisions/7/confirmed-date', body: {} });
    expect(d).toMatchObject({ action: 'แก้วันนิเทศ', targetType: 'นัดนิเทศ', targetId: '7' });
  });

  test('ตัด query string ออกก่อนเทียบ', () => {
    expect(describeRequest({ method: 'DELETE', path: '/api/companies/9?force=1', body: {} }).action).toBe('ลบบริษัท');
  });

  test('เส้นทางที่ไม่อยู่ในตาราง ใช้ METHOD + path', () => {
    const d = describeRequest({ method: 'POST', path: '/api/unknown/thing', body: {} });
    expect(d).toMatchObject({ action: 'POST /api/unknown/thing', targetType: null, targetId: null });
  });
});

describe('sanitizeBody — ไม่เก็บความลับ', () => {
  test('ซ่อนรหัสผ่าน/โทเคน แต่เก็บฟิลด์ปกติ', () => {
    const text = sanitizeBody({ email: 'a@b.c', password: 'secret123', token: 'xyz', role: 'student' });
    expect(text).toContain('a@b.c');
    expect(text).not.toContain('secret123');
    expect(text).not.toContain('xyz');
    expect(text).toContain('[ซ่อน]');
  });

  test('ย่อ array และข้อความยาว ไม่ให้ log บวม', () => {
    const text = sanitizeBody({ ids: [1, 2, 3], note: 'ก'.repeat(500) });
    expect(text).toContain('[3 รายการ]');
    expect(text.length).toBeLessThanOrEqual(810);
  });

  test('body ว่างคืน null', () => {
    expect(sanitizeBody({})).toBeNull();
    expect(sanitizeBody(undefined)).toBeNull();
  });
});

describe('auditLogger — บันทึกหลังจบ request', () => {
  test('POST ที่สำเร็จ → บันทึกผู้ทำ สิทธิ์ และการกระทำ', async () => {
    const req = makeReq({ user: { id: 3, role: 'staff' }, body: { name: 'บริษัท ก' } });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.finish();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 3, role: 'staff', actorName: 'สมหญิง ใจดี',
      action: 'เพิ่มบริษัท', method: 'POST', path: '/api/companies', statusCode: 200,
    });
  });

  test('คำสั่งที่ล้มเหลว → ต่อท้ายว่า (ไม่สำเร็จ) และเก็บ status', async () => {
    const req = makeReq({ user: { id: 3, role: 'staff' } });
    const res = makeRes(409);
    auditLogger(req, res, () => {});
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'เพิ่มบริษัท (ไม่สำเร็จ)', statusCode: 409 });
  });

  test('GET ไม่ถูกบันทึก', async () => {
    const next = jest.fn();
    auditLogger(makeReq({ method: 'GET', originalUrl: '/api/students' }), makeRes(200), next);
    expect(next).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test('เข้าสู่ระบบสำเร็จ → เก็บ id ผู้ใช้จาก response (ไม่เก็บ token)', async () => {
    prisma.user.findUnique.mockResolvedValue({ username: 'u640001', student: { prefix: 'MR', firstName: 'ดำ', lastName: 'แดง', studentId: '640001' } });
    const req = makeReq({ originalUrl: '/api/auth/signin', body: { email: 'a@b.c', password: 'p' } });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    res.json({ ok: true, token: 'jwt-token', user: { id: 9, role: 'student' } });
    await res.finish();

    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 9, role: 'student', action: 'เข้าสู่ระบบ' });
    expect(data.actorName).toContain('ดำ');
    expect(data.detail).not.toContain('jwt-token');
  });

  test('เข้าสู่ระบบไม่สำเร็จ → ยังบันทึก พร้อมอีเมลที่กรอก', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const req = makeReq({ originalUrl: '/api/auth/signin', body: { email: 'ghost@example.com', password: 'x' } });
    const res = makeRes(401);
    auditLogger(req, res, () => {});
    await res.finish();

    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: null, action: 'เข้าสู่ระบบ (ไม่สำเร็จ)', actorName: 'ghost@example.com', statusCode: 401,
    });
  });

  test('เขียน log ไม่สำเร็จ ต้องไม่ทำให้ request พัง', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('DB ล่ม'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const req = makeReq({ user: { id: 3, role: 'staff' } });
    const res = makeRes(200);
    const next = jest.fn();
    auditLogger(req, res, next);
    await expect(res.finish()).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('purgeOldLogs — เก็บย้อนหลัง 1 ปี', () => {
  test('ลบเฉพาะรายการที่เก่ากว่า 365 วัน', async () => {
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });
    const count = await purgeOldLogs();
    expect(count).toBe(5);
    const cutoff = prisma.auditLog.deleteMany.mock.calls[0][0].where.createdAt.lt;
    const days = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(365);
  });
});
