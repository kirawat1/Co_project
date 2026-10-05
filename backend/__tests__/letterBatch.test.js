// __tests__/letterBatch.test.js — หนังสือรวมหลายคน (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศของกลุ่ม)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue(), getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([]) }));

const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { issueLetterBatch, markLetterPending } = require('../controllers/adminDocController');
const { uploadOfficialLetter } = require('../controllers/supervisionController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), locals: {} });
const file = { filename: 'batch-signed.pdf', originalname: 'signed.pdf' };
const coop = (studentId, status, over = {}) => ({
  studentId, status, companyId: 'c1', reqLetterUrl: null, placeLetterUrl: null,
  actualStartDate: new Date('2026-11-01'), actualEndDate: new Date('2027-02-28'),
  student: { deletedAt: null, studentId: `65000000${studentId}`, firstName: 'ชื่อ', lastName: `${studentId}`, coopApplicationForm: null },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
  prisma.studentCoop.findFirst.mockResolvedValue(null);
  prisma.studentCoop.update.mockResolvedValue({});
  prisma.document.findFirst.mockResolvedValue(null);
  prisma.document.create.mockResolvedValue({});
  prisma.student.findMany.mockResolvedValue([{ userId: 101 }, { userId: 102 }]);
});

describe('issueLetterBatch', () => {
  const req = (body) => ({ body: { letter: 'REQUEST', studentIds: '[1,2]', docNumber: 'ที่ อว 660301.26.6.2/500', docDate: '2026-10-05', deliveryMethod: 'STUDENT', ...body }, file, user: { id: 1, role: 'staff' } });

  test('ออกหนังสือขอความอนุเคราะห์รวม 2 คน → เลขที่เดียว ไฟล์เดียว batch เดียวกัน + แจ้งทุกคน', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'DOCS_APPROVED'), coop(2, 'DOCS_APPROVED')]);
    const res = makeRes();
    await issueLetterBatch(req(), res);
    expect(res.status).not.toHaveBeenCalled();
    const calls = prisma.studentCoop.update.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    const batch = calls[0].data.reqLetterBatch;
    expect(batch).toEqual(expect.any(String));
    for (const c of calls) {
      expect(c.data).toMatchObject({ reqDocNumber: '660301.26.6.2/500', reqLetterUrl: 'batch-signed.pdf', reqLetterBatch: batch, status: 'REQ_LETTER_ISSUED', reqLetterDelivery: 'STUDENT' });
    }
    // เลขที่ซ้ำ: ยกเว้นทั้ง 2 คนในฉบับ
    expect(prisma.studentCoop.findFirst.mock.calls[0][0].where.studentId).toEqual({ notIn: [1, 2] });
    await new Promise((r) => setImmediate(r));
    expect(createNotifications).toHaveBeenCalledWith([101, 102], expect.objectContaining({ message: expect.stringContaining('ออกหนังสือขอความอนุเคราะห์แล้ว') }));
  });

  test('หนังสือส่งตัว + เจ้าหน้าที่ส่งให้บริษัท → เริ่มฝึกงานเลย (เหมือนออกเดี่ยว)', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'ACCEPTANCE_CHECKED'), coop(2, 'ACCEPTANCE_CHECKED')]);
    const res = makeRes();
    await issueLetterBatch(req({ letter: 'PLACEMENT', deliveryMethod: 'STAFF' }), res);
    expect(prisma.studentCoop.update.mock.calls.map((c) => c[0].data.status)).toEqual(['INTERNSHIP_STARTED', 'INTERNSHIP_STARTED']);
    expect(prisma.studentCoop.update.mock.calls[0][0].data).toMatchObject({ placeDocNumber: '660301.26.6.2/500', placeLetterUrl: 'batch-signed.pdf' });
  });

  test('คนที่ผ่านขั้นนี้ไปแล้ว → เก็บหนังสือใหม่ แต่ไม่ย้อนสถานะ', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'DOCS_APPROVED'), coop(2, 'INTERNSHIP_STARTED')]);
    const res = makeRes();
    await issueLetterBatch(req(), res);
    const [a, b] = prisma.studentCoop.update.mock.calls.map((c) => c[0].data);
    expect(a.status).toBe('REQ_LETTER_ISSUED');
    expect(b).not.toHaveProperty('status');
    expect(res.json.mock.calls[0][0].students).toEqual([{ studentId: 1, statusKept: false }, { studentId: 2, statusKept: true }]);
  });

  test.each([
    ['คนละบริษัท', [coop(1, 'DOCS_APPROVED'), coop(2, 'DOCS_APPROVED', { companyId: 'c2' })], {}],
    ['ยังไม่ถึงขั้นออกหนังสือ', [coop(1, 'DOCS_APPROVED'), coop(2, 'QUALIFIED')], {}],
    ['คนเดียว', [coop(1, 'DOCS_APPROVED')], { studentIds: '[1]' }],
    ['เลขที่ยังเป็นเทมเพลต', [coop(1, 'DOCS_APPROVED'), coop(2, 'DOCS_APPROVED')], { docNumber: '660301.26.6.2/' }],
  ])('400 — %s', async (_n, coops, body) => {
    prisma.studentCoop.findMany.mockResolvedValue(coops);
    const res = makeRes();
    await issueLetterBatch(req(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('เลขที่ซ้ำกับหนังสือของคนนอกฉบับ → 409', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'DOCS_APPROVED'), coop(2, 'DOCS_APPROVED')]);
    prisma.studentCoop.findFirst.mockResolvedValue({ reqDocNumber: '660301.26.6.2/500', student: { studentId: '650000009', firstName: 'ก', lastName: 'ข' } });
    const res = makeRes();
    await issueLetterBatch(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('หนังสือส่งตัว: มีคนไม่มีวันฝึก (ทั้งวันฝึกจริงและใบสมัคร) → 400 บอกชื่อ ไม่บันทึก', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([
      coop(1, 'ACCEPTANCE_CHECKED'),
      coop(2, 'ACCEPTANCE_CHECKED', { actualStartDate: null, actualEndDate: null }),
    ]);
    const res = makeRes();
    await issueLetterBatch(req({ letter: 'PLACEMENT' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('650000002');
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('หนังสือส่งตัว: ไม่มีวันฝึกจริง แต่มีวันในใบสมัคร → ออกได้', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([
      coop(1, 'ACCEPTANCE_CHECKED'),
      coop(2, 'ACCEPTANCE_CHECKED', {
        actualStartDate: null, actualEndDate: null,
        student: { deletedAt: null, studentId: '650000002', firstName: 'ข', lastName: 'ค', coopApplicationForm: { startDate: new Date('2026-11-01'), endDate: new Date('2027-02-28') } },
      }),
    ]);
    const res = makeRes();
    await issueLetterBatch(req({ letter: 'PLACEMENT' }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.studentCoop.update).toHaveBeenCalledTimes(2);
  });

  test('หนังสือขอความอนุเคราะห์ไม่ต้องมีวันฝึก', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'DOCS_APPROVED', { actualStartDate: null, actualEndDate: null }), coop(2, 'DOCS_APPROVED')]);
    const res = makeRes();
    await issueLetterBatch(req(), res);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ออกหนังสือเลขเดียวกันพร้อมกัน — ทดสอบจริงกับ MySQL ด้วยสคริปต์ race (ยิง 2 คำขอพร้อมกัน 10 รอบ ได้ 200+409 ทุกรอบ)
// ที่นี่ตรวจเงื่อนไขที่ทำให้กันได้: ล็อกเลขที่ก่อนตรวจซ้ำ + transaction READ COMMITTED
describe('ล็อกเลขที่หนังสือ (กันออกเลขเดียวกันพร้อมกัน)', () => {
  const { DOC_NUMBER_TX } = require('../utils/docNumberLock');
  const order = () => {
    const seq = [];
    prisma.$executeRaw.mockImplementation(async () => { seq.push('lock'); return 1; });
    prisma.studentCoop.findFirst.mockImplementation(async () => { seq.push('check'); return null; });
    prisma.supervisionAppointment.findFirst.mockImplementation(async () => { seq.push('check'); return null; });
    return seq;
  };

  test('หนังสือรวม: ล็อก (REQ, เลขที่) ก่อนตรวจซ้ำ · transaction READ COMMITTED', async () => {
    const seq = order();
    prisma.studentCoop.findMany.mockResolvedValue([coop(1, 'DOCS_APPROVED'), coop(2, 'DOCS_APPROVED')]);
    await issueLetterBatch({ body: { letter: 'REQUEST', studentIds: '[1,2]', docNumber: '660301.26.6.2/700' }, file, user: { id: 1, role: 'staff' } }, makeRes());
    expect(seq.slice(0, 2)).toEqual(['lock', 'check']);
    const [, kind, number] = prisma.$executeRaw.mock.calls[0];
    expect([kind, number]).toEqual(['reqLetter', '660301.26.6.2/700']);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual(DOC_NUMBER_TX);
    expect(DOC_NUMBER_TX.isolationLevel).toBe('ReadCommitted');
  });

  test('บันทึกร่างรอลงนาม: ล็อกเลขที่ร่างก่อนตรวจซ้ำ', async () => {
    const seq = order();
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'DOCS_APPROVED' });
    await markLetterPending({ body: { studentIds: [1, 2], letter: 'REQUEST', docNumber: '660301.26.6.2/701' } }, makeRes());
    expect(seq.slice(0, 2)).toEqual(['lock', 'check']);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual(DOC_NUMBER_TX);
  });

  test('หนังสือขอนิเทศ: ล็อก (supervisionLetter, เลขที่) ก่อนตรวจซ้ำ', async () => {
    const seq = order();
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 10, status: 'DATE_CONFIRMED', studentId: 1 });
    prisma.supervisionAppointment.update.mockImplementation(async ({ where, data }) => ({ id: where.id, studentId: where.id, ...data }));
    prisma.student.findUnique.mockResolvedValue({ userId: 9 });
    await uploadOfficialLetter({ params: { id: '10' }, body: { docNumber: '660301.26.6.2/702' }, file: { filename: 'sup.pdf' }, user: { id: 1, role: 'staff' } }, makeRes());
    expect(seq.slice(0, 2)).toEqual(['lock', 'check']);
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['supervisionLetter', '660301.26.6.2/702']);
  });
});

