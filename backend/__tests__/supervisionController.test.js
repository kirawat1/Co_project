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
// getSupervisionPeriods
// ===========================
describe('getSupervisionPeriods', () => {
  test('200 — returns periods array', async () => {
    const periods = [
      { id: 1, academicYear: '2566', semester: 1, isSupervisionOpen: true },
      { id: 2, academicYear: '2565', semester: 2, isSupervisionOpen: false },
    ];
    prisma.coopPeriod.findMany.mockResolvedValue(periods);

    const res = makeRes();
    await getSupervisionPeriods({}, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, periods });
    expect(prisma.coopPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
  });

  test('500 — DB error returns server error', async () => {
    prisma.coopPeriod.findMany.mockRejectedValue(new Error('DB crash'));

    const res = makeRes();
    await getSupervisionPeriods({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ===========================
// saveSupervisionPeriod
// ===========================
describe('saveSupervisionPeriod', () => {
  test('200 — calls update with correct where clause', async () => {
    const updatedPeriod = {
      id: 3,
      isSupervisionOpen: true,
      supervisionStartDate: new Date('2024-01-01'),
      supervisionEndDate: new Date('2024-06-30'),
    };
    prisma.coopPeriod.update.mockResolvedValue(updatedPeriod);

    const req = {
      body: {
        periodId: '3',
        isSupervisionOpen: true,
        supervisionStartDate: '2024-01-01',
        supervisionEndDate: '2024-06-30',
      },
    };
    const res = makeRes();
    await saveSupervisionPeriod(req, res);

    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3 } })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, period: updatedPeriod });
  });

  test('500 — DB error returns server error', async () => {
    prisma.coopPeriod.update.mockRejectedValue(new Error('DB crash'));

    const req = {
      body: {
        periodId: '1',
        isSupervisionOpen: false,
        supervisionStartDate: null,
        supervisionEndDate: null,
      },
    };
    const res = makeRes();
    await saveSupervisionPeriod(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ===========================
// getAllSupervisions
// ===========================
describe('getAllSupervisions', () => {
  test('200 — returns supervisions array', async () => {
    const supervisions = [
      { id: 1, status: 'PENDING_TEACHER', student: { firstName: 'ก', lastName: 'ข' }, teacher: { id: 5 } },
    ];
    prisma.supervisionAppointment.findMany.mockResolvedValue(supervisions);

    const res = makeRes();
    await getAllSupervisions({}, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, supervisions });
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
    expect(res.json).toHaveBeenCalledWith({ ok: true, appointment });
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
      expect(prisma.supervisionAppointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: { not: 1 } });
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
    expect(prisma.supervisionAppointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: { not: 5 } });
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
    const student = { id: 10, userId: 1, coop: { coopPeriodId: null } };
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
    const student = { id: 10, userId: 1, coop: { coopPeriodId: 2 } };
    const appointment = { id: 5, studentId: 10, status: 'PENDING_TEACHER' };
    const period = { id: 2, isSupervisionOpen: true, isActive: false };
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appointment);
    prisma.coopPeriod.findUnique.mockResolvedValue(period);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getStudentSupervision(req, res);

    expect(prisma.coopPeriod.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(res.json).toHaveBeenCalledWith({ ok: true, appointment, supervisionPeriod: period });
  });
});

// ===========================
// proposeSupervisionDate
// ===========================
describe('proposeSupervisionDate', () => {
  const student = { id: 10, userId: 1, deletedAt: null, coopAdvisorId: 5, coop: { coopPeriodId: 2, status: 'INTERNSHIP_STARTED' } };
  const teacher = { id: 5, userId: 2 };
  const openPeriod = { id: 2, isSupervisionOpen: true };

  function baseReq(body) {
    return { user: { id: 1 }, body: { proposedDates: '["2026-11-10|09:00|ONSITE"]', supervisionType: 'ONSITE', ...body } };
  }

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
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.supervisionAppointment.upsert).not.toHaveBeenCalled();
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
    prisma.coopPeriod.findUnique.mockResolvedValue({ id: 2, isSupervisionOpen: false });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(prisma.coopPeriod.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
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
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    prisma.teacher.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('403 — ถูกล็อกเพราะสถานะเป็น DATE_CONFIRMED แล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ status: 'DATE_CONFIRMED' });
    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ป้องกัน regression ของบั๊ก 500 ที่พบระหว่างตรวจระบบ: Prisma upsert() validate ทั้ง
  // create/update block พร้อมกันเสมอ — ถ้า record มีอยู่แล้วแต่ไม่ส่ง supervisionType มา
  // ต้อง fallback ไปใช้ค่าเดิมของ record นั้น ไม่ใช่ปล่อย undefined เข้า create block
  test('200 — เสนอวันใหม่โดยไม่ส่ง supervisionType มา (ใช้ค่าเดิมของนัดที่มีอยู่)', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ status: 'TEACHER_REJECTED', supervisionType: 'ONLINE' });
    prisma.supervisionAppointment.upsert.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER', supervisionType: 'ONLINE' });

    const req = baseReq({ supervisionType: undefined });
    const res = makeRes();
    await proposeSupervisionDate(req, res);

    expect(prisma.supervisionAppointment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ supervisionType: 'ONLINE' }),
        create: expect.objectContaining({ supervisionType: 'ONLINE' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('400 — สร้างนัดใหม่ (ไม่มี record เดิม) แต่ไม่ส่ง supervisionType มา', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);

    const req = baseReq({ supervisionType: undefined });
    const res = makeRes();
    await proposeSupervisionDate(req, res);

    expect(prisma.supervisionAppointment.upsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 — สร้างนัดใหม่สำเร็จ', async () => {
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.coopPeriod.findUnique.mockResolvedValue(openPeriod);
    prisma.teacher.findUnique.mockResolvedValue(teacher);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(null);
    prisma.supervisionAppointment.upsert.mockResolvedValue({ id: 1, status: 'PENDING_TEACHER', supervisionType: 'ONSITE' });

    const res = makeRes();
    await proposeSupervisionDate(baseReq(), res);

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
    id: 1, teacherId: 5, status: 'PENDING_TEACHER', coTeacherName: null,
    proposedDates: JSON.stringify(['2024-03-15|10:00-12:00|ONSITE']),
  };
  // รายการที่อาจารย์คนเดียวกันจองไว้แล้ว ใช้จำลองการชนเวลา
  const bookedSameTeacher = {
    id: 99,
    confirmedDate: new Date('2024-03-15T11:00:00'),
    confirmedEndDate: new Date('2024-03-15T13:00:00'),
    proposedDates: null,
    teacherId: 5,
    coTeacherName: null,
    teacher: teacherRecord,
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

    expect(prisma.supervisionAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'DATE_CONFIRMED' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
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
    await getSupervisionCalendar({}, res);

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

    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confirmedDate: { not: null },
          status: { in: expect.arrayContaining(['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED']) },
        }),
      })
    );
  });

  test('500 — DB error returns server error', async () => {
    prisma.supervisionAppointment.findMany.mockRejectedValue(new Error('DB crash'));

    const res = makeRes();
    await getSupervisionCalendar({}, res);

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

  test('ชื่ออาจารย์สั้นกว่า 2 ตัวอักษร — ไม่เพิ่มเงื่อนไข coTeacherName (กัน false-positive)', async () => {
    // No lastName → condition (firstName && lastName) is false → coTeacherName not added
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, firstName: 'ก' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getSupervisionsForTeacher(req, res);

    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ teacherId: 5 }], student: { deletedAt: null } },
      })
    );
  });

  test('ชื่ออาจารย์ปกติ — เพิ่มเงื่อนไข coTeacherName ค้นหาอาจารย์นิเทศร่วม', async () => {
    // Both firstName + lastName present → coTeacherName: { contains: 'firstName lastName' }
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, firstName: 'สมชาย', lastName: 'ใจดี' });
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getSupervisionsForTeacher(req, res);

    expect(prisma.supervisionAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ teacherId: 5 }, { coTeacherName: { contains: 'สมชาย ใจดี' } }], student: { deletedAt: null } },
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
    groupId: 'group-uuid-1', coTeacherName: null,
    confirmedDate: new Date('2026-12-10T09:00:00'),
    proposedDates: JSON.stringify(['2026-12-10|09:00-10:00|ONSITE']),
  };
  const req = (confirmedDate) => ({ params: { id: '21' }, body: { confirmedDate } });

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
