// __tests__/supervisionController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  getSupervisionPeriods,
  saveSupervisionPeriod,
  getAllSupervisions,
  uploadOfficialLetter,
  markSupervisionLetterPending,
  getStudentSupervision,
  proposeSupervisionDate,
  reviewSupervision,
  getSupervisionCalendar,
  getSupervisionsForTeacher,
} = require('../controllers/supervisionController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// ===========================
// getSupervisionPeriods / saveSupervisionPeriod — ช่วงนิเทศแยกหลักสูตร (CoopPeriodMajor)
// ===========================
const pRow = (periodId, major, over = {}) => ({ periodId, major, startDate: new Date('2026-01-01'), endDate: new Date(Date.now() + 86400000), isActive: false, supervisionStartDate: null, supervisionEndDate: null, isSupervisionOpen: false, ...over });
describe('getSupervisionPeriods', () => {
  test('อาจารย์ประจำวิชา CS — ค่าระดับบน = ช่วงนิเทศของ CS', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
    prisma.coopPeriod.findMany.mockResolvedValue([{ id: 1, academicYear: '2569', semester: 1, startDate: new Date(), endDate: new Date(), majors: [pRow(1, 'AI', { isSupervisionOpen: true }), pRow(1, 'CS')] }]);
    const res = makeRes();
    await getSupervisionPeriods({ user: { id: 2, role: 'teacher' }, method: 'GET' }, res);
    expect(res.json.mock.calls[0][0].periods[0]).toMatchObject({ id: 1, major: 'CS', isSupervisionOpen: false });
  });

  test('500 — DB error returns server error', async () => {
    prisma.coopPeriod.findMany.mockRejectedValue(new Error('DB crash'));
    const res = makeRes();
    await getSupervisionPeriods({ user: { id: 1, role: 'staff' }, method: 'GET' }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('saveSupervisionPeriod', () => {
  const body = { periodId: '3', isSupervisionOpen: true, supervisionStartDate: '2024-01-01', supervisionEndDate: '2024-06-30' };

  test('เจ้าหน้าที่ระบุหลักสูตร → upsert แถวของหลักสูตรนั้น (ยังไม่มี = สร้างโดยใช้วันตั้งต้นของรอบ)', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 3, startDate: new Date('2024-01-01'), endDate: new Date('2024-02-01') });
    prisma.coopPeriod.findMany.mockResolvedValue([{ id: 3, academicYear: '2569', semester: 1, startDate: new Date(), endDate: new Date(), majors: [pRow(3, 'AI', { isSupervisionOpen: true })] }]);
    prisma.coopPeriodMajor.upsert.mockResolvedValue({});
    const res = makeRes();
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'AI' } }, res);
    expect(prisma.coopPeriodMajor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId_major: { periodId: 3, major: 'AI' } },
      update: expect.objectContaining({ isSupervisionOpen: true }),
      create: expect.objectContaining({ periodId: 3, major: 'AI', startDate: new Date('2024-01-01') }),
    }));
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, period: { major: 'AI', isSupervisionOpen: true } });
  });

  test('แถวหลักสูตรที่สร้างใหม่ได้กำหนดส่งตั้งต้นของวิทยาลัยติดไป (ปฏิทินของรอบ)', async () => {
    const college = { T002: { due: '2024-07-03', mode: 'HARD' } };
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 3, startDate: new Date('2024-01-01'), endDate: new Date('2024-02-01'), deadlines: college });
    prisma.coopPeriod.findMany.mockResolvedValue([{ id: 3, academicYear: '2569', semester: 1, startDate: new Date(), endDate: new Date(), majors: [pRow(3, 'AI')] }]);
    prisma.coopPeriodMajor.upsert.mockResolvedValue({});
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'AI' } }, makeRes());
    expect(prisma.coopPeriodMajor.upsert.mock.calls[0][0].create).toMatchObject({ deadlines: college });
    expect(prisma.coopPeriodMajor.upsert.mock.calls[0][0].update).not.toHaveProperty('deadlines');
  });

  test('เจ้าหน้าที่ไม่ระบุหลักสูตร → 400', async () => {
    const res = makeRes();
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.coopPeriodMajor.upsert).not.toHaveBeenCalled();
  });

  test('อาจารย์ประจำวิชา CS ตั้งของ AI → 403', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'CS' }] });
    const res = makeRes();
    await saveSupervisionPeriod({ user: { id: 2, role: 'teacher' }, method: 'POST', body: { ...body, major: 'AI' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // /scrutinize 2026-11-03: วันที่ผิดรูปแบบเดิมพังเป็น 500 · เริ่มหลังสิ้นสุดบันทึกได้ (ช่วงนี้บังคับวันที่นักศึกษาเสนอแล้ว = นัดไม่ได้ทั้งหลักสูตร)
  test.each([
    ['วันเริ่มผิดรูปแบบ', { supervisionStartDate: 'abc' }, /วันเริ่มนัดหมายนิเทศ/],
    ['วันสิ้นสุดผิดรูปแบบ', { supervisionEndDate: '2024-13-45' }, /วันสิ้นสุดนัดหมายนิเทศ/],
    ['เริ่มหลังสิ้นสุด', { supervisionStartDate: '2024-07-01', supervisionEndDate: '2024-06-30' }, /ต้องไม่หลังวันสิ้นสุด/],
  ])('400 — %s · ไม่บันทึก', async (_, over, msg) => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 3, startDate: new Date('2024-01-01'), endDate: new Date('2024-02-01') });
    const res = makeRes();
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'CS', ...over } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(msg);
    expect(prisma.coopPeriodMajor.upsert).not.toHaveBeenCalled();
  });

  test('วันเริ่ม = วันสิ้นสุด (นิเทศวันเดียว) บันทึกได้ · ล้างวันได้ (ค่าว่าง = ไม่ตั้ง)', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 3, startDate: new Date('2024-01-01'), endDate: new Date('2024-02-01') });
    prisma.coopPeriod.findMany.mockResolvedValue([{ id: 3, academicYear: '2569', semester: 1, startDate: new Date(), endDate: new Date(), majors: [pRow(3, 'CS')] }]);
    prisma.coopPeriodMajor.upsert.mockResolvedValue({});
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'CS', supervisionStartDate: '2024-06-30', supervisionEndDate: '2024-06-30' } }, makeRes());
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'CS', supervisionStartDate: '', supervisionEndDate: null } }, makeRes());
    expect(prisma.coopPeriodMajor.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.coopPeriodMajor.upsert.mock.calls[1][0].update).toMatchObject({ supervisionStartDate: null, supervisionEndDate: null });
  });

  test('500 — DB error returns server error', async () => {
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 1, startDate: new Date(), endDate: new Date() });
    prisma.coopPeriodMajor.upsert.mockRejectedValue(new Error('DB crash'));
    const res = makeRes();
    await saveSupervisionPeriod({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, major: 'CS' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ===========================
// getAllSupervisions
// ===========================
// ── หน้านิเทศกรองรอบที่ server (เดิมโหลดทุกรอบ) ──
describe('getAllSupervisions — กรองรอบ', () => {
  const appt = (id, over = {}) => ({ id, status: 'DATE_CONFIRMED', groupId: null, student: { major: 'CS', coop: { coopPeriodId: 2 } }, teacher: null, coTeachers: [], ...over });
  beforeEach(() => prisma.coopCriteria.findMany.mockResolvedValue([]));

  test('coopPeriodId → เงื่อนไขรอบรวมกับขอบเขตหลักสูตร · ค่าผิด 400', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    await getAllSupervisions({ user: { role: 'staff' }, query: { coopPeriodId: '2' } }, makeRes());
    expect(prisma.supervisionAppointment.findMany.mock.calls[0][0].where.student.AND).toContainEqual({ coop: { coopPeriodId: 2 } });
    const res = makeRes();
    await getAllSupervisions({ user: { role: 'staff' }, query: { coopPeriodId: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test.each([
    ['letter', [{ coopPeriodId: 2, count: 3, pending: 1 }]],     // ยืนยันวันแล้ว ยังไม่โหลดร่างหนังสือ
    ['coteacher', [{ coopPeriodId: 2, count: 3, pending: 2 }]],  // ยังไม่มีอาจารย์ร่วม
  ])('countsOnly pending=%s', async (pending, expected) => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { status: 'DATE_CONFIRMED', letterPendingAt: null, coTeacherName: null, student: { coop: { coopPeriodId: 2 } } },
      { status: 'DATE_CONFIRMED', letterPendingAt: new Date(), coTeacherName: 'อ.ร่วม', student: { coop: { coopPeriodId: 2 } } },
      { status: 'PENDING_TEACHER', letterPendingAt: null, coTeacherName: null, student: { coop: { coopPeriodId: 2 } } },
    ]);
    const res = makeRes();
    await getAllSupervisions({ user: { role: 'staff' }, query: { countsOnly: '1', pending } }, res);
    expect(res.json.mock.calls[0][0].periods).toEqual(expected);
  });

  test('กรองรอบแล้ว: นัดกลุ่มเดียวกัน (หนังสือรวม) ที่อยู่นอกรอบมาด้วย ติด outsidePeriod', async () => {
    const a = appt(1, { groupId: 'G1' });
    const b = appt(2, { groupId: 'G1', student: { major: 'CS', coop: { coopPeriodId: 1 } } });
    prisma.supervisionAppointment.findMany.mockResolvedValueOnce([a]).mockResolvedValueOnce([a, b]);
    const res = makeRes();
    await getAllSupervisions({ user: { role: 'staff' }, query: { coopPeriodId: '2' } }, res);
    expect(prisma.supervisionAppointment.findMany.mock.calls[1][0].where.groupId).toEqual({ in: ['G1'] });
    expect(res.json.mock.calls[0][0].supervisions.map((x) => [x.id, !!x.outsidePeriod])).toEqual([[1, false], [2, true]]);
  });
});

describe('getSupervisionCalendar — ลิงก์ออนไลน์เฉพาะคนที่เห็นในรายการนัดของตัวเองอยู่แล้ว', () => {
  const ev = (id, over = {}) => ({
    id, confirmedDate: new Date('2026-10-20T02:00:00Z'), confirmedEndDate: null, proposedDates: null, supervisionType: 'ONLINE',
    status: 'DATE_CONFIRMED', onlineLink: `https://meet/${id}`, coTeacherName: null, groupId: null, teacherId: 10, coTeachers: [],
    teacher: { prefix: '', firstName: 'ครู', lastName: 'หนึ่ง' }, student: { studentId: `S${id}`, firstName: 'ก', lastName: 'ข', major: 'CS', coop: null }, ...over,
  });
  const links = (res) => Object.fromEntries(res.json.mock.calls[0][0].events.map((e) => [e.id, e.onlineLink]));

  test('เจ้าหน้าที่ → เห็นลิงก์', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([ev(1)]);
    const res = makeRes();
    await getSupervisionCalendar({ user: { id: 1, role: 'staff' }, method: 'GET', get: () => '' }, res);
    expect(links(res)).toEqual({ 1: 'https://meet/1' });
  });

  test('อาจารย์ → นัดของตัวเอง (หลัก/ร่วม) เห็นลิงก์ · นัดของคนอื่นในหลักสูตรไม่เห็น', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 10, major: 'CS', isCoopTeacher: false, coopMajors: [] });
    prisma.supervisionAppointment.findMany.mockResolvedValue([ev(1), ev(2, { teacherId: 11 }), ev(3, { teacherId: 11, coTeachers: [{ teacherId: 10 }] })]);
    const res = makeRes();
    await getSupervisionCalendar({ user: { id: 5, role: 'teacher' }, method: 'GET', get: () => '' }, res);
    expect(links(res)).toEqual({ 1: 'https://meet/1', 2: undefined, 3: 'https://meet/3' });
  });

  test('นักศึกษา → ไม่ส่งลิงก์ในปฏิทิน', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 3, major: 'CS' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([ev(1)]);
    const res = makeRes();
    await getSupervisionCalendar({ user: { id: 7, role: 'student' }, method: 'GET', get: () => '' }, res);
    expect(links(res)).toEqual({ 1: undefined });
  });
});

