// __tests__/announcementRooms.test.js — ประกาศแบบห้องเรียน (รอบ × หลักสูตร): ใครเห็นอะไร · ห้อง · ปักหมุด · ตั้งเวลา · แจ้งเตือน
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('../utils/notificationHelper', () => ({ createNotifications: jest.fn().mockResolvedValue(), getStaffAndCoopTeacherIds: jest.fn().mockResolvedValue([]) }));
jest.mock('multer', () => { const m = () => ({ array: () => jest.fn() }); m.diskStorage = jest.fn(() => ({})); return m; });

const prisma = require('./__mocks__/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const { getAnnouncements, getRooms, setPinned, addOrUpdateAnnouncement } = require('../controllers/announcementController');
const audience = require('../utils/announcementAudience');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const FUTURE = new Date(Date.now() + 86_400_000);
const ann = (id, year, targetMajors, over = {}) => ({ id, title: id, body: '', date: new Date('2026-10-01'), year, linkUrl: null, targetMajors, files: [], pinned: false, publishAt: null, authorId: null, ...over });
const LIST = [
  ann('g-2', '2/2569', []),            // ส่วนกลาง เทอม 2
  ann('cs-2', '2/2569', ['CS']),
  ann('ai-2', '2/2569', ['AI']),
  ann('cs-1', '1/2569', ['CS']),       // รอบอื่น
  ann('cs-sched', '2/2569', ['CS'], { publishAt: FUTURE }),
  ann('legacy-null', '2/2569', null),  // ข้อมูลเก่า targetMajors = null → ส่วนกลาง
];
const ids = (res) => res.json.mock.calls[0][0].list.map((a) => a.id).sort();

beforeEach(() => {
  jest.clearAllMocks();
  prisma.announcement.findMany.mockImplementation(async ({ where }) => LIST.filter((a) => !where?.year || a.year === where.year));
  prisma.user.findMany.mockResolvedValue([]);
});

const asStudent = (major, periodId = 2) => {
  prisma.student.findUnique.mockResolvedValue({ major, deletedAt: null, coop: { coopPeriodId: periodId } });
  prisma.coopPeriod.findUnique.mockResolvedValue(periodId === 2 ? { semester: 2, academicYear: '2569' } : { semester: 1, academicYear: '2569' });
  return { user: { id: 50, role: 'student' }, query: {}, method: 'GET', get: () => '' };
};
const asTeacher = (major, coopMajors = []) => {
  prisma.teacher.findUnique.mockImplementation(async ({ select }) => (select?.coopMajors ? { coopMajors: coopMajors.map((m) => ({ major: m })) } : { major }));
  return (query = {}) => ({ user: { id: 30, role: 'teacher' }, query, method: 'GET', get: () => '' });
};

describe('ใครเห็นอะไร', () => {
  test('นักศึกษา CS เทอม 2: ส่วนกลาง + CS ของเทอม 2 · ไม่เห็น AI / รอบอื่น / ที่ตั้งเวลาไว้', async () => {
    const res = makeRes();
    await getAnnouncements(asStudent('CS'), res);
    expect(ids(res)).toEqual(['cs-2', 'g-2', 'legacy-null']);
  });

  test('นักศึกษาส่ง ?major=AI&year=1/2569 มาเอง → ไม่มีผล (เดิมแก้ URL อ่านหลักสูตรอื่นได้)', async () => {
    const req = asStudent('CS');
    req.query = { major: 'AI', year: '1/2569', room: 'AI' };
    const res = makeRes();
    await getAnnouncements(req, res);
    expect(ids(res)).toEqual(['cs-2', 'g-2', 'legacy-null']);
  });

  test('นักศึกษายังไม่มีหลักสูตร → เห็นเฉพาะส่วนกลางของรอบตัวเอง', async () => {
    const res = makeRes();
    await getAnnouncements(asStudent(null), res);
    expect(ids(res)).toEqual(['g-2', 'legacy-null']);
  });

  test('นักศึกษาไม่ได้ผูกรอบ → ใช้รอบที่เปิดอยู่ของหลักสูตรตัวเอง', async () => {
    prisma.student.findUnique.mockResolvedValue({ major: 'CS', deletedAt: null, coop: null });
    prisma.coopPeriodMajor.findFirst.mockResolvedValue({ period: { semester: 1, academicYear: '2569' } });
    const res = makeRes();
    await getAnnouncements({ user: { id: 50, role: 'student' }, query: {} }, res);
    expect(ids(res)).toEqual(['cs-1']);
  });

  test('อาจารย์ทั่วไป CS: ห้อง CS + ส่วนกลาง อ่านอย่างเดียว · ไม่เห็นที่ตั้งเวลาไว้', async () => {
    const req = asTeacher('CS');
    const res = makeRes();
    await getAnnouncements(req({ year: '2/2569' }), res);
    expect(ids(res)).toEqual(['cs-2', 'g-2', 'legacy-null']);
    expect(res.json.mock.calls[0][0].list.every((a) => a.canEdit === false)).toBe(true);
  });

  test('อาจารย์ประจำวิชา AI: เห็นห้อง AI รวมที่ตั้งเวลา · แก้ได้เฉพาะของ AI ไม่ใช่ส่วนกลาง', async () => {
    const req = asTeacher('AI', ['AI']);
    const res = makeRes();
    await getAnnouncements(req({ year: '2/2569', room: 'AI' }), res);
    const list = res.json.mock.calls[0][0].list;
    expect(list.map((a) => a.id).sort()).toEqual(['ai-2', 'g-2', 'legacy-null']);
    expect(Object.fromEntries(list.map((a) => [a.id, a.canEdit]))).toEqual({ 'ai-2': true, 'g-2': false, 'legacy-null': false });
  });

  test('เจ้าหน้าที่ห้องส่วนกลาง → เฉพาะประกาศส่วนกลาง', async () => {
    const res = makeRes();
    await getAnnouncements({ user: { id: 1, role: 'staff' }, query: { year: '2/2569', room: 'GLOBAL' } }, res);
    expect(ids(res)).toEqual(['g-2', 'legacy-null']);
  });

  test('ประกาศที่ตั้งเวลาไว้: เจ้าหน้าที่เห็น พร้อมป้าย scheduled', async () => {
    const res = makeRes();
    await getAnnouncements({ user: { id: 1, role: 'staff' }, query: { year: '2/2569', room: 'CS' } }, res);
    const s = res.json.mock.calls[0][0].list.find((a) => a.id === 'cs-sched');
    expect(s.scheduled).toBe(true);
  });
});

describe('การ์ดห้อง', () => {
  test('เจ้าหน้าที่: ห้องส่วนกลาง + ทุกหลักสูตร · นับประกาศ · โพสต์ได้ทุกห้อง', async () => {
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'AI' }, { major: 'CS' }]);
    const res = makeRes();
    await getRooms({ user: { id: 1, role: 'staff' }, query: { year: '2/2569' } }, res);
    const { rooms } = res.json.mock.calls[0][0];
    expect(rooms.map((r) => r.room)).toEqual(['GLOBAL', 'AI', 'CS']);
    const cs = rooms.find((r) => r.room === 'CS');
    expect(cs).toMatchObject({ count: 4, ownCount: 2, scheduled: 1, canPost: true }); // g-2, legacy, cs-2, cs-sched
    expect(rooms.find((r) => r.room === 'GLOBAL')).toMatchObject({ count: 2, canPost: true });
  });

  test('อาจารย์ประจำวิชา AI: ห้องส่วนกลาง (โพสต์ไม่ได้) + AI', async () => {
    const req = asTeacher('AI', ['AI']);
    const res = makeRes();
    await getRooms(req({ year: '2/2569' }), res);
    const { rooms } = res.json.mock.calls[0][0];
    expect(rooms.map((r) => [r.room, r.canPost])).toEqual([['GLOBAL', false], ['AI', true]]);
  });
});

