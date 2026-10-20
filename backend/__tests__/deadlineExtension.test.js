// ขยายเวลาส่งรายคน (T000/T002/T003) — เจ้าหน้าที่ / อาจารย์ประจำวิชาของหลักสูตรนักศึกษา
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { setExtension, clearExtension } = require('../controllers/deadlineExtensionController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STAFF = { id: 1, role: 'staff' };
const COOP_CS = { id: 2, role: 'teacher' };
const lastJson = (res) => res.json.mock.calls[res.json.mock.calls.length - 1][0];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-05T03:00:00Z'));
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
  prisma.student.findUnique.mockResolvedValue({ id: 10, major: 'CS' });
  prisma.studentCoop.findUnique.mockResolvedValue({ deadlineExtensions: { T000: '2026-05-20' } });
  prisma.studentCoop.update.mockResolvedValue({});
});
afterEach(() => jest.useRealTimers());

describe('setExtension', () => {
  test('ขยาย T002 → เก็บรวมกับที่มี', async () => {
    const res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10', reason: 'บริษัทเริ่มงานช้า' } }, res);
    expect(lastJson(res)).toMatchObject({ ok: true, deadlineExtensions: { T000: '2026-05-20', T002: '2026-07-10' } });
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({
      where: { studentId: 10 }, data: { deadlineExtensions: { T000: '2026-05-20', T002: '2026-07-10' } },
    });
  });

  test('วันนี้ (เวลาไทย) ขยายได้ · ย้อนหลัง → 400', async () => {
    let res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-05' } }, res);
    expect(lastJson(res)).toMatchObject({ ok: true });
    res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-04' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test.each([['T007', '2026-07-10'], ['X', '2026-07-10'], ['T002', '10/7/2026'], ['T002', '']])('stepKey=%s until=%s → 400', async (stepKey, until) => {
    const res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey, until } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('เหตุผลต้องเป็นข้อความไม่เกิน 200 ตัวอักษร', async () => {
    let res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10', reason: 'x'.repeat(201) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10', reason: { a: 1 } } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('ล็อกแถวก่อนอ่าน-เขียน (สองคนขยายพร้อมกันไม่ทับกัน)', async () => {
    const res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10' } }, res);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.studentCoop.findUnique.mock.invocationCallOrder[0]);
  });

  test('อาจารย์ประจำวิชา CS ขยายให้นักศึกษา AI → 403', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, major: 'AI' });
    const res = makeRes();
    await setExtension({ user: COOP_CS, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('ไม่มีข้อมูลสหกิจ → 404', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await setExtension({ user: STAFF, params: { id: '10' }, body: { stepKey: 'T002', until: '2026-07-10' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('clearExtension', () => {
  test('ยกเลิกขั้นเดียว คงขั้นอื่น', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ deadlineExtensions: { T000: '2026-05-20', T002: '2026-07-10' } });
    const res = makeRes();
    await clearExtension({ user: STAFF, params: { id: '10', stepKey: 'T002' } }, res);
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { deadlineExtensions: { T000: '2026-05-20' } } });
    expect(lastJson(res)).toMatchObject({ ok: true, deadlineExtensions: { T000: '2026-05-20' } });
  });

  test('stepKey แปลก → 400', async () => {
    const res = makeRes();
    await clearExtension({ user: STAFF, params: { id: '10', stepKey: 'T009' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
