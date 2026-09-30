// __tests__/majorScope.test.js — ขอบเขตหลักสูตร (อาจารย์ประจำวิชาเห็น/ทำได้เฉพาะหลักสูตรที่ดูแล)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { getMajorScope, studentWhere, visibleStudentWhere, assertStudentInScope } = require('../utils/majorScope');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STAFF = { user: { id: 1, role: 'staff' } };
const coopReq = (majors = ['CS']) => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: majors.map((major) => ({ major })) });
  return { user: { id: 2, role: 'teacher' } };
};

beforeEach(() => jest.clearAllMocks());

describe('getMajorScope / studentWhere / visibleStudentWhere', () => {
  test('เจ้าหน้าที่ = ทุกหลักสูตร ไม่กรอง', async () => {
    const scope = await getMajorScope({ ...STAFF });
    expect(scope.all).toBe(true);
    expect(studentWhere(scope)).toEqual({});
    expect(await visibleStudentWhere({ ...STAFF })).toEqual({});
  });

  test('อาจารย์ประจำวิชา = หลักสูตรที่ดูแล · เห็นนักศึกษาในหลักสูตร หรือที่ตัวเองเป็นที่ปรึกษา', async () => {
    const req = coopReq(['CS', 'AI']);
    const scope = await getMajorScope(req);
    expect(scope).toEqual({ all: false, majors: ['CS', 'AI'] });
    expect(studentWhere(scope)).toEqual({ major: { in: ['CS', 'AI'] } });
    expect(await visibleStudentWhere(req)).toEqual({ OR: [{ coopAdvisorId: 20 }, { major: { in: ['CS', 'AI'] } }] });
  });

  test('อาจารย์ทั่วไป = ไม่มีหลักสูตร · เห็นเฉพาะที่ตัวเองเป็นที่ปรึกษา', async () => {
    const req = coopReq([]);
    expect(await visibleStudentWhere(req)).toEqual({ OR: [{ coopAdvisorId: 20 }] });
  });

  test('ไม่มี role ที่รู้จัก → ไม่เห็นใครเลย', async () => {
    expect(await visibleStudentWhere({ user: { id: 9, role: 'student' } })).toEqual({ id: -1 });
  });

  test('assertStudentInScope: นักศึกษานอกหลักสูตร → 403 · ในหลักสูตร/เจ้าหน้าที่ → ผ่าน', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({ major: 'AI' });
    await expect(assertStudentInScope(coopReq(['CS']), 5)).rejects.toMatchObject({ is403: true });
    prisma.student.findUnique.mockResolvedValueOnce({ major: 'CS' });
    await expect(assertStudentInScope(coopReq(['CS']), 5)).resolves.toBeUndefined();
    await expect(assertStudentInScope({ ...STAFF }, 5)).resolves.toBeUndefined();
  });

  test('นักศึกษาที่ยังไม่มีหลักสูตร → อาจารย์ประจำวิชาทำไม่ได้ (เจ้าหน้าที่เท่านั้น)', async () => {
    prisma.student.findUnique.mockResolvedValueOnce({ major: null });
    await expect(assertStudentInScope(coopReq(['CS']), 5)).rejects.toMatchObject({ is403: true });
  });
});