describe('getAllSupervisions', () => {
  test('200 — returns supervisions array with student.majorNameTh resolved', async () => {
    const supervisions = [
      { id: 1, status: 'PENDING_TEACHER', student: { firstName: 'ก', lastName: 'ข', major: 'CS' }, teacher: { id: 5 } },
      { id: 2, status: 'DATE_CONFIRMED', student: { firstName: 'ค', lastName: 'ง', major: null }, teacher: { id: 6 } },
    ];
    prisma.supervisionAppointment.findMany.mockResolvedValue(supervisions);
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);

    const res = makeRes();
    await getAllSupervisions({}, res);

    // หนังสือนิเทศต้องใช้ชื่อหลักสูตรภาษาไทยจริง ไม่ใช่ฮาร์ดโค้ด — major เป็นรหัส (CS) ต้อง resolve เป็นชื่อไทย
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      supervisions: [
        { id: 1, status: 'PENDING_TEACHER', student: { firstName: 'ก', lastName: 'ข', major: 'CS', majorNameTh: 'วิทยาการคอมพิวเตอร์' }, teacher: { id: 5 }, coTeachers: [] },
        { id: 2, status: 'DATE_CONFIRMED', student: { firstName: 'ค', lastName: 'ง', major: null, majorNameTh: null }, teacher: { id: 6 }, coTeachers: [] },
      ],
    });
  });

  test('500 — DB error returns server error', async () => {
    prisma.supervisionAppointment.findMany.mockRejectedValue(new Error('DB crash'));

    const res = makeRes();
    await getAllSupervisions({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ===========================
// uploadOfficialLetter
// ===========================
describe('uploadOfficialLetter', () => {
  test('400 — no req.file returns error', async () => {
    const req = { params: { id: '1' }, file: undefined };
    const res = makeRes();
    await uploadOfficialLetter(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('200 — success updates appointment', async () => {
    const appointment = { id: 1, officialLetterPath: 'letter.pdf', status: 'LETTER_UPLOADED' };
    // Controller now uses $transaction: findUnique first to check status, then update
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 1, status: 'DATE_CONFIRMED' });
    prisma.supervisionAppointment.update.mockResolvedValue(appointment);
    // Notify student after update (student.findUnique inside .then — won't block test)
    prisma.student.findUnique.mockResolvedValue(null);

    const req = {
      params: { id: '1' },
      file: { filename: 'letter.pdf' },
    };
    const res = makeRes();
    await uploadOfficialLetter(req, res);

    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ officialLetterPath: 'letter.pdf', status: 'LETTER_UPLOADED' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, appointment, appointmentIds: [1] });
  });

  describe('เลขที่/วันที่หนังสือ + ป้ายรอลงนาม', () => {
    const file = { filename: 'SUPERVISION_LETTER_zz.pdf' };
    beforeEach(() => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 1, status: 'DATE_CONFIRMED' });
      prisma.supervisionAppointment.findFirst.mockResolvedValue(null);
      prisma.supervisionAppointment.update.mockResolvedValue({ id: 1, studentId: 10 });
      prisma.student.findUnique.mockResolvedValue(null);
    });

    test('200 — เก็บเลขที่ (ตัด "ที่ อว") + วันที่ และล้างป้ายรอลงนาม', async () => {
      const res = makeRes();
      await uploadOfficialLetter({ params: { id: '1' }, file, body: { docNumber: 'ที่ อว 660301.26.6.2/777', docDate: '2026-09-15' } }, res);

      expect(res.status).not.toHaveBeenCalled();
      const { data } = prisma.supervisionAppointment.update.mock.calls[0][0];
      expect(data).toMatchObject({
        officialLetterPath: file.filename, status: 'LETTER_UPLOADED', letterDocNumber: '660301.26.6.2/777',
        letterPendingAt: null, letterDraftNumber: null, letterDraftDate: null,
      });
      expect(data.letterDocDate.toISOString().slice(0, 10)).toBe('2026-09-15');
      expect(prisma.supervisionAppointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: { notIn: [1] } });
    });

    test('400 — เลขที่ยังเป็นเทมเพลต → ไม่บันทึก', async () => {
      const res = makeRes();
      await uploadOfficialLetter({ params: { id: '1' }, file, body: { docNumber: '660301.26.6.2/' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
    });

    test('400 — วันที่ผิดรูปแบบ → ไม่บันทึก', async () => {
      const res = makeRes();
      await uploadOfficialLetter({ params: { id: '1' }, file, body: { docNumber: '660301.26.6.2/778', docDate: 'nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
    });

    test('409 — เลขที่ซ้ำกับหนังสือขอนิเทศของนักศึกษาคนอื่น', async () => {
      prisma.supervisionAppointment.findFirst.mockResolvedValue({
        letterDocNumber: '660301.26.6.2/777', letterDraftNumber: null,
        student: { studentId: '663380222-2', firstName: 'ก', lastName: 'ข' },
      });
      const res = makeRes();
      await uploadOfficialLetter({ params: { id: '1' }, file, body: { docNumber: '660301.26.6.2/777' } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json.mock.calls[0][0].message).toMatch(/663380222-2/);
      expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
    });
  });
});

// ===========================
// markSupervisionLetterPending — ดาวน์โหลดร่างหนังสือขอนิเทศไปเสนอลงนาม
// ===========================
describe('markSupervisionLetterPending', () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ status: 'DATE_CONFIRMED', student: { deletedAt: null } });
    prisma.supervisionAppointment.findFirst.mockResolvedValue(null);
    prisma.supervisionAppointment.update.mockResolvedValue({});
  });

  test('200 — บันทึกเวลา + เลขที่/วันที่ร่าง', async () => {
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { docNumber: 'อว 660301.26.6.2/900', docDate: '2026-09-20' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    const { where, data } = prisma.supervisionAppointment.update.mock.calls[0][0];
    expect(where).toEqual({ id: 5 });
    expect(data.letterPendingAt).toBeInstanceOf(Date);
    expect(data.letterDraftNumber).toBe('660301.26.6.2/900');
    expect(data.letterDraftDate.toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, draftNumber: '660301.26.6.2/900' });
  });

  test('200 — เลขที่ยังเป็นเทมเพลต → ขึ้นรอลงนาม ไม่เก็บเลขที่ ไม่เช็คซ้ำ', async () => {
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { docNumber: '660301.26.6.2/' } }, res);
    const { data } = prisma.supervisionAppointment.update.mock.calls[0][0];
    expect(data.letterPendingAt).toBeInstanceOf(Date);
    expect(data.letterDraftNumber).toBeNull();
    expect(data.letterDraftDate).toBeNull();
    expect(prisma.supervisionAppointment.findFirst).not.toHaveBeenCalled();
  });

  test('409 — เลขที่ซ้ำกับร่างที่รอลงนามของคนอื่น', async () => {
    prisma.supervisionAppointment.findFirst.mockResolvedValue({
      letterDocNumber: null, letterDraftNumber: '660301.26.6.2/900',
      student: { studentId: '663380333-3', firstName: 'ค', lastName: 'ง' },
    });
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { docNumber: '660301.26.6.2/900' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/รอลงนาม/);
    expect(prisma.supervisionAppointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: { notIn: [5] } });
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test.each(['PENDING_TEACHER', 'TEACHER_REJECTED', 'LETTER_UPLOADED', 'COMPLETED'])(
    '400 — สถานะ %s ไม่ใช่ช่วงออกหนังสือ',
    async (status) => {
      prisma.supervisionAppointment.findUnique.mockResolvedValue({ status, student: { deletedAt: null } });
      const res = makeRes();
      await markSupervisionLetterPending({ params: { id: '5' }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
    },
  );

  test('200 — cancel ล้างป้าย (ไม่ต้องเช็คสถานะ)', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ status: 'LETTER_UPLOADED', student: { deletedAt: null } });
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { cancel: true } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.supervisionAppointment.update.mock.calls[0][0].data).toEqual({ letterPendingAt: null, letterDraftNumber: null, letterDraftDate: null });
  });

  test.each([
    [{ params: { id: 'abc' }, body: {} }, 400],
    [{ params: { id: '5' }, body: { docDate: 'not-a-date' } }, 400],
  ])('400 — ข้อมูลไม่ถูกต้อง %#', async (req, code) => {
    const res = makeRes();
    await markSupervisionLetterPending(req, res);
    expect(res.status).toHaveBeenCalledWith(code);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test.each([null, { status: 'DATE_CONFIRMED', student: { deletedAt: new Date() } }])('404 — ไม่พบนัดหมาย / นักศึกษาอยู่ในถังขยะ', async (found) => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(found);
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ===========================
// getStudentSupervision
// ===========================
describe('getStudentSupervision', () => {
  test('404 — student not found', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { user: { id: 99 } };
    const res = makeRes();
    await getStudentSupervision(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — returns appointment for existing student, supervisionPeriod null when no coopPeriodId', async () => {
    const student = { id: 10, userId: 1, major: 'CS', coop: { coopPeriodId: null } };
    const appointment = { id: 5, studentId: 10, status: 'PENDING_TEACHER' };
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appointment);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getStudentSupervision(req, res);

    expect(prisma.supervisionAppointment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: student.id } })
    );
    expect(prisma.coopPeriod.findUnique).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, appointment, supervisionPeriod: null });
  });

  // นักศึกษาต้องดูรอบสหกิจของตัวเอง (StudentCoop.coopPeriodId) ไม่ใช่ "รอบรับสมัครที่เปิดอยู่ตอนนี้"
  // — isActive ปิดอัตโนมัติเมื่อหมดเขตรับสมัคร แต่ นศ. เริ่มนัดนิเทศตอนฝึกงานไปแล้วครึ่งทาง ซึ่งรอบ
  // รับสมัครของรุ่นตัวเองมักปิดไปนานแล้วเป็นปกติ (ดู CHANGELOG 2026-09-07)
  test('200 — fetches supervisionPeriod via student.coop.coopPeriodId when set', async () => {
    const student = { id: 10, userId: 1, major: 'CS', coop: { coopPeriodId: 2 } };
    const appointment = { id: 5, studentId: 10, status: 'PENDING_TEACHER' };
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appointment);
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2, academicYear: '2569', semester: 2 });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', startDate: null, endDate: null, isActive: false, supervisionStartDate: null, supervisionEndDate: null, isSupervisionOpen: true });

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getStudentSupervision(req, res);

    // ช่วงนิเทศ = แถวหลักสูตรของนักศึกษา (CS) ในรอบของตัวเอง
    expect(prisma.coopPeriodMajor.findUnique).toHaveBeenCalledWith({ where: { periodId_major: { periodId: 2, major: 'CS' } } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, appointment, supervisionPeriod: { id: 2, major: 'CS', isSupervisionOpen: true } });
  });
});

