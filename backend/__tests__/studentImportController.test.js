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
      'รหัสนักศึกษา': '645040001-1',
      'คำนำหน้าชื่อ': 'นาย',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'สมชาย ใจดี',
      'ชื่อ-นามสกุล (ภาษาอังกฤษ)': 'Somchai Jaidee',
      'สาขาวิชา / แผนกการศึกษา': 'CS',
      'ชั้นปี': '3',
      'เบอร์โทรศัพท์': '0812345678',
      'อีเมล': 'stu1@kkumail.com',
      'ภาคการศึกษา (ปกติ/พิเศษ)': 'ปกติ',
      'เกรดเฉลี่ยสะสม (GPA)': '3.45',
      'ชื่ออาจารย์ที่ปรึกษา': 'สมหญิง รักเรียน',
    }]) };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 1 });
    prisma.student.upsert.mockResolvedValue({ id: 1 });
    prisma.teacher.findMany.mockResolvedValue([{ id: 10, firstName: 'สมหญิง', lastName: 'รักเรียน' }]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.total).toBe(1);
    expect(body.summary.created).toBe(1);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: '645040001-1' },
      create: expect.objectContaining({
        studentId: '645040001-1',
        prefix: 'MR',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        firstNameEn: 'Somchai',
        lastNameEn: 'Jaidee',
        year: '3',
        major: 'CS',
        phone: '0812345678',
        email: 'stu1@kkumail.com',
        gpa: 3.45,
        studyProgram: 'normal',
        advisorName: 'สมหญิง รักเรียน',
        generalAdvisorId: 10,
        userId: 1,
      }),
    }));
  });

  test('200 – skips row with missing email, counts as error', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([{
      'อีเมล': '',
      'รหัสนักศึกษา': '',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'test',
    }]) };

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.errors).toBe(1);
    expect(body.summary.created).toBe(0);
  });

  test('200 – ไม่พบอาจารย์ที่ปรึกษาตามชื่อ → generalAdvisorId เป็น null', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([{
      'รหัสนักศึกษา': '645040002-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'สมศรี มีสุข',
      'อีเมล': 'stu2@kkumail.com',
      'ชื่ออาจารย์ที่ปรึกษา': 'ไม่มีใครชื่อนี้ เลย',
    }]) };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 2 });
    prisma.student.upsert.mockResolvedValue({ id: 2 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ generalAdvisorId: null }),
    }));
  });

  test('200 – ชื่อ-นามสกุลแบบคำเดียว (ไม่มีเว้นวรรค) → lastName เป็นค่าว่าง', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([{
      'รหัสนักศึกษา': '645040003-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'เดี่ยว',
      'อีเมล': 'stu3@kkumail.com',
    }]) };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 3 });
    prisma.student.upsert.mockResolvedValue({ id: 3 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ firstName: 'เดี่ยว', lastName: '' }),
    }));
  });
});
