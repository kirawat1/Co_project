// __tests__/supervisionEval.test.js — ส่งลิงก์แบบประเมินการนิเทศให้อาจารย์ผู้นิเทศ
jest.mock('../config/prismaClient', () => ({
  systemConfig: { findUnique: jest.fn() },
  supervisionAppointment: { findMany: jest.fn(), update: jest.fn() },
}));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn() }));

const prisma = require('../config/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { unlinkedCoTeacherNames, sendEvalForAppointments, getEvalConfig } = require('../utils/supervisionEval');

const A = { userId: 11, prefix: 'อ.', firstName: 'สมชาย', lastName: 'ใจดี' };
const B = { userId: 12, prefix: 'ผศ.', firstName: 'สมหญิง', lastName: 'ดีใจ' };
const config = (v) => prisma.systemConfig.findUnique.mockResolvedValue(v ? { value: JSON.stringify(v) } : null);

beforeEach(() => jest.clearAllMocks());

describe('unlinkedCoTeacherNames', () => {
  test('ชื่อที่ผูกบัญชีแล้วไม่นับ · ชื่อเก่าที่ไม่มีบัญชีรายงานออกมา', () => {
    expect(unlinkedCoTeacherNames('อ.สมชาย ใจดี, อ.คนนอก ระบบ', [A])).toEqual(['อ.คนนอก ระบบ']);
  });

  test('ไม่มีอาจารย์ร่วม → ว่าง', () => {
    expect(unlinkedCoTeacherNames(null, [])).toEqual([]);
  });
});

describe('sendEvalForAppointments', () => {
  test('ยังไม่ตั้งลิงก์ (ทั้งค่ากลางและค่าหลักสูตร) → 400 ไม่ส่งอะไร', async () => {
    config(null);
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 7, teacher: { userId: 11 }, coTeachers: [], student: { major: 'CS' } }]);
    await expect(sendEvalForAppointments([1])).rejects.toMatchObject({ is400: true });
    expect(createNotifications).not.toHaveBeenCalled();
  });

  test('แจ้งเตือนอาจารย์หลัก + อาจารย์ร่วมที่ผูกบัญชี (ไม่ซ้ำ) แล้วบันทึก evalSentAt', async () => {
    config({ evalLink: 'https://forms.gle/x', autoSend: false });
    prisma.supervisionAppointment.findMany.mockResolvedValue([{
      id: 7,
      coTeacherName: 'อ.สมชาย ใจดี, ผศ.สมหญิง ดีใจ, อ.คนนอก ระบบ',
      teacher: { userId: 11 },
      coTeachers: [{ teacher: A }, { teacher: B }],
      student: { firstName: 'ดำ', lastName: 'แดง' },
    }]);

    const results = await sendEvalForAppointments([7]);

    expect(createNotifications).toHaveBeenCalledWith([11, 12], expect.objectContaining({
      type: 'SUPERVISION_EVAL', link: '/teacher/review-supervision', relatedId: '7',
      message: expect.stringContaining('ดำ แดง'),
    }));
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { evalSentAt: expect.any(Date) } });
    expect(results).toEqual([{ id: 7, recipients: 2, unlinked: ['อ.คนนอก ระบบ'] }]);
  });

  test('ส่งเฉพาะนัดที่อนุมัติหนังสือแล้ว/นิเทศเสร็จ', async () => {
    config({ evalLink: 'https://forms.gle/x' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    await sendEvalForAppointments([1, 2]);
    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['LETTER_UPLOADED', 'COMPLETED'] } }),
    }));
  });
});

test('getEvalConfig: ไม่มีค่าใน DB → ค่าเริ่มต้น (ส่งเอง, ไม่มีลิงก์)', async () => {
  config(null);
  expect(await getEvalConfig()).toEqual({ instructionText: '', evalLink: null, autoSend: false });
});
