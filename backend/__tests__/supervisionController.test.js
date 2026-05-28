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
  getStudentSupervision,
  reviewSupervision,
  getSupervisionCalendar,
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
    prisma.supervisionAppointment.update.mockResolvedValue(appointment);

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

  test('200 — returns appointment for existing student', async () => {
    const student = { id: 10, userId: 1 };
    const appointment = { id: 5, studentId: 10, status: 'PENDING_TEACHER' };
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.supervisionAppointment.findUnique.mockResolvedValue(appointment);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getStudentSupervision(req, res);

    expect(prisma.supervisionAppointment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: student.id } })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, appointment });
  });
});

// ===========================
// reviewSupervision
// ===========================
describe('reviewSupervision', () => {
  const teacherRecord = { id: 5, userId: 2 };
  const supervision = { id: 1, teacherId: 5, status: 'PENDING_TEACHER' };

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
    prisma.supervisionAppointment.findFirst.mockResolvedValue({
      id: 99,
      teacherId: 5,
      student: { firstName: 'จ', lastName: 'ฉ' },
    });

    const req = {
      params: { id: '1' },
      body: { action: 'APPROVE', confirmedDate: '2024-03-15' },
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
    prisma.supervisionAppointment.findFirst.mockResolvedValue(null); // no conflict
    prisma.supervisionAppointment.update.mockResolvedValue({
      ...supervision,
      status: 'DATE_CONFIRMED',
      confirmedDate: new Date('2024-03-15'),
    });

    const req = {
      params: { id: '1' },
      body: { action: 'APPROVE', confirmedDate: '2024-03-15' },
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
        supervisionType: 'ONSITE',
        status: 'DATE_CONFIRMED',
        student: { studentId: 'CS001', firstName: 'ก', lastName: 'ข' },
      },
      {
        id: 8,
        confirmedDate: new Date('2024-04-15'),
        supervisionType: 'ONLINE',
        status: 'LETTER_UPLOADED',
        student: { studentId: 'CS002', firstName: 'จ', lastName: 'ฉ' },
      },
    ];
    prisma.supervisionAppointment.findMany.mockResolvedValue(appointments);

    const res = makeRes();
    await getSupervisionCalendar({}, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      events: [
        {
          id: 7,
          confirmedDate,
          studentId: 'CS001',
          studentName: 'ก ข',
          type: 'ONSITE',
          status: 'DATE_CONFIRMED',
        },
        {
          id: 8,
          confirmedDate: new Date('2024-04-15'),
          studentId: 'CS002',
          studentName: 'จ ฉ',
          type: 'ONLINE',
          status: 'LETTER_UPLOADED',
        },
      ],
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
