// __tests__/t002Supervisors.test.js — พี่เลี้ยงจากแบบฟอร์ม T002 → พี่เลี้ยงในระบบ
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  normalizeExtraSupervisors,
  parseExtraSupervisors,
  splitMentorName,
  syncT002SupervisorsToMentors,
} = require('../utils/t002Supervisors');

beforeEach(() => jest.resetAllMocks());

describe('normalizeExtraSupervisors', () => {
  test('ตัดช่องว่าง เก็บเฉพาะฟิลด์ที่รู้จัก และแปลงค่าไม่ใช่ข้อความเป็น ""', () => {
    expect(normalizeExtraSupervisors([
      { name: '  สมศรี  ใจดี ', position: ' HR ', phone: 123, hack: 'x' },
    ])).toEqual([{ name: 'สมศรี  ใจดี', position: 'HR', dept: '', phone: '', fax: '', email: '' }]);
  });

  test('เก็บแถวว่างไว้ (นักศึกษากดเพิ่มแถวแล้วยังไม่ได้กรอก) แต่จำกัดไม่เกิน 4 คน (รวมคนแรกเป็น 5)', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ name: i === 0 ? '' : `คน${i}` }));
    const out = normalizeExtraSupervisors(rows);
    expect(out).toHaveLength(4);
    expect(out[0].name).toBe('');
  });

  test('ไม่ใช่อาเรย์ / แถวไม่ใช่ object → ตัดทิ้ง', () => {
    expect(normalizeExtraSupervisors('x')).toEqual([]);
    expect(normalizeExtraSupervisors([null, 'a', { name: 'ก ข' }])).toHaveLength(1);
  });
});

describe('parseExtraSupervisors', () => {
  test('อ่าน JSON ที่บันทึกไว้ได้ และ JSON เสีย/ว่าง → []', () => {
    expect(parseExtraSupervisors('[{"name":"ก ข"}]')[0].name).toBe('ก ข');
    expect(parseExtraSupervisors('not json')).toEqual([]);
    expect(parseExtraSupervisors(null)).toEqual([]);
  });
});

describe('splitMentorName', () => {
  test.each([
    ['สมชาย ดูแลดี', 'สมชาย', 'ดูแลดี'],
    ['คุณสมชาย ดูแลดี', 'สมชาย', 'ดูแลดี'],
    ['นางสาว สมหญิง  รักงาน', 'สมหญิง', 'รักงาน'],
    ['Mr. John  Smith Jr.', 'John', 'Smith Jr.'],
    ['สมชาย', 'สมชาย', ''],
    ['นายสมชาย ดูแลดี', 'สมชาย', 'ดูแลดี'],
    ['คุณากร ใจดี', 'คุณากร', 'ใจดี'],
    ['นายิกา สุขใจ', 'นายิกา', 'สุขใจ'],
    ['Missy Smith', 'Missy', 'Smith'],
    ['Ms.Jane Doe', 'Jane', 'Doe'],
    ['   ', '', ''],
  ])('%s → %s / %s', (input, first, last) => {
    expect(splitMentorName(input)).toEqual({ firstName: first, lastName: last });
  });
});

