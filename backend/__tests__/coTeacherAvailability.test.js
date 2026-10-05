// __tests__/coTeacherAvailability.test.js — อาจารย์นิเทศร่วมระบุวันว่าง ก่อนอาจารย์หลักเลือกวัน
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue(), getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([]) }));

const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { unavailableOn, proposedDays } = require('../utils/coTeacherAvailability');
const { setCoTeacherAvailability, reviewSupervision } = require('../controllers/supervisionController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const PROPOSED = JSON.stringify(['2026-11-10|09:00|ONSITE', '2026-11-12|13:00-15:00|ONLINE', '2026-11-12|15:00|ONLINE']);
const co = (teacherId, availableDates, responded = true) => ({
  teacherId, availableDates: availableDates ? JSON.stringify(availableDates) : null, respondedAt: responded ? new Date() : null,
  teacher: { prefix: 'อ.', firstName: `ร่วม${teacherId}`, lastName: 'ทดสอบ', userId: 100 + teacherId },
});

beforeEach(() => jest.clearAllMocks());

describe('utils', () => {
  test('proposedDays = วันที่ไม่ซ้ำจากที่นักศึกษาเสนอ', () => {
    expect(proposedDays(PROPOSED)).toEqual(['2026-11-10', '2026-11-12']);
  });
  test('unavailableOn: ไม่ว่าง / ยังไม่ตอบ / ว่าง', () => {
    const list = unavailableOn([co(1, ['2026-11-10']), co(2, ['2026-11-12']), co(3, null, false)], '2026-11-10');
    expect(list.map((u) => [u.teacherId, u.reason])).toEqual([[2, 'NOT_FREE'], [3, 'NO_RESPONSE']]);
  });
  test('ตอบว่าไม่ว่างทุกวัน ([]) นับว่าไม่ว่าง ไม่ใช่ยังไม่ตอบ', () => {
    expect(unavailableOn([co(1, [])], '2026-11-10')[0].reason).toBe('NOT_FREE');
  });
});

describe('setCoTeacherAvailability', () => {
  const req = (body, id = 2) => ({ params: { id: String(id) }, body, user: { id: 50, role: 'teacher' } });
  beforeEach(() => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, prefix: 'อ.', firstName: 'ร่วม', lastName: 'หนึ่ง' });
    prisma.supervisionAppointment.findUnique.mockResolvedValue({
      id: 2, status: 'PENDING_TEACHER', proposedDates: PROPOSED, teacher: { userId: 90 },
      coTeachers: [{ teacherId: 7 }], student: { firstName: 'ก', lastName: 'ข', studentId: '650000001' },
    });
    prisma.supervisionCoTeacher.update.mockResolvedValue({});
  });

  test('อาจารย์ร่วมติ๊กวันว่าง → บันทึก + แจ้งอาจารย์หลัก', async () => {
    const res = makeRes();
    await setCoTeacherAvailability(req({ availableDates: ['2026-11-12', '2026-11-12'] }), res);
    expect(prisma.supervisionCoTeacher.update).toHaveBeenCalledWith({
      where: { appointmentId_teacherId: { appointmentId: 2, teacherId: 7 } },
      data: { availableDates: JSON.stringify(['2026-11-12']), respondedAt: expect.any(Date) },
    });
    expect(createNotifications).toHaveBeenCalledWith([90], expect.objectContaining({ type: 'SUPERVISION_CO_RESPONDED' }));
  });

  test('ไม่ว่างเลยสักวัน ([]) บันทึกได้', async () => {
    const res = makeRes();
    await setCoTeacherAvailability(req({ availableDates: [] }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.supervisionCoTeacher.update.mock.calls[0][0].data.availableDates).toBe('[]');
  });

  test('วันที่นักศึกษาไม่ได้เสนอ → 400', async () => {
    const res = makeRes();
    await setCoTeacherAvailability(req({ availableDates: ['2026-12-01'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionCoTeacher.update).not.toHaveBeenCalled();
  });

  test('ไม่ใช่อาจารย์ร่วมของนัดนี้ → 403', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 2, status: 'PENDING_TEACHER', proposedDates: PROPOSED, teacher: { userId: 90 }, coTeachers: [], student: {} });
    const res = makeRes();
    await setCoTeacherAvailability(req({ availableDates: ['2026-11-10'] }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('ยืนยันวันไปแล้ว → 400 (แก้วันว่างไม่ได้)', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 2, status: 'DATE_CONFIRMED', proposedDates: PROPOSED, teacher: { userId: 90 }, coTeachers: [{ teacherId: 7 }], student: {} });
    const res = makeRes();
    await setCoTeacherAvailability(req({ availableDates: ['2026-11-10'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('reviewSupervision APPROVE — เตือนเมื่ออาจารย์ร่วมไม่ว่าง', () => {
  const chosen = new Date(2026, 10, 10, 9, 0); // 10 พ.ย. 09:00 เวลาเครื่อง
  const req = (extra = {}) => ({ params: { id: '2' }, body: { action: 'APPROVE', confirmedDate: chosen.toISOString(), ...extra }, user: { id: 90, role: 'teacher' } });
  beforeEach(() => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 90 });
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 2, teacherId: 5, status: 'PENDING_TEACHER', proposedDates: PROPOSED, coTeachers: [] });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]); // ไม่มีนัดชน
    prisma.supervisionAppointment.update.mockResolvedValue({});
    prisma.student.findUnique.mockResolvedValue({ userId: 60 }); // แจ้งเตือนนักศึกษาหลังยืนยัน
  });

  test('อาจารย์ร่วมไม่ว่างวันที่เลือก → 409 พร้อมชื่อ ไม่บันทึก', async () => {
    prisma.supervisionCoTeacher.findMany.mockResolvedValueOnce([co(7, ['2026-11-12'])]);
    const res = makeRes();
    await reviewSupervision(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'CO_TEACHER_UNAVAILABLE', unavailable: [{ teacherId: 7, reason: 'NOT_FREE' }] });
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('อาจารย์หลักยืนยันซ้ำ (acknowledgeUnavailable) → บันทึก', async () => {
    prisma.supervisionCoTeacher.findMany.mockResolvedValueOnce([co(7, ['2026-11-12'])]);
    const res = makeRes();
    await reviewSupervision(req({ acknowledgeUnavailable: true }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DATE_CONFIRMED' }) }));
  });

  test('อาจารย์ร่วมทุกคนว่าง → บันทึกทันที', async () => {
    prisma.supervisionCoTeacher.findMany.mockResolvedValueOnce([co(7, ['2026-11-10', '2026-11-12'])]);
    const res = makeRes();
    await reviewSupervision(req(), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.supervisionAppointment.update).toHaveBeenCalled();
  });
});
