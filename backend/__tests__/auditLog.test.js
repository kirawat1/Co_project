jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('../config/prismaClient');
const { describeRequest, sanitizeBody } = require('../utils/auditActions');
const { auditLogger, purgeOldLogs } = require('../middlewares/auditLogger');

// res จำลองแบบ express: handler จบด้วย res.end() แล้วค่อยเกิด event 'finish' เมื่อส่งถึงผู้ใช้
function makeRes(statusCode = 200) {
  const handlers = {};
  const res = {
    statusCode,
    locals: {},
    json: jest.fn(function (payload) { this._json = payload; return this; }),
    end: jest.fn(),
    on: (ev, fn) => { handlers[ev] = fn; },
    // จบปกติ: handler เรียก end แล้วส่งถึงผู้ใช้ (finish)
    finish: async () => { res.end(); await handlers.finish?.(); await new Promise((r) => setImmediate(r)); },
    // ผู้ใช้หลุดการเชื่อมต่อ: handler ยังทำงานจนจบ (เรียก end) แต่ไม่มี finish
    endWithoutFinish: async () => { res.end(); await new Promise((r) => setImmediate(r)); },
  };
  return res;
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

describe('แท็บแยกตามสิทธิ์ (เจ้าหน้าที่ / อาจารย์ / นักศึกษา / ไม่ได้ล็อกอิน)', () => {
  const { getAuditLogs, buildWhere } = require('../controllers/auditLogController');
  const makeJsonRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  test('role=anonymous กรองเฉพาะรายการที่ยังไม่ได้ล็อกอิน (role เป็น null)', () => {
    expect(buildWhere({ role: 'anonymous' })).toEqual({ role: null });
    expect(buildWhere({ role: 'teacher' })).toEqual({ role: 'teacher' });
    expect(buildWhere({ role: 'hacker' })).toEqual({});
  });

  test('คืนจำนวนของแต่ละแท็บ โดยใช้ตัวกรองอื่นเดียวกันแต่ไม่กรองสิทธิ์', async () => {
    prisma.auditLog.count.mockResolvedValue(3);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.groupBy.mockResolvedValue([
      { role: 'staff', _count: { _all: 5 } },
      { role: 'teacher', _count: { _all: 2 } },
      { role: 'student', _count: { _all: 3 } },
      { role: null, _count: { _all: 4 } },
    ]);
    const res = makeJsonRes();
    await getAuditLogs({ query: { role: 'student', onlyFailed: 'true' } }, res);

    const { meta } = res.json.mock.calls[0][0];
    expect(meta.roleCounts).toEqual({ all: 14, staff: 5, teacher: 2, student: 3, anonymous: 4 });
    // ตัวเลขแท็บต้องไม่ถูกกรองด้วยสิทธิ์ที่เลือกอยู่ แต่ยังใช้ตัวกรองอื่น (เฉพาะที่ไม่สำเร็จ)
    const groupWhere = prisma.auditLog.groupBy.mock.calls[0][0].where;
    expect(groupWhere.role).toBeUndefined();
    expect(groupWhere.statusCode).toEqual({ gte: 400 });
    // ส่วนตารางยังกรองเฉพาะนักศึกษา
    expect(prisma.auditLog.findMany.mock.calls[0][0].where.role).toBe('student');
  });
});

describe('รายชื่อผู้ใช้ในตัวกรอง', () => {
  const { getAuditActors } = require('../controllers/auditLogController');

  test('คนเดียวกันที่มีหลายชื่อในบันทึก รวมเป็นแถวเดียว (กัน key ซ้ำบนหน้าจอ)', async () => {
    prisma.auditLog.groupBy.mockResolvedValue([
      { userId: 7, actorName: 'อ.สมชาย ใจดี', role: 'teacher', _count: { _all: 8 } },
      { userId: 7, actorName: null, role: 'teacher', _count: { _all: 2 } },
      { userId: 9, actorName: 'สมหญิง', role: 'staff', _count: { _all: 3 } },
      { userId: null, actorName: 'ghost@example.com', role: null, _count: { _all: 5 } },
    ]);
    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    await getAuditActors({ query: {} }, res);

    const { actors } = res.json.mock.calls[0][0];
    expect(actors).toEqual([
      { userId: 7, name: 'อ.สมชาย ใจดี', role: 'teacher', count: 10 },
      { userId: 9, name: 'สมหญิง', role: 'staff', count: 3 },
    ]);
  });

  test('ส่ง role มา → กรองเฉพาะคนในแท็บนั้น', async () => {
    prisma.auditLog.groupBy.mockResolvedValue([]);
    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    await getAuditActors({ query: { role: 'student' } }, res);
    expect(prisma.auditLog.groupBy.mock.calls[0][0].where).toEqual({ role: 'student' });
  });
});

describe('ชื่อผู้ทำตาม role ที่ใช้ทำรายการ', () => {
  test('บัญชีที่มีทั้งโปรไฟล์นักศึกษาและอาจารย์ → ทำในฐานะอาจารย์ต้องได้ชื่ออาจารย์', async () => {
    prisma.user.findUnique.mockResolvedValue({
      username: 'dual',
      student: { prefix: 'MR', firstName: 'ดำ', lastName: 'แดง', studentId: '6430212186' },
      teacher: { prefix: 'อ.', firstName: 'สมศักดิ์', lastName: 'สอนดี' },
      staffProfile: null,
    });
    const req = makeReq({ user: { id: 555, role: 'teacher' }, originalUrl: '/api/teacher/supervisions/confirm-group' });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data.actorName).toBe('อ.สมศักดิ์ สอนดี');
  });
});

