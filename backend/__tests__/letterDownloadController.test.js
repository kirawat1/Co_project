// __tests__/letterDownloadController.test.js — ดาวน์โหลดหนังสือที่ออกแล้วเป็น zip
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const mockZip = { on: jest.fn(), pipe: jest.fn(), file: jest.fn(), append: jest.fn(), finalize: jest.fn().mockResolvedValue() };
jest.mock('archiver', () => jest.fn(() => mockZip));

const fs = require('fs');
const path = require('path');
const prisma = require('./__mocks__/prismaClient');
const { downloadLetters } = require('../controllers/letterDownloadController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn(), headersSent: false, destroy: jest.fn() });
const req = (query, user = { id: 1, role: 'staff' }) => ({ query, user, method: 'GET', get: () => '' });
const UPLOADS = path.join(__dirname, '../uploads');
const stu = (studentId, over = {}) => ({ studentId, firstName: 'ก', lastName: 'ข', coop: { reqLetterUrl: `${studentId}.pdf`, placeLetterUrl: null }, supervisionAppointment: null, ...over });

let exists;
beforeEach(() => {
  jest.clearAllMocks();
  exists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
});
afterEach(() => exists.mockRestore());

test('type ไม่ถูกต้อง → 400', async () => {
  const res = makeRes();
  await downloadLetters(req({ type: 'X' }), res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('ไม่มีหนังสือที่ออกแล้ว → 404 ไม่ส่ง zip', async () => {
  prisma.student.findMany.mockResolvedValue([]);
  const res = makeRes();
  await downloadLetters(req({ type: 'REQ' }), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(mockZip.finalize).not.toHaveBeenCalled();
});

test('หนังสือขอความอนุเคราะห์ของรอบที่เลือก → zip ชื่อไฟล์ รหัส_ชื่อ_นามสกุล_ประเภท', async () => {
  prisma.student.findMany.mockResolvedValue([stu('650000001'), stu('650000002', { firstName: 'ค/ง' })]);
  const res = makeRes();
  await downloadLetters(req({ type: 'REQ', coopPeriodId: '2' }), res);
  const where = prisma.student.findMany.mock.calls[0][0].where.AND;
  expect(where).toEqual(expect.arrayContaining([{ coop: { reqLetterUrl: { not: null } } }, { coop: { coopPeriodId: 2 } }]));
  expect(mockZip.file).toHaveBeenCalledWith(path.join(UPLOADS, '650000001.pdf'), { name: '650000001_ก_ข_หนังสือขอความอนุเคราะห์.pdf' });
  expect(mockZip.file).toHaveBeenCalledWith(path.join(UPLOADS, '650000002.pdf'), { name: '650000002_ค-ง_ข_หนังสือขอความอนุเคราะห์.pdf' });
  expect(res.setHeader).toHaveBeenCalledWith('X-Letter-Count', '2');
  expect(mockZip.finalize).toHaveBeenCalled();
});

test('หนังสือขอนิเทศอ่านจาก uploads/supervision · ไฟล์หาย → ใส่รายชื่อใน _ไม่พบไฟล์.txt', async () => {
  prisma.student.findMany.mockResolvedValue([
    stu('1', { supervisionAppointment: { officialLetterPath: 'a.pdf' } }),
    stu('2', { supervisionAppointment: { officialLetterPath: 'gone.pdf' } }),
  ]);
  exists.mockImplementation((p) => !String(p).endsWith('gone.pdf'));
  const res = makeRes();
  await downloadLetters(req({ type: 'supervision' }), res);
  expect(mockZip.file).toHaveBeenCalledTimes(1);
  expect(mockZip.file.mock.calls[0][0]).toBe(path.join(UPLOADS, 'supervision', 'a.pdf'));
  expect(mockZip.append).toHaveBeenCalledWith(expect.stringContaining('2 ก ข'), { name: '_ไม่พบไฟล์.txt' });
  expect(res.setHeader).toHaveBeenCalledWith('X-Letter-Missing', '1');
});

test('ชื่อไฟล์ใน DB พาออกนอก uploads → ไม่ใส่ใน zip', async () => {
  prisma.student.findMany.mockResolvedValue([stu('1', { coop: { reqLetterUrl: '../../.env' } })]);
  const res = makeRes();
  await downloadLetters(req({ type: 'REQ' }), res);
  expect(mockZip.file).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(404);
});

test('โฟลเดอร์ข้างๆ ที่ชื่อขึ้นต้นด้วย uploads (uploads-old) → ไม่ใส่ใน zip', async () => {
  prisma.student.findMany.mockResolvedValue([stu('1', { coop: { reqLetterUrl: '../uploads-old/x.pdf' } })]);
  const res = makeRes();
  await downloadLetters(req({ type: 'REQ' }), res);
  expect(mockZip.file).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(404);
});

test('อาจารย์ประจำวิชา CS → กรองเฉพาะนักศึกษา CS', async () => {
  prisma.student.findMany.mockResolvedValue([]);
  await downloadLetters(req({ type: 'PLACE' }, { id: 2, role: 'teacher' }), makeRes());
  expect(prisma.student.findMany.mock.calls[0][0].where.AND).toContainEqual({ major: { in: ['CS'] } });
});

// ── หน้าต่างยืนยัน + ลิงก์ให้เบราว์เซอร์ดาวน์โหลดเอง ─────────────────────────
describe('summary / download-link / zip ผ่านลิงก์', () => {
  const jwt = require('jsonwebtoken');
  const { letterSummary, createDownloadLink, downloadByLink, LINK_PURPOSE } = require('../controllers/letterDownloadController');
  const { verifyToken } = require('../middlewares/authMiddleware');
  const textRes = () => ({ ...makeRes(), type: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() });
  let stat;
  beforeEach(() => { stat = jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1_000_000 }); });
  afterEach(() => stat.mockRestore());

  test('summary: จำนวน · ขนาดรวม · รายชื่อ · คนที่ไม่พบไฟล์', async () => {
    prisma.student.findMany.mockResolvedValue([stu('1', { major: 'CS' }), stu('2'), stu('3', { coop: { reqLetterUrl: 'gone.pdf' } })]);
    exists.mockImplementation((p) => !String(p).endsWith('gone.pdf'));
    const res = makeRes();
    await letterSummary(req({ type: 'REQ', coopPeriodId: '2' }), res);
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({ ok: true, label: 'หนังสือขอความอนุเคราะห์', count: 2, totalBytes: 2_000_000 });
    expect(body.fileName).toMatch(/^หนังสือขอความอนุเคราะห์_.+\.zip$/);
    expect(body.students.map((s) => s.studentId)).toEqual(['1', '2']);
    expect(body.missing).toEqual([{ studentId: '3', name: 'ก ข' }]);
    expect(mockZip.finalize).not.toHaveBeenCalled(); // ไม่สร้าง zip
  });

  test('summary: เลือกหลักสูตรเอง (major) → กรองตามนั้น · อาจารย์ประจำวิชาเลือกหลักสูตรอื่น → ไม่ขยายสิทธิ์', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    await letterSummary(req({ type: 'REQ', major: 'AI' }), makeRes());
    expect(prisma.student.findMany.mock.calls[0][0].where.AND).toContainEqual({ major: { in: ['AI'] } });
    await letterSummary(req({ type: 'REQ', major: 'AI' }, { id: 2, role: 'teacher' }), makeRes());
    expect(prisma.student.findMany.mock.calls[1][0].where.AND).toContainEqual({ major: { in: ['CS'] } });
  });

  test('download-link: ไม่มีหนังสือ → 404 · มี → ลิงก์อายุสั้นที่ผูกผู้ใช้/ตัวกรอง', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    let res = makeRes();
    await createDownloadLink({ ...req({}), body: { type: 'PLACE', coopPeriodId: '2', major: 'CS' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);

    prisma.student.findMany.mockResolvedValue([stu('1', { coop: { placeLetterUrl: '1.pdf' } })]);
    res = makeRes();
    await createDownloadLink({ ...req({}), body: { type: 'PLACE', coopPeriodId: '2', major: 'CS' } }, res);
    const { url, count } = res.json.mock.calls[0][0];
    expect(count).toBe(1);
    const t = decodeURIComponent(url.split('t=')[1]);
    const claims = jwt.verify(t, process.env.JWT_SECRET);
    expect(claims).toMatchObject({ purpose: LINK_PURPOSE, uid: 1, role: 'staff', type: 'PLACE', periodId: 2, major: 'CS' });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(300);
  });

  const link = (over = {}, opts = { expiresIn: '5m' }) => jwt.sign({ purpose: LINK_PURPOSE, uid: 1, role: 'staff', type: 'REQ', periodId: 2, major: 'CS', ...over }, process.env.JWT_SECRET, opts);

  test('zip ผ่านลิงก์: ตัวกรองจากลิงก์ · ชื่อไฟล์ไทย · ไม่บีบอัดซ้ำ (PDF สแกน)', async () => {
    const archiver = require('archiver');
    prisma.user.findUnique.mockResolvedValue({ role: 'staff' });
    prisma.coopPeriod.findUnique.mockResolvedValue({ semester: 2, academicYear: '2569' });
    prisma.student.findMany.mockResolvedValue([stu('1')]);
    const res = textRes();
    await downloadByLink({ query: { t: link() }, method: 'GET', get: () => '' }, res);
    expect(prisma.student.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([{ major: { in: ['CS'] } }, { coop: { coopPeriodId: 2 } }]));
    const cd = res.setHeader.mock.calls.find(([h]) => h === 'Content-Disposition')[1];
    expect(cd).toContain('filename="letters_REQ_round2_CS.zip"');
    expect(decodeURIComponent(cd.split("UTF-8''")[1])).toBe('หนังสือขอความอนุเคราะห์_เทอม2-2569_CS.zip');
    expect(archiver).toHaveBeenCalledWith('zip', { store: true });
    expect(mockZip.finalize).toHaveBeenCalled();
  });

  test.each([
    ['หมดอายุ', () => link({}, { expiresIn: -10 })],
    ['token login ธรรมดา (ไม่มี purpose)', () => jwt.sign({ id: 1, role: 'staff' }, process.env.JWT_SECRET)],
    ['ลายเซ็นผิด', () => jwt.sign({ purpose: LINK_PURPOSE, uid: 1, role: 'staff', type: 'REQ' }, 'wrong-secret')],
  ])('ลิงก์%s → 401 ไม่สร้าง zip', async (_n, mk) => {
    const res = textRes();
    await downloadByLink({ query: { t: mk() } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockZip.finalize).not.toHaveBeenCalled();
  });

  test('บัญชีถูกลบ/เปลี่ยน role หลังออกลิงก์ → 401', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'student' });
    const res = textRes();
    await downloadByLink({ query: { t: link() } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  test('ลิงก์ดาวน์โหลดใช้แทน token login ไม่ได้', () => {
    const res = makeRes(); const next = jest.fn();
    verifyToken({ headers: { authorization: `Bearer ${link()}` } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