describe('markLetterPending — หนังสือรวม', () => {
  test('studentIds หลายคน → ขึ้นรอลงนามทุกคน เลขที่ร่างเดียวกัน', async () => {
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'DOCS_APPROVED' });
    const res = makeRes();
    await markLetterPending({ body: { studentIds: [3, 4], letter: 'REQUEST', docNumber: '660301.26.6.2/600' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.studentCoop.update.mock.calls.map((c) => [c[0].where.studentId, c[0].data.reqLetterDraftNumber])).toEqual([[3, '660301.26.6.2/600'], [4, '660301.26.6.2/600']]);
    expect(prisma.studentCoop.findFirst.mock.calls[0][0].where.studentId).toEqual({ notIn: [3, 4] });
  });
});

describe('uploadOfficialLetter — หนังสือขอนิเทศรวมของกลุ่ม', () => {
  const req = (appointmentIds) => ({ params: { id: '10' }, body: { docNumber: '660301.26.6.2/700', appointmentIds }, file: { filename: 'sup.pdf' }, user: { id: 1, role: 'staff' } });

  test('นัด 2 นัดในกลุ่มเดียวกัน → ไฟล์/เลขที่เดียวกันทั้งคู่', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 10, groupId: 'g1' }, { id: 11, groupId: 'g1' }]);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 10, status: 'DATE_CONFIRMED', studentId: 1 });
    prisma.supervisionAppointment.findFirst.mockResolvedValue(null);
    prisma.supervisionAppointment.update.mockImplementation(async ({ where, data }) => ({ id: where.id, studentId: where.id, ...data }));
    prisma.student.findUnique.mockResolvedValue({ userId: 9 });
    const res = makeRes();
    await uploadOfficialLetter(req('[11]'), res);
    expect(res.status).not.toHaveBeenCalled();
    const updates = prisma.supervisionAppointment.update.mock.calls.map((c) => [c[0].where.id, c[0].data.officialLetterPath, c[0].data.letterDocNumber]);
    expect(updates).toEqual([[10, 'sup.pdf', '660301.26.6.2/700'], [11, 'sup.pdf', '660301.26.6.2/700']]);
    expect(prisma.supervisionAppointment.findFirst.mock.calls[0][0].where.id).toEqual({ notIn: [10, 11] });
  });

  test('นัดคนละกลุ่ม → 400 ไม่บันทึก', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 10, groupId: 'g1' }, { id: 11, groupId: 'g2' }]);
    const res = makeRes();
    await uploadOfficialLetter(req('[11]'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });
});