describe('ความลับทุกรูปแบบต้องไม่ลง log (บั๊ก: kkuPassword / id_token หลุด)', () => {
  test.each([
    ['kkuPassword', 'ZZ-SECRET-PASS'],
    ['id_token', 'ZZ-GOOGLE-TOKEN'],
    ['newPassword', 'ZZ-NEW'],
    ['clientSecret', 'ZZ-CLIENT'],
    ['access_token', 'ZZ-ACCESS'],
    ['apiKey', 'ZZ-KEY'],
  ])('ฟิลด์ %s ถูกซ่อน', (field, value) => {
    const text = sanitizeBody({ username: 'u', [field]: value });
    expect(text).not.toContain(value);
    expect(text).toContain('[ซ่อน]');
  });
});

describe('ชื่อการกระทำตรงกับ route จริง', () => {
  test.each([
    ['POST', '/api/students/sync-from-reg', 'ซิงก์ข้อมูลจากทะเบียน KKU'],
    ['PUT', '/api/auth/me/password', 'เปลี่ยนรหัสผ่าน'],
    ['POST', '/api/admin/students/import-excel', 'นำเข้านักศึกษาจาก Excel'],
    ['POST', '/api/admin/students/create', 'เพิ่มนักศึกษา'],
    ['PUT', '/api/admin/students/12', 'แก้ไขข้อมูลนักศึกษา'],
    ['DELETE', '/api/admin/students/12', 'ลบนักศึกษา (ย้ายไปถังขยะ)'],
    ['PATCH', '/api/admin/staff/3/password', 'รีเซ็ตรหัสผ่านเจ้าหน้าที่'],
  ])('%s %s → %s', (method, path, action) => {
    expect(describeRequest({ method, path, body: {} }).action).toBe(action);
  });

  test('ทุกกฎในตารางต้องมี route จริงรองรับ', () => {
    const fs = require('fs');
    const pathMod = require('path');
    const { RULES } = require('../utils/auditActions');
    const mounts = {
      authRoutes: ['/api/auth'], companyRoutes: ['/api/companies'], announcementRoutes: ['/api/announcements'],
      studentRoutes: ['/api/students'], coopRoutes: ['/api/coop'], teacherRoutes: ['/api/teacher', '/api/teachers'],
      docRoutes: ['/api/docs'], adminRoutes: ['/api/admin'], notificationRoutes: ['/api/notifications'],
      supervisionRoutes: ['/api'], visitRoutes: ['/api/visits'],
    };
    const real = [];
    for (const [file, prefixes] of Object.entries(mounts)) {
      const src = fs.readFileSync(pathMod.join(__dirname, '../routes', `${file}.js`), 'utf8');
      const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(src))) {
        for (const p of prefixes) real.push(`${m[1].toUpperCase()} ${(p + m[2]).replace(/\/$/, '').replace(/:[A-Za-z]+/g, ':x')}`);
      }
    }
    const missing = RULES.filter(([m, p]) => !real.includes(`${m} ${p}`)).map(([m, p]) => `${m} ${p}`);
    expect(missing).toEqual([]);
  });
});