describe('ปักหมุด', () => {
  test('อาจารย์ประจำวิชาปักหมุดประกาศหลักสูตรตัวเองได้ · ส่วนกลางไม่ได้ (403)', async () => {
    const req = asTeacher('AI', ['AI']);
    prisma.announcement.findUnique.mockResolvedValue({ targetMajors: ['AI'] });
    let res = makeRes();
    await setPinned({ ...req(), params: { id: 'ai-2' }, body: { pinned: true } }, res);
    expect(prisma.announcement.update).toHaveBeenCalledWith({ where: { id: 'ai-2' }, data: { pinned: true } });

    prisma.announcement.findUnique.mockResolvedValue({ targetMajors: [] });
    res = makeRes();
    await setPinned({ ...req(), params: { id: 'g-2' }, body: { pinned: true } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('ตั้งเวลา + แจ้งเตือน', () => {
  const body = { title: 'สอบ', date: '2026-10-13', year: '2/2569', targetMajors: '["CS"]' };

  test('โพสต์ทันที → บันทึกผู้โพสต์ + แจ้งนักศึกษา CS ของรอบนั้นครั้งเดียว', async () => {
    prisma.announcement.create.mockResolvedValue({ id: 'new', files: [] });
    prisma.announcement.updateMany.mockResolvedValue({ count: 1 });
    prisma.announcement.findUnique.mockResolvedValue({ id: 'new', title: 'สอบ', year: '2/2569', targetMajors: ['CS'] });
    prisma.coopPeriod.findFirst.mockResolvedValue({ id: 2 });
    prisma.student.findMany.mockResolvedValue([{ userId: 101 }, { userId: 102 }]);
    const res = makeRes();
    await addOrUpdateAnnouncement({ user: { id: 1, role: 'staff' }, method: 'POST', body, files: [] }, res);
    expect(prisma.announcement.create.mock.calls[0][0].data).toMatchObject({ authorId: 1, publishAt: null });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(prisma.student.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null, coop: { coopPeriodId: 2 }, major: { in: ['CS'] } });
    expect(createNotifications).toHaveBeenCalledWith([101, 102], expect.objectContaining({ type: 'ANNOUNCEMENT', message: 'สอบ' }));
  });

  test('ตั้งเวลาในอนาคต → ยังไม่แจ้ง (จองแจ้งไม่ได้เพราะยังไม่ถึงเวลา)', async () => {
    prisma.announcement.create.mockResolvedValue({ id: 'later', files: [] });
    prisma.announcement.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();
    await addOrUpdateAnnouncement({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, publishAt: FUTURE.toISOString() }, files: [] }, res);
    expect(prisma.announcement.create.mock.calls[0][0].data.publishAt).toEqual(FUTURE);
    await new Promise((r) => setImmediate(r));
    expect(createNotifications).not.toHaveBeenCalled();
  });

  test('เวลาเผยแพร่ผิดรูปแบบ → 400', async () => {
    const res = makeRes();
    await addOrUpdateAnnouncement({ user: { id: 1, role: 'staff' }, method: 'POST', body: { ...body, publishAt: 'พรุ่งนี้' }, files: [] }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('งานตั้งเวลา: ถึงเวลาแล้ว → แจ้ง · แจ้งไปแล้ว (จองไม่ได้) → ไม่แจ้งซ้ำ', async () => {
    prisma.announcement.findMany.mockResolvedValue([{ id: 'due' }]);
    prisma.announcement.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prisma.announcement.findUnique.mockResolvedValue({ id: 'due', title: 'ถึงเวลา', year: '2/2569', targetMajors: [] });
    prisma.coopPeriod.findFirst.mockResolvedValue({ id: 2 });
    prisma.student.findMany.mockResolvedValue([{ userId: 7 }]);
    await audience.publishDueAnnouncements();
    await audience.publishDueAnnouncements();
    expect(createNotifications).toHaveBeenCalledTimes(1);
    // ส่วนกลาง → ทุกหลักสูตรในรอบ (ไม่กรอง major)
    expect(prisma.student.findMany.mock.calls[0][0].where).not.toHaveProperty('major');
  });
});
