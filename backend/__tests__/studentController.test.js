// __tests__/studentController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

jest.mock('../services/kkuRegService', () => ({
  isConfigured: jest.fn(() => false),
  syncStudentAll: jest.fn(),
  getStudentToken: jest.fn(),
  getGradeList: jest.fn(),
  getCurrentSemester: jest.fn(),
}));

const prisma = require('./__mocks__/prismaClient');
const { getStudents, getMyProfile } = require('../controllers/studentController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// =====================
// getStudents — pagination
// =====================
describe('getStudents', () => {
  const mockStudents = [
    { id: 1, studentId: 'u640001', firstName: 'ก', lastName: 'ข' },
    { id: 2, studentId: 'u640002', firstName: 'ค', lastName: 'ง' },
  ];

  test('200 — คืน list + meta pagination', async () => {
    prisma.student.findMany.mockResolvedValue(mockStudents);
    prisma.student.count.mockResolvedValue(2);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ total: 2, page: 1, limit: 50, totalPages: 1 });
  });

  test('200 — page 2 ส่ง skip ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(60);

    const req = { query: { page: '2', limit: '10' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
    }));

    const body = res.json.mock.calls[0][0];
    expect(body.meta.page).toBe(2);
    expect(body.meta.totalPages).toBe(6);
  });

  test('200 — limit ไม่เกิน 100', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: { limit: '9999' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
    }));
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB connection lost'));
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('200 — กรองตาม coopPeriodId ส่ง where ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 1, studentId: 'u640001', firstName: 'ก', lastName: 'ข' },
    ]);
    prisma.student.count.mockResolvedValue(1);

    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ coop: { coopPeriodId: 3 } }] },
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
  });

  test('200 — ไม่มี coopPeriodId ส่ง where เป็น {}', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

// =====================
// getMyProfile
// =====================
describe('getMyProfile', () => {
  test('200 — ส่ง student profile กลับมา', async () => {
    const studentData = {
      id: 1,
      studentId: 'u640001',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      coop: { company: { id: 5, name: 'Test Co', mentors: [] }, mentor: null },
      coopApplicationForm: null,
      documents: [],
      emails: [],
      user: { email: 'student@kku.ac.th' },
      t003Form: null,
    };
    prisma.student.findUnique.mockResolvedValue(studentData);

    const req = { userId: 1 };
    const res = makeRes();

    await getMyProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.studentId).toBe('u640001');
    expect(body.company).toBeDefined();
  });

  test('200 — คืน default profile เมื่อไม่มีข้อมูลนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'user@kku.ac.th' });

    const req = { userId: 1 };
    const res = makeRes();

    await getMyProfile(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.studentId).toBe('');
    expect(body.userEmail).toBe('user@kku.ac.th');
  });
});

// =====================
// checkEligibility helper (exported for testing)
// =====================
const { checkEligibility } = require('../controllers/studentController');

describe('checkEligibility', () => {
  const criteria = {
    prepCourseCodes: ['CP002001', 'SC002001'],
    requiredCourses: ['CP001001', 'CP001002'],
    coreCourses: ['SC310001', 'SC310002', 'SC310003'],
    electiveMinCount: 2,
  };

  const gradeList = [
    { course_code: 'CP002001', grade: 'S' },
    { course_code: 'CP001001', grade: 'A' },
    { course_code: 'CP001002', grade: 'B+' },
    { course_code: 'SC310001', grade: 'B' },
    { course_code: 'SC310002', grade: 'C' },
  ];

  test('qualified — all criteria met', () => {
    const result = checkEligibility(gradeList, criteria);
    expect(result.isPassPrepCourse).toBe(true);
    expect(result.passedAllRequired).toBe(true);
    expect(result.passedElectiveCount).toBe(2);
    expect(result.isQualified).toBe(true);
  });

  test('not qualified — missing one required course', () => {
    const partialGrades = gradeList.filter(g => g.course_code !== 'CP001002');
    const result = checkEligibility(partialGrades, criteria);
    expect(result.passedAllRequired).toBe(false);
    expect(result.isQualified).toBe(false);
  });

  test('not qualified — prep course not passed', () => {
    const noPrepGrades = gradeList.filter(g => g.course_code !== 'CP002001');
    const result = checkEligibility(noPrepGrades, criteria);
    expect(result.isPassPrepCourse).toBe(false);
    expect(result.isQualified).toBe(false);
  });

  test('not qualified — only 1 elective passed (needs 2)', () => {
    const oneElective = gradeList.filter(g => g.course_code !== 'SC310002');
    const result = checkEligibility(oneElective, criteria);
    expect(result.passedElectiveCount).toBe(1);
    expect(result.isQualified).toBe(false);
  });

  test('qualified — no required courses configured (empty array)', () => {
    const emptyCriteria = { ...criteria, requiredCourses: [] };
    const result = checkEligibility(gradeList, emptyCriteria);
    expect(result.passedAllRequired).toBe(true);
  });

  test('qualified — no elective courses configured (empty array)', () => {
    const emptyCriteria = { ...criteria, coreCourses: [] };
    const result = checkEligibility(gradeList, emptyCriteria);
    expect(result.isQualified).toBe(true);
  });

  test('null gradeList returns all false', () => {
    const result = checkEligibility(null, criteria);
    expect(result.isPassPrepCourse).toBe(false);
    expect(result.isQualified).toBe(false);
  });
});