describe('ใครออกเอกสารอะไร ให้ใคร — ชื่อการกระทำละเอียดตามเอกสาร', () => {
  test.each([
    [{ status: 'REQ_LETTER_ISSUED', reqDocNumber: '660301.26.6.2/1234', deliveryMethod: 'STAFF' },
      'ออกหนังสือขอความอนุเคราะห์ เลขที่ 660301.26.6.2/1234 (เจ้าหน้าที่จัดส่งให้บริษัท)'],
    [{ status: 'PLACEMENT_LETTER_ISSUED', placeDocNumber: '660301.26.6.2/9999', deliveryMethod: 'STUDENT' },
      'ออกหนังสือส่งตัว เลขที่ 660301.26.6.2/9999 (นักศึกษานำไปยื่นเอง)'],
    [{ status: 'PLACEMENT_LETTER_ISSUED' }, 'ออกหนังสือส่งตัว'],
    [{ status: 'DOCS_APPROVED' }, 'อนุมัติเอกสาร T000'],
    [{ status: 'EDITS_REQUIRED' }, 'ให้แก้ไขเอกสาร T000'],
    [{ status: 'WAITING_FOR_PLACEMENT_LETTER' }, 'ตีกลับใบตอบรับ'],
    [{ status: 'ACCEPTANCE_CHECKED' }, 'ตรวจใบตอบรับผ่าน'],
  ])('ตรวจ/ออกหนังสือ %o → %s', (body, action) => {
    expect(describeRequest({ method: 'PUT', path: '/api/admin/t000/review', body: { studentId: 5, ...body } }).action).toBe(action);
  });

  test('ร่างหนังสือรอลงนาม / ยกเลิก', () => {
    const d = (body) => describeRequest({ method: 'PUT', path: '/api/admin/t000/letter-pending', body }).action;
    expect(d({ studentId: 5, letter: 'PLACEMENT', docNumber: '660301.26.6.2/1' })).toBe('โหลดร่างหนังสือส่งตัว (รอลงนาม) เลขที่ 660301.26.6.2/1');
    expect(d({ studentId: 5, letter: 'REQUEST', cancel: true })).toBe('ยกเลิกรอลงนามหนังสือขอความอนุเคราะห์');
  });

  test('ออกหนังสือขอนิเทศพร้อมเลขที่', () => {
    const d = describeRequest({ method: 'POST', path: '/api/admin/supervisions/9/upload-letter', body: { docNumber: '660301.26.6.2/77' } });
    expect(d).toMatchObject({ action: 'ออกหนังสือขอนิเทศ เลขที่ 660301.26.6.2/77', targetType: 'นัดนิเทศ', targetId: '9' });
  });

  test('เปลี่ยนสถานะเอกสารรายไฟล์', () => {
    const d = (status) => describeRequest({ method: 'PUT', path: '/api/admin/doc/3/status', body: { status } }).action;
    expect(d('APPROVED')).toBe('ตรวจเอกสารผ่าน');
    expect(d('REJECTED')).toBe('ตรวจเอกสารไม่ผ่าน');
    expect(d('EDITS_REQUIRED')).toBe('ให้แก้ไขเอกสาร');
  });
});

