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
        onlineLink: null,
        student: {
          studentId: 'CS001', firstName: 'ก', lastName: 'ข',
          coop: { company: { name: 'บริษัท เอบีซี จำกัด' } },
        },
      },
      {
        id: 8,
        confirmedDate: new Date('2024-04-15'),
        supervisionType: 'ONLINE',
        status: 'LETTER_UPLOADED',
        onlineLink: 'https://meet.google.com/abc-defg',
        student: {
          studentId: 'CS002', firstName: 'จ', lastName: 'ฉ',
          coop: null,
        },
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
          companyName: 'บริษัท เอบีซี จำกัด',
        },
        {
          id: 8,
          confirmedDate: new Date('2024-04-15'),
          studentId: 'CS002',
          studentName: 'จ ฉ',
          type: 'ONLINE',
          status: 'LETTER_UPLOADED',
          companyName: null,
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
