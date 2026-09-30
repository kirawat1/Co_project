// backend/__tests__/coopPeriodController.test.js — รอบสหกิจ: ปี/เทอมใช้ร่วมกัน · วันรับสมัคร/เปิดปิด/ช่วงนิเทศ แยกหลักสูตร (Phase 5)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue() }));

const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const {
  getPeriods, createPeriod, updatePeriod, togglePeriod, deletePeriod, removePeriodMajor, getActivePeriod, moveStudentPeriod,
} = require('../controllers/coopPeriodController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STAFF = { id: 1, role: 'staff' };
const COOP_CS = { id: 2, role: 'teacher' };
const STUDENT = { id: 3, role: 'student' };
const req = (user, extra = {}) => ({ user, method: 'GET', body: {}, params: {}, get: () => '', ...extra });

const FUTURE = new Date(Date.now() + 30 * 86400000);
const PAST = new Date(Date.now() - 30 * 86400000);
const row = (periodId, major, over = {}) => ({
  periodId, major, startDate: new Date('2026-01-01'), endDate: FUTURE, isActive: false,
  supervisionStartDate: null, supervisionEndDate: null, isSupervisionOpen: false, ...over,
});
const period = (id, majors, over = {}) => ({
  id, academicYear: '2569', semester: id, startDate: new Date('2026-01-01'), endDate: FUTURE,
  majors, ...over,
});
const lastJson = (res) => res.json.mock.calls[res.json.mock.calls.length - 1][0];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
  prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'AI' }, { major: 'CS' }]);
  prisma.coopPeriodMajor.updateMany.mockResolvedValue({ count: 0 });
});