// ===========================
// proposeSupervisionDate
// ===========================
describe('proposeSupervisionDate', () => {
  const student = { id: 10, userId: 1, deletedAt: null, coopAdvisorId: 5, major: 'CS', coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } };
  const teacher = { id: 5, userId: 2 };
  const openPeriod = { id: 2, isSupervisionOpen: true };
  // วันที่เสนอ = อีก 10 วัน (เดิมตั้งเป็นวันที่ตายตัว — พอวันนั้นผ่านไป เทสต์ 200 จะกลายเป็น "วันที่ผ่านมาแล้ว")
  const FUTURE = new Date(Date.now() + 10 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const dayAt = (n) => new Date(Date.now() + n * 86400000);
  const wrote = () => prisma.supervisionAppointment.create.mock.calls.length + prisma.supervisionAppointment.updateMany.mock.calls.length;

  function baseReq(body) {
    return { user: { id: 1 }, body: { proposedDates: JSON.stringify([`${FUTURE}|09:00|ONSITE`]), supervisionType: 'ONSITE', ...body } };
  }

  // ช่วงนิเทศแยกหลักสูตร — ยังไม่ระบุหลักสูตร = นัดไม่ได้ ต้องบอกสาเหตุจริง (เดิมขึ้น "ระบบยังไม่เปิด" ทำให้เข้าใจผิด)
  test('403 — ยังไม่ระบุหลักสูตร → บอกให้ติดต่อเจ้าหน้าที่ (ไม่ใช่ "ระบบยังไม่เปิด")', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...student, major: null });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toMatch(/ยังไม่ได้ระบุหลักสูตร/);
    expect(wrote()).toBe(0);
  });

  test('400 — invalid supervisionType', async () => {
    const res = makeRes();
    await proposeSupervisionDate(baseReq({ supervisionType: 'HYBRID' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — onlineLink with disallowed protocol', async () => {
    const res = makeRes();
    await proposeSupervisionDate(baseReq({ onlineLink: 'javascript:alert(1)' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — student not found', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // บั๊กที่พบตอนตรวจระบบ 2026-09-22: หน้าจอซ่อนฟอร์มขอนัดถ้ายังไม่ออกฝึก แต่ API ไม่เช็คสถานะ → เรียกตรงได้ 200
  test.each(['DOCS_APPROVED', 'REQ_LETTER_ISSUED', 'PLACEMENT_LETTER_ISSUED', 'NOT_SUBMITTED'])('403 — ยังไม่ออกฝึก (%s) ขอนัดนิเทศไม่ได้', async (status) => {
    prisma.student.findUnique.mockResolvedValue({ ...student, coop: { coopPeriodId: 2, status } });
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(wrote()).toBe(0);
  });

  test('403 — ไม่มีข้อมูลสหกิจเลย', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...student, coop: null });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('400 — student has no coopAdvisorId', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...student, coopAdvisorId: null });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ป้องกัน regression ของบั๊กที่พบระหว่างตรวจระบบ 2026-09-07:
  // ต้องเช็ค isSupervisionOpen จากรอบสหกิจของ นศ. เอง (coop.coopPeriodId) ไม่ใช่รอบรับสมัครที่ isActive
  test('403 — supervisionPeriod ของ นศ. คนนี้ isSupervisionOpen เป็น false', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2 });
    prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: false });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(prisma.coopPeriodMajor.findUnique).toHaveBeenCalledWith({ where: { periodId_major: { periodId: 2, major: 'CS' } } });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 — นศ. ไม่มี coopPeriodId เลย (หา supervisionPeriod ไม่เจอ)', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...student, coop: { coopPeriodId: null } });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(prisma.coopPeriod.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('400 — อาจารย์ที่ปรึกษาโครงการไม่มีในระบบ', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('403 — ถูกล็อกเพราะสถานะเป็น DATE_CONFIRMED แล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ status: 'DATE_CONFIRMED' });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ถ้า record มีอยู่แล้วแต่ไม่ส่ง supervisionType มา ต้องใช้ค่าเดิมของ record นั้น (เดิม upsert พังเป็น 500 เมื่อปล่อย undefined เข้า create)
  test('200 — เสนอวันใหม่โดยไม่ส่ง supervisionType มา (ใช้ค่าเดิมของนัดที่มีอยู่)', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 1, status: 'TEACHER_REJECTED', supervisionType: 'ONLINE' });

    const req = baseReq({ supervisionType: undefined });
    const res = makeRes();
    await proposeSupervisionDate(req, res);

    expect(prisma.supervisionAppointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ supervisionType: 'ONLINE', status: 'PENDING_TEACHER', rejectReason: null }),
    }));
    expect(prisma.supervisionAppointment.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  // บั๊กจาก /scrutinize 2026-11-03: อ่านสถานะแล้ว upsert ไม่มีเงื่อนไข — อาจารย์ยืนยันวันพร้อมกันพอดี นัดที่ยืนยันแล้วถูกเขียนทับกลับเป็นรออาจารย์
  test('เสนอใหม่: เขียนเฉพาะนัดที่ยังไม่ล็อก (สถานะอยู่ใน where) · อาจารย์ยืนยันไปก่อนพอดี (count 0) → 403 ไม่เขียนทับ', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER', supervisionType: 'ONSITE' });
    prisma.supervisionAppointment.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(prisma.supervisionAppointment.updateMany.mock.calls[0][0].where).toEqual({ studentId: 10, status: { notIn: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.supervisionCoTeacher.updateMany).not.toHaveBeenCalled();
  });

  test('กดส่งซ้ำพร้อมกันตอนยังไม่มีนัด: อีกคำขอสร้างไปแล้ว (P2002) → 409 ไม่ใช่ 500', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  // ผู้ใช้ตัดสิน 2026-11-03: ช่วงนิเทศบังคับเฉพาะวันที่นักศึกษาเสนอ (เดิมใช้แสดงผลอย่างเดียว)
  describe('ช่วงนิเทศของหลักสูตร', () => {
    const withWindow = (start, end) => {
      prisma.student.findUnique.mockResolvedValue(student);
      prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
      prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true, supervisionStartDate: start, supervisionEndDate: end });
      prisma.teacher.findUnique.mockResolvedValue(teacher);
      prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
      prisma.supervisionAppointment.create.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER' });
    };
    const day = (n) => dayAt(n).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    const ask = async (...days) => {
      const res = makeRes();
      await proposeSupervisionDate(baseReq({ proposedDates: JSON.stringify(days.map((d) => `${d}|09:00-10:00|ONSITE`)) }), res);
      return res;
    };

    test.each([
      ['ก่อนวันเริ่ม', 5, 30, [3]],
      ['หลังวันสิ้นสุด', 5, 30, [31]],
      ['ตัวเลือกเดียวนอกช่วง (ที่เหลืออยู่ในช่วง)', 5, 30, [10, 40]],
    ])('400 — %s', async (_, s, e, days) => {
      withWindow(dayAt(s), dayAt(e));
      const res = await ask(...days.map(day));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toMatch(/นอกช่วงนิเทศของหลักสูตร/);
      expect(wrote()).toBe(0);
    });

    test('วันแรกและวันสุดท้ายของช่วงเสนอได้', async () => {
      withWindow(dayAt(5), dayAt(30));
      const res = await ask(day(5), day(30));
      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.supervisionAppointment.create).toHaveBeenCalled();
    });

    test('ตั้งไว้ฝั่งเดียว: มีแต่วันเริ่ม → หลังจากนั้นไกลแค่ไหนก็ได้ · ก่อนวันเริ่มไม่ได้', async () => {
      withWindow(dayAt(5), null);
      expect((await ask(day(200))).status).not.toHaveBeenCalled();
      expect((await ask(day(4))).status).toHaveBeenCalledWith(400);
    });

    test('ไม่ได้ตั้งช่วง = ไม่บังคับ (มีแต่สวิตช์เปิด/ปิด)', async () => {
      withWindow(null, null);
      const res = await ask(day(300));
      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.supervisionAppointment.create).toHaveBeenCalled();
    });
  });

  test('400 — สร้างนัดใหม่ (ไม่มี record เดิม) แต่ไม่ส่ง supervisionType มา', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);

    const req = baseReq({ supervisionType: undefined });
    const res = makeRes();
    await proposeSupervisionDate(req, res);

    expect(wrote()).toBe(0);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 — สร้างนัดใหม่สำเร็จ', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.create.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER', supervisionType: 'ONSITE' });

    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(prisma.supervisionAppointment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ studentId: 10, teacherId: 5, status: 'PENDING_TEACHER' }) });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, appointment: expect.objectContaining({ status: 'PENDING_TEACHER' }) })
    );
  });
});

