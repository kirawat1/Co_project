// __tests__/docRequirementController.test.js — หัวข้อเอกสาร T000 แยกตามหลักสูตร (Phase 3)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');
const {
  getRequirements,
  getAllRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  setExclusion,
} = require('../controllers/docRequirementController');
const { appliesTo } = require('../utils/docRequirementScope');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const STAFF = { user: { id: 1, role: 'staff' } };
const coop = (majors = ['CS']) => {
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: majors.map((major) => ({ major })) });
  return { user: { id: 2, role: 'teacher' } };
};
// แถวจาก DB (มี majorRules) — rules: [['CS', false], ['AI', true]]
const row = (id, docKey, rules = [], extra = {}) => ({
  id, docKey, title: docKey, isRequired: true, isActive: true, ...extra,
  majorRules: rules.map(([major, excluded]) => ({ major, excluded })),
});
const SHARED_CV = row(1, 'CP-CV', [['AI', true]]);         // ทุกหลักสูตร แต่ AI ปิดไว้
const CS_ONLY = row(2, 'CP-PORTFOLIO', [['CS', false]]);   // เฉพาะ CS
const AI_ONLY = row(3, 'CP-AI-PROJECT', [['AI', false]]);  // เฉพาะ AI

beforeEach(() => jest.clearAllMocks());

describe('appliesTo', () => {
  const v = (r) => ({ ...r, majors: r.majorRules.filter((x) => !x.excluded).map((x) => x.major), excludedMajors: r.majorRules.filter((x) => x.excluded).map((x) => x.major) });
  test.each([
    ['หัวข้อกลาง → CS ใช้', SHARED_CV, 'CS', true],
    ['หัวข้อกลางที่ AI ปิด → AI ไม่ใช้', SHARED_CV, 'AI', false],
    ['หัวข้อกลาง → นักศึกษาไม่มีหลักสูตรใช้', SHARED_CV, null, true],
    ['เฉพาะ CS → CS ใช้', CS_ONLY, 'CS', true],
    ['เฉพาะ CS → AI ไม่ใช้', CS_ONLY, 'AI', false],
    ['เฉพาะ CS → นักศึกษาไม่มีหลักสูตรไม่ใช้', CS_ONLY, null, false],
  ])('%s', (_n, r, major, expected) => expect(appliesTo(v(r), major)).toBe(expected));
});

describe('getRequirements (หน้านักศึกษา)', () => {
  test('นักศึกษา AI เห็นเฉพาะหัวข้อที่ใช้กับ AI', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([SHARED_CV, CS_ONLY, AI_ONLY]);
    prisma.student.findUnique.mockResolvedValue({ major: 'AI' });
    const res = makeRes();
    await getRequirements({ user: { id: 9, role: 'student' } }, res);
    expect(res.json.mock.calls[0][0].requirements.map((r) => r.docKey)).toEqual(['CP-AI-PROJECT']);
    expect(prisma.documentRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });

  test('นักศึกษา CS เห็นหัวข้อกลาง + ของ CS', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([SHARED_CV, CS_ONLY, AI_ONLY]);
    prisma.student.findUnique.mockResolvedValue({ major: 'CS' });
    const res = makeRes();
    await getRequirements({ user: { id: 9, role: 'student' } }, res);
    expect(res.json.mock.calls[0][0].requirements.map((r) => r.docKey)).toEqual(['CP-CV', 'CP-PORTFOLIO']);
  });

  test('ส่ง majors / excludedMajors กลับไปด้วย', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([SHARED_CV]);
    const res = makeRes();
    await getRequirements({ ...STAFF }, res);
    expect(res.json.mock.calls[0][0].requirements[0]).toMatchObject({ majors: [], excludedMajors: ['AI'] });
    expect(res.json.mock.calls[0][0].requirements[0]).not.toHaveProperty('majorRules');
  });
});

describe('getAllRequirements (หน้าจัดการ)', () => {
  test('เจ้าหน้าที่เห็นทั้งหมด และจัดการได้ทุกหัวข้อ', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([SHARED_CV, CS_ONLY, AI_ONLY]);
    const res = makeRes();
    await getAllRequirements({ ...STAFF }, res);
    const list = res.json.mock.calls[0][0].requirements;
    expect(list.map((r) => r.docKey)).toEqual(['CP-CV', 'CP-PORTFOLIO', 'CP-AI-PROJECT']);
    expect(list.every((r) => r.canManage)).toBe(true);
  });

  test('อาจารย์ประจำวิชา CS: เห็นหัวข้อกลาง + ของ CS · จัดการได้เฉพาะของ CS', async () => {
    prisma.documentRequirement.findMany.mockResolvedValue([SHARED_CV, CS_ONLY, AI_ONLY]);
    const res = makeRes();
    await getAllRequirements(coop(['CS']), res);
    const list = res.json.mock.calls[0][0].requirements;
    expect(list.map((r) => [r.docKey, r.canManage])).toEqual([['CP-CV', false], ['CP-PORTFOLIO', true]]);
  });
});

