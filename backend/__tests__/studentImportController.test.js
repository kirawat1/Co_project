jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('xlsx');

const prisma = require('./__mocks__/prismaClient');
const XLSX = require('xlsx');
const { importStudents } = require('../controllers/studentImportController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('importStudents', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 – no file uploaded', async () => {
    const req = { file: null };
    const res = makeRes();
    await importStudents(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 – imports valid row, returns summary', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([{
      'email นักศึกษา': 'stu1@kkumail.com',
      'id': '645040001-1',
      'ชื่อ': 'สมชาย',
      'สกุล': 'ใจดี',
      'ปี': '3',
      'สาขาวิชา': 'CS',
      'รูปแบบการศึกษา': 'ปกติ',
      'อาจารย์ที่ปรึกษาทั่วไป': 'อ.ทดสอบ',
      'email อาจารย์': 'teacher@kku.ac.th',
    }]) };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 1 });
    prisma.student.upsert.mockResolvedValue({ id: 1 });
    prisma.teacher.findFirst.mockResolvedValue({ id: 10 });
    prisma.teacher.findMany.mockResolvedValue([{ id: 10, email: 'teacher@kku.ac.th' }]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.total).toBe(1);
  });

  test('200 – skips row with missing email, counts as error', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([{
      'email นักศึกษา': '',
      'id': '',
      'ชื่อ': 'test',
    }]) };

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.errors).toBe(1);
    expect(body.summary.created).toBe(0);
  });
});