// ===========================
// reviewSupervision
// ===========================
describe('reviewSupervision', () => {
  const teacherRecord = { id: 5, userId: 2, prefix: 'ผศ.', firstName: 'ก', lastName: 'ข' };
  // นักศึกษาเสนอ 15 มี.ค. 2024 ช่วง 10:00-12:00 — คิวนิเทศเป็นช่วงเวลา
  const supervision = {
    id: 1, teacherId: 5, status: 'PENDING_TEACHER', coTeacherName: null, coTeachers: [],
    proposedDates: JSON.stringify(['2024-03-15|10:00-12:00|ONSITE']),
  };
  // รายการที่อาจารย์คนเดียวกันจองไว้แล้ว ใช้จำลองการชนเวลา
  const bookedSameTeacher = {
    id: 99,
    confirmedDate: new Date('2024-03-15T11:00:00'),
    confirmedEndDate: new Date('2024-03-15T13:00:00'),
    proposedDates: null,
    teacherId: 5,
    teacher: teacherRecord,
    coTeachers: [],
    student: { studentId: 'u640099', firstName: 'จ', lastName: 'ฉ' },
  };

  test('403 — teacher mismatch (not primary advisor)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 99, userId: 2 }); // different teacher id
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision); // supervision.teacherId = 5

    const req = {
      params: { id: '1' },
      body: { action: 'APPROVE', confirmedDate: '2024-03-15' },
      user: { id: 2 },
    };
    const res = makeRes();
    await reviewSupervision(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('409 — date conflict on APPROVE', async () => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    prisma.supervisionAppointment.findMany.mockResolvedValue([bookedSameTeacher]);

    const req = {
      params: { id: '1' },
      body: { action: 'APPROVE', confirmedDate: '2024-03-15T10:00:00' },
      user: { id: 2 },
    };
    const res = makeRes();
    await reviewSupervision(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — APPROVE success (no conflict)', async () => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    prisma.supervisionAppointment.findMany.mockResolvedValue([]); // ไม่มีคิวชน
    prisma.supervisionAppointment.update.mockResolvedValue({
      ...supervision,
      status: 'DATE_CONFIRMED',
      confirmedDate: new Date('2024-03-15T10:00:00'),
    });

    const req = {
      params: { id: '1' },
      body: { action: 'APPROVE', confirmedDate: '2024-03-15T10:00:00' },
      user: { id: 2 },
    };
    const res = makeRes();
    await reviewSupervision(req, res);

    // เขียนเฉพาะเมื่อยังรออาจารย์ และวันที่เสนอยังเป็นชุดเดียวกับที่ตรวจ (กันนักศึกษาแก้วันพร้อมกันพอดี)
    expect(prisma.supervisionAppointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: 'PENDING_TEACHER', proposedDates: supervision.proposedDates },
        data: expect.objectContaining({ status: 'DATE_CONFIRMED' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('409 — นักศึกษาแก้วันที่เสนอพร้อมกันพอดี (เขียนไม่ได้ count 0) · ไม่แจ้งเตือนว่ายืนยันแล้ว', async () => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    prisma.supervisionAppointment.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = makeRes();
    await reviewSupervision({ params: { id: '1' }, body: { action: 'APPROVE', confirmedDate: '2024-03-15T10:00:00' }, user: { id: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/นักศึกษาเพิ่งแก้วันที่เสนอ/);
  });

  // ผู้ใช้ตัดสิน 2026-11-03: ปฏิเสธต้องมีเหตุผล (หน้าเว็บบังคับอยู่แล้ว แต่ API เดิมรับค่าว่าง)
  test.each([[undefined], [''], ['   ']])('400 — ปฏิเสธโดยไม่มีเหตุผล (%p) · ไม่เปลี่ยนสถานะ', async (rejectReason) => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    const res = makeRes();
    await reviewSupervision({ params: { id: '1' }, body: { action: 'REJECT', rejectReason }, user: { id: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/เหตุผล/);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('ปฏิเสธ: เหตุผลถูกตัดช่องว่างหัวท้ายก่อนบันทึก', async () => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    const res = makeRes();
    await reviewSupervision({ params: { id: '1' }, body: { action: 'REJECT', rejectReason: '  ขอเลื่อนเป็นสัปดาห์หน้า  ' }, user: { id: 2 } }, res);
    expect(prisma.supervisionAppointment.update.mock.calls[0][0].data.rejectReason).toBe('ขอเลื่อนเป็นสัปดาห์หน้า');
  });

  test('200 — REJECT success', async () => {
    prisma.teacher.findUnique.mockResolvedValue(teacherRecord);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(supervision);
    prisma.supervisionAppointment.update.mockResolvedValue({
      ...supervision,
      status: 'TEACHER_REJECTED',
      rejectReason: 'ไม่ว่าง',
    });

    const req = {
      params: { id: '1' },
      body: { action: 'REJECT', rejectReason: 'ไม่ว่าง' },
      user: { id: 2 },
    };
    const res = makeRes();
    await reviewSupervision(req, res);

    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'TEACHER_REJECTED', rejectReason: 'ไม่ว่าง' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

// ===========================
// getSupervisionCalendar
// ===========================
describe('getSupervisionCalendar', () => {
  test('200 — returns events with correct shape', async () => {
    const confirmedDate = new Date('2024-04-10');
    const appointments = [
      {
        id: 7,
        confirmedDate,
        confirmedEndDate: new Date('2024-04-10T10:00:00'),
        proposedDates: null,
        supervisionType: 'ONSITE',
        status: 'DATE_CONFIRMED',
        onlineLink: null,
        coTeacherName: 'อ.ร่วม นิเทศ',
        teacher: { prefix: 'ผศ.', firstName: 'ครู', lastName: 'หนึ่ง' },
        student: {
          studentId: 'CS001', firstName: 'ก', lastName: 'ข',
          coop: { company: { name: 'บริษัท เอบีซี จำกัด', province: 'ขอนแก่น' } },
        },
      },
      {
        id: 8,
        confirmedDate: new Date('2024-04-15'),
        confirmedEndDate: null,
        proposedDates: null,
        supervisionType: 'ONLINE',
        status: 'LETTER_UPLOADED',
        onlineLink: 'https://meet.google.com/abc-defg',
        coTeacherName: null,
        teacher: { prefix: 'รศ.', firstName: 'ครู', lastName: 'สอง' },
        student: {
          studentId: 'CS002', firstName: 'จ', lastName: 'ฉ',
          coop: null,
        },
      },
    ];
    prisma.supervisionAppointment.findMany.mockResolvedValue(appointments);

    const res = makeRes();
    await getSupervisionCalendar({ user: { id: 1, role: 'staff' }, method: 'GET', get: () => '' }, res);

    const { events } = res.json.mock.calls[0][0];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 7,
      studentId: 'CS001',
      studentName: 'ก ข',
      type: 'ONSITE',
      status: 'DATE_CONFIRMED',
      companyName: 'บริษัท เอบีซี จำกัด',
      companyProvince: 'ขอนแก่น',
      // ตารางนิเทศ: ใครนิเทศ เมื่อไหร่ ถึงกี่โมง
      teacherName: 'ผศ.ครู หนึ่ง',
      coTeacherName: 'อ.ร่วม นิเทศ',
      date: '2024-04-10',
      // new Date('2024-04-10') = UTC เที่ยงคืน = 07:00 ตามเวลาไทย
      start: '07:00',
      end: '10:00',
      session: 'เช้า',
    });
    expect(events[1]).toMatchObject({
      id: 8,
      studentName: 'จ ฉ',
      teacherName: 'รศ.ครู สอง',
      coTeacherName: null,
      companyName: null,
      // ไม่มีเวลาสิ้นสุดที่บันทึกไว้ → ถือว่ายาว 1 ชม.
      start: '07:00',
      end: '08:00',
    });

    const { where } = prisma.supervisionAppointment.findMany.mock.calls[0][0];
    expect(where.AND[0]).toMatchObject({
      confirmedDate: { not: null },
      status: { in: expect.arrayContaining(['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED']) },
    });
    // เจ้าหน้าที่ไม่มีตัวกรอง = ทุกหลักสูตร
    expect(where.AND[1]).toEqual({ student: {} });
  });

  describe('แยกตามหลักสูตร', () => {
    const scopeOf = async (user, header = '') => {
      prisma.supervisionAppointment.findMany.mockResolvedValue([]);
      await getSupervisionCalendar({ user, method: 'GET', get: () => header }, makeRes());
      return prisma.supervisionAppointment.findMany.mock.calls[0][0].where.AND[1];
    };

    test('เจ้าหน้าที่ + ตัวกรองหลักสูตรบนแถบบน → เฉพาะหลักสูตรนั้น', async () => {
      expect(await scopeOf({ id: 1, role: 'staff' }, 'AI')).toEqual({ student: { major: { in: ['AI'] } } });
    });

    test('นักศึกษา → หลักสูตรตัวเอง + นัดของตัวเอง', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 5, major: 'CS' });
      expect(await scopeOf({ id: 50, role: 'student' })).toEqual({ OR: [{ studentId: 5 }, { student: { major: 'CS' } }] });
    });

    test('นักศึกษายังไม่มีหลักสูตร → เฉพาะนัดของตัวเอง', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 5, major: null });
      expect(await scopeOf({ id: 50, role: 'student' })).toEqual({ studentId: 5 });
    });

    test('อาจารย์ทั่วไป → หลักสูตรตัวเอง + นัดที่นิเทศ/ร่วมนิเทศ', async () => {
      prisma.teacher.findUnique.mockImplementation(async ({ select }) => (select.coopMajors ? { coopMajors: [] } : { id: 3, major: 'IT' }));
      expect(await scopeOf({ id: 30, role: 'teacher' })).toEqual({
        OR: [{ teacherId: 3 }, { coTeachers: { some: { teacherId: 3 } } }, { student: { major: { in: ['IT'] } } }],
      });
    });

    test('อาจารย์ประจำวิชา → หลักสูตรตัวเอง + หลักสูตรที่ดูแล', async () => {
      prisma.teacher.findUnique.mockImplementation(async ({ select }) => (select.coopMajors ? { coopMajors: [{ major: 'CS' }, { major: 'AI' }] } : { id: 3, major: 'CS' }));
      const where = await scopeOf({ id: 30, role: 'teacher' });
      expect(where.OR[2]).toEqual({ student: { major: { in: ['CS', 'AI'] } } });
    });

    test('อาจารย์ประจำวิชา + ตัวกรองหลักสูตรบนแถบบน → เฉพาะหลักสูตรนั้น (ตรงกับรายการนัดหน้าจัดการ)', async () => {
      prisma.teacher.findUnique.mockImplementation(async ({ select }) => (select.coopMajors ? { coopMajors: [{ major: 'CS' }, { major: 'AI' }] } : { id: 3, major: 'CS' }));
      expect(await scopeOf({ id: 30, role: 'teacher' }, 'AI')).toEqual({ student: { major: { in: ['AI'] } } });
    });

    test('อาจารย์ทั่วไปส่งตัวกรองหลักสูตรที่ไม่ได้ดูแล → ไม่มีผล', async () => {
      prisma.teacher.findUnique.mockImplementation(async ({ select }) => (select.coopMajors ? { coopMajors: [] } : { id: 3, major: 'IT' }));
      expect((await scopeOf({ id: 30, role: 'teacher' }, 'AI')).OR).toHaveLength(3);
    });

    test('ไม่พบโปรไฟล์ → ไม่เห็นนัดใคร', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      expect(await scopeOf({ id: 50, role: 'student' })).toEqual({ id: -1 });
    });
  });

  test('500 — DB error returns server error', async () => {
    prisma.supervisionAppointment.findMany.mockRejectedValue(new Error('DB crash'));

    const res = makeRes();
    await getSupervisionCalendar({ user: { id: 1, role: 'staff' }, method: 'GET', get: () => '' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ===========================
// getSupervisionsByCompany
// ===========================
describe('getSupervisionsByCompany', () => {
  const { getSupervisionsByCompany } = require('../controllers/supervisionController');

  test('404 — teacher not found', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    const req = { user: { id: 99 } };
    const res = makeRes();
    await getSupervisionsByCompany(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — groups students by company with commonDates', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    // student A: บริษัท X เสนอวัน 2026-04-10
    // student B: บริษัท X เสนอวัน 2026-04-10 และ 2026-04-11
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      {
        id: 1, groupId: null, status: 'PENDING_TEACHER',
        proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']),
        student: {
          id: 10, studentId: '651111111', firstName: 'ก', lastName: 'ข',
          coop: { company: { id: 'cid1', name: 'บริษัท X' } }
        }
      },
      {
        id: 2, groupId: null, status: 'PENDING_TEACHER',
        proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE','2026-04-11T00:00:00.000Z|13:00|ONLINE']),
        student: {
          id: 11, studentId: '651111112', firstName: 'ค', lastName: 'ง',
          coop: { company: { id: 'cid1', name: 'บริษัท X' } }
        }
      }
    ]);
    const req = { user: { id: 1 } };
    const res = makeRes();
    await getSupervisionsByCompany(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    const { companies } = res.json.mock.calls[0][0];
    expect(companies).toHaveLength(1);
    expect(companies[0].companyId).toBe('cid1');
    expect(companies[0].students).toHaveLength(2);
    // 2026-04-10 ปรากฏใน 2 คน → commonDates มี 1 entry
    expect(companies[0].commonDates).toHaveLength(1);
    expect(companies[0].commonDates[0]).toContain('2026-04-10');
  });

  test('500 — DB error', async () => {
    prisma.teacher.findUnique.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await getSupervisionsByCompany({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ===========================
// confirmGroupSupervision
// ===========================
describe('confirmGroupSupervision', () => {
  const { confirmGroupSupervision } = require('../controllers/supervisionController');

  const makeReq = (body) => ({ user: { id: 1 }, body });

  test('400 — missing appointmentIds', async () => {
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ confirmedDate: '2026-04-10T10:00:00.000Z' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 — missing confirmedDate', async () => {
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 — some appointmentIds not found in DB', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    // requested [1, 2] but DB only returns 1 record
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 1, proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) }
    ]);
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1, 2], confirmedDate: '2026-04-10T10:00:00.000Z' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('403 — appointment belongs to another teacher', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5 });
    // teacherId = 99 ≠ 5
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 99, proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) }
    ]);
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1], confirmedDate: '2026-04-10T10:00:00.000Z' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('200 — confirms group, returns groupId', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 1, status: 'PENDING_TEACHER', proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) },
      { id: 2, teacherId: 1, status: 'PENDING_TEACHER', proposedDates: JSON.stringify(['2026-04-10T00:00:00.000Z|10:00|ONSITE']) },
    ]);
    prisma.supervisionAppointment.update.mockResolvedValue({ id: 1 });
    const res = makeRes();
    await confirmGroupSupervision(
      makeReq({ appointmentIds: [1, 2], confirmedDate: '2026-04-10T10:00:00.000Z' }),
      res
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, updatedCount: 2 }));
    // groupId ต้องเป็น UUID string
    const { groupId } = res.json.mock.calls[0][0];
    expect(typeof groupId).toBe('string');
    expect(groupId).toMatch(/^[0-9a-f-]{36}$/);
    // ใช้ individual update (ผ่าน $transaction) แทน updateMany
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledTimes(2);
  });

  test('นัดก่อน 07:00 เวลาไทย (UTC ยังเป็นวันก่อนหน้า) → ตรงกับวันที่เสนอตามเวลาท้องถิ่น เหมือนอนุมัติรายคน', async () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Asia/Bangkok';
    try {
      prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
      prisma.supervisionAppointment.findMany.mockResolvedValue([
        { id: 1, teacherId: 1, status: 'PENDING_TEACHER', proposedDates: JSON.stringify(['2026-04-10|06:30|ONSITE']) },
      ]);
      prisma.supervisionAppointment.update.mockResolvedValue({ id: 1 });
      const res = makeRes();
      // 06:30 วันที่ 10 เวลาไทย = 23:30Z วันที่ 9 (frontend ส่ง toISOString())
      await confirmGroupSupervision(makeReq({ appointmentIds: [1], confirmedDate: '2026-04-09T23:30:00.000Z' }), res);
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, updatedCount: 1 }));
    } finally {
      process.env.TZ = tz;
      if (tz === undefined) delete process.env.TZ;
    }
  });

  test('400 — confirmedDate ไม่ใช่วันที่', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 1 });
    prisma.supervisionAppointment.findMany.mockResolvedValue([
      { id: 1, teacherId: 1, status: 'PENDING_TEACHER', proposedDates: JSON.stringify(['2026-04-10|10:00|ONSITE']) },
    ]);
    const res = makeRes();
    await confirmGroupSupervision(makeReq({ appointmentIds: [1], confirmedDate: 'not-a-date' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ===========================
// getSupervisionsForTeacher
// ===========================
describe('getSupervisionsForTeacher', () => {
  test('404 — ไม่พบข้อมูลอาจารย์', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getSupervisionsForTeacher(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('หานัดที่เป็นอาจารย์หลัก หรือเป็นอาจารย์ร่วม (ผูกด้วย id ไม่ใช่ค้นจากชื่อ)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, firstName: 'สมชาย', lastName: 'ใจดี' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);

    const res = makeRes();
    await getSupervisionsForTeacher({ user: { id: 1 } }, res);

    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ teacherId: 5 }, { coTeachers: { some: { teacherId: 5 } } }], student: { deletedAt: null } },
      })
    );
  });
});