describe('createRequirement', () => {
  const body = (majors) => ({ docKey: 'CP-X', title: 'X', isRequired: true, isActive: true, ...(majors !== undefined ? { majors } : {}) });

  test('เจ้าหน้าที่สร้างหัวข้อกลาง (ไม่ระบุหลักสูตร)', async () => {
    prisma.documentRequirement.create.mockResolvedValue(row(9, 'CP-X'));
    const res = makeRes();
    await createRequirement({ ...STAFF, body: body() }, res);
    expect(prisma.documentRequirement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ docKey: 'CP-X', majorRules: { create: [] } }),
    }));
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, requirement: { majors: [] } });
  });

  test('อาจารย์ประจำวิชา: สร้างเฉพาะหลักสูตรตัวเองได้ · ไม่ระบุ (= ทุกหลักสูตร) / หลักสูตรอื่น → 403', async () => {
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS' }]);
    prisma.documentRequirement.create.mockResolvedValue(row(9, 'CP-X', [['CS', false]]));
    const ok = makeRes();
    await createRequirement({ ...coop(['CS']), body: body(['CS']) }, ok);
    expect(prisma.documentRequirement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ majorRules: { create: [{ major: 'CS', excluded: false }] } }),
    }));

    for (const majors of [undefined, [], ['AI']]) {
      const res = makeRes();
      await createRequirement({ ...coop(['CS']), body: body(majors) }, res);
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  test('400 — ขาด docKey / หลักสูตรที่ไม่มีในระบบ · docKey ซ้ำ (P2002) → 400', async () => {
    const r1 = makeRes();
    await createRequirement({ ...STAFF, body: { title: 'X' } }, r1);
    expect(r1.status).toHaveBeenCalledWith(400);

    prisma.coopCriteria.findMany.mockResolvedValue([]);
    const r2 = makeRes();
    await createRequirement({ ...STAFF, body: body(['ZZ']) }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);

    prisma.documentRequirement.create.mockRejectedValue({ code: 'P2002' });
    const r3 = makeRes();
    await createRequirement({ ...STAFF, body: body() }, r3);
    expect(r3.status).toHaveBeenCalledWith(400);
  });
});

describe('updateRequirement / deleteRequirement', () => {
  test('อาจารย์ประจำวิชาแก้/ลบหัวข้อกลางไม่ได้ (403) · แก้หัวข้อของตัวเองได้', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(SHARED_CV);
    const r1 = makeRes();
    await updateRequirement({ ...coop(['CS']), params: { id: '1' }, body: { title: 'ใหม่' } }, r1);
    expect(r1.status).toHaveBeenCalledWith(403);
    const r2 = makeRes();
    await deleteRequirement({ ...coop(['CS']), params: { id: '1' } }, r2);
    expect(r2.status).toHaveBeenCalledWith(403);
    expect(prisma.documentRequirement.delete).not.toHaveBeenCalled();

    prisma.documentRequirement.findUnique.mockResolvedValue(CS_ONLY);
    const r3 = makeRes();
    await updateRequirement({ ...coop(['CS']), params: { id: '2' }, body: { title: 'ใหม่' } }, r3);
    expect(prisma.documentRequirement.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { title: 'ใหม่' } });
  });

  test('เจ้าหน้าที่เปลี่ยนหัวข้อเฉพาะหลักสูตรเป็นหัวข้อกลาง (majors = []) → ล้างกฎเดิมทั้งหมด', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(CS_ONLY);
    const res = makeRes();
    await updateRequirement({ ...STAFF, params: { id: '2' }, body: { majors: [] } }, res);
    expect(prisma.documentRequirementMajor.deleteMany).toHaveBeenCalledWith({ where: { requirementId: 2 } });
    expect(prisma.documentRequirementMajor.createMany).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบหัวข้อ · 400 — id ไม่ใช่ตัวเลข', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(null);
    const r1 = makeRes();
    await updateRequirement({ ...STAFF, params: { id: '99' }, body: {} }, r1);
    expect(r1.status).toHaveBeenCalledWith(404);
    const r2 = makeRes();
    await deleteRequirement({ ...STAFF, params: { id: 'abc' } }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
  });
});

describe('setExclusion — หลักสูตรปิด/เปิดหัวข้อกลาง', () => {
  test('อาจารย์ประจำวิชา AI ปิดหัวข้อกลางสำหรับ AI ได้', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(row(1, 'CP-CV'));
    prisma.coopCriteria.findUnique.mockResolvedValue({ major: 'AI' });
    const res = makeRes();
    await setExclusion({ ...coop(['AI']), params: { id: '1' }, body: { major: 'AI', excluded: true } }, res);
    expect(prisma.documentRequirementMajor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { requirementId: 1, major: 'AI', excluded: true },
    }));
  });

  test('เปิดกลับ → ลบเฉพาะแถว excluded', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(SHARED_CV);
    prisma.coopCriteria.findUnique.mockResolvedValue({ major: 'AI' });
    const res = makeRes();
    await setExclusion({ ...STAFF, params: { id: '1' }, body: { major: 'AI', excluded: false } }, res);
    expect(prisma.documentRequirementMajor.deleteMany).toHaveBeenCalledWith({ where: { requirementId: 1, major: 'AI', excluded: true } });
  });

  test('ปิดแทนหลักสูตรอื่น → 403 · หัวข้อเฉพาะหลักสูตร → 400', async () => {
    prisma.documentRequirement.findUnique.mockResolvedValue(row(1, 'CP-CV'));
    const r1 = makeRes();
    await setExclusion({ ...coop(['CS']), params: { id: '1' }, body: { major: 'AI', excluded: true } }, r1);
    expect(r1.status).toHaveBeenCalledWith(403);

    prisma.documentRequirement.findUnique.mockResolvedValue(CS_ONLY);
    const r2 = makeRes();
    await setExclusion({ ...STAFF, params: { id: '2' }, body: { major: 'CS', excluded: true } }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
    expect(prisma.documentRequirementMajor.upsert).not.toHaveBeenCalled();
  });
});