describe('ให้ใคร — ชื่อเป้าหมายอ่านออก (targetName)', () => {
  const { resolveTargetName } = require('../middlewares/auditLogger');

  test('นักศึกษา (id ในระบบ) → รหัส + ชื่อ', async () => {
    prisma.student.findUnique = prisma.student.findUnique || jest.fn();
    prisma.student.findUnique.mockResolvedValue({ studentId: '6430212186', prefix: 'MR', firstName: 'ดำ', lastName: 'แดง' });
    await expect(resolveTargetName('นักศึกษา', '42')).resolves.toBe('6430212186 นายดำ แดง');
  });

  test('นัดนิเทศ → นักศึกษาเจ้าของนัด', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ student: { studentId: '6430000001', prefix: 'MS', firstName: 'ขาว', lastName: 'ใส' } });
    await expect(resolveTargetName('นัดนิเทศ', '9')).resolves.toBe('6430000001 นางสาวขาว ใส');
  });

  test('เอกสาร → ประเภทเอกสาร + นักศึกษา', async () => {
    prisma.document.findUnique.mockResolvedValue({ type: 'CP-ACCEPTANCE', name: 'acc.pdf', student: { studentId: '6430000002', prefix: 'MR', firstName: 'เขียว', lastName: 'ขจี' } });
    await expect(resolveTargetName('เอกสาร', '3')).resolves.toBe('CP-ACCEPTANCE (acc.pdf) · 6430000002 นายเขียว ขจี');
  });

  test('หาไม่เจอ / ไม่มี id → null (ไม่ทำให้ log พัง)', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(resolveTargetName('นักศึกษา', '999')).resolves.toBeNull();
    await expect(resolveTargetName('นักศึกษา', null)).resolves.toBeNull();
  });

  test('บันทึก targetName ลง log จริง', async () => {
    prisma.student.findUnique.mockResolvedValue({ studentId: '6430212186', prefix: 'MR', firstName: 'ดำ', lastName: 'แดง' });
    const req = makeReq({
      method: 'PUT', originalUrl: '/api/admin/t000/review', user: { id: 3, role: 'staff' },
      body: { studentId: '42', status: 'PLACEMENT_LETTER_ISSUED', placeDocNumber: '660301.26.6.2/5' },
    });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'ออกหนังสือส่งตัว เลขที่ 660301.26.6.2/5',
      targetType: 'นักศึกษา', targetId: '42', targetName: '6430212186 นายดำ แดง',
    });
  });
});

describe('ตัวกรอง "เฉพาะเรื่องเอกสาร"', () => {
  const { buildWhere } = require('../controllers/auditLogController');
  test('docsOnly=true → กรองเฉพาะการกระทำที่เกี่ยวกับเอกสาร และใช้ร่วมกับคำค้นได้', () => {
    const where = buildWhere({ docsOnly: 'true', q: '6430212186' });
    const prefixes = where.AND[0].OR.map((c) => c.action.startsWith);
    expect(prefixes).toEqual(expect.arrayContaining(['ออกหนังสือ', 'โหลดร่าง', 'ตรวจเอกสาร', 'ตีกลับใบตอบรับ']));
    // คำค้นยังอยู่ (ไม่ถูกทับ) และค้นจากชื่อ/รหัสนักศึกษาเป้าหมายได้
    expect(where.OR).toEqual(expect.arrayContaining([{ targetName: { contains: '6430212186' } }]));
  });
});