// ===========================
// updateConfirmedDate — เจ้าหน้าที่แก้วันนิเทศ
// บั๊กที่พบตอนตรวจระบบ 2026-09-22: ย้ายวันของสมาชิก 1 คนในนัดกลุ่มแล้ว groupId ยังอยู่
// ปฏิทินรวมกลุ่มตาม groupId เลยโชว์คนนั้นที่วันเดิม และหายจากวันใหม่
// ===========================
describe('updateConfirmedDate — สมาชิกนัดกลุ่ม', () => {
  const { updateConfirmedDate } = require('../controllers/supervisionController');
  const grouped = {
    id: 21, studentId: 7, teacherId: 5, status: 'DATE_CONFIRMED', officialLetterPath: null,
    groupId: 'group-uuid-1', coTeacherName: null, coTeachers: [],
    confirmedDate: new Date('2026-12-10T09:00:00'),
    proposedDates: JSON.stringify(['2026-12-10|09:00-10:00|ONSITE']),
  };
  const req = (confirmedDate) => ({ user: { role: 'staff' }, params: { id: '21' }, body: { confirmedDate } });

  beforeEach(() => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(grouped);
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, prefix: 'อ.', firstName: 'ก', lastName: 'ข' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]); // ไม่มีคิวชน
    prisma.supervisionAppointment.update.mockResolvedValue({ ...grouped, studentId: 7 });
    prisma.student.findUnique.mockResolvedValue({ userId: 70 });
  });

  test('ย้ายไปวันอื่น → ถอดออกจากกลุ่ม (groupId เป็น null)', async () => {
    const res = makeRes();
    await updateConfirmedDate(req('2026-12-11T10:00:00'), res);
    const { data } = prisma.supervisionAppointment.update.mock.calls[0][0];
    expect(data.groupId).toBeNull();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('เลื่อนเวลาในวันเดิม → ยังอยู่กลุ่มเดิม', async () => {
    const res = makeRes();
    await updateConfirmedDate(req('2026-12-10T11:00:00'), res);
    const { data } = prisma.supervisionAppointment.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('groupId');
  });
});

