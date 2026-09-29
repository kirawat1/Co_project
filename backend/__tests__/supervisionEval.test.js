// __tests__/supervisionEval.test.js — ส่งลิงก์แบบประเมินการนิเทศให้อาจารย์ผู้นิเทศ
jest.mock('../config/prismaClient', () => ({
  systemConfig: { findUnique: jest.fn() },
  supervisionAppointment: { findMany: jest.fn(), update: jest.fn() },
  teacher: { findMany: jest.fn() },
}));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn() }));

const prisma = require('../config/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { matchCoTeachers, sendEvalForAppointments, getEvalConfig } = require('../utils/supervisionEval');

const TEACHERS = [
  { userId: 11, prefix: 'อ.', firstName: 'สมชาย', lastName: 'ใจดี' },
  { userId: 12, prefix: 'ผศ.', firstName: 'สมหญิง', lastName: 'ดีใจ' },
];
const config = (v) => prisma.systemConfig.findUnique.mockResolvedValue(v ? { value: JSON.stringify(v) } : null);

beforeEach(() => jest.clearAllMocks());

describe('matchCoTeachers', () => {
  test('จับคู่ชื่อที่บันทึกไว้ (คำนำหน้า+ชื่อ นามสกุล) กับบัญชีอาจารย์', () => {
    const r = matchCoTeachers('อ.สมชาย ใจดี, ผศ.สมหญิง ดีใจ', TEACHERS);
    expect(r.matched.map((t) => t.userId)).toEqual([11, 12]);
    expect(r.unmatched).toEqual([]);
  });

  test('คำนำหน้าเปลี่ยนภายหลังก็ยังจับคู่ได้ · ชื่อที่ไม่มีบัญชีรายงานเป็น unmatched', () => {
    const r = matchCoTeachers('รศ.สมชาย  ใจดี, อ.คนนอก ระบบ', TEACHERS);
    expect(r.matched.map((t) => t.userId)).toEqual([11]);
    expect(r.unmatched).toEqual(['อ.คนนอก ระบบ']);
  });

  test('ไม่มีอาจารย์ร่วม → ว่างทั้งสองฝั่ง', () => {
    expect(matchCoTeachers(null, TEACHERS)).toEqual({ matched: [], unmatched: [] });
  });
});

describe('sendEvalForAppointments', () => {
  test('ยังไม่ตั้งลิงก์ → 400 ไม่ส่งอะไร', async () => {
    config(null);
    await expect(sendEvalForAppointments([1])).rejects.toMatchObject({ is400: true });
    expect(createNotifications).not.toHaveBeenCalled();
  });

  test('แจ้งเตือนอาจารย์หลัก + อาจารย์ร่วมที่มีบัญชี (ไม่ซ้ำ) แล้วบันทึก evalSentAt', async () => {
    config({ evalLink: 'https://forms.gle/x', autoSend: false });
    prisma.teacher.findMany.mockResolvedValue(TEACHERS);
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 7, coTeacherName: 'อ.สมชาย ใจดี, ผศ.สมหญิง ดีใจ, อ.คนนอก ระบบ', teacher: { userId: 11 }, student: { firstName: 'ดำ', lastName: 'แดง' } },
    ]);

    const results = await sendEvalForAppointments([7]);

    expect(createNotifications).toHaveBeenCalledWith([11, 12], expect.objectContaining({
      type: 'SUPERVISION_EVAL', link: '/teacher/review-supervision', relatedId: '7',
      message: expect.stringContaining('ดำ แดง'),
    }));
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { evalSentAt: expect.any(Date) } });
    expect(results).toEqual([{ id: 7, recipients: 2, unmatched: ['อ.คนนอก ระบบ'] }]);
  });

  test('ส่งเฉพาะนัดที่อนุมัติหนังสือแล้ว/นิเทศเสร็จ', async () => {
    config({ evalLink: 'https://forms.gle/x' });
    prisma.teacher.findMany.mockResolvedValue([]);
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