describe('getPeriods', () => {
  test('เจ้าหน้าที่ — ค่าระดับบนรวมทุกหลักสูตร (เปิดถ้ามีหลักสูตรใดเปิด) + แถวของทุกหลักสูตร', async () => {
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'AI'), row(1, 'CS', { isActive: true })])]);
    const res = makeRes();
    await getPeriods(req(STAFF), res);
    const [p] = lastJson(res).periods;
    expect(p.isActive).toBe(true);
    expect(p.majors.map((r) => r.major)).toEqual(['AI', 'CS']);
  });

  test('อาจารย์ประจำวิชา CS — ค่าระดับบน = ของ CS · หลักสูตรที่ยังไม่ตั้งรอบนี้ = ปิด (configured=false)', async () => {
    prisma.coopPeriod.findMany.mockResolvedValue([
      period(1, [row(1, 'AI', { isActive: true }), row(1, 'CS', { isSupervisionOpen: true })]),
      period(2, [row(2, 'AI', { isActive: true })]),
    ]);
    const res = makeRes();
    await getPeriods(req(COOP_CS), res);
    const [p1, p2] = lastJson(res).periods;
    expect(p1).toMatchObject({ major: 'CS', isActive: false, isSupervisionOpen: true, configured: true });
    expect(p2).toMatchObject({ major: 'CS', isActive: false, configured: false });
  });

  test('เลยวันปิดแต่ยังเปิดค้าง → ปิดอัตโนมัติ (บันทึกลง DB) เฉพาะแถวนั้น', async () => {
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'AI', { isActive: true, endDate: PAST }), row(1, 'CS', { isActive: true })])]);
    const res = makeRes();
    await getPeriods(req(STAFF), res);
    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledWith({ where: { OR: [{ periodId: 1, major: 'AI' }] }, data: { isActive: false } });
    const [p] = lastJson(res).periods;
    expect(p.majors.find((r) => r.major === 'AI').isActive).toBe(false);
    expect(p.majors.find((r) => r.major === 'CS').isActive).toBe(true);
  });

  test('500 เมื่อ DB ล้ม', async () => {
    prisma.coopPeriod.findMany.mockRejectedValue(new Error('DB fail'));
    const res = makeRes();
    await getPeriods(req(STAFF), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createPeriod', () => {
  const b = { academicYear: '2570', semester: 1, startDate: '2027-01-01', endDate: '2027-03-01' };

  test('เจ้าหน้าที่สร้างรอบใหม่ → ได้แถวของทุกหลักสูตร', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(null);
    prisma.coopPeriod.create.mockResolvedValue({ id: 9 });
    prisma.coopPeriodMajor.findMany.mockResolvedValue([]);
    prisma.coopPeriod.findMany.mockResolvedValue([period(9, [row(9, 'AI'), row(9, 'CS')])]);
    const res = makeRes();
    await createPeriod(req(STAFF, { method: 'POST', body: b }), res);
    expect(prisma.coopPeriodMajor.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ periodId: 9, major: 'AI' }), expect.objectContaining({ periodId: 9, major: 'CS' })] });
    expect(lastJson(res)).toMatchObject({ ok: true, added: ['AI', 'CS'] });
  });

  test('ปี/เทอมมีแล้ว และทุกหลักสูตรตั้งแล้ว → 409', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 9 });
    prisma.coopPeriodMajor.findMany.mockResolvedValue([{ major: 'AI' }, { major: 'CS' }]);
    const res = makeRes();
    await createPeriod(req(STAFF, { method: 'POST', body: b }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.coopPeriodMajor.createMany).not.toHaveBeenCalled();
  });

  test('อาจารย์ประจำวิชา CS กับปี/เทอมที่มีแล้ว → เพิ่มเฉพาะแถว CS ไม่สร้างปี/เทอมซ้ำ', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 9 });
    prisma.coopPeriodMajor.findMany.mockResolvedValue([{ major: 'AI' }]);
    prisma.coopPeriod.findMany.mockResolvedValue([period(9, [row(9, 'AI'), row(9, 'CS')])]);
    const res = makeRes();
    await createPeriod(req(COOP_CS, { method: 'POST', body: b }), res);
    expect(prisma.coopPeriod.create).not.toHaveBeenCalled();
    expect(prisma.coopPeriodMajor.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ major: 'CS' })] });
  });

  test('อาจารย์ประจำวิชา CS ระบุ AI → 403', async () => {
    const res = makeRes();
    await createPeriod(req(COOP_CS, { method: 'POST', body: { ...b, major: 'AI' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('ไม่ระบุวัน → 400', async () => {
    const res = makeRes();
    await createPeriod(req(STAFF, { method: 'POST', body: { academicYear: '2570', semester: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updatePeriod', () => {
  const b = { startDate: '2027-01-01', endDate: '2027-03-01' };

  test('อาจารย์ประจำวิชา CS → แก้วันของแถว CS (upsert) ไม่แตะปี/เทอม', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1 });
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'CS')])]);
    const res = makeRes();
    await updatePeriod(req(COOP_CS, { method: 'PUT', params: { id: '1' }, body: { ...b, academicYear: '2599' } }), res);
    expect(prisma.coopPeriodMajor.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { periodId_major: { periodId: 1, major: 'CS' } } }));
    expect(prisma.coopPeriod.update).not.toHaveBeenCalled();
  });

  test('เจ้าหน้าที่ไม่ระบุหลักสูตร → แก้ปี/เทอมของรอบ', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1 });
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [])]);
    const res = makeRes();
    await updatePeriod(req(STAFF, { method: 'PUT', params: { id: '1' }, body: { ...b, academicYear: '2570', semester: 2 } }), res);
    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ academicYear: '2570', semester: 2 }) }));
    expect(prisma.coopPeriodMajor.upsert).not.toHaveBeenCalled();
  });

  test('ไม่พบรอบ → 404', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await updatePeriod(req(STAFF, { method: 'PUT', params: { id: '1' }, body: b }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('togglePeriod', () => {
  test('อาจารย์ประจำวิชา CS เปิดรอบ → ปิดรอบอื่นของ CS เท่านั้น แล้วเปิดแถว CS', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(period(1, [row(1, 'AI'), row(1, 'CS')]));
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'CS', { isActive: true })])]);
    const res = makeRes();
    await togglePeriod(req(COOP_CS, { method: 'PATCH', params: { id: '1' }, body: { isActive: true } }), res);
    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledWith({ where: { major: { in: ['CS'] }, periodId: { not: 1 } }, data: { isActive: false } });
    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledWith({ where: { periodId: 1, major: { in: ['CS'] } }, data: { isActive: true } });
  });

  test('เจ้าหน้าที่ไม่ระบุหลักสูตร → ทุกหลักสูตรที่ตั้งรอบนี้', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(period(1, [row(1, 'AI'), row(1, 'CS')]));
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [])]);
    const res = makeRes();
    await togglePeriod(req(STAFF, { method: 'PATCH', params: { id: '1' }, body: { isActive: false } }), res);
    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.coopPeriodMajor.updateMany).toHaveBeenCalledWith({ where: { periodId: 1, major: { in: ['AI', 'CS'] } }, data: { isActive: false } });
  });

  test('เปิดแถวที่เลยวันปิดรับสมัครแล้ว → 400 ไม่เปิด', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(period(1, [row(1, 'CS', { endDate: PAST })]));
    const res = makeRes();
    await togglePeriod(req(COOP_CS, { method: 'PATCH', params: { id: '1' }, body: { isActive: true } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopPeriodMajor.updateMany).not.toHaveBeenCalled();
  });

  test('หลักสูตรยังไม่ได้ตั้งรอบนี้ → 400', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(period(1, [row(1, 'AI')]));
    const res = makeRes();
    await togglePeriod(req(COOP_CS, { method: 'PATCH', params: { id: '1' }, body: { isActive: true } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('อาจารย์ประจำวิชา CS สั่ง AI → 403', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue(period(1, [row(1, 'AI')]));
    const res = makeRes();
    await togglePeriod(req(COOP_CS, { method: 'PATCH', params: { id: '1' }, body: { isActive: true, major: 'AI' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('isActive ไม่ใช่ boolean → 400', async () => {
    const res = makeRes();
    await togglePeriod(req(STAFF, { method: 'PATCH', params: { id: '1' }, body: { isActive: 'yes' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deletePeriod / removePeriodMajor', () => {
  test('ลบรอบที่มีนักศึกษาอ้างอิง → 409', async () => {
    prisma.coopPeriod.delete.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));
    const res = makeRes();
    await deletePeriod(req(STAFF, { method: 'DELETE', params: { id: '1' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('เอารอบออกจากหลักสูตรที่ยังมีนักศึกษาอยู่ในรอบ → 409', async () => {
    prisma.studentCoop.count.mockResolvedValue(3);
    const res = makeRes();
    await removePeriodMajor(req(COOP_CS, { method: 'DELETE', params: { id: '1', major: 'CS' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.coopPeriodMajor.delete).not.toHaveBeenCalled();
  });

  test('เอารอบออกจากหลักสูตร (ไม่มีนักศึกษา) → ลบแถว', async () => {
    prisma.studentCoop.count.mockResolvedValue(0);
    prisma.coopPeriodMajor.findUnique.mockResolvedValue(row(1, 'CS'));
    const res = makeRes();
    await removePeriodMajor(req(COOP_CS, { method: 'DELETE', params: { id: '1', major: 'CS' } }), res);
    expect(prisma.coopPeriodMajor.delete).toHaveBeenCalledWith({ where: { periodId_major: { periodId: 1, major: 'CS' } } });
  });
});

describe('getActivePeriod (นักศึกษา)', () => {
  test('ยังไม่ระบุหลักสูตร → period null + reason NO_MAJOR', async () => {
    prisma.student.findUnique.mockResolvedValue({ major: null });
    const res = makeRes();
    await getActivePeriod(req(STUDENT), res);
    expect(lastJson(res)).toMatchObject({ ok: true, period: null, reason: 'NO_MAJOR' });
  });

  test('CS เปิดอยู่ → นักศึกษา CS ได้รอบนั้น (ค่าของ CS)', async () => {
    prisma.student.findUnique.mockResolvedValue({ major: 'CS' });
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'AI'), row(1, 'CS', { isActive: true })])]);
    const res = makeRes();
    await getActivePeriod(req(STUDENT), res);
    expect(lastJson(res).period).toMatchObject({ id: 1, major: 'CS', isActive: true });
  });

  test('มีแต่ CS เปิด → นักศึกษา AI ไม่มีรอบเปิด', async () => {
    prisma.student.findUnique.mockResolvedValue({ major: 'AI' });
    prisma.coopPeriod.findMany.mockResolvedValue([period(1, [row(1, 'AI'), row(1, 'CS', { isActive: true })])]);
    const res = makeRes();
    await getActivePeriod(req(STUDENT), res);
    expect(lastJson(res).period).toBeNull();
  });
});

describe('moveStudentPeriod', () => {
  const stu = (status, over = {}) => ({ id: 5, userId: 50, major: 'CS', deletedAt: null, coop: { status, coopPeriodId: 1 }, supervisionAppointment: null, ...over });
  const mv = (b) => req(COOP_CS, { method: 'POST', params: { id: '5' }, body: { periodId: 2, reason: 'บริษัทยกเลิก', ...b } });
  beforeEach(() => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2, academicYear: '2569', semester: 2 });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue(row(2, 'CS'));
    prisma.studentCoop.update.mockResolvedValue({});
  });

  test('ยังไม่ผ่านคุณสมบัติ + KEEP → ย้ายรอบอย่างเดียว + แจ้งนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(stu('APPLYING'));
    const res = makeRes();
    await moveStudentPeriod(mv({ resetTo: 'KEEP' }), res);
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 5 }, data: { coopPeriodId: 2 } });
    expect(createNotifications).toHaveBeenCalledWith([50], expect.objectContaining({ type: 'COOP_PERIOD_MOVED' }));
  });

  test('ออกหนังสือแล้ว + QUALIFIED → คงผ่านคุณสมบัติ ยกเลิกหนังสือ/ใบตอบรับ', async () => {
    prisma.student.findUnique.mockResolvedValue(stu('PLACEMENT_LETTER_ISSUED'));
    const res = makeRes();
    await moveStudentPeriod(mv({ resetTo: 'QUALIFIED' }), res);
    const { data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(data).toMatchObject({ coopPeriodId: 2, status: 'QUALIFIED', t000Status: 'WAITING', reqDocNumber: null, reqLetterUrl: null, placeDocNumber: null, placeLetterUrl: null, acceptanceFileUrl: null });
    expect(data).not.toHaveProperty('teacherCheckComment');
  });

  test('NOT_SUBMITTED → ล้างผลตรวจคุณสมบัติด้วย', async () => {
    prisma.student.findUnique.mockResolvedValue(stu('REQ_LETTER_ISSUED'));
    const res = makeRes();
    await moveStudentPeriod(mv({ resetTo: 'NOT_SUBMITTED' }), res);
    expect(prisma.studentCoop.update.mock.calls[0][0].data).toMatchObject({ status: 'NOT_SUBMITTED', teacherCheckComment: null, reqDocNumber: null });
  });

  test.each([
    ['ผ่านคุณสมบัติแล้วเลือก KEEP', stu('REQ_LETTER_ISSUED'), { resetTo: 'KEEP' }],
    ['ยังไม่ผ่านคุณสมบัติเลือก QUALIFIED', stu('APPLYING'), { resetTo: 'QUALIFIED' }],
    ['ออกฝึกแล้ว', stu('INTERNSHIP_STARTED'), { resetTo: 'NOT_SUBMITTED' }],
    ['มีนัดนิเทศแล้ว', stu('PLACEMENT_LETTER_ISSUED', { supervisionAppointment: { id: 1 } }), { resetTo: 'QUALIFIED' }],
    ['ไม่ใส่เหตุผล', stu('APPLYING'), { resetTo: 'KEEP', reason: '  ' }],
    ['รอบเดิม', stu('APPLYING'), { resetTo: 'KEEP', periodId: 1 }],
  ])('400 — %s', async (_n, s, b) => {
    prisma.student.findUnique.mockResolvedValue(s);
    const res = makeRes();
    await moveStudentPeriod(mv(b), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('หลักสูตรของนักศึกษายังไม่ได้ตั้งรอบปลายทาง → 400', async () => {
    prisma.student.findUnique.mockResolvedValue(stu('APPLYING'));
    prisma.coopPeriodMajor.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await moveStudentPeriod(mv({ resetTo: 'KEEP' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });
});