// ===========================
// ตรวจซ้ำ 2026-09-22 (รอบ 2)
// ===========================
describe('proposeSupervisionDate — ห้ามเสนอวันที่ผ่านมาแล้ว', () => {
  const student = { id: 10, userId: 1, deletedAt: null, coopAdvisorId: 5, major: 'CS', coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } };
  const req = (dates) => ({ user: { id: 1 }, body: { proposedDates: JSON.stringify(dates), supervisionType: 'ONSITE' } });
  beforeEach(() => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2 }); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 2 });
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.upsert.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER' });
  });

  test('400 — มีตัวเลือกเป็นวันในอดีต', async () => {
    const res = makeRes();
    await proposeSupervisionDate(req(['2020-01-15|10:00-12:00|ONSITE']), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionAppointment.upsert).not.toHaveBeenCalled();
  });

  test('200 — วันนี้หรืออนาคตเสนอได้', async () => {
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const res = makeRes();
    await proposeSupervisionDate(req([`${today}|16:00-17:00|ONSITE`, '2099-12-01|10:00-11:00|ONSITE']), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('getCompanySupervisionQueue — เฉพาะคิวที่ยังไม่ถึง', () => {
  const { getCompanySupervisionQueue } = require('../controllers/supervisionController');
  test('ไม่ดึงนัดที่นิเทศเสร็จแล้ว หรือวันที่ผ่านไปแล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, coopAdvisorId: 5, coop: { company: { id: 'c1', name: 'บริษัท ก' } } });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    const res = makeRes();
    await getCompanySupervisionQueue({ user: { id: 1 } }, res);
    const where = prisma.supervisionAppointment.findMany.mock.calls[0][0].where;
    expect(where.status.in).not.toContain('COMPLETED');
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    expect(where.confirmedDate.gte.getTime()).toBe(startOfToday.getTime());
  });
});

describe('updateConfirmedDate — ย้ายวันแล้วความยาวคิวต้องเท่าเดิม', () => {
  const { updateConfirmedDate } = require('../controllers/supervisionController');
  test('นัด 10:00-12:00 ย้ายไปวันที่ไม่อยู่ในรายการเสนอ → ยังยาว 2 ชม.', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({
      id: 31, studentId: 7, teacherId: 5, status: 'DATE_CONFIRMED', officialLetterPath: null, groupId: null, coTeacherName: null, coTeachers: [],
      confirmedDate: new Date('2026-12-18T10:00:00'), confirmedEndDate: new Date('2026-12-18T12:00:00'),
      proposedDates: JSON.stringify(['2026-12-18|10:00-12:00|ONSITE']),
    });
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, prefix: 'อ.', firstName: 'ก', lastName: 'ข' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    prisma.supervisionAppointment.update.mockResolvedValue({ id: 31, studentId: 7 });
    prisma.student.findUnique.mockResolvedValue({ userId: 70 });
    const res = makeRes();
    await updateConfirmedDate({ user: { role: 'staff' }, params: { id: '31' }, body: { confirmedDate: '2026-12-19T10:00:00' } }, res);
    const { data } = prisma.supervisionAppointment.update.mock.calls[0][0];
    expect((data.confirmedEndDate - data.confirmedDate) / 60000).toBe(120);
  });
});

describe('confirmGroupSupervision — คิวเรียงตามลำดับที่อาจารย์ส่งมา (ตรวจ scrutinize)', () => {
  const { confirmGroupSupervision } = require('../controllers/supervisionController');
  test('ส่ง [คนที่ 2, คนที่ 1] → คนที่ 2 ได้คิวแรก แม้ฐานข้อมูลคืนมาเป็น [1, 2]', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, prefix: 'อ.', firstName: 'ก', lastName: 'ข' });
    const mk = (id) => ({ id, teacherId: 5, status: 'PENDING_TEACHER', coTeacherName: null, studentId: id * 10,
      proposedDates: JSON.stringify(['2026-12-22|09:00-10:00|ONSITE']) });
    prisma.supervisionAppointment.findMany
      .mockResolvedValueOnce([mk(1), mk(2)]) // ดึงนัดตาม id (ลำดับของฐานข้อมูล)
      .mockResolvedValue([]);               // ตรวจเวลาชน: ไม่มีคิวอื่น
    prisma.supervisionAppointment.update.mockResolvedValue({});
    prisma.student.findMany.mockResolvedValue([]);
    const res = makeRes();
    await confirmGroupSupervision({ user: { id: 2 }, body: { appointmentIds: [2, 1], confirmedDate: '2026-12-22T09:00:00' } }, res);
    const updates = prisma.supervisionAppointment.update.mock.calls.map((c) => ({ id: c[0].where.id, start: c[0].data.confirmedDate.getHours() }));
    expect(updates).toEqual([{ id: 2, start: 9 }, { id: 1, start: 10 }]);
  });
});

