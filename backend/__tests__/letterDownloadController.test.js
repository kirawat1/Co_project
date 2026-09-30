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
