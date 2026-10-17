jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('xlsx');

const prisma = require('./__mocks__/prismaClient');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { importStudents, previewStudents } = require('../controllers/studentImportController');

const STAFF = { id: 1, role: 'staff' };

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
    // controller แปลงชื่อสาขาภาษาไทย -> รหัส ผ่าน CoopCriteria (เพิ่มทีหลังตอน batch 129)
    // ถ้าไม่ mock จะคืน undefined แล้ว for...of พังเป็น 500 ทั้งที่ไม่ใช่บั๊กของ controller
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);
    prisma.systemConfig.findUnique.mockResolvedValue(null);
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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
        studyProgram: 'normal',
        advisorName: 'สมหญิง รักเรียน',
        generalAdvisorId: 10,
        userId: 1,
      }),
    }));
    // ระบบไม่ใช้ GPA แล้ว — ไฟล์เก่าที่ยังมีคอลัมน์ GPA ก็ไม่นำเข้า
    const { create, update } = prisma.student.upsert.mock.calls[0][0];
    expect(create).not.toHaveProperty('gpa');
    expect(update).not.toHaveProperty('gpa');
  });

  test('[old] skips row with missing email, counts as error', async () => {
    mockSheet([{
      'อีเมล': '',
      'รหัสนักศึกษา': '',
      'ชื่อ-นามสกุล (ภาษาไทย)': 'test',
    }]);

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') }, body: { majorMap: JSON.stringify({ 'วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ': 'CS' }) } };
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
        studyProgram:    'normal',
        advisorName:     'วิชาญ ธรรมวิเศษ',
        generalAdvisorId: 42,
        userId: 1,
        major: 'CS',
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') }, body: { majorMap: JSON.stringify({ 'วิทยาการคอมพิวเตอร์ โครงการพิเศษ': 'CS' }) } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
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

    const req = { user: STAFF, file: { buffer: Buffer.from('fake') } };
    const res = makeRes();
    await importStudents(req, res);

    const call = prisma.student.upsert.mock.calls[0][0];
    expect(call.create.advisorName).toBeNull();
    expect(call.create.generalAdvisorId).toBeNull();
    const body = res.json.mock.calls[0][0];
    expect(body.errorRows).toHaveLength(0);
  });

  // ── รหัสผ่านเริ่มต้น = รหัสนักศึกษาแบบมีขีด ─────────────────────────────────────

  test('[password] บัญชีใหม่: username = อีเมล และรหัสผ่านเริ่มต้นเป็นรหัสนักศึกษา (เก็บแบบ hash)', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380007-9', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'New@kkumail.com' }]);
    prisma.user.upsert.mockResolvedValue({ id: 11 });
    prisma.student.upsert.mockResolvedValue({ id: 11 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    const { create, where } = prisma.user.upsert.mock.calls[0][0];
    expect(where).toEqual({ username: 'new@kkumail.com' });
    expect(create.username).toBe('new@kkumail.com');
    expect(create.email).toBe('new@kkumail.com');
    expect(await bcrypt.compare('663380007-9', create.password)).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('[password] บัญชีเดิมที่ยังไม่มีรหัสผ่าน (username เก่าเป็นรหัสนักศึกษา) → ใส่รหัสผ่านเริ่มต้น + username เป็นอีเมล', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380008-1', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'old@kkumail.com' }]);
    const existing = { id: 12, role: 'student', username: '663380008-1', email: 'old@kkumail.com', password: null, student: { studentId: '663380008-1' } };
    prisma.user.findMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([]);
    prisma.student.upsert.mockResolvedValue({ id: 12 });
    prisma.user.update.mockResolvedValue({});
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    expect(res.json.mock.calls[0][0].summary.updated).toBe(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 12 });
    expect(arg.data.username).toBe('old@kkumail.com');
    expect(await bcrypt.compare('663380008-1', arg.data.password)).toBe(true);
  });

  test('[password] บัญชีเดิมที่มีรหัสผ่านแล้ว (นักศึกษาเปลี่ยนเอง) → นำเข้าซ้ำไม่ทับรหัสผ่าน (แก้แค่ username เป็นอีเมล)', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380009-2', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'changed@kkumail.com' }]);
    const existing = { id: 13, role: 'student', username: '663380009-2', email: 'changed@kkumail.com', password: '$2a$10$alreadychangedhash', student: { studentId: '663380009-2' } };
    prisma.user.findMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([]);
    prisma.student.upsert.mockResolvedValue({ id: 13 });
    prisma.user.update.mockResolvedValue({});
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    expect(res.json.mock.calls[0][0].summary.updated).toBe(1);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 13 }, data: { username: 'changed@kkumail.com' } });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  test('[username] บัญชีเดิมที่ username เป็นอีเมลอยู่แล้วและมีรหัสผ่าน → ไม่แตะบัญชี', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380010-3', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'done@kkumail.com' }]);
    const existing = { id: 14, role: 'student', username: 'done@kkumail.com', email: 'done@kkumail.com', password: '$2a$10$x', student: { studentId: '663380010-3' } };
    prisma.user.findMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([existing]);
    prisma.student.upsert.mockResolvedValue({ id: 14 });
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    expect(res.json.mock.calls[0][0].summary.updated).toBe(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('[identity] อีเมลเป็นของนักศึกษารหัสอื่น → ข้ามแถวนั้นพร้อมเหตุผล', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380011-4', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'someone@kkumail.com' }]);
    const existing = { id: 15, role: 'student', username: 'someone@kkumail.com', email: 'someone@kkumail.com', password: 'x', student: { studentId: '663380099-9' } };
    prisma.user.findMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([existing]);
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(1);
    expect(body.errorRows[0].reason).toMatch(/663380099-9/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('[identity] อีเมลเป็นบัญชีอาจารย์ → ข้ามแถวนั้น', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380012-5', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'teacher@kku.ac.th' }]);
    const existing = { id: 16, role: 'teacher', username: 'teacher@kku.ac.th', email: 'teacher@kku.ac.th', password: 'x', student: null };
    prisma.user.findMany.mockResolvedValueOnce([existing]).mockResolvedValueOnce([existing]);
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(1);
    expect(body.errorRows[0].reason).toMatch(/อาจารย์/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('[identity] รหัสนักศึกษานี้ผูกกับอีเมลอื่นอยู่แล้ว → ข้ามแถว (ไม่สร้างบัญชีซ้ำ)', async () => {
    mockKkuSheet([{ STUDENTCODE: '663380013-6', STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: 'newmail@kkumail.com' }]);
    prisma.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.student.findMany.mockResolvedValue([{ studentId: '663380013-6', deletedAt: null, userId: 20, user: { email: 'oldmail@kkumail.com' } }]);
    prisma.teacher.findMany.mockResolvedValue([]);

    const res = makeRes();
    await importStudents({ user: STAFF, file: { buffer: Buffer.from('fake') } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.summary.errors).toBe(1);
    expect(body.errorRows[0].reason).toMatch(/oldmail@kkumail\.com/);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});

// ── อาจารย์ประจำวิชานำเข้าได้เฉพาะหลักสูตรที่ดูแล ─────────────────────────────
describe('นำเข้าโดยอาจารย์ประจำวิชา (CS)', () => {
  const COOP = { id: 2, role: 'teacher' };
  const row = (code, program) => ({ STUDENTCODE: code, STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: `${code}@kkumail.com`, ...(program ? { PROGRAMNAME: program } : {}) });
  const run = async (fn = importStudents) => { const res = makeRes(); await fn({ user: COOP, file: { buffer: Buffer.from('fake') } }, res); return res.json.mock.calls[0][0]; };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
    prisma.teacher.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }, { major: 'AI', nameTh: 'ปัญญาประดิษฐ์' }]);
    prisma.user.upsert.mockResolvedValue({ id: 50 });
    prisma.student.upsert.mockResolvedValue({ id: 50 });
  });

  test('หลักสูตรที่ดูแล (ชื่อไทย) → นำเข้าเป็นรหัส CS', async () => {
    mockKkuSheet([row('660000001-1', 'วิทยาการคอมพิวเตอร์')]);
    const body = await run();
    expect(body.summary.created).toBe(1);
    expect(prisma.student.upsert.mock.calls[0][0].create.major).toBe('CS');
  });

  test('ไฟล์ไม่ระบุหลักสูตร + ดูแลหลักสูตรเดียว → ใส่ CS ให้', async () => {
    mockKkuSheet([row('660000002-1')]);
    await run();
    expect(prisma.student.upsert.mock.calls[0][0].create.major).toBe('CS');
  });

  test('หลักสูตรอื่น (AI) → ข้ามแถว ไม่บันทึก', async () => {
    mockKkuSheet([row('660000003-1', 'ปัญญาประดิษฐ์')]);
    const body = await run();
    expect(body.summary).toMatchObject({ created: 0, errors: 1 });
    expect(body.errorRows[0].reason).toMatch(/ไม่อยู่ในหลักสูตรที่คุณดูแล/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('หลักสูตรที่ไม่มีในระบบ → ข้ามแถว และไม่สร้างหลักสูตรใหม่', async () => {
    mockKkuSheet([row('660000004-1', 'ฟิสิกส์')]);
    const body = await run();
    expect(body.summary.errors).toBe(1);
    expect(prisma.coopCriteria.createMany).not.toHaveBeenCalled();
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('รหัสที่เป็นนักศึกษาหลักสูตรอื่นอยู่แล้ว → ข้าม (ไม่ย้ายนักศึกษามาหลักสูตรตัวเอง)', async () => {
    mockKkuSheet([row('660000005-1', 'วิทยาการคอมพิวเตอร์')]);
    prisma.student.findMany.mockResolvedValue([{ studentId: '660000005-1', deletedAt: null, major: 'AI', userId: 70, user: { email: '660000005-1@kkumail.com' } }]);
    prisma.user.findMany.mockResolvedValueOnce([{ id: 70, role: 'student', username: '660000005-1@kkumail.com', email: '660000005-1@kkumail.com', password: 'x', student: { studentId: '660000005-1' } }]).mockResolvedValueOnce([]);
    const body = await run();
    expect(body.errorRows[0].reason).toMatch(/หลักสูตร AI/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('ตัวอย่างก่อนนำเข้า: แถวนอกหลักสูตร = ข้าม พร้อมเหตุผล · แถวในหลักสูตรแสดงรหัส CS', async () => {
    mockKkuSheet([row('660000006-1', 'ปัญญาประดิษฐ์'), row('660000007-1', 'วิทยาการคอมพิวเตอร์')]);
    const body = await run(previewStudents);
    expect(body.rows[0]).toMatchObject({ action: 'skip', error: expect.stringMatching(/ไม่อยู่ในหลักสูตรที่คุณดูแล/) });
    expect(body.rows[1]).toMatchObject({ action: 'create', major: 'CS' });
    expect(body.summary).toMatchObject({ willCreate: 1, willSkip: 1 });
  });

  test('จับคู่หลักสูตรนอกที่ดูแล (AI) → 400 ไม่นำเข้าอะไรเลย', async () => {
    mockKkuSheet([row('660000009-1', 'ฟิสิกส์')]);
    const res = makeRes();
    await importStudents({ user: COOP, file: { buffer: Buffer.from('fake') }, body: { majorMap: JSON.stringify({ 'ฟิสิกส์': 'AI' }) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/AI ไม่อยู่ในหลักสูตรที่คุณดูแล/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });
});

// ── หลักสูตรที่ไม่มีในระบบ: ไม่สร้างให้เอง ต้องจับคู่ (เดิมเจ้าหน้าที่นำเข้าแล้วได้หลักสูตรใหม่ที่ใช้ชื่อไทยเป็นรหัส) ──
describe('นำเข้าโดยเจ้าหน้าที่ — หลักสูตรที่ไม่มีในระบบ', () => {
  const PROGRAM = 'วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ';
  const row = (code, program) => ({ STUDENTCODE: code, STUDENTNAME: 'ก', STUDENTSURNAME: 'ข', KKUMAIL: `${code}@kkumail.com`, ...(program ? { PROGRAMNAME: program } : {}) });
  const req = (majorMap) => ({ user: STAFF, file: { buffer: Buffer.from('fake') }, ...(majorMap ? { body: { majorMap: JSON.stringify(majorMap) } } : {}) });
  const run = async (fn, r) => { const res = makeRes(); await fn(r, res); return { res, body: res.json.mock.calls[0][0] }; };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.teacher.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);
    prisma.coopCriteria.findMany.mockResolvedValue([
      { major: 'AI', nameTh: 'ปัญญาประดิษฐ์' },
      { major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' },
      { major: 'GIS', nameTh: 'ภูมิสารสนเทศศาสตร์' },
    ]);
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 50 });
    prisma.student.upsert.mockResolvedValue({ id: 50 });
  });

  test('ไม่จับคู่ → แถวนั้นข้าม ไม่สร้างหลักสูตรใหม่ · แถวที่รู้จักนำเข้าตามปกติ', async () => {
    mockKkuSheet([row('660000101-1', PROGRAM), row('660000102-1', 'ปัญญาประดิษฐ์')]);
    const { body } = await run(importStudents, req());
    expect(body.summary).toMatchObject({ created: 1, errors: 1 });
    expect(body.errorRows[0].reason).toMatch(/ไม่พบหลักสูตร "วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ"/);
    expect(prisma.coopCriteria.createMany).not.toHaveBeenCalled();
    expect(prisma.coopCriteria.create).not.toHaveBeenCalled();
    expect(prisma.student.upsert.mock.calls[0][0].create.major).toBe('AI');
  });

  test('ตัวอย่าง: บอกชื่อที่ไม่รู้จัก + จำนวนแถว + หลักสูตรที่น่าจะใช่ · แถวขึ้นว่าข้าม', async () => {
    mockKkuSheet([row('660000103-1', PROGRAM), row('660000104-1', PROGRAM), row('660000105-1', 'ฟิสิกส์')]);
    const { body } = await run(previewStudents, req());
    expect(body.unknownMajors).toEqual([
      { name: PROGRAM, rows: 2, suggestion: 'CS' },
      { name: 'ฟิสิกส์', rows: 1, suggestion: null },
    ]);
    expect(body.majors.map((m) => m.major)).toEqual(['AI', 'CS', 'GIS']);
    expect(body.summary).toMatchObject({ willCreate: 0, willSkip: 3 });
  });

  test('จับคู่แล้ว → ตัวอย่างไม่มีชื่อที่ไม่รู้จัก · นำเข้าเป็นรหัสที่เลือก · "" = ข้ามแถวของชื่อนั้น', async () => {
    mockKkuSheet([row('660000106-1', PROGRAM), row('660000107-1', 'ฟิสิกส์')]);
    const map = { [PROGRAM]: 'CS', 'ฟิสิกส์': '' };
    const preview = (await run(previewStudents, req(map))).body;
    expect(preview.unknownMajors).toEqual([]);
    expect(preview.rows[0]).toMatchObject({ action: 'create', major: 'CS' });
    expect(preview.rows[1]).toMatchObject({ action: 'skip', error: expect.stringMatching(/ข้ามตามที่เลือก/) });

    const { body } = await run(importStudents, req(map));
    expect(body.summary).toMatchObject({ created: 1, errors: 1 });
    expect(prisma.student.upsert.mock.calls[0][0].create.major).toBe('CS');
  });

  test('จำการจับคู่ไว้ → นำเข้าไฟล์ถัดไปไม่ต้องเลือกซ้ำ', async () => {
    mockKkuSheet([row('660000108-1', PROGRAM)]);
    await run(importStudents, req({ [PROGRAM]: 'CS' }));
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'MAJOR_IMPORT_ALIASES' },
      create: { key: 'MAJOR_IMPORT_ALIASES', value: JSON.stringify({ [PROGRAM]: 'CS' }) },
    }));

    jest.clearAllMocks();
    prisma.systemConfig.findUnique.mockResolvedValue({ key: 'MAJOR_IMPORT_ALIASES', value: JSON.stringify({ [PROGRAM]: 'CS' }) });
    mockKkuSheet([row('660000109-1', PROGRAM)]);
    const { body } = await run(previewStudents, req());
    expect(body.unknownMajors).toEqual([]);
    expect(body.rows[0]).toMatchObject({ action: 'create', major: 'CS' });
  });

  test('ชื่อที่จำไว้ชี้ไปหลักสูตรที่ถูกลบแล้ว → กลับเป็นไม่รู้จัก (ไม่นำเข้าไปหลักสูตรที่ไม่มี)', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({ key: 'MAJOR_IMPORT_ALIASES', value: JSON.stringify({ [PROGRAM]: 'OLD' }) });
    mockKkuSheet([row('660000110-1', PROGRAM)]);
    const { body } = await run(previewStudents, req());
    expect(body.unknownMajors.map((u) => u.name)).toEqual([PROGRAM]);
  });

  test('จับคู่ไปรหัสที่ไม่มีในระบบ → 400', async () => {
    mockKkuSheet([row('660000111-1', PROGRAM)]);
    prisma.coopCriteria.findMany.mockResolvedValueOnce([]); // ตรวจรหัสที่เลือก
    const { res, body } = await run(importStudents, req({ [PROGRAM]: 'ฟิสิกส์' }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body.message).toMatch(/ไม่พบหลักสูตร ฟิสิกส์/);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('majorMap ไม่ใช่ JSON → 400', async () => {
    mockKkuSheet([row('660000112-1', PROGRAM)]);
    const { res } = await run(previewStudents, { user: STAFF, file: { buffer: Buffer.from('fake') }, body: { majorMap: '{bad' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ไฟล์ไม่ระบุหลักสูตร + นักศึกษาเดิม → ไม่เปลี่ยนหลักสูตรเดิม', async () => {
    mockKkuSheet([row('660000113-1')]);
    prisma.student.findMany.mockResolvedValue([{ studentId: '660000113-1', deletedAt: null, major: 'GIS', userId: 70, user: { email: '660000113-1@kkumail.com' } }]);
    prisma.user.findMany.mockResolvedValueOnce([{ id: 70, role: 'student', username: '660000113-1@kkumail.com', email: '660000113-1@kkumail.com', password: 'x', student: { studentId: '660000113-1' } }]).mockResolvedValueOnce([]);
    const { body } = await run(importStudents, req());
    expect(body.summary.updated).toBe(1);
    expect(prisma.student.upsert.mock.calls[0][0].update.major).toBeUndefined();
  });
});
