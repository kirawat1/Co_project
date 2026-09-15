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
const { getStudents, getMyProfile, updateMyProfile } = require('../controllers/studentController');

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

  test('200 — ดึงข้อมูลที่หน้าดูข้อมูลนักศึกษาใช้: ที่ปรึกษาทั่วไป/โครงงาน, รอบสหกิจ, การนิเทศ', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    await getStudents({ query: {} }, makeRes());

    const { include } = prisma.student.findMany.mock.calls[0][0];
    const teacherSelect = { select: expect.objectContaining({ prefix: true, firstName: true, lastName: true }) };
    expect(include).toMatchObject({
      generalAdvisor: teacherSelect,
      coopAdvisor: teacherSelect,
      coop: { include: expect.objectContaining({ company: true, mentors: true, coopPeriod: expect.any(Object) }) },
      supervisionAppointment: { select: expect.objectContaining({ status: true, confirmedDate: true, coTeacherName: true, teacher: teacherSelect }) },
    });
  });

  test('200 — กรองตามสาขา (majors=AI)', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    prisma.coopCriteria.findMany.mockResolvedValue([]);

    await getStudents({ query: { majors: 'AI' } }, makeRes());

    const { where } = prisma.student.findMany.mock.calls[0][0];
    expect(where.AND).toContainEqual({ OR: [{ major: { in: ['AI'] } }] });
  });

  test('200 — กรองตามสาขา รวมข้อมูลเก่าที่เก็บเป็นชื่อไทยของสาขานั้นด้วย', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);

    await getStudents({ query: { majors: 'CS' } }, makeRes());

    const { where } = prisma.student.findMany.mock.calls[0][0];
    expect(where.AND).toContainEqual({ OR: [{ major: { in: ['CS', 'วิทยาการคอมพิวเตอร์'] } }] });
  });

  test('200 — กรอง "ยังไม่ระบุสาขา" (__NONE__) รวมกับสาขาอื่นได้', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    prisma.coopCriteria.findMany.mockResolvedValue([]);

    await getStudents({ query: { majors: 'CS,__NONE__' } }, makeRes());

    const { where } = prisma.student.findMany.mock.calls[0][0];
    expect(where.AND).toContainEqual({ OR: [{ major: { in: ['CS'] } }, { major: null }, { major: '' }] });
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
        where: { AND: [{ deletedAt: null }, { coop: { coopPeriodId: 3 } }] },
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
  });

  test('200 — ไม่มี coopPeriodId ก็ยังกรอง deletedAt: null เสมอ', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {} };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
  });

  test('200 — teacher role (non-coop) เพิ่ม advisor filter (เฉพาะ coopAdvisorId — ที่ปรึกษาทั่วไปไม่มีสิทธิ์)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, isCoopTeacher: false });
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {}, user: { role: 'teacher' }, userId: 99 };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { deletedAt: null },
            { coopAdvisorId: 7 },
          ],
        },
      })
    );
  });

  test('200 — teacher role (isCoopTeacher) ไม่เพิ่ม advisor filter', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, isCoopTeacher: true });
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const req = { query: {}, user: { role: 'teacher' }, userId: 99 };
    const res = makeRes();

    await getStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
  });

  test('404 — teacher role แต่ไม่พบ teacher record', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const req = { query: {}, user: { role: 'teacher' }, userId: 99 };
    const res = makeRes();

    await getStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

const {
  softDeleteStudent,
  getTrashedStudents,
  restoreStudent,
  permanentlyDeleteStudent,
} = require('../controllers/studentController');

describe('softDeleteStudent', () => {
  test('200 — ตั้ง deletedAt ให้นักศึกษาที่มีอยู่', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
    prisma.student.update.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('409 — อยู่ในถังขยะอยู่แล้ว', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await softDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('getTrashedStudents', () => {
  test('200 — คืนรายชื่อที่ deletedAt ไม่เป็น null', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 1, deletedAt: new Date() }]);

    const req = {};
    const res = makeRes();

    await getTrashedStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: { not: null } },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: expect.any(Array) }));
  });
});