describe('ชื่อเป้าหมาย — ตารางที่ใช้ UUID (บริษัท / พี่เลี้ยง)', () => {
  const { resolveTargetName } = require('../middlewares/auditLogger');
  // บั๊กที่เจอตอนตรวจซ้ำ: เดิมแปลง id เป็นตัวเลขอย่างเดียว บริษัท (UUID) เลยได้ null เสมอ
  test('บริษัท id UUID → ชื่อบริษัท', async () => {
    prisma.company.findUnique.mockResolvedValue({ name: 'บริษัท โวซ่าร์ คอร์ปอเรชั่น จำกัด' });
    await expect(resolveTargetName('บริษัท', '99ddf122-ae5a-49a0-9bf4-82e8452d801a')).resolves.toBe('บริษัท โวซ่าร์ คอร์ปอเรชั่น จำกัด');
    expect(prisma.company.findUnique.mock.calls[0][0].where).toEqual({ id: '99ddf122-ae5a-49a0-9bf4-82e8452d801a' });
  });

  test('พี่เลี้ยง id UUID → ชื่อ + บริษัท', async () => {
    prisma.mentor.findUnique.mockResolvedValue({ firstName: 'สมศรี', lastName: 'ดูแล', company: { name: 'บริษัท ก' } });
    await expect(resolveTargetName('พี่เลี้ยง', 'a21ee297-de74-439b-bac1-25a037cda6f7')).resolves.toBe('สมศรี ดูแล (บริษัท ก)');
  });

  test('ลบบริษัท: หาชื่อไว้ก่อนส่งต่อให้ handler ลบ', async () => {
    prisma.company.findUnique.mockResolvedValue({ name: 'บริษัทที่จะถูกลบ' });
    const req = makeReq({ method: 'DELETE', originalUrl: '/api/companies/99ddf122-ae5a-49a0-9bf4-82e8452d801a', user: { id: 3, role: 'staff' } });
    const res = makeRes(200);
    const next = jest.fn(() => { prisma.company.findUnique.mockResolvedValue(null); }); // handler ลบแล้วหาไม่เจอ
    auditLogger(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalled();
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'ลบบริษัท', targetName: 'บริษัทที่จะถูกลบ' });
  });
});

describe('log ต้องครบแม้ผู้ใช้หลุดการเชื่อมต่อ (ตรวจ scrutinize 2026-09-22)', () => {
  // เดิมเขียน log ตอน event finish อย่างเดียว — ผู้ใช้ปิดแท็บ/เน็ตหลุดก่อนได้คำตอบ ข้อมูลถูกแก้แล้วแต่ไม่มี log (ทดลองจริง 10 ครั้ง log แค่ 8)
  test('handler จบงานแล้ว (end) แม้ไม่มี finish → ยังบันทึก log', async () => {
    const req = makeReq({ user: { id: 3, role: 'staff' }, body: { name: 'บริษัท ก' } });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.endWithoutFinish();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'เพิ่มบริษัท', statusCode: 200 });
  });

  test('จบปกติ (end แล้ว finish) → บันทึกครั้งเดียว ไม่ซ้ำ', async () => {
    const req = makeReq({ user: { id: 3, role: 'staff' } });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.finish();
    res.end();
    await new Promise((r) => setImmediate(r));
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('รายละเอียดจาก controller (ตรวจ scrutinize): ใช้ผลที่ทำจริงก่อนค่าที่เดาจาก request', () => {
  const { setAuditDetail, reviewActionText } = require('../utils/auditActions');

  test('middleware ใช้ action/เป้าหมายที่ controller แนบมา', async () => {
    prisma.student.findUnique.mockResolvedValue({ studentId: '6430212186', prefix: 'MR', firstName: 'ดำ', lastName: 'แดง' });
    const req = makeReq({
      method: 'PUT', originalUrl: '/api/admin/t000/review', user: { id: 3, role: 'staff' },
      body: { studentId: '42', status: 'PLACEMENT_LETTER_ISSUED', placeDocNumber: 'ค่าดิบจาก request' },
    });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    setAuditDetail(res, { action: 'ออกหนังสือส่งตัว เลขที่ 660301.26.6.2/5 (พิมพ์ซ้ำ)', targetType: 'นักศึกษา', targetId: 42 });
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'ออกหนังสือส่งตัว เลขที่ 660301.26.6.2/5 (พิมพ์ซ้ำ)', targetId: '42', targetName: '6430212186 นายดำ แดง',
    });
  });

  test('คำขอล้มเหลว (controller ไม่ได้แนบ) → ใช้ตัวสำรองจาก request + (ไม่สำเร็จ)', async () => {
    const req = makeReq({ method: 'PUT', originalUrl: '/api/admin/t000/review', user: { id: 3, role: 'staff' }, body: { studentId: '42', status: 'REQ_LETTER_ISSUED', reqDocNumber: '660301.26.6.2/9' } });
    const res = makeRes(409);
    auditLogger(req, res, () => {});
    await res.finish();
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('ออกหนังสือขอความอนุเคราะห์ เลขที่ 660301.26.6.2/9 (ไม่สำเร็จ)');
  });

  test('ข้อความพิมพ์ซ้ำไม่บอกวิธีจัดส่งซ้ำ', () => {
    expect(reviewActionText({ status: 'REQ_LETTER_ISSUED', docNumber: 'X/1', deliveryMethod: 'STAFF', reprint: true })).toBe('ออกหนังสือขอความอนุเคราะห์ เลขที่ X/1 (พิมพ์ซ้ำ)');
  });

  test('เพิ่มนักศึกษา: studentId เป็นรหัสนักศึกษา → หาด้วยรหัส ไม่เดาจากความยาว', async () => {
    prisma.student.findFirst.mockResolvedValue({ studentId: '640001', prefix: 'MS', firstName: 'สั้น', lastName: 'รหัส' });
    const req = makeReq({ method: 'POST', originalUrl: '/api/admin/students/create', user: { id: 3, role: 'staff' }, body: { studentId: '640001' } });
    const res = makeRes(200);
    auditLogger(req, res, () => {});
    await res.finish();
    expect(prisma.student.findFirst.mock.calls[0][0].where).toEqual({ studentId: '640001' });
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create.mock.calls[0][0].data.targetName).toBe('640001 นางสาวสั้น รหัส');
  });
});

