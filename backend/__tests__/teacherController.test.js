// __tests__/teacherController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  getProfile,
  updateProfile,
  getAllTeachers,
  reviewT002,
  getDashboardStats,
  createTeacher,
  deleteTeacher,
} = require('../controllers/teacherController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// =====================
// getProfile
// =====================
describe('getProfile', () => {
  test('401 — no req.user', async () => {
    const req = {};
    const res = makeRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  test('200 isFirstTime — teacher not in DB yet', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ email: 'teacher@kku.ac.th' });

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isFirstTime: true, email: 'teacher@kku.ac.th' })
    );
  });

  test('200 — teacher found, returns teacher data with email', async () => {
    const mockTeacher = {
      id: 10,
      userId: 1,
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      user: { email: 'teacher@kku.ac.th' },
    };
    prisma.teacher.findUnique.mockResolvedValue(mockTeacher);

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.firstName).toBe('สมชาย');
    expect(body.email).toBe('teacher@kku.ac.th');
    expect(body.isFirstTime).toBeUndefined();
  });

  test('500 — DB error', async () => {
    prisma.teacher.findUnique.mockRejectedValue(new Error('DB down'));

    const req = { user: { id: 1 } };
    const res = makeRes();
    await getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
  });
});

// =====================
// updateProfile
// =====================
describe('updateProfile', () => {
  test('401 — no req.user', async () => {
    const req = { body: {} };
    const res = makeRes();
    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  test('404 — user not found in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const req = { user: { id: 99 }, body: { firstName: 'A', lastName: 'B' } };
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('200 — success, returns ok + data with email', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'teacher@kku.ac.th' });
    const upserted = {
      id: 10,
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      phone: '0801234567',
      faculty: 'วิทยาลัยการคอมพิวเตอร์',
      major: null,
      user: { email: 'teacher@kku.ac.th' },
    };
    prisma.teacher.upsert.mockResolvedValue(upserted);

    const req = {
      user: { id: 1 },
      body: { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0801234567', faculty: 'วิทยาลัยการคอมพิวเตอร์', major: null },
    };
    const res = makeRes();
    await updateProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.data.firstName).toBe('สมชาย');
    expect(body.data.email).toBe('teacher@kku.ac.th');
  });
});

// =====================
// getAllTeachers
// =====================
describe('getAllTeachers', () => {
  test('200 — returns array with flattened email field', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      { id: 1, firstName: 'ก', user: { email: 'a@kku.ac.th' } },
      { id: 2, firstName: 'ข', user: { email: 'b@kku.ac.th' } },
    ]);

    const req = {};
    const res = makeRes();
    await getAllTeachers(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveLength(2);
    expect(body[0].email).toBe('a@kku.ac.th');
    expect(body[1].email).toBe('b@kku.ac.th');
  });
});

// =====================
// reviewT002
// =====================
describe('reviewT002', () => {
  test('400 — missing studentId', async () => {
    const req = { body: { status: 'APPROVED' } };
    const res = makeRes();
    await reviewT002(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — success: upserts studentCoop and updates document', async () => {
    prisma.studentCoop.upsert.mockResolvedValue({});
    prisma.document.findFirst.mockResolvedValue({ id: 55 });
    prisma.document.update.mockResolvedValue({});

    const req = { body: { studentId: 1, status: 'T002_APPROVED', comment: '' } };
    const res = makeRes();
    await reviewT002(req, res);

    expect(prisma.studentCoop.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 1 } })
    );
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'T002_FORM' }) })
    );
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 55 } })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
  });

  test('200 — no document found: skips document update', async () => {
    prisma.studentCoop.upsert.mockResolvedValue({});
    prisma.document.findFirst.mockResolvedValue(null);

    const req = { body: { studentId: 2, status: 'T002_EDITS_REQUIRED', comment: 'แก้ด้วย' } };
    const res = makeRes();
    await reviewT002(req, res);

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

// =====================
// getDashboardStats
// =====================
describe('getDashboardStats', () => {
  test('200 — teacher not found, returns zeros', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const req = { user: { id: 99 }, query: {} };
    const res = makeRes();
    await getDashboardStats(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0 });
  });

  test('200 — teacher found, returns real counts', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, firstName: 'สมชาย' });
    prisma.student.count.mockResolvedValue(8);
    prisma.studentCoop.count
      .mockResolvedValueOnce(3)  // pendingRequests
      .mockResolvedValueOnce(5); // approvedStudents

    const req = { user: { id: 1 }, query: {} };
    const res = makeRes();
    await getDashboardStats(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.data.myStudentsCount).toBe(8);
    expect(body.data.pendingRequests).toBe(3);
    expect(body.data.approvedStudents).toBe(5);
  });
});

// =====================
// createTeacher
// =====================
describe('createTeacher', () => {
  test('400 — missing required fields', async () => {
    const req = { body: { firstName: 'สมชาย' } }; // missing lastName and email
    const res = makeRes();
    await createTeacher(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('409 — email already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 1, email: 'dup@kku.ac.th' });

    const req = { body: { firstName: 'ก', lastName: 'ข', email: 'dup@kku.ac.th' } };
    const res = makeRes();
    await createTeacher(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — success creates user and teacher', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 20, email: 'new@kku.ac.th', role: 'teacher' });
    prisma.teacher.create.mockResolvedValue({
      id: 7,
      userId: 20,
      firstName: 'ใหม่',
      lastName: 'ทดสอบ',
      email: 'new@kku.ac.th',
    });

    const req = { body: { firstName: 'ใหม่', lastName: 'ทดสอบ', email: 'new@kku.ac.th' } };
    const res = makeRes();
    await createTeacher(req, res);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.teacher.create).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.teacher.email).toBe('new@kku.ac.th');
  });
});

// =====================
// deleteTeacher
// =====================
describe('deleteTeacher', () => {
  test('404 — teacher not found', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();
    await deleteTeacher(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('200 — success deletes user (cascades to teacher)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 20 });
    prisma.user.delete.mockResolvedValue({ id: 20 });

    const req = { params: { id: '5' } };
    const res = makeRes();
    await deleteTeacher(req, res);

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 20 } });

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
  });
});
