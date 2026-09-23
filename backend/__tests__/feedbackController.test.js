// __tests__/feedbackController.test.js — เรื่องที่ผู้ใช้แจ้งจากปุ่ม "แจ้งปัญหา"
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({
  createNotifications: jest.fn().mockResolvedValue(undefined),
  getStaffIds: jest.fn().mockResolvedValue([9, 10]),
  getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([9, 10]),
}));

const prisma = require('./__mocks__/prismaClient');
const { createNotifications, getStaffIds } = require('../utils/notificationHelper');
const { submitFeedback, getMyFeedback, listFeedback, updateFeedback } = require('../controllers/feedbackController');
const { describeRequest } = require('../utils/auditActions');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STUDENT = {
  id: 5, username: 'stu', email: 's@kku.ac.th', role: 'student',
  student: { studentId: '6430212186', prefix: 'MR', firstName: 'ดำ', lastName: 'แดง', coop: { status: 'T002_SUBMITTED' } },
  teacher: null, staffProfile: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  getStaffIds.mockResolvedValue([9, 10]);
});

describe('ผู้ใช้แจ้งเรื่อง', () => {
  test('บันทึกเรื่องพร้อมบริบท (หน้าที่เปิดอยู่ · สถานะสหกิจ · เบราว์เซอร์) แล้วแจ้งเจ้าหน้าที่', async () => {
    prisma.user.findUnique.mockResolvedValue(STUDENT);
    prisma.feedback.create.mockResolvedValue({ id: 77 });
    const req = {
      user: { id: 5 },
      headers: { 'user-agent': 'Chrome/130 Windows' },
      body: { kind: 'BUG', message: 'อัปโหลดใบตอบรับแล้วขึ้นว่าไฟล์ใหญ่เกิน', pagePath: '/student/docs' },
      file: { filename: '123-456.png' },
    };
    const res = makeRes();
    await submitFeedback(req, res);

    const data = prisma.feedback.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 5, role: 'student', kind: 'BUG',
      pagePath: '/student/docs', contextNote: 'T002_SUBMITTED',
      userAgent: 'Chrome/130 Windows', imagePath: '123-456.png',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(createNotifications).toHaveBeenCalledWith([9, 10], expect.objectContaining({
      type: 'FEEDBACK_NEW', link: '/admin/feedback', relatedId: '77',
    }));
    // ข้อความแจ้งเตือนต้องบอกว่าใครแจ้ง เจ้าหน้าที่จะได้รู้ตั้งแต่ยังไม่เปิดดู
    expect(createNotifications.mock.calls[0][1].message).toContain('6430212186');
  });

  test('ไม่มีภาพแนบก็ส่งได้ · สถานะเริ่มต้นเป็นเรื่องใหม่', async () => {
    prisma.user.findUnique.mockResolvedValue(STUDENT);
    prisma.feedback.create.mockResolvedValue({ id: 78 });
    await submitFeedback({ user: { id: 5 }, headers: {}, body: { kind: 'SUGGEST', message: 'อยากให้แจ้งเตือนทางอีเมลด้วย' } }, makeRes());
    const data = prisma.feedback.create.mock.calls[0][0].data;
    expect(data.imagePath).toBeNull();
    expect(data.kind).toBe('SUGGEST');
    expect(data.status).toBeUndefined(); // ใช้ค่า default NEW จากฐานข้อมูล
  });

  test('ข้อความสั้นเกินไป / ประเภทไม่ถูกต้อง → 400 และไม่บันทึก', async () => {
    let res = makeRes();
    await submitFeedback({ user: { id: 5 }, headers: {}, body: { kind: 'BUG', message: 'งง' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await submitFeedback({ user: { id: 5 }, headers: {}, body: { kind: 'OTHER', message: 'ข้อความยาวพอแล้วนะ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  test('แจ้งเตือนเจ้าหน้าที่ล้มเหลว ต้องไม่ทำให้การแจ้งเรื่องพัง', async () => {
    prisma.user.findUnique.mockResolvedValue(STUDENT);
    prisma.feedback.create.mockResolvedValue({ id: 79 });
    getStaffIds.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await submitFeedback({ user: { id: 5 }, headers: {}, body: { kind: 'BUG', message: 'กดปุ่มส่งแล้วไม่มีอะไรเกิดขึ้น' } }, res);
    spy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('เจ้าหน้าที่ดูและตอบกลับ', () => {
  test('รายการมีชื่อผู้แจ้งอ่านออก และตัวนับแยกตามสถานะ', async () => {
    prisma.feedback.count.mockResolvedValue(1);
    prisma.feedback.findMany.mockResolvedValue([
      { id: 1, kind: 'BUG', message: 'x', status: 'NEW', userId: 5, user: STUDENT },
    ]);
    prisma.feedback.groupBy.mockResolvedValue([{ status: 'NEW', _count: { _all: 1 } }]);
    const res = makeRes();
    await listFeedback({ query: { status: 'NEW' } }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data[0]).toMatchObject({ reporterName: '6430212186 นายดำ แดง', reporterRole: 'student', coopStatus: 'T002_SUBMITTED' });
    expect(payload.meta.counts).toMatchObject({ NEW: 1, all: 1 });
    // ต้องไม่ส่งข้อมูลดิบของบัญชีผู้ใช้ออกไปทั้งก้อน
    expect(payload.data[0].user).toBeUndefined();
  });

  test('ตอบกลับ + ปิดเรื่อง → แจ้งผู้แจ้ง และเก็บว่าใครเป็นคนจัดการ', async () => {
    prisma.feedback.findUnique.mockResolvedValue({ id: 3, userId: 5, kind: 'BUG' });
    prisma.user.findUnique.mockResolvedValue({ id: 9, username: 'staff01', role: 'staff', staffProfile: { firstName: 'สมหญิง', lastName: 'ใจดี' }, student: null, teacher: null });
    prisma.feedback.update.mockResolvedValue({ id: 3, status: 'RESOLVED', staffReply: 'แก้ไขแล้ว' });
    const res = makeRes();
    await updateFeedback({ params: { id: '3' }, user: { id: 9 }, body: { status: 'RESOLVED', staffReply: 'แก้ไขแล้ว' } }, res);

    expect(prisma.feedback.update.mock.calls[0][0].data).toMatchObject({
      status: 'RESOLVED', staffReply: 'แก้ไขแล้ว', handledById: 9, handledName: 'สมหญิง ใจดี',
    });
    expect(createNotifications).toHaveBeenCalledWith([5], expect.objectContaining({ type: 'FEEDBACK_REPLIED' }));
  });

  test('เปลี่ยนสถานะเฉยๆ (ยังไม่ตอบ) ไม่รบกวนผู้แจ้ง', async () => {
    prisma.feedback.findUnique.mockResolvedValue({ id: 3, userId: 5, kind: 'BUG' });
    prisma.user.findUnique.mockResolvedValue({ id: 9, username: 'staff01', role: 'staff', staffProfile: null, student: null, teacher: null });
    prisma.feedback.update.mockResolvedValue({ id: 3, status: 'IN_PROGRESS', staffReply: null });
    await updateFeedback({ params: { id: '3' }, user: { id: 9 }, body: { status: 'IN_PROGRESS' } }, makeRes());
    expect(createNotifications).not.toHaveBeenCalled();
  });

  test('สถานะไม่ถูกต้อง / ไม่พบเรื่อง / ไม่มีอะไรจะบันทึก', async () => {
    let res = makeRes();
    await updateFeedback({ params: { id: '3' }, user: { id: 9 }, body: { status: 'WHATEVER' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await updateFeedback({ params: { id: '3' }, user: { id: 9 }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    prisma.feedback.findUnique.mockResolvedValue(null);
    await updateFeedback({ params: { id: '3' }, user: { id: 9 }, body: { status: 'NEW' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('ผู้แจ้งดูเรื่องของตัวเองได้เฉพาะของตัวเอง', async () => {
    prisma.feedback.findMany.mockResolvedValue([]);
    await getMyFeedback({ user: { id: 5 } }, makeRes());
    expect(prisma.feedback.findMany.mock.calls[0][0].where).toEqual({ userId: 5 });
  });
});

describe('บันทึกการใช้งาน', () => {
  test('เส้นทางแจ้งเรื่องและตอบกลับมีชื่อไทย', () => {
    expect(describeRequest({ method: 'POST', path: '/api/feedback', body: {} }).action).toBe('แจ้งปัญหาการใช้งาน');
    expect(describeRequest({ method: 'PATCH', path: '/api/admin/feedback/7', body: {} }))
      .toMatchObject({ action: 'ตอบกลับ/อัปเดตเรื่องที่แจ้ง', targetType: 'เรื่องที่แจ้ง', targetId: '7' });
  });
});
