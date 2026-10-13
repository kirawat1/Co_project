// __tests__/processGaps.test.js — ขั้นของกระบวนการที่เดิมไม่มีเทสต์เรียกเลย (สำรวจ coverage 2026-10-13)
//   นักศึกษาดาวน์โหลดหนังสือส่งตัว → ออกฝึกสหกิจ · ส่ง/ตรวจ T003 · แบบประเมินการนิเทศ · จำนวนแจ้งเตือน
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue(), getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/supervisionEval', () => ({
  SENDABLE_STATUSES: ['LETTER_UPLOADED', 'COMPLETED'],
  getEvalConfig: jest.fn(),
  unlinkedCoTeacherNames: jest.fn(() => []),
  sendEvalForAppointments: jest.fn(),
  CONFIG_KEY: 'SUPERVISION_EVAL',
  EVAL_DEFAULTS: { instructionText: '', evalLink: null, autoSend: false },
}));

const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const evalUtil = require('../utils/supervisionEval');
const { downloadPlacementLetter } = require('../controllers/studentController');
const { reviewT003 } = require('../controllers/teacherController');
const { saveT003Form } = require('../controllers/docController');
const { listEvalAppointments, sendEval, getMyEval } = require('../controllers/supervisionEvalController');
const { updateSupervisionEvalConfig } = require('../controllers/configController');
const { getUnreadCount, getCounts } = require('../controllers/notificationController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
});