// ===========================
// อาจารย์นิเทศร่วม — ผูกกับบัญชีอาจารย์ (SupervisionCoTeacher) ไม่ใช่ข้อความชื่อ
// ===========================
describe('assignCoTeachers — เลือกอาจารย์ร่วมด้วย id', () => {
  const { assignCoTeachers } = require('../controllers/supervisionController');
  const appt = { id: 4, teacherId: 5, status: 'PENDING_TEACHER', confirmedDate: null, proposedDates: null };
  const T7 = { id: 7, prefix: 'ผศ. ดร.', firstName: 'ชิตสุธา', lastName: 'สุ่มเล็ก' };
  const T68 = { id: 68, prefix: 'อ. ดร.', firstName: 'ญานิกา', lastName: 'คงโสรส' };

  test('ผูกอาจารย์ร่วมตาม id และสร้างชื่อแสดงผลจากบัญชีจริง (ตัดอาจารย์หลักออก)', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appt);
    prisma.teacher.findMany.mockResolvedValue([T68, T7]); // DB คืนคนละลำดับกับที่เลือก
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds: [7, 5, 68, 7] } }, res);

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [7, 68] } } }));
    // ลบเฉพาะคนที่เอาออก · คนเดิมคงไว้ (วันว่างที่ตอบไว้ไม่หาย) · เพิ่มเฉพาะคนใหม่
    expect(prisma.supervisionCoTeacher.deleteMany).toHaveBeenCalledWith({ where: { appointmentId: 4, teacherId: { notIn: [7, 68] } } });
    expect(prisma.supervisionCoTeacher.createMany).toHaveBeenCalledWith({
      data: [{ appointmentId: 4, teacherId: 7 }, { appointmentId: 4, teacherId: 68 }],
      skipDuplicates: true,
    });
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith({
      where: { id: 4 }, data: { coTeacherName: 'ผศ. ดร.ชิตสุธา สุ่มเล็ก, อ. ดร.ญานิกา คงโสรส' },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('ล้างอาจารย์ร่วมทั้งหมด → ลบความเชื่อมโยง และชื่อเป็น null', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appt);
    prisma.teacher.findMany.mockResolvedValue([]);
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds: [] } }, res);
    expect(prisma.supervisionCoTeacher.deleteMany).toHaveBeenCalled();
    expect(prisma.supervisionCoTeacher.createMany).not.toHaveBeenCalled();
    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { coTeacherName: null } });
  });

  test('400 — ส่งชื่อแบบเดิม (ไม่ใช่รายการ id)', async () => {
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherName: 'อ.ก ข' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('400 — มี id อาจารย์ที่ไม่มีในระบบ', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appt);
    prisma.teacher.findMany.mockResolvedValue([T7]);
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds: [7, 999] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionCoTeacher.createMany).not.toHaveBeenCalled();
  });

  test('409 — อาจารย์ร่วมติดนิเทศรายการอื่นเวลาเดียวกัน (เทียบด้วย id)', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({
      ...appt, status: 'DATE_CONFIRMED',
      confirmedDate: new Date('2026-12-10T10:00:00'), confirmedEndDate: new Date('2026-12-10T11:00:00'),
    });
    prisma.teacher.findMany.mockResolvedValue([T7]);
    prisma.supervisionAppointment.findMany.mockResolvedValue([{
      id: 50, teacherId: 9, confirmedDate: new Date('2026-12-10T10:30:00'), confirmedEndDate: new Date('2026-12-10T11:30:00'),
      proposedDates: null, teacher: { prefix: 'อ.', firstName: 'อื่น', lastName: 'คน' },
      coTeachers: [{ teacherId: 7, teacher: T7 }], student: { firstName: 'ก', lastName: 'ข' },
    }]);
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds: [7] } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('ชิตสุธา') }));
  });
});

