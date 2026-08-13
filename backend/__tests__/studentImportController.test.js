jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('xlsx');

const prisma = require('./__mocks__/prismaClient');
const XLSX = require('xlsx');
const { importStudents } = require('../controllers/studentImportController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

// ── Old Thai-header template ──────────────────────────────────────────────────

const HEADER_KEYS = [
  'รหัสนักศึกษา', 'คำนำหน้าชื่อ', 'ชื่อ-นามสกุล (ภาษาไทย)', 'ชื่อ-นามสกุล (ภาษาอังกฤษ)',
  'สาขาวิชา / แผนกการศึกษา', 'ชั้นปี', 'เบอร์โทรศัพท์', 'อีเมล',
  'ภาคการศึกษา (ปกติ/พิเศษ)', 'เกรดเฉลี่ยสะสม (GPA)', 'ชื่ออาจารย์ที่ปรึกษา',
];

// จำลองไฟล์ Excel จริง: มีแถวหัวข้อฟอร์ม + แถวว่าง อยู่เหนือแถวหัวคอลัมน์
function mockSheet(dataRows) {
  XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
  XLSX.utils = {
    sheet_to_json: jest.fn((sheet, opts) => {
      if (opts && opts.header === 1) {
        return [
          ['แบบฟอร์มข้อมูลนักศึกษาสำหรับนำเข้าระบบบริหารจัดการสหกิจศึกษา'],
          [],
          HEADER_KEYS,
        ];
      }
      return dataRows;
    }),
  };
}

// ── KKU system export (English headers, pre-split names) ─────────────────────

const KKU_HEADER_KEYS = [
  'STUDENTCODE', 'PREFIXNAME', 'STUDENTNAME', 'STUDENTSURNAME',
  'STUDENTNAMEENG', 'STUDENTSURNAMEENG', 'PROGRAMNAME', 'LEVELNAME',
  'ADMITACADYEAR', 'KKUMAIL', 'OFFICERNAME', 'OFFICERSURNAME',
];

function mockKkuSheet(dataRows) {
  XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
  XLSX.utils = {
    sheet_to_json: jest.fn((sheet, opts) => {
      if (opts && opts.header === 1) {
        return [KKU_HEADER_KEYS];
      }
      return dataRows;
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('importStudents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);
  });

  // ── shared / format-agnostic ────────────────────────────────────────────────

  test('400 – no file uploaded', async () => {
    const req = { file: null };
    const res = makeRes();
    await importStudents(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 – ไม่พบหัวคอลัมน์ STUDENTCODE หรือ รหัสนักศึกษา ในไฟล์', async () => {
    XLSX.read = jest.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
    XLSX.utils = { sheet_to_json: jest.fn().mockReturnValue([['อะไรก็ไม่รู้'], ['อะไรก็ไม่รู้']]) };

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ── old Thai-header template ────────────────────────────────────────────────

  test('[old] ไฟล์มีแถวหัวข้อฟอร์ม + แถวว่างเหนือแถวหัวคอลัมน์ → ยังอ่านข้อมูลได้ถูกต้อง', async () => {
    mockSheet([{
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
    }]);

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

  test('[old] skips row with missing email, counts as error', async () => {
    mockSheet([{
      'อีเมล': '',
      'รหัสนักศึกษา': '',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'test',
    }]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.errors).toBe(1);
    expect(body.summary.created).toBe(0);
  });

  test('[old] ไม่พบอาจารย์ที่ปรึกษาตามชื่อ (นักศึกษาใหม่) → generalAdvisorId เป็น null และมี errorRows แจ้งเตือน', async () => {
    mockSheet([{
      'รหัสนักศึกษา': '645040002-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'สมศรี มีสุข',
      'อีเมล': 'stu2@kkumail.com',
      'ชื่ออาจารย์ที่ปรึกษา': 'ไม่มีใครชื่อนี้ เลย',
    }]);

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

    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(0);
    expect(body.errorRows[0].reason).toMatch(/ไม่พบอาจารย์ที่ปรึกษา/);
  });

  test('[old] นักศึกษาเดิม + ไม่พบอาจารย์ที่ปรึกษาตามชื่อ → ไม่แก้ไขอาจารย์ที่ปรึกษาเดิม', async () => {
    mockSheet([{
      'รหัสนักศึกษา': '645040002-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'สมศรี มีสุข',
      'อีเมล': 'stu2@kkumail.com',
      'ชื่ออาจารย์ที่ปรึกษา': 'พิมพ์ชื่อผิด ไปนิดนึง',
    }]);

    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 2, email: 'stu2@kkumail.com', username: '645040002-1' }])
      .mockResolvedValueOnce([]);
    prisma.student.upsert.mockResolvedValue({ id: 2 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const call = prisma.student.upsert.mock.calls[0][0];
    expect(call.update.generalAdvisorId).toBeUndefined();
  });

  test('[old] อาจารย์ชื่อซ้ำกันหลายคนในระบบ → ไม่เดาว่าเป็นคนไหน', async () => {
    mockSheet([{
      'รหัสนักศึกษา': '645040004-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'สมปอง ดีใจ',
      'อีเมล': 'stu4@kkumail.com',
      'ชื่ออาจารย์ที่ปรึกษา': 'สมหญิง รักเรียน',
    }]);

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 4 });
    prisma.student.upsert.mockResolvedValue({ id: 4 });
    prisma.teacher.findMany.mockResolvedValue([
      { id: 10, firstName: 'สมหญิง', lastName: 'รักเรียน' },
      { id: 20, firstName: 'สมหญิง', lastName: 'รักเรียน' },
    ]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ generalAdvisorId: null }),
    }));
    const body = res.json.mock.calls[0][0];
    expect(body.errorRows[0].reason).toMatch(/ซ้ำกันหลายคน/);
  });

  test('[old] ชื่อ-นามสกุลแบบคำเดียว (ไม่มีเว้นวรรค) → lastName เป็นค่าว่าง', async () => {
    mockSheet([{
      'รหัสนักศึกษา': '645040003-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'เดี่ยว',
      'อีเมล': 'stu3@kkumail.com',
    }]);

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

  test('[old] studentId อยู่ในถังขยะ (soft-deleted) → ไม่อัปเดตทับ ขึ้น error แทน', async () => {
    mockSheet([{
      'รหัสนักศึกษา': '645040005-1',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'ถูกลบ ไปแล้ว',
      'อีเมล': 'stu5@kkumail.com',
    }]);

    prisma.student.findMany.mockResolvedValue([{ studentId: '645040005-1', deletedAt: new Date('2026-01-01') }]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(1);
    expect(body.summary.created).toBe(0);
    expect(body.errorRows[0].reason).toMatch(/ถังขยะ/);
  });

  // ── KKU system export format ────────────────────────────────────────────────

  test('[kku] นำเข้าสำเร็จ — อ่านชื่อ/นามสกุล TH+EN จาก column แยก และค้นหาอาจารย์จาก OFFICERNAME+OFFICERSURNAME', async () => {
    mockKkuSheet([{
      STUDENTCODE:       '663380007-9',
      PREFIXNAME:        'นาย',
      STUDENTNAME:       'กฤตยชญ์',
      STUDENTSURNAME:    'มัตกิจ',
      STUDENTNAMEENG:    'KITTAYOT',
      STUDENTSURNAMEENG: 'MUTTAKIT',
      PROGRAMNAME:       'วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ',
      LEVELNAME:         'ปริญญาตรี ภาคปกติ',
      ADMITACADYEAR:     2566,
      KKUMAIL:           'kittayot.m@kkumail.com',
      OFFICERNAME:       'วิชาญ',
      OFFICERSURNAME:    'ธรรมวิเศษ',
    }]);

    prisma.user.upsert.mockResolvedValue({ id: 1 });
    prisma.student.upsert.mockResolvedValue({ id: 1 });
    prisma.teacher.findMany.mockResolvedValue([{ id: 42, firstName: 'วิชาญ', lastName: 'ธรรมวิเศษ' }]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.summary.created).toBe(1);
    expect(body.summary.errors).toBe(0);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: '663380007-9' },
      create: expect.objectContaining({
        prefix:      'MR',
        firstName:   'กฤตยชญ์',
        lastName:    'มัตกิจ',
        firstNameEn: 'KITTAYOT',
        lastNameEn:  'MUTTAKIT',
        email:       'kittayot.m@kkumail.com',
        phone:       null,
        year:        null,
        gpa:         null,
        studyProgram:    'normal',
        advisorName:     'วิชาญ ธรรมวิเศษ',
        generalAdvisorId: 42,
        userId: 1,
      }),
    }));
  });

  test('[kku] PROGRAMNAME ที่มี "พิเศษ" → studyProgram = special', async () => {
    mockKkuSheet([{
      STUDENTCODE:    '663380025-1',
      PREFIXNAME:     'นาย',
      STUDENTNAME:    'สมปอง',
      STUDENTSURNAME: 'ดีใจ',
      PROGRAMNAME:    'วิทยาการคอมพิวเตอร์ โครงการพิเศษ',
      KKUMAIL:        'sompong@kkumail.com',
      OFFICERNAME:    '',
      OFFICERSURNAME: '',
    }]);

    prisma.user.upsert.mockResolvedValue({ id: 5 });
    prisma.student.upsert.mockResolvedValue({ id: 5 });

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ studyProgram: 'special' }),
    }));
  });

  test('[kku] ไม่พบอาจารย์ใน DB → generalAdvisorId = null (นักศึกษาใหม่) และมี errorRows แจ้งเตือน', async () => {
    mockKkuSheet([{
      STUDENTCODE:    '663380099-1',
      PREFIXNAME:     'นางสาว',
      STUDENTNAME:    'สมใจ',
      STUDENTSURNAME: 'รักดี',
      KKUMAIL:        'somjai@kkumail.com',
      OFFICERNAME:    'ไม่มีในระบบ',
      OFFICERSURNAME: 'เลย',
    }]);

    prisma.user.upsert.mockResolvedValue({ id: 6 });
    prisma.student.upsert.mockResolvedValue({ id: 6 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    expect(prisma.student.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ generalAdvisorId: null }),
    }));
    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(0);
    expect(body.errorRows[0].reason).toMatch(/ไม่พบอาจารย์ที่ปรึกษา/);
  });

  test('[kku] ไม่มี OFFICERNAME → advisorName = null, generalAdvisorId = null (ล้างค่า)', async () => {
    mockKkuSheet([{
      STUDENTCODE:    '663380088-1',
      PREFIXNAME:     'นาย',
      STUDENTNAME:    'ทดสอบ',
      STUDENTSURNAME: 'ว่างเปล่า',
      KKUMAIL:        'test@kkumail.com',
      OFFICERNAME:    '',
      OFFICERSURNAME: '',
    }]);

    prisma.user.upsert.mockResolvedValue({ id: 7 });
    prisma.student.upsert.mockResolvedValue({ id: 7 });

    const req = { file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const call = prisma.student.upsert.mock.calls[0][0];
    expect(call.create.advisorName).toBeNull();
    expect(call.create.generalAdvisorId).toBeNull();
    const body = res.json.mock.calls[0][0];
    expect(body.errorRows).toHaveLength(0);
  });
});