describe('syncT002SupervisorsToMentors', () => {
  const tx = prisma;
  const form = (overrides = {}) => ({
    supervisorName: 'สมชาย ดูแลดี', supervisorPosition: 'หัวหน้าทีม', supervisorDept: 'IT',
    supervisorPhone: '081', supervisorEmail: 'somchai@co.th', extraSupervisors: null, ...overrides,
  });

  test('ยังไม่มีพี่เลี้ยงคนนี้ในบริษัท → สร้างใหม่ และผูกกับนักศึกษา', async () => {
    tx.coopT002Form.findUnique.mockResolvedValue(form());
    tx.studentCoop.findUnique.mockResolvedValue({ companyId: 'c1' });
    tx.mentor.findMany.mockResolvedValue([]);
    tx.mentor.create.mockResolvedValue({ id: 'm-new' });

    const result = await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 });

    expect(tx.mentor.create).toHaveBeenCalledWith({ data: {
      firstName: 'สมชาย', lastName: 'ดูแลดี', position: 'หัวหน้าทีม', department: 'IT',
      phone: '081', email: 'somchai@co.th', companyId: 'c1', createdById: 7,
    } });
    expect(tx.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { mentors: { connect: [{ id: 'm-new' }] } },
    });
    expect(result).toEqual({ linked: 1, created: 1, updated: 0 });
  });

  test('ชื่อซ้ำกับพี่เลี้ยงเดิมในบริษัท (ไม่สนช่องว่าง/คำนำหน้า) → ใช้คนเดิม เติมเฉพาะช่องที่ว่าง ไม่สร้างซ้ำ', async () => {
    tx.coopT002Form.findUnique.mockResolvedValue(form({ supervisorName: 'คุณสมชาย  ดูแลดี' }));
    tx.studentCoop.findUnique.mockResolvedValue({ companyId: 'c1' });
    tx.mentor.findMany.mockResolvedValue([{ id: 'm1', firstName: 'สมชาย', lastName: 'ดูแลดี', position: 'ผู้จัดการ', department: null, phone: null, email: null }]);
    tx.mentor.update.mockResolvedValue({ id: 'm1' });

    const result = await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 });

    expect(tx.mentor.create).not.toHaveBeenCalled();
    expect(tx.mentor.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { department: 'IT', phone: '081', email: 'somchai@co.th' } });
    expect(result).toEqual({ linked: 1, created: 0, updated: 1 });
  });

  test('หลายคน: คนแรก + คนเพิ่มเติม (ข้ามแถวว่าง, ชื่อซ้ำกันในฟอร์มนับครั้งเดียว)', async () => {
    tx.coopT002Form.findUnique.mockResolvedValue(form({
      extraSupervisors: JSON.stringify([
        { name: 'สมหญิง รักงาน', position: 'Dev' },
        { name: '' },
        { name: 'สมชาย ดูแลดี' },
      ]),
    }));
    tx.studentCoop.findUnique.mockResolvedValue({ companyId: 'c1' });
    tx.mentor.findMany.mockResolvedValue([]);
    tx.mentor.create
      .mockResolvedValueOnce({ id: 'm-a', firstName: 'สมชาย', lastName: 'ดูแลดี' })
      .mockResolvedValueOnce({ id: 'm-b', firstName: 'สมหญิง', lastName: 'รักงาน' });

    const result = await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 });

    expect(tx.mentor.create).toHaveBeenCalledTimes(2);
    expect(tx.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { mentors: { connect: [{ id: 'm-a' }, { id: 'm-b' }] } },
    });
    expect(result).toEqual({ linked: 2, created: 2, updated: 0 });
  });

  test('ยังไม่ได้เลือกบริษัท → ไม่สร้างพี่เลี้ยง (ไม่รู้ว่าอยู่บริษัทไหน)', async () => {
    tx.coopT002Form.findUnique.mockResolvedValue(form());
    tx.studentCoop.findUnique.mockResolvedValue({ companyId: null });

    const result = await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 });

    expect(tx.mentor.create).not.toHaveBeenCalled();
    expect(tx.studentCoop.update).not.toHaveBeenCalled();
    expect(result).toEqual({ linked: 0, created: 0, updated: 0, skipped: 'no-company' });
  });

  test('ยังไม่มีแบบฟอร์ม T002 หรือไม่ได้กรอกชื่อพี่เลี้ยงเลย → ไม่ทำอะไร', async () => {
    tx.coopT002Form.findUnique.mockResolvedValue(null);
    expect(await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 })).toEqual({ linked: 0, created: 0, updated: 0 });

    tx.coopT002Form.findUnique.mockResolvedValue(form({ supervisorName: '  ' }));
    tx.studentCoop.findUnique.mockResolvedValue({ companyId: 'c1' });
    expect(await syncT002SupervisorsToMentors(tx, { studentId: 10, userId: 7 })).toEqual({ linked: 0, created: 0, updated: 0 });
    expect(tx.mentor.findMany).not.toHaveBeenCalled();
  });
});