describe('proposeSupervisionDate — นักศึกษากำหนดอาจารย์ร่วมเองไม่ได้', () => {
  test('coTeacherName ที่แนบมาใน body ไม่ถูกบันทึก', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null, coopAdvisorId: 5, major: 'CS', coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } });
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2 }); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 2 });
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.create.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER' });
    const res = makeRes();
    await proposeSupervisionDate({
      user: { id: 1 },
      body: { proposedDates: JSON.stringify(['2099-12-01|10:00-11:00|ONSITE']), supervisionType: 'ONSITE', coTeacherName: 'อ.ใครก็ได้ ที่นักศึกษาใส่เอง' },
    }, res);
    expect(prisma.supervisionAppointment.create.mock.calls[0][0].data).not.toHaveProperty('coTeacherName');
    // นัดที่มีอยู่แล้ว (เสนอใหม่) ก็ไม่บันทึก
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 1, status: 'TEACHER_REJECTED', supervisionType: 'ONSITE' });
    await proposeSupervisionDate({
      user: { id: 1 },
      body: { proposedDates: JSON.stringify(['2099-12-01|10:00-11:00|ONSITE']), supervisionType: 'ONSITE', coTeacherName: 'อ.ใครก็ได้ ที่นักศึกษาใส่เอง' },
    }, makeRes());
    expect(prisma.supervisionAppointment.updateMany.mock.calls[0][0].data).not.toHaveProperty('coTeacherName');
  });
});

// ===========================
// ด่านที่หน้าเว็บกันแต่ server ไม่กัน (ทดสอบทั้งระบบ รอบ 3 — 2026-11-02)
// ===========================
describe('updateConfirmedDate — ระหว่างรอลงนาม / วันที่ผิด', () => {
  const { updateConfirmedDate } = require('../controllers/supervisionController');
  const appt = {
    id: 21, studentId: 7, teacherId: 5, status: 'DATE_CONFIRMED', officialLetterPath: null, groupId: null, coTeachers: [],
    confirmedDate: new Date('2026-12-10T09:00:00'), proposedDates: JSON.stringify(['2026-12-10|09:00-10:00|ONSITE']),
  };
  const req = (confirmedDate) => ({ user: { role: 'staff' }, params: { id: '21' }, body: { confirmedDate } });
  beforeEach(() => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    prisma.supervisionAppointment.update.mockResolvedValue({ ...appt });
    prisma.student.findUnique.mockResolvedValue({ userId: 70 });
  });

  test('409 — มีร่างหนังสือรอลงนามอยู่ (วันในร่างจะไม่ตรง) ไม่บันทึก', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ ...appt, letterPendingAt: new Date(), letterDraftNumber: '660301.26.6.2/1215' });
    const res = makeRes();
    await updateConfirmedDate(req('2026-12-11T10:00:00'), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/1215.*ยกเลิกรอลงนาม/);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('200 — ไม่มีร่างรอลงนาม แก้วันได้', async () => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ ...appt, letterPendingAt: null });
    const res = makeRes();
    await updateConfirmedDate(req('2026-12-11T10:00:00'), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('400 — วันที่ผิดรูปแบบ (เดิม 500)', async () => {
    const res = makeRes();
    await updateConfirmedDate(req('not-a-date'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });
});

describe('markSupervisionLetterPending — รอลงนามอยู่ห้ามออกร่างเลขอื่นทับ', () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
    prisma.supervisionAppointment.findFirst.mockResolvedValue(null);
    prisma.supervisionAppointment.update.mockResolvedValue({});
    prisma.supervisionAppointment.findUnique.mockResolvedValue({
      status: 'DATE_CONFIRMED', letterPendingAt: new Date(), letterDraftNumber: '660301.26.6.2/900', student: { deletedAt: null },
    });
  });

  test('409 — เลขอื่น', async () => {
    const res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { docNumber: '660301.26.6.2/901' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/รอลงนามอยู่ \(เลข 660301\.26\.6\.2\/900\)/);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('200 — เลขเดิม (โหลดร่างเดิมซ้ำ) · ยกเลิกได้', async () => {
    let res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { docNumber: '660301.26.6.2/900' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    res = makeRes();
    await markSupervisionLetterPending({ params: { id: '5' }, body: { cancel: true } }, res);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('reviewSupervision — ยืนยันได้เฉพาะวันที่นักศึกษาเสนอ', () => {
  beforeEach(() => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 2 });
    prisma.supervisionAppointment.findUnique.mockResolvedValue({
      id: 1, teacherId: 5, status: 'PENDING_TEACHER', coTeachers: [], proposedDates: JSON.stringify(['2026-12-15|10:00-12:00|ONSITE']),
    });
    prisma.supervisionCoTeacher.findMany.mockResolvedValue([]);
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    prisma.supervisionAppointment.update.mockResolvedValue({});
  });

  test('400 — วันที่ไม่ได้เสนอ ไม่บันทึก', async () => {
    const res = makeRes();
    await reviewSupervision({ params: { id: '1' }, body: { action: 'APPROVE', confirmedDate: '2026-12-16T10:00:00' }, user: { id: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/เฉพาะวันที่นักศึกษาเสนอ/);
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('200 — วันที่เสนอ → ยืนยันวัน', async () => {
    const res = makeRes();
    await reviewSupervision({ params: { id: '1' }, body: { action: 'APPROVE', confirmedDate: '2026-12-15T10:00:00' }, user: { id: 2 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(prisma.supervisionAppointment.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'DATE_CONFIRMED' });
  });
});

describe('proposeSupervisionDate — รายการวันที่ต้องถูกต้อง (ตรงกับหน้าเสนอวัน)', () => {
  const student = { id: 10, userId: 1, deletedAt: null, coopAdvisorId: 5, major: 'CS', coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } };
  const req = (body) => ({ user: { id: 1 }, body: { supervisionType: 'ONSITE', ...body } });
  beforeEach(() => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2 }); prisma.coopPeriodMajor.findUnique.mockResolvedValue({ periodId: 2, major: 'CS', isSupervisionOpen: true });
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 2 });
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.upsert.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER' });
  });

  test.each([
    ['ไม่ใช่ข้อความ JSON (เดิม 500)', { proposedDates: ['2099-12-01|10:00-11:00|ONSITE'] }, /JSON/],
    ['ไม่มีวันเลย', { proposedDates: '[]' }, /อย่างน้อย 1 วัน/],
    ['รูปแบบวันผิดทั้งหมด', { proposedDates: JSON.stringify(['พรุ่งนี้']) }, /อย่างน้อย 1 วัน/],
    ['เวลาเริ่มไม่น้อยกว่าเวลาจบ', { proposedDates: JSON.stringify(['2099-12-01|10:00-11:00|ONSITE', '2099-12-02|14:00-13:00|ONSITE']) }, /ตัวเลือกที่ 2: เวลาเริ่ม/],
    ['ออนไลน์ไม่มีลิงก์', { proposedDates: JSON.stringify(['2099-12-01|10:00-11:00|ONLINE']), supervisionType: 'ONLINE' }, /Link/],
  ])('400 — %s', async (_name, body, msg) => {
    const res = makeRes();
    await proposeSupervisionDate(req(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(msg);
    expect(prisma.supervisionAppointment.upsert).not.toHaveBeenCalled();
  });

  test('200 — ออนไลน์พร้อมลิงก์', async () => {
    const res = makeRes();
    await proposeSupervisionDate(req({ proposedDates: JSON.stringify(['2099-12-01|10:00-11:00|ONLINE']), supervisionType: 'ONLINE', onlineLink: 'https://meet.google.com/abc' }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('assignCoTeachers — ระหว่างรอลงนาม (รายชื่ออาจารย์อยู่ในร่างหนังสือ)', () => {
  const { assignCoTeachers } = require('../controllers/supervisionController');
  const appt = { id: 4, teacherId: 5, status: 'DATE_CONFIRMED', confirmedDate: null, proposedDates: null, letterPendingAt: new Date(), letterDraftNumber: '660301.26.6.2/1215' };
  beforeEach(() => {
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appt);
    prisma.supervisionCoTeacher.findMany.mockResolvedValue([{ teacherId: 7 }]);
    prisma.teacher.findMany.mockResolvedValue([{ id: 7, prefix: 'อ.', firstName: 'ก', lastName: 'ข' }]);
  });

  test('409 — เพิ่ม/เอาออก ไม่บันทึก', async () => {
    for (const coTeacherIds of [[7, 68], []]) {
      const res = makeRes();
      await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
    }
    expect(prisma.supervisionCoTeacher.deleteMany).not.toHaveBeenCalled();
    expect(prisma.supervisionAppointment.update).not.toHaveBeenCalled();
  });

  test('200 — ชุดเดิม (กดบันทึกโดยไม่เปลี่ยน) ไม่ติด', async () => {
    const res = makeRes();
    await assignCoTeachers({ user: { role: 'staff' }, params: { id: '4' }, body: { coTeacherIds: [7, 5] } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
