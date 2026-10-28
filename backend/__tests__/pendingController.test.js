// __tests__/pendingController.test.js — ป้ายเมนู = งานที่รออยู่จริงตามขอบเขต (ไม่ใช่แจ้งเตือนที่ยังไม่อ่าน)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getPendingCounts } = require('../controllers/pendingController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}
const req = (id, role, headers = {}) => ({ user: { id, role }, userId: id, method: 'GET', get: (h) => headers[h.toLowerCase()] });
const coopCountFor = (status) => prisma.studentCoop.count.mock.calls.find(([a]) => JSON.stringify(a.where.status) === JSON.stringify(status));

beforeEach(() => {
  jest.clearAllMocks();
  prisma.studentCoop.count.mockResolvedValue(1);
  prisma.supervisionAppointment.count.mockResolvedValue(2);
  prisma.feedback.count.mockResolvedValue(3);
});

describe('เจ้าหน้าที่', () => {
  test('นับทุกหน้าที่มีงานรอ ทุกหลักสูตร', async () => {
    const res = makeRes();
    await getPendingCounts(req(1, 'staff'), res);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      pending: { t002: 1, t003: 1, coopApplications: 1, t000: 1, supervisionManager: 2, feedback: 3 },
    });
    // คำร้อง = APPLYING (ตรงกับหน้าตรวจคำร้อง) · ไม่นับนักศึกษาที่ถูกลบ
    expect(coopCountFor('APPLYING')[0].where.student).toEqual({ deletedAt: null });
    // T000: ตรวจเอกสาร/ใบตอบรับ + หนังสือที่ต้องออก (เจ้าหน้าที่เท่านั้น)
    expect(coopCountFor({ in: ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_STAFF_CHECK_LETTER', 'DOCS_APPROVED', 'ACCEPTANCE_CHECKED'] })).toBeTruthy();
    expect(coopCountFor('T002_SUBMITTED')).toBeTruthy();
    expect(coopCountFor('T003_SUBMITTED')).toBeTruthy();
    // นิเทศ: ยืนยันวันแล้ว รอออกหนังสือ/อัปโหลดฉบับลงนาม
    expect(prisma.supervisionAppointment.count).toHaveBeenCalledWith({ where: { status: 'DATE_CONFIRMED', student: { deletedAt: null } } });
    expect(prisma.feedback.count).toHaveBeenCalledWith({ where: { status: 'NEW' } });
  });

  test('ตัวกรองหลักสูตรบนแถบบน (X-Major-Filter) ใช้เหมือนหน้ารายการ', async () => {
    const res = makeRes();
    await getPendingCounts(req(1, 'staff', { 'x-major-filter': 'CS' }), res);
    expect(coopCountFor('APPLYING')[0].where.student).toEqual({ deletedAt: null, major: { in: ['CS'] } });
  });
});

describe('อาจารย์ประจำวิชา (มีหลักสูตรที่ดูแล)', () => {
  beforeEach(() => prisma.teacher.findUnique.mockResolvedValue({ id: 9, coopMajors: [{ major: 'AI' }] }));

  test('งานของหลักสูตรที่ดูแล + งานของตัวเอง · ไม่มีหนังสือ/เรื่องที่ผู้ใช้แจ้ง', async () => {
    const res = makeRes();
    await getPendingCounts(req(2, 'teacher'), res);
    const { pending } = res.json.mock.calls[0][0];
    expect(Object.keys(pending).sort()).toEqual(['coopApplications', 't000', 't002', 't003', 'teacherRequests', 'teacherSupervision']);
    expect(coopCountFor('APPLYING')[0].where.student).toEqual({ deletedAt: null, major: { in: ['AI'] } });
    // T000 ของอาจารย์ = งานตรวจเท่านั้น (ออกหนังสือเป็นของเจ้าหน้าที่)
    expect(coopCountFor({ in: ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_STAFF_CHECK_LETTER'] })).toBeTruthy();
    // หน้าคำร้องของอาจารย์ = ที่ปรึกษา + หลักสูตรที่ดูแล · รอตรวจรวมรอพิจารณาเกรด
    expect(coopCountFor({ in: ['APPLYING', 'PENDING_GRADE'] })[0].where.student)
      .toEqual({ AND: [{ deletedAt: null }, { OR: [{ coopAdvisorId: 9 }, { major: { in: ['AI'] } }] }] });
    expect(prisma.feedback.count).not.toHaveBeenCalled();
  });

  test('นิเทศ: เป็นอาจารย์หลักรอเลือกวัน หรือเป็นอาจารย์ร่วมที่ยังไม่ตอบวันว่าง', async () => {
    const res = makeRes();
    await getPendingCounts(req(2, 'teacher'), res);
    expect(prisma.supervisionAppointment.count).toHaveBeenCalledWith({
      where: {
        status: 'PENDING_TEACHER',
        student: { deletedAt: null },
        OR: [{ teacherId: 9 }, { coTeachers: { some: { teacherId: 9, availableDates: null } } }],
      },
    });
  });
});

describe('อาจารย์ทั่วไป (ไม่มีหลักสูตรที่ดูแล)', () => {
  test('เฉพาะหน้าของอาจารย์ — ไม่มีงานหน้าจัดการหลักสูตร', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, coopMajors: [] });
    const res = makeRes();
    await getPendingCounts(req(3, 'teacher'), res);
    const { pending } = res.json.mock.calls[0][0];
    expect(Object.keys(pending).sort()).toEqual(['t002', 't003', 'teacherRequests', 'teacherSupervision']);
  });
});

test('นักศึกษา → ไม่มีป้ายงานรอ (ใช้แจ้งเตือนผลตรวจตามเดิม)', async () => {
  const res = makeRes();
  await getPendingCounts(req(4, 'student'), res);
  expect(res.json).toHaveBeenCalledWith({ ok: true, pending: {} });
  expect(prisma.studentCoop.count).not.toHaveBeenCalled();
});

test('500 — ฐานข้อมูลพัง', async () => {
  prisma.studentCoop.count.mockRejectedValue(new Error('db down'));
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = makeRes();
  await getPendingCounts(req(1, 'staff'), res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ ok: false, pending: {} });
  spy.mockRestore();
});
