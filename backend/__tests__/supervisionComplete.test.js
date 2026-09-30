// __tests__/supervisionComplete.test.js — ใครกด "นิเทศเสร็จ" ได้
// อาจารย์ผู้นิเทศหลัก · อาจารย์ประจำวิชาของหลักสูตรนักศึกษา (ทำงานแทนเจ้าหน้าที่ในหลักสูตร) · เจ้าหน้าที่
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue(), getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/supervisionEval', () => ({ getEvalConfig: jest.fn().mockResolvedValue({ autoSend: false }), sendEvalForAppointments: jest.fn() }));

const prisma = require('./__mocks__/prismaClient');
const { completeSupervision } = require('../controllers/supervisionController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const req = (user) => ({ user, params: { id: '2' }, method: 'PUT', get: () => '' });
const APPT = { id: 2, studentId: 18, teacherId: 1, status: 'LETTER_UPLOADED', evalSentAt: null };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.supervisionAppointment.findUnique.mockResolvedValue(APPT);
  prisma.supervisionAppointment.update.mockResolvedValue({});
  prisma.student.findUnique.mockResolvedValue({ major: 'CS', userId: 50, deletedAt: null });
});

test('อาจารย์ผู้นิเทศหลัก → 200', async () => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 1, coopMajors: [] });
  const res = makeRes();
  await completeSupervision(req({ id: 10, role: 'teacher' }), res);
  expect(res.status).not.toHaveBeenCalled();
  expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { status: 'COMPLETED' } });
});

test('อาจารย์ประจำวิชา CS (ไม่ได้นิเทศเอง) กับนักศึกษา CS → 200 เหมือนเจ้าหน้าที่', async () => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 3, coopMajors: [{ major: 'CS' }] });
  const res = makeRes();
  await completeSupervision(req({ id: 11, role: 'teacher' }), res);
  expect(res.status).not.toHaveBeenCalled();
  expect(prisma.supervisionAppointment.update).toHaveBeenCalled();
});

test('อาจารย์ประจำวิชา AI กับนักศึกษา CS → 403', async () => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 3, coopMajors: [{ major: 'AI' }] });
  const res = makeRes();
  await completeSupervision(req({ id: 11, role: 'teacher' }), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
});

test('อาจารย์ทั่วไปที่ไม่ได้นิเทศนัดนี้ → 403', async () => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 7, coopMajors: [] });
  const res = makeRes();
  await completeSupervision(req({ id: 12, role: 'teacher' }), res);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('เจ้าหน้าที่ → 200', async () => {
  const res = makeRes();
  await completeSupervision(req({ id: 1, role: 'staff' }), res);
  expect(res.status).not.toHaveBeenCalled();
  expect(prisma.supervisionAppointment.update).toHaveBeenCalled();
});