describe('อาจารย์ประจำวิชา CS ทำกับนักศึกษา AI ไม่ได้', () => {
  test('เปลี่ยนสถานะเอกสาร → 403 ไม่แก้ข้อมูล', async () => {
    const { updateDocStatus } = require('../controllers/adminDocController');
    prisma.document.findUnique.mockResolvedValue({ studentId: 5 });
    prisma.student.findUnique.mockResolvedValue({ major: 'AI' });
    const res = makeRes();
    await updateDocStatus({ ...coopReq(['CS']), params: { id: '3' }, body: { status: 'APPROVED' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test('ตรวจคำร้อง: นักศึกษาในหลักสูตร (ไม่ใช่ที่ปรึกษา) ทำได้ · นอกหลักสูตรได้ 403', async () => {
    const { updateCoopApplicationStatus } = require('../controllers/adminDocController');
    const record = (major) => ({ status: 'WAITING_FOR_STAFF_CHECK', student: { deletedAt: null, id: 5, coopAdvisorId: 99, major } });
    prisma.studentCoop.update.mockResolvedValue({ studentId: 5 });

    prisma.studentCoop.findUnique.mockResolvedValueOnce(record('CS'));
    const ok = makeRes();
    await updateCoopApplicationStatus({ ...coopReq(['CS']), params: { id: '1' }, body: { status: 'QUALIFIED' } }, ok);
    expect(ok.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));

    prisma.studentCoop.findUnique.mockResolvedValueOnce(record('AI'));
    const denied = makeRes();
    await updateCoopApplicationStatus({ ...coopReq(['CS']), params: { id: '1' }, body: { status: 'QUALIFIED' } }, denied);
    expect(denied.status).toHaveBeenCalledWith(403);
  });

  test('เลือกอาจารย์นิเทศร่วม → 403', async () => {
    const { assignCoTeachers } = require('../controllers/supervisionController');
    prisma.supervisionAppointment.findUnique.mockResolvedValue({ id: 4, studentId: 5, teacherId: 1 });
    prisma.student.findUnique.mockResolvedValue({ major: 'AI' });
    const res = makeRes();
    await assignCoTeachers({ ...coopReq(['CS']), params: { id: '4' }, body: { coTeacherIds: [7] } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.supervisionCoTeacher.createMany).not.toHaveBeenCalled();
  });

  test('รายการนิเทศ / คำร้อง / T000 กรองตามหลักสูตร', async () => {
    const { getAllSupervisions } = require('../controllers/supervisionController');
    const { getCoopApplications, getStudentsForT000 } = require('../controllers/adminDocController');
    prisma.supervisionAppointment.findMany.mockResolvedValue([]);
    prisma.coopCriteria.findMany.mockResolvedValue([]);
    prisma.studentCoop.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);

    await getAllSupervisions(coopReq(['CS']), makeRes());
    expect(prisma.supervisionAppointment.findMany.mock.calls[0][0].where.student).toEqual({ deletedAt: null, major: { in: ['CS'] } });
    await getCoopApplications(coopReq(['CS']), makeRes());
    expect(prisma.studentCoop.findMany.mock.calls[0][0].where.student).toEqual({ deletedAt: null, major: { in: ['CS'] } });
    await getStudentsForT000(coopReq(['CS']), makeRes());
    expect(prisma.student.findMany.mock.calls[0][0].where.AND).toContainEqual({ major: { in: ['CS'] } });
  });
});

describe('ประกาศ — อาจารย์ประจำวิชาประกาศได้เฉพาะหลักสูตรที่ดูแล', () => {
  const { addOrUpdateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
  const body = (targetMajors) => ({ title: 'T', date: '2026-10-01', year: '2569', targetMajors: JSON.stringify(targetMajors) });

  test('ไม่เลือกหลักสูตร (= ทุกหลักสูตร) → 403', async () => {
    const res = makeRes();
    await addOrUpdateAnnouncement({ ...coopReq(['CS']), body: body([]), files: [] }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  test('หลักสูตรที่ไม่ได้ดูแล → 403 · หลักสูตรตัวเอง → สร้างได้', async () => {
    const denied = makeRes();
    await addOrUpdateAnnouncement({ ...coopReq(['CS']), body: body(['CS', 'AI']), files: [] }, denied);
    expect(denied.status).toHaveBeenCalledWith(403);

    prisma.announcement.create.mockResolvedValue({ id: 'a1' });
    const ok = makeRes();
    await addOrUpdateAnnouncement({ ...coopReq(['CS']), body: body(['CS']), files: [] }, ok);
    expect(prisma.announcement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ targetMajors: ['CS'] }) }));
  });

  test('ลบประกาศทุกหลักสูตร (ของเจ้าหน้าที่) ไม่ได้', async () => {
    prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', targetMajors: [], files: [] });
    const res = makeRes();
    await deleteAnnouncement({ ...coopReq(['CS']), params: { id: 'a1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.announcement.delete).not.toHaveBeenCalled();
  });
});
