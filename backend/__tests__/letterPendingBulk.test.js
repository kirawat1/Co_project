// __tests__/letterPendingBulk.test.js — ติดป้ายรอลงนามหลายฉบับในทรานแซกชันเดียว (ทั้งชุดหรือไม่เลย)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { markLetterPendingBulk } = require('../controllers/adminDocController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), locals: {} });
const row = (id, status = 'DOCS_APPROVED', companyId = 'c1') => ({ studentId: id, status, companyId, student: { deletedAt: null, studentId: `65000000${id}`, firstName: 'ชื่อ', lastName: `${id}` } });
const req = (over = {}) => ({ user: { id: 1, role: 'staff' }, body: { letter: 'REQUEST', docDate: '2026-10-22',
  letters: [{ studentIds: [1, 2], docNumber: 'ที่ อว 660301.26.6.2/811' }, { studentIds: [3], docNumber: '660301.26.6.2/812' }], ...over } });
const pendingSets = () => prisma.studentCoop.updateMany.mock.calls.map((c) => c[0]).filter((a) => a.data.reqLetterPendingAt instanceof Date);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
  prisma.studentCoop.findFirst.mockResolvedValue(null);
  prisma.studentCoop.updateMany.mockResolvedValue({ count: 1 });
  prisma.studentCoop.findMany.mockResolvedValue([row(1), row(2), row(3)]);
});

describe('markLetterPendingBulk', () => {
  test('ติดป้ายทุกฉบับ — เลขของแต่ละฉบับ วันที่เดียวกัน', async () => {
    const res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(pendingSets()).toEqual([
      { where: { studentId: { in: [1, 2] } }, data: expect.objectContaining({ reqLetterDraftNumber: '660301.26.6.2/811', reqLetterDraftDate: new Date('2026-10-22') }) },
      { where: { studentId: { in: [3] } }, data: expect.objectContaining({ reqLetterDraftNumber: '660301.26.6.2/812' }) },
    ]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, count: 2 }));
    expect(res.locals.audit.action).toBe('โหลดร่างหนังสือขอความอนุเคราะห์หลายฉบับ (รอลงนาม) 2 ฉบับ: 660301.26.6.2/811, 660301.26.6.2/812');
  });

  test('เลขชนกับหนังสือของคนนอกชุด → 409 บอกเลขที่ชน · ไม่ติดป้ายฉบับไหนเลย', async () => {
    prisma.studentCoop.findFirst.mockImplementation(async (a) => (a.where.OR[0].reqDocNumber === '660301.26.6.2/812'
      ? { reqDocNumber: '660301.26.6.2/812', student: { studentId: '650000009', firstName: 'ก', lastName: 'ข' } } : null));
    const res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].conflicts).toEqual([expect.objectContaining({ docNumber: '660301.26.6.2/812', message: expect.stringContaining('650000009') })]);
    expect(pendingSets()).toHaveLength(0);
  });

  test('เลขซ้ำกันเองในชุด → 409 ไม่เปิดทรานแซกชัน', async () => {
    const res = makeRes();
    await markLetterPendingBulk(req({ letters: [{ studentIds: [1], docNumber: 'ที่ อว 660301.26.6.2/811' }, { studentIds: [3], docNumber: '660301.26.6.2/811' }] }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].conflicts[0].docNumber).toBe('660301.26.6.2/811');
  });

  test('มีคนยังไม่ถึงขั้น → 400 บอกรหัส ไม่ติดป้าย', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([row(1), row(2), row(3, 'QUALIFIED')]);
    const res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('650000003');
    expect(pendingSets()).toHaveLength(0);
  });

  test('คนเดียวอยู่สองฉบับ → 400', async () => {
    const res = makeRes();
    await markLetterPendingBulk(req({ letters: [{ studentIds: [1, 2], docNumber: '660301.26.6.2/811' }, { studentIds: [2], docNumber: '660301.26.6.2/812' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('2');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('หนังสือรวมต่างบริษัท → 400', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([row(1), row(2, 'DOCS_APPROVED', 'c2'), row(3)]);
    const res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pendingSets()).toHaveLength(0);
  });

  test('เลขยังไม่กรอก · ไม่มีวันที่ · letters ว่าง · เกิน 200 ฉบับ → 400', async () => {
    const bad = [
      req({ letters: [{ studentIds: [1], docNumber: '660301.26.6.2/' }] }),
      req({ docDate: undefined }),
      req({ letters: [] }),
      req({ letters: Array.from({ length: 201 }, (_, i) => ({ studentIds: [i + 1], docNumber: `660301.26.6.2/${i + 1}` })) }),
    ];
    for (const r of bad) {
      const res = makeRes();
      await markLetterPendingBulk(r, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('ไม่พบนักศึกษา / ถูกลบ → 404', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([row(1), row(2)]);
    let res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    prisma.studentCoop.findMany.mockResolvedValue([row(1), row(2), { ...row(3), student: { ...row(3).student, deletedAt: new Date() } }]);
    res = makeRes();
    await markLetterPendingBulk(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('ล้างร่างเดิมของคนในชุดก่อนตรวจเลข — ออกร่างใหม่ซ้ำเลขเดิมได้', async () => {
    await markLetterPendingBulk(req(), makeRes());
    const clear = prisma.studentCoop.updateMany.mock.calls.findIndex((c) => c[0].data.reqLetterDraftNumber === null);
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(prisma.studentCoop.updateMany.mock.calls[clear][0].where).toEqual({ studentId: { in: [1, 2, 3] } });
    expect(prisma.studentCoop.updateMany.mock.invocationCallOrder[clear]).toBeLessThan(prisma.studentCoop.findFirst.mock.invocationCallOrder[0]);
  });

  test('ล็อกเลขทุกฉบับเรียงลำดับก่อนตรวจ (สองคนออกพร้อมกันไม่ deadlock)', async () => {
    await markLetterPendingBulk(req({ letters: [{ studentIds: [3], docNumber: '660301.26.6.2/812' }, { studentIds: [1, 2], docNumber: '660301.26.6.2/811' }] }), makeRes());
    expect(prisma.$executeRaw.mock.calls.slice(0, 2).map((c) => c[2])).toEqual(['660301.26.6.2/811', '660301.26.6.2/812']);
  });

  test('ส่งตัว: ใช้ช่อง placeLetter* และขั้น ACCEPTANCE_CHECKED', async () => {
    const body = { letter: 'PLACEMENT', letters: [{ studentIds: [1], docNumber: '660301.26.6.2/900' }] };
    prisma.studentCoop.findMany.mockResolvedValue([row(1, 'DOCS_APPROVED')]);
    let res = makeRes();
    await markLetterPendingBulk(req(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    prisma.studentCoop.findMany.mockResolvedValue([row(1, 'ACCEPTANCE_CHECKED')]);
    res = makeRes();
    await markLetterPendingBulk(req(body), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, count: 1 }));
    const set = prisma.studentCoop.updateMany.mock.calls.map((c) => c[0]).find((a) => a.data.placeLetterPendingAt instanceof Date);
    expect(set.data.placeLetterDraftNumber).toBe('660301.26.6.2/900');
  });
});