describe('ตัวกรอง "เรื่องเอกสาร" ไม่เพี้ยนจากชื่อการกระทำ (ตรวจ scrutinize)', () => {
  const { RULES, DOC_ACTION_PREFIXES, reviewActionText, letterPendingActionText, supervisionLetterActionText } = require('../utils/auditActions');
  // ชื่อการกระทำทั้งหมดที่ระบบสร้างได้
  const labels = new Set(RULES.map((r) => r[2]));
  ['REQ_LETTER_ISSUED', 'PLACEMENT_LETTER_ISSUED', 'DOCS_APPROVED', 'EDITS_REQUIRED', 'WAITING_FOR_PLACEMENT_LETTER',
    'ACCEPTANCE_CHECKED', 'INTERNSHIP_STARTED', 'QUALIFIED', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED']
    .forEach((status) => { labels.add(reviewActionText({ status })); labels.add(reviewActionText({ status, reprint: true })); });
  ['REQUEST', 'PLACEMENT', 'SUPERVISION'].forEach((letter) => [true, false].forEach((cancel) => labels.add(letterPendingActionText({ letter, cancel }))));
  labels.add(supervisionLetterActionText({ docNumber: 'X/1' }));
  ['ตรวจเอกสารผ่าน', 'ตรวจเอกสารไม่ผ่าน', 'ให้แก้ไขเอกสาร'].forEach((l) => labels.add(l));
  const isDocPrefixed = (l) => DOC_ACTION_PREFIXES.some((p) => l.startsWith(p));

  test('ชื่อที่เกี่ยวกับเอกสาร/หนังสือ/ใบตอบรับทุกตัวถูกตัวกรองจับ (ยกเว้นการตั้งค่า)', () => {
    const docish = [...labels].filter((l) => /หนังสือ|เอกสาร|ใบตอบรับ|T000|รอลงนาม|ออกฝึก/.test(l) && !l.startsWith('ตั้งค่า'));
    expect(docish.filter((l) => !isDocPrefixed(l))).toEqual([]);
  });

  test('ทุกคำขึ้นต้นตรงกับชื่อที่มีจริงอย่างน้อยหนึ่งชื่อ', () => {
    expect(DOC_ACTION_PREFIXES.filter((p) => ![...labels].some((l) => l.startsWith(p)))).toEqual([]);
  });

  test('คำร้องสหกิจ / การตั้งค่า ไม่ปนเข้ามา', () => {
    expect(isDocPrefixed(reviewActionText({ status: 'QUALIFIED' }))).toBe(false);
    expect(isDocPrefixed('ตั้งค่าเอกสารที่ต้องส่ง')).toBe(false);
  });
});