describe('restoreStudent', () => {
  test('200 — ล้าง deletedAt', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    prisma.student.update.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: null },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('409 — ไม่ได้อยู่ในถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await restoreStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('permanentlyDeleteStudent', () => {
  const fs = require('fs');
  let unlinkSpy;
  beforeEach(() => {
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    prisma.document.count.mockResolvedValue(0);
    prisma.studentCoop.count.mockResolvedValue(0);
    prisma.supervisionAppointment.count.mockResolvedValue(0);
  });
  afterEach(() => unlinkSpy.mockRestore());

  test('200 — ลบจริงเมื่ออยู่ในถังขยะแล้ว และลบ User (บัญชี login) คู่กันด้วย', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, userId: 10, deletedAt: new Date(), documents: [], coop: null, supervisionAppointment: null });
    prisma.student.delete.mockResolvedValue({ id: 1 });
    prisma.user.delete.mockResolvedValue({ id: 10 });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 — นักศึกษาเคยเพิ่มบริษัทไว้ ก็ลบได้ (บริษัทคงอยู่ DB ตั้ง createdById = NULL เอง)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, userId: 10, deletedAt: new Date(), documents: [], coop: null, supervisionAppointment: null });
    prisma.company.count.mockResolvedValue(2);
    prisma.student.delete.mockResolvedValue({ id: 1 });
    prisma.user.delete.mockResolvedValue({ id: 10 });

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  test('200 — ลบไฟล์ที่อัปโหลดของนักศึกษาออกจาก disk ด้วย แต่ข้ามไฟล์ที่ยังมีข้อมูลอื่นอ้างถึง', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, deletedAt: new Date(),
      documents: [{ path: 'doc-a.pdf' }, { path: 'shared.pdf' }],
      coop: { reqLetterUrl: 'req.pdf', acceptanceFileUrl: null, placeLetterUrl: 'place.pdf' },
      supervisionAppointment: { officialLetterPath: '../../etc/sup.pdf' },
    });
    prisma.student.delete.mockResolvedValue({});
    prisma.user.delete.mockResolvedValue({});
    prisma.document.count.mockImplementation(({ where }) => Promise.resolve(where.path === 'shared.pdf' ? 1 : 0));

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    const removed = unlinkSpy.mock.calls.map(([p]) => require('path').basename(p)).sort();
    expect(removed).toEqual(['doc-a.pdf', 'place.pdf', 'req.pdf', 'sup.pdf']);
    // ชื่อไฟล์จาก DB ถูกตัดเหลือแค่ชื่อไฟล์ ไม่หลุดออกนอกโฟลเดอร์ uploads
    unlinkSpy.mock.calls.forEach(([p]) => expect(require('path').dirname(p)).toMatch(/uploads$/));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  // บัญชีนักศึกษาที่มีข้อมูลอาจารย์ค้างอยู่ (เดิม 500 P2003 เพราะ Teacher.userId เป็น RESTRICT)
  const strayTeacherStudent = () => ({
    id: 1, userId: 3, deletedAt: new Date(), documents: [], coop: null, supervisionAppointment: null,
    user: { role: 'student', teacher: { id: 7 }, staffProfile: null },
  });

  test('200 — บัญชีนักศึกษามีข้อมูลอาจารย์ค้างอยู่ ไม่มีใครใช้ → ลบข้อมูลอาจารย์ + บัญชีไปด้วย และล้างอาจารย์ที่ปรึกษาของนักศึกษาที่ชี้มา', async () => {
    prisma.student.findUnique.mockResolvedValue(strayTeacherStudent());
    prisma.student.delete.mockResolvedValue({});
    prisma.supervisionAppointment.count.mockResolvedValue(0);
    prisma.visit.count.mockResolvedValue(0);
    prisma.student.updateMany.mockResolvedValue({ count: 2 });
    prisma.teacher.delete.mockResolvedValue({});
    prisma.user.delete.mockResolvedValue({});

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.supervisionAppointment.count).toHaveBeenCalledWith({ where: { teacherId: 7 } });
    expect(prisma.student.updateMany).toHaveBeenCalledWith({ where: { generalAdvisorId: 7 }, data: { generalAdvisorId: null, advisorName: null } });
    expect(prisma.student.updateMany).toHaveBeenCalledWith({ where: { coopAdvisorId: 7 }, data: { coopAdvisorId: null, advisorName: null } });
    expect(prisma.teacher.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
  });

  test('409 — ข้อมูลอาจารย์ที่ค้างอยู่ยังเป็นอาจารย์นิเทศของนักศึกษาคนอื่น → ไม่ลบอะไร และบอกจำนวนที่ติด', async () => {
    prisma.student.findUnique.mockResolvedValue(strayTeacherStudent());
    prisma.student.delete.mockResolvedValue({});
    prisma.supervisionAppointment.count.mockResolvedValue(2);
    prisma.visit.count.mockResolvedValue(0);

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/นัดหมายนิเทศ 2/);
    expect(prisma.teacher.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  test('200 — บัญชีจริงเป็นอาจารย์ (role teacher) แต่มีข้อมูลนักศึกษา → ลบเฉพาะข้อมูลนักศึกษา เก็บบัญชีอาจารย์ไว้', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...strayTeacherStudent(), user: { role: 'teacher', teacher: { id: 7 }, staffProfile: null } });
    prisma.student.delete.mockResolvedValue({});

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.teacher.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, accountKept: true });
    expect(res.json.mock.calls[0][0].message).toMatch(/อาจารย์/);
  });

  test('409 — ติดข้อมูลอื่นที่อ้างถึง (P2003) → แจ้งชัดเจน ไม่ใช่ 500 กลางๆ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, userId: 10, deletedAt: new Date(), documents: [], coop: null, supervisionAppointment: null, user: { role: 'student', teacher: null, staffProfile: null } });
    prisma.student.delete.mockResolvedValue({});
    prisma.user.delete.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003', meta: { field_name: 'userId' } }));

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  test('500 — ลบใน DB ไม่สำเร็จ → ไม่ลบไฟล์', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, userId: 10, deletedAt: new Date(), documents: [{ path: 'doc-a.pdf' }], coop: null, supervisionAppointment: null });
    prisma.student.delete.mockRejectedValue(new Error('DB fail'));

    const res = makeRes();
    await permanentlyDeleteStudent({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  test('400 — ปฏิเสธถ้ายังไม่ได้ย้ายไปถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });

    const req = { params: { id: '1' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' } };
    const res = makeRes();

    await permanentlyDeleteStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });
});

const { updateStudentBasicInfo } = require('../controllers/studentController');

describe('updateStudentBasicInfo', () => {
  test('200 — แก้ไขข้อมูลพื้นฐาน ไม่แก้ email', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1, firstName: 'ใหม่' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ firstName: 'ใหม่', lastName: 'สกุล', studentId: 'u640099' }),
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 — แก้ email → อัปเดต User.email + username ที่มาจากอีเมล + อีเมลในข้อมูลนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, email: 'old@kkumail.com', user: { email: 'old@kkumail.com' },
    });
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: 'old@kkumail.com' });
    prisma.user.findFirst.mockResolvedValue(null); // ไม่ชนกับใคร
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1 });
    prisma.user.update.mockResolvedValue({ id: 10, email: 'new@kkumail.com' });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'New@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { email: 'new@kkumail.com', username: 'new@kkumail.com' },
    });
    expect(prisma.student.update.mock.calls[0][0].data.email).toBe('new@kkumail.com');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('200 — บัญชีเก่าที่ username เป็นรหัสนักศึกษา แก้ email → username เป็นอีเมลใหม่ด้วย', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, email: 'contact@gmail.com', user: { email: 'old@kkumail.com' },
    });
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: '663380001-1' });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.student.update.mockResolvedValue({ id: 1 });
    prisma.user.update.mockResolvedValue({});

    const res = makeRes();
    await updateStudentBasicInfo({ params: { id: '1' }, body: { firstName: 'ก', lastName: 'ข', email: 'new@kkumail.com' } }, res);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { email: 'new@kkumail.com', username: 'new@kkumail.com' } });
    // อีเมลติดต่อที่ไม่ใช่อีเมลบัญชีเดิม ไม่ถูกทับ
    expect(prisma.student.update.mock.calls[0][0].data.email).toBeUndefined();
  });

  test('409 — email ใหม่ชนกับ user อื่น', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: 'old@kkumail.com' });
    prisma.user.findFirst.mockResolvedValue({ id: 99 });

    const req = {
      params: { id: '1' },
      body: { firstName: 'ก', lastName: 'ข', email: 'taken@kkumail.com' },
    };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const req = { params: { id: '999' }, body: { firstName: 'ก' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('409 — studentId ซ้ำ (P2002)', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, userId: 10, user: { email: 'old@kkumail.com' },
    });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002', meta: { target: 'studentId' } });
    prisma.$transaction.mockRejectedValue(p2002);

    const req = { params: { id: '1' }, body: { firstName: 'ก', studentId: 'u640001' } };
    const res = makeRes();

    await updateStudentBasicInfo(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
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

  test('200 — majorNameTh ชื่อสาขาภาษาไทยจาก criteria (ใช้พิมพ์ในเอกสาร T000/T003/หนังสือยินยอมผู้ปกครอง)', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 1, studentId: 'u640001', major: 'CS', coop: null, documents: [], emails: [], user: { email: 'a@kku.ac.th' },
    });
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);

    const res = makeRes();
    await getMyProfile({ userId: 1 }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.major).toBe('CS');
    expect(body.majorNameTh).toBe('วิทยาการคอมพิวเตอร์');
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
// updateMyProfile — นักศึกษาแก้ไขข้อมูลตัวเอง
// =====================
describe('updateMyProfile', () => {
  // เทสก่อนหน้า (updateStudentBasicInfo) ตั้ง $transaction ให้ reject ค้างไว้ — clearAllMocks ไม่ล้าง mockRejectedValue
  beforeEach(() => {
    prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  });

  const setupUpsert = () => {
    prisma.student.findUnique.mockResolvedValue({ deletedAt: null, activityUnit: 5 });
    prisma.student.upsert.mockResolvedValue({ id: 1 });
  };

  // ระบบไม่ใช้ GPA แล้ว — ส่งมาก็ไม่บันทึก และค่าที่ไม่ใช่ตัวเลขก็ไม่ทำให้บันทึกโปรไฟล์ไม่ได้
  test.each(['3.75', 'abc', ''])('200 — ส่ง gpa (%p) มาก็ไม่บันทึก gpa', async (gpa) => {
    setupUpsert();
    const res = makeRes();

    await updateMyProfile({ userId: 1, body: { firstName: 'ก', gpa } }, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const { update, create } = prisma.student.upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty('gpa');
    expect(create).not.toHaveProperty('gpa');
  });

  test('200 — ไม่กรอก activityUnit (ส่งค่าว่าง) → ไม่ใช่ error', async () => {
    setupUpsert();
    const req = { userId: 1, body: { firstName: 'ก', activityUnit: '' } };
    const res = makeRes();

    await updateMyProfile(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(prisma.student.upsert.mock.calls[0][0].update.activityUnit).toBeUndefined();
  });

  // เดิม endpoint นี้รับ advisorName ดิบๆ จาก client แต่ไม่เคยอัปเดต generalAdvisorId เลย —
  // นักศึกษาเปลี่ยนที่ปรึกษาทั่วไปที่หน้าโปรไฟล์ตัวเอง ข้อความเปลี่ยนแต่ FK ไม่เปลี่ยนตาม (บั๊กจริงที่เจอ)
  test('200 — เปลี่ยนที่ปรึกษาทั่วไป → อัปเดต generalAdvisorId จริง และ derive advisorName จากอาจารย์ที่เลือก (ไม่เชื่อ advisorName ดิบจาก client)', async () => {
    setupUpsert();
    prisma.teacher.findUnique.mockResolvedValue({ id: 42, prefix: 'ผศ.ดร.', firstName: 'วชิราวุธ', lastName: 'ธรรมวิเศษ' });
    const req = { userId: 1, body: { firstName: 'ก', generalAdvisorId: 42, advisorName: 'ชื่อปลอมที่ client ส่งมาเอง' } };
    const res = makeRes();

    await updateMyProfile(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const update = prisma.student.upsert.mock.calls[0][0].update;
    expect(update.generalAdvisorId).toBe(42);
    expect(update.advisorName).toBe('ผศ.ดร.วชิราวุธ ธรรมวิเศษ');
  });

  test('200 — ล้างที่ปรึกษาทั่วไป (generalAdvisorId: null) → เคลียร์ทั้ง FK และ advisorName', async () => {
    setupUpsert();
    const req = { userId: 1, body: { firstName: 'ก', generalAdvisorId: null } };
    const res = makeRes();

    await updateMyProfile(req, res);

    const update = prisma.student.upsert.mock.calls[0][0].update;
    expect(update.generalAdvisorId).toBeNull();
    expect(update.advisorName).toBeNull();
  });

  test('400 — เลือกอาจารย์ที่ปรึกษาทั่วไปที่ไม่มีอยู่จริง', async () => {
    setupUpsert();
    prisma.teacher.findUnique.mockResolvedValue(null);
    const req = { userId: 1, body: { firstName: 'ก', generalAdvisorId: 999 } };
    const res = makeRes();

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.student.upsert).not.toHaveBeenCalled();
  });

  test('200 — เลือกอาจารย์ที่ปรึกษาโครงงานสหกิจ → ตรวจสอบว่ามีอาจารย์คนนี้จริงก่อนผูก FK', async () => {
    setupUpsert();
    prisma.teacher.findUnique.mockResolvedValue({ id: 7, firstName: 'บี', lastName: 'สหกิจ' });
    const req = { userId: 1, body: { firstName: 'ก', coopAdvisorId: 7 } };
    const res = makeRes();

    await updateMyProfile(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(prisma.student.upsert.mock.calls[0][0].update.coopAdvisorId).toBe(7);
  });
});

// =====================
// exportStudents
// =====================
describe('exportStudents', () => {
  test('200 — ส่งไฟล์ xlsx กลับ พร้อม Content-Type และ Content-Disposition ที่ถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        studentId: '643021218',
        prefix: 'MR',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        major: 'CS',
        year: '4',
        coop: { status: 'QUALIFIED', company: { name: 'บริษัท ทดสอบ' } },
        generalAdvisor: null,
        coopAdvisor: null,
      },
    ]);

    const req = { query: {} };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);

    const { exportStudents } = require('../controllers/studentController');
    const { STUDENT_EXPORT_INCLUDE } = require('../utils/studentExport');
    await exportStudents(req, res);

    // ข้อมูลเพิ่ม: ระบบการศึกษา, อาจารย์นิเทศ/นัดนิเทศ, รอบสหกิจ, พี่เลี้ยง, ชื่อรายงาน, อีเมล · ชื่อสาขาไทยจาก criteria
    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null },
      include: STUDENT_EXPORT_INCLUDE,
    }));
    expect(STUDENT_EXPORT_INCLUDE).toMatchObject({
      coop: { include: { company: true, coopPeriod: true, mentors: true } },
      supervisionAppointment: expect.any(Object),
      t003Form: expect.any(Object),
    });
    expect(prisma.coopCriteria.findMany).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="students_')
    );
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  test('200 — filter ตาม coopPeriodId เมื่อระบุ (ไม่ใช่ "all")', async () => {
    prisma.student.findMany.mockResolvedValue([]);

    const req = { query: { coopPeriodId: '5' } };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null, coop: { coopPeriodId: 5 } },
    }));
  });

  test('500 — DB error คืน { ok: false }', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB fail'));

    const req = { query: {} };
    const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    const { exportStudents } = require('../controllers/studentController');
    await exportStudents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// =====================
// createStudentSingle — สาขาวิชาต้องมาจากหน้าจัดการสาขาวิชา (CoopCriteria)
// =====================
describe('createStudentSingle — major', () => {
  const { createStudentSingle } = require('../controllers/studentController');
  const baseBody = { studentId: '663380001-1', firstName: 'ก', lastName: 'ข', email: 'a@kkumail.com' };

  beforeEach(() => {
    // mockReset ล้างค่าที่ค้างจาก describe ก่อนหน้า (clearAllMocks ไม่ล้าง implementation) —
    // เช่นเทสต์ updateStudentBasicInfo ตั้ง $transaction ให้ throw P2002 ไว้
    [prisma.user.findFirst, prisma.student.findFirst, prisma.user.create, prisma.coopCriteria.findFirst].forEach(m => m.mockReset());
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 5, email: 'a@kkumail.com', student: { studentId: '663380001-1' } });
  });

  test('เลือกรหัสสาขา (CS) → เก็บรหัสสาขา', async () => {
    prisma.coopCriteria.findFirst.mockResolvedValue({ major: 'CS' });
    const res = makeRes();
    await createStudentSingle({ body: { ...baseBody, major: 'CS' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.user.create.mock.calls[0][0].data.student.create.major).toBe('CS');
  });

  test('ระบบไม่ใช้ GPA แล้ว — ส่ง gpa มาก็ไม่บันทึก', async () => {
    prisma.coopCriteria.findFirst.mockResolvedValue({ major: 'CS' });
    const res = makeRes();
    await createStudentSingle({ body: { ...baseBody, major: 'CS', gpa: '3.5' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.user.create.mock.calls[0][0].data.student.create).not.toHaveProperty('gpa');
  });

  test('ส่งชื่อไทย (วิทยาการคอมพิวเตอร์) → แปลงเป็นรหัสสาขาที่ตรงกัน', async () => {
    prisma.coopCriteria.findFirst.mockResolvedValue({ major: 'CS' });
    const res = makeRes();
    await createStudentSingle({ body: { ...baseBody, major: ' วิทยาการคอมพิวเตอร์ ' } }, res);

    expect(prisma.coopCriteria.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ major: 'วิทยาการคอมพิวเตอร์' }, { nameTh: 'วิทยาการคอมพิวเตอร์' }] },
    }));
    expect(prisma.user.create.mock.calls[0][0].data.student.create.major).toBe('CS');
  });

  test('400 — สาขาที่ไม่มีในหน้าจัดการสาขาวิชา ไม่สร้างนักศึกษา', async () => {
    prisma.coopCriteria.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await createStudentSingle({ body: { ...baseBody, major: 'สาขาพิมพ์ผิด' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/ไม่พบสาขาวิชา/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('ไม่เลือกสาขา → major = null ไม่ต้องค้นหา', async () => {
    const res = makeRes();
    await createStudentSingle({ body: { ...baseBody, major: '' } }, res);

    expect(prisma.coopCriteria.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create.mock.calls[0][0].data.student.create.major).toBeNull();
  });
});