// ─────────────────────────────────────────────
describe('downloadPlacementLetter — นักศึกษากดดาวน์โหลดหนังสือส่งตัว → ออกฝึกสหกิจ', () => {
  const req = { user: { id: 50, role: 'student' } };

  test('ออกหนังสือส่งตัวแล้ว + มีไฟล์ → INTERNSHIP_STARTED', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 5, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'PLACEMENT_LETTER_ISSUED', placeLetterUrl: 'p.pdf' });
    const res = makeRes();
    await downloadPlacementLetter(req, res);
    expect(prisma.student.findUnique).toHaveBeenCalledWith({ where: { userId: 50 } }); // หาจาก User.id ไม่ใช่ Student.id
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 5 }, data: { status: 'INTERNSHIP_STARTED' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test.each([
    ['ยังไม่มีไฟล์หนังสือส่งตัว', { status: 'PLACEMENT_LETTER_ISSUED', placeLetterUrl: null }],
    ['ยังไม่ถึงขั้น (ตรวจใบตอบรับแล้ว)', { status: 'ACCEPTANCE_CHECKED', placeLetterUrl: 'p.pdf' }],
    ['ออกฝึกแล้ว (กดซ้ำ) — ไม่ย้อน/ไม่เขียนซ้ำ', { status: 'T002_SUBMITTED', placeLetterUrl: 'p.pdf' }],
    ['ไม่มีข้อมูลสหกิจ', null],
  ])('%s → 400 ไม่เปลี่ยนสถานะ', async (_n, coop) => {
    prisma.student.findUnique.mockResolvedValue({ id: 5, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue(coop);
    const res = makeRes();
    await downloadPlacementLetter(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test.each([['ไม่พบนักศึกษา', null], ['อยู่ในถังขยะ', { id: 5, deletedAt: new Date() }]])('%s → 404', async (_n, student) => {
    prisma.student.findUnique.mockResolvedValue(student);
    const res = makeRes();
    await downloadPlacementLetter(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
describe('saveT003Form — นักศึกษากรอกโครงร่างรายงาน', () => {
  const req = (body = {}) => ({ user: { id: 50 }, body: { reportTitleTh: 'หัวข้อ', objectives: 'วัตถุประสงค์', ...body } });

  test.each(['T002_SUBMITTED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED'])('สถานะ %s → บันทึก (upsert ตามนักศึกษา)', async (status) => {
    prisma.student.findUnique.mockResolvedValue({ id: 5, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status });
    prisma.coopT003Form.upsert.mockResolvedValue({ id: 1 });
    const res = makeRes();
    await saveT003Form(req(), res);
    const arg = prisma.coopT003Form.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ studentId: 5 });
    expect(arg.create).toMatchObject({ studentId: 5, reportTitleTh: 'หัวข้อ' });
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 1 } });
  });

  test.each(['INTERNSHIP_STARTED', 'T003_APPROVED', 'QUALIFIED'])('สถานะ %s → 400 (ยังไม่ถึง/ผ่านแล้วแก้ไม่ได้)', async (status) => {
    prisma.student.findUnique.mockResolvedValue({ id: 5, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status });
    const res = makeRes();
    await saveT003Form(req(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopT003Form.upsert).not.toHaveBeenCalled();
  });

  test('นักศึกษาในถังขยะ → 404', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 5, deletedAt: new Date() });
    const res = makeRes();
    await saveT003Form(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─────────────────────────────────────────────
describe('reviewT003 — อาจารย์ที่ปรึกษาสหกิจตรวจ T003', () => {
  const req = (body) => ({ user: { id: 30, role: 'teacher' }, body: { studentId: 5, status: 'T003_APPROVED', ...body } });
  const setup = ({ advisor = 3, coopStatus = 'T003_SUBMITTED', doc = { id: 77 } } = {}) => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 3 });
    prisma.student.findUnique.mockImplementation(async ({ select }) =>
      select?.userId ? { userId: 50 } : { id: 5, deletedAt: null, coopAdvisorId: advisor });
    prisma.studentCoop.findUnique.mockResolvedValue(coopStatus ? { status: coopStatus } : null);
    prisma.document.findFirst.mockResolvedValue(doc);
  };

  test('ผ่าน → สถานะ T003_APPROVED + ไฟล์ล่าสุด APPROVED + แจ้งนักศึกษา', async () => {
    setup();
    const res = makeRes();
    await reviewT003(req(), res);
    expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 5 }, data: { status: 'T003_APPROVED' } });
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 77 }, data: { status: 'APPROVED', rejectReason: null } });
    await flush();
    expect(createNotifications).toHaveBeenCalledWith([50], expect.objectContaining({ type: 'T003_REVIEWED', message: expect.stringContaining('ผ่าน') }));
  });

  test('ให้แก้ไข → T003_EDITS_REQUIRED + ไฟล์ REJECTED พร้อมเหตุผล', async () => {
    setup();
    const res = makeRes();
    await reviewT003(req({ status: 'T003_EDITS_REQUIRED', comment: 'แก้บทที่ 2' }), res);
    expect(prisma.studentCoop.update.mock.calls[0][0].data).toEqual({ status: 'T003_EDITS_REQUIRED' });
    expect(prisma.document.update.mock.calls[0][0].data).toEqual({ status: 'REJECTED', rejectReason: 'แก้บทที่ 2' });
  });

  test('ไม่ใช่อาจารย์ที่ปรึกษาสหกิจของนักศึกษา → 403 ไม่แก้อะไร', async () => {
    setup({ advisor: 99 });
    const res = makeRes();
    await reviewT003(req(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('ยังไม่ได้ส่ง T003 (สถานะอื่น) → 400', async () => {
    setup({ coopStatus: 'T002_SUBMITTED' });
    const res = makeRes();
    await reviewT003(req(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test.each([['status ที่ไม่อนุญาต', { status: 'COMPLETED' }], ['studentId ไม่ใช่ตัวเลข', { studentId: 'abc' }]])('%s → 400', async (_n, body) => {
    setup();
    const res = makeRes();
    await reviewT003(req(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ผู้ใช้ไม่มีข้อมูลอาจารย์ (เช่น เจ้าหน้าที่) → 403', async () => {
    setup();
    prisma.teacher.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await reviewT003({ user: { id: 1, role: 'staff' }, body: { studentId: 5, status: 'T003_APPROVED' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────
describe('แบบประเมินการนิเทศ', () => {
  const appt = (id, over = {}) => ({
    id, status: 'LETTER_UPLOADED', confirmedDate: new Date('2026-12-01T02:00:00Z'), coTeacherName: '', evalSentAt: null, teacherId: 3,
    teacher: { prefix: 'อ.', firstName: 'หลัก', lastName: 'นิเทศ' }, coTeachers: [],
    student: { studentId: `6500${id}`, firstName: 'นศ', lastName: String(id), major: 'CS', coop: { coopPeriodId: 2, company: { name: 'บ.' } } },
    ...over,
  });

  test('รายการ (อาจารย์ประจำวิชา) → เฉพาะหลักสูตรที่ดูแล + บอกว่าหลักสูตรมีลิงก์แล้วหรือยัง', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ coopMajors: [{ major: 'CS' }] });
    prisma.supervisionAppointment.findMany.mockResolvedValue([appt(1), appt(2, { student: { ...appt(2).student, major: 'AI' } })]);
    evalUtil.getEvalConfig.mockImplementation(async (_db, major) => ({ evalLink: major === 'CS' ? 'https://forms.example/cs' : null }));
    const res = makeRes();
    await listEvalAppointments({ user: { id: 20, role: 'teacher' }, method: 'GET', get: () => '' }, res);
    expect(prisma.supervisionAppointment.findMany.mock.calls[0][0].where.student).toMatchObject({ deletedAt: null, major: { in: ['CS'] } });
    const rows = res.json.mock.calls[0][0].appointments;
    expect(rows.map((r) => [r.id, r.hasLink])).toEqual([[1, true], [2, false]]);
  });

  test('ส่งลิงก์: ไม่เลือกรายการ → 400 · มีนัดนอกหลักสูตร → 403 ไม่ส่งเลย · ในหลักสูตรครบ → ส่ง', async () => {
    let res = makeRes();
    await sendEval({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ids: [] }, get: () => '' }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    prisma.teacher.findUnique.mockResolvedValue({ coopMajors: [{ major: 'CS' }] });
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 1 }]); // ในขอบเขตแค่ 1 จาก 2
    res = makeRes();
    await sendEval({ user: { id: 20, role: 'teacher' }, method: 'POST', body: { ids: [1, 2] }, get: () => '' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(evalUtil.sendEvalForAppointments).not.toHaveBeenCalled();

    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    evalUtil.sendEvalForAppointments.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    res = makeRes();
    await sendEval({ user: { id: 20, role: 'teacher' }, method: 'POST', body: { ids: [1, '2'] }, get: () => '' }, res);
    expect(evalUtil.sendEvalForAppointments).toHaveBeenCalledWith([1, 2]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, sent: 2 }));
  });

  test('ฝั่งอาจารย์: นัดที่ส่งลิงก์ให้ฉันแล้ว (หลัก/ร่วม) จัดกลุ่มตามลิงก์ · หลักสูตรไม่มีลิงก์ไม่แสดง', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 3 });
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      appt(1, { evalSentAt: new Date() }),
      appt(2, { evalSentAt: new Date(), teacherId: 9, coTeachers: [{ teacherId: 3, teacher: {} }] }),
      appt(3, { evalSentAt: new Date(), student: { ...appt(3).student, major: 'AI' } }),
    ]);
    evalUtil.getEvalConfig.mockImplementation(async (_db, major) => ({ evalLink: major === 'CS' ? 'https://forms.example/cs' : null, instructionText: 'กรอกภายใน 7 วัน' }));
    const res = makeRes();
    await getMyEval({ user: { id: 30, role: 'teacher' } }, res);
    const where = prisma.supervisionAppointment.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ teacherId: 3 }, { coTeachers: { some: { teacherId: 3 } } }]);
    expect(where.evalSentAt).toEqual({ not: null });
    const { groups } = res.json.mock.calls[0][0];
    expect(groups).toHaveLength(1);
    expect(groups[0].evalLink).toBe('https://forms.example/cs');
    expect(groups[0].appointments.map((a) => [a.id, a.isPrimary])).toEqual([[1, true], [2, false]]);
  });

  test('ผู้ใช้ไม่มีข้อมูลอาจารย์ → รายการว่าง (ไม่ error)', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await getMyEval({ user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, groups: [] });
  });

  test('ตั้งค่ากลาง: ลิงก์ที่ไม่ใช่ http/https → 400 · ค่าปกติ → บันทึก (ตัดข้อความยาว, autoSend ต้องเป็น true จริง)', async () => {
    let res = makeRes();
    await updateSupervisionEvalConfig({ body: { evalLink: 'javascript:alert(1)' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();

    res = makeRes();
    await updateSupervisionEvalConfig({ body: { evalLink: 'https://forms.example/x', instructionText: 'ก'.repeat(3000), autoSend: 'true' } }, res);
    const saved = JSON.parse(prisma.systemConfig.upsert.mock.calls[0][0].update.value);
    expect(saved).toEqual({ evalLink: 'https://forms.example/x', instructionText: 'ก'.repeat(2000), autoSend: false });
  });
});

// ─────────────────────────────────────────────
describe('จำนวนแจ้งเตือน (ป้ายตัวเลขบนเมนู)', () => {
  test('ยังไม่อ่านทั้งหมด — เฉพาะของผู้ใช้คนนี้', async () => {
    prisma.notification.count.mockResolvedValue(3);
    const res = makeRes();
    await getUnreadCount({ userId: 7 }, res);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 7, isRead: false } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, count: 3 });
  });

  test('แยกตามชนิด (แต่ละเมนู)', async () => {
    prisma.notification.findMany.mockResolvedValue([{ type: 'T002_SUBMITTED' }, { type: 'T002_SUBMITTED' }, { type: 'SUPERVISION_LETTER_UPLOADED' }]);
    const res = makeRes();
    await getCounts({ userId: 7 }, res);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 7, isRead: false });
    expect(res.json).toHaveBeenCalledWith({ ok: true, counts: { T002_SUBMITTED: 2, SUPERVISION_LETTER_UPLOADED: 1 } });
  });

  test('DB ล่ม → 500 แต่ยังตอบรูปแบบเดิม (หน้าเว็บไม่พัง)', async () => {
    prisma.notification.count.mockRejectedValue(new Error('down'));
    const res = makeRes();
    await getUnreadCount({ userId: 7 }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, count: 0 });
  });
});
