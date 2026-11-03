jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  unlinkSync: jest.fn(),
}));

const prisma = require('./__mocks__/prismaClient');
const docController = require('../controllers/docController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('docController', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────
  // deleteDocument
  // ─────────────────────────────────────────────────────────
  describe('deleteDocument', () => {
    test('400 — id ที่ไม่ใช่ตัวเลขถูก reject', async () => {
      const req = { params: { id: 'abc' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('404 — document ไม่มีอยู่จริง', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('403 — นักศึกษาคนอื่นพยายามลบเอกสารที่ไม่ใช่ของตัวเอง', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: 'CV',
        student: { userId: 99, deletedAt: null }, // เจ้าของจริง userId=99
      });
      const req = { params: { id: '5' }, user: { id: 1 } }; // ผู้เรียก userId=1
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('200 — เจ้าของเอกสารลบได้', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: 'CV',
        student: { userId: 1, deletedAt: null },
      });
      // inside transaction: student เป็น active, ไม่ใช่ T002/T003
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.document.delete.mockResolvedValue({});

      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test.each(['WAITING', 'APPROVED'])('409 — ไม่สามารถลบ T002 ที่ไฟล์ %s (รอตรวจ/ผ่านแล้ว)', async (status) => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: 'T002_FORM', status,
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });

      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test.each(['WAITING', 'APPROVED'])('409 — ไม่สามารถลบ T003 ที่ไฟล์ %s (รอตรวจ/ผ่านแล้ว)', async (status) => {
      prisma.document.findUnique.mockResolvedValue({
        id: 6, path: 'test3.pdf', studentId: 10, type: 'T003_FORM', status,
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });

      const req = { params: { id: '6' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test.each(['T002', 'T003'])('200 — ลบ %s ได้เมื่อไฟล์ถูกตีกลับ (REJECTED)', async (form) => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: `${form}_FORM`, status: 'REJECTED',
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });
      prisma.document.delete.mockResolvedValue({});

      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  // ไฟล์ที่ตรวจผ่านแล้ว / ใบตอบรับ — หน้าเว็บไม่มีปุ่มลบ แต่เดิมยิง API ลบได้ (สถานะยังผ่าน ไฟล์หาย)
  describe('ลบไฟล์ที่ล็อกแล้ว', () => {
    const own = (extra) => ({ id: 5, path: 'x.pdf', studentId: 10, student: { userId: 1, deletedAt: null, major: 'CS' }, ...extra });
    beforeEach(() => {
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.document.delete.mockClear();
    });

    test('409 — ไฟล์ T000 ที่ผ่านแล้ว (อ่านสถานะในทรานแซกชัน)', async () => {
      // อ่านนอกทรานแซกชันยังรอตรวจ · ในทรานแซกชันเจ้าหน้าที่เพิ่งกดผ่าน
      prisma.document.findUnique
        .mockResolvedValueOnce(own({ type: 'CP-CV', status: 'WAITING' }))
        .mockResolvedValueOnce({ type: 'CP-CV', status: 'APPROVED' });
      const res = makeRes();
      await docController.deleteDocument({ params: { id: '5' }, user: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('ผ่านการตรวจสอบแล้ว') }));
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('200 — ไฟล์ T000 ที่ไม่ผ่าน/รอแก้ ลบได้', async () => {
      for (const status of ['REJECTED', 'EDITS_REQUIRED', 'WAITING']) {
        prisma.document.findUnique.mockResolvedValue(own({ type: 'CP-CV', status }));
        prisma.studentCoop.findUnique.mockResolvedValue({ status: 'EDITS_REQUIRED', t000Status: 'PENDING' });
        const res = makeRes();
        await docController.deleteDocument({ params: { id: '5' }, user: { id: 1 } }, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      }
    });

    test('409 — ใบตอบรับลบไม่ได้ทุกสถานะ', async () => {
      prisma.document.findUnique.mockResolvedValue(own({ type: 'CP-ACCEPTANCE', status: 'WAITING' }));
      const res = makeRes();
      await docController.deleteDocument({ params: { id: '5' }, user: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('409 — ลบด้วยชนิดเอกสาร: ไฟล์ที่ผ่านแล้ว', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.document.findFirst.mockResolvedValue({ id: 20, path: 'cv.pdf', studentId: 10, type: 'CV', status: 'APPROVED' });
      const res = makeRes();
      await docController.deleteDocumentByType({ params: { docType: 'CP-CV' }, user: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });
  });

  // ลบไฟล์บังคับหลังส่ง T000 ครั้งแรกครบ (ยังไม่ถูกตรวจ) → ไม่ครบแล้ว กลับไปรอนักศึกษาส่ง (ไม่ค้างในรายการรอตรวจ)
  describe('ลบเอกสาร T000 หลังส่งครั้งแรกครบ', () => {
    beforeEach(() => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null, major: 'CS' });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'WAITING_FOR_STAFF_CHECK', t000Status: 'PENDING' });
      prisma.studentCoop.update.mockReset().mockResolvedValue({});
      prisma.documentRequirement.findMany.mockResolvedValue([{ docKey: 'CV', majorRules: [] }]);
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.delete.mockResolvedValue({});
    });
    const backToQualified = { where: { studentId: 10 }, data: { status: 'QUALIFIED', t000Status: 'WAITING' } };

    test('ลบด้วย id → กลับไปผ่านคุณสมบัติ', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 5, path: 'cv.pdf', studentId: 10, type: 'CV', student: { userId: 1, deletedAt: null, major: 'CS' } });
      const res = makeRes();
      await docController.deleteDocument({ params: { id: '5' }, user: { id: 1 } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      expect(prisma.studentCoop.update).toHaveBeenCalledWith(backToQualified);
    });

    test('ลบด้วยชนิดเอกสาร → กลับไปผ่านคุณสมบัติ', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 20, path: 'cv.pdf', studentId: 10, type: 'CV' });
      const res = makeRes();
      await docController.deleteDocumentByType({ params: { docType: 'CP-CV' }, user: { id: 1 } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      expect(prisma.studentCoop.update).toHaveBeenCalledWith(backToQualified);
    });
  });

  // ─────────────────────────────────────────────────────────
  // deleteDocumentByType
  // ─────────────────────────────────────────────────────────
  describe('deleteDocumentByType', () => {
    test('400 — docType ที่ไม่อยู่ใน allowlist ถูก reject', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      const req = { params: { docType: 'INVALID_TYPE' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocumentByType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('400 — ป้องกัน path traversal หรือ javascript: ผ่าน docType', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      const req = { params: { docType: '../../../etc/passwd' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocumentByType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('200 — CP-CV map ไปยัง CV ถูกต้อง', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.document.findFirst.mockResolvedValue({ id: 20, path: 'cv.pdf', studentId: 10, type: 'CV' });
      prisma.document.delete.mockResolvedValue({});

      const req = { params: { docType: 'CP-CV' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocumentByType(req, res);
      expect(prisma.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ type: 'CV' }),
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('200 — CP-TRANSCRIPT map ไปยัง TRANSCRIPT ถูกต้อง', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.document.findFirst.mockResolvedValue({ id: 21, path: 'tr.pdf', studentId: 10, type: 'TRANSCRIPT' });
      prisma.document.delete.mockResolvedValue({});

      const req = { params: { docType: 'CP-TRANSCRIPT' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocumentByType(req, res);
      expect(prisma.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ type: 'TRANSCRIPT' }),
      }));
    });
  });

  // ─────────────────────────────────────────────────────────
  // acknowledgeDispatchDownload
  // ─────────────────────────────────────────────────────────
  describe('acknowledgeDispatchDownload', () => {
    test('404 — ไม่พบนักศึกษา', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      const req = { user: { id: 1 } };
      const res = makeRes();
      await docController.acknowledgeDispatchDownload(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('400 — สถานะปัจจุบันไม่ใช่ REQ_LETTER_ISSUED', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      // inside transaction: coop status ไม่ตรง
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'QUALIFIED' });

      const req = { user: { id: 1 } };
      const res = makeRes();
      await docController.acknowledgeDispatchDownload(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.studentCoop.update).not.toHaveBeenCalled();
    });

    test('200 — เปลี่ยนสถานะจาก REQ_LETTER_ISSUED → WAITING_FOR_PLACEMENT_LETTER', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ studentId: 10, status: 'REQ_LETTER_ISSUED' });
      prisma.studentCoop.update.mockResolvedValue({});

      const req = { user: { id: 1 } };
      const res = makeRes();
      await docController.acknowledgeDispatchDownload(req, res);
      expect(prisma.studentCoop.update).toHaveBeenCalledWith({
        where: { studentId: 10 },
        data: { status: 'WAITING_FOR_PLACEMENT_LETTER' },
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ─────────────────────────────────────────────────────────
  // uploadDocument — status guards (key paths)
  // ─────────────────────────────────────────────────────────
  describe('uploadDocument — status guards', () => {
    const makeUploadReq = (docType, overrides = {}) => ({
      body: { docType },
      file: { path: '/tmp/test.pdf', filename: 'test.pdf', mimetype: 'application/pdf', originalname: 'test.pdf' },
      user: { id: 1 },
      ...overrides,
    });

    test('400 — ไม่มีไฟล์แนบ', async () => {
      const req = { body: { docType: 'CP-CV' }, file: null, user: { id: 1 } };
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 — docType ที่ไม่อยู่ใน allowlist ถูก reject', async () => {
      prisma.documentRequirement.findFirst.mockResolvedValue(null); // ไม่มีใน DocumentRequirement
      const req = makeUploadReq('FAKE_PLACEMENT_LETTER');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.student.findUnique).not.toHaveBeenCalled();
    });

    test('400 — หัวข้อเฉพาะหลักสูตรอื่น / หัวข้อกลางที่หลักสูตรตัวเองปิดไว้ ถูก reject ก่อนบันทึกไฟล์', async () => {
      prisma.student.findUnique.mockResolvedValue({ major: 'AI' });
      for (const rules of [[{ major: 'CS', excluded: false }], [{ major: 'AI', excluded: true }]]) {
        prisma.documentRequirement.findFirst.mockResolvedValueOnce({ id: 1, majorRules: rules });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-PORTFOLIO'), res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    test('404 — ไม่พบนักศึกษา', async () => {
      prisma.documentRequirement.findFirst.mockResolvedValue({ id: 1 }); // valid docKey
      prisma.systemConfig.findUnique.mockResolvedValue(null); // ระบบเปิด (no config)
      prisma.student.findUnique.mockResolvedValue(null);

      const req = makeUploadReq('CP-CV');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('400 — ส่ง T002 ในสถานะที่ไม่ถูกต้อง (QUALIFIED)', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null); // T002_CONFIG เปิด
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      // inside transaction: student active, coop status ไม่ถูกต้อง
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'QUALIFIED' });

      const req = makeUploadReq('T002_FORM');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      // document.create is called inside the transaction before the status guard;
      // the transaction rolls back in prod, but the mock still records the call.
    });

    test('400 — ส่ง T003 ในสถานะที่ไม่ถูกต้อง (INTERNSHIP_STARTED ข้าม T002)', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });

      const req = makeUploadReq('T003_FORM');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 — ส่งใบตอบรับ CP-ACCEPTANCE ในสถานะที่ไม่ถูกต้อง (APPLYING)', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'APPLYING' });

      const req = makeUploadReq('CP-ACCEPTANCE');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // เดิมเปลี่ยนไฟล์ใบตอบรับหลังออกหนังสือส่งตัวแล้วได้ → สถานะเด้งกลับไป "รอตรวจใบตอบรับ" การ์ดหนังสือส่งตัวหาย
    test.each(['PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'])(
      '400 — ออกหนังสือส่งตัวแล้ว (%s) เปลี่ยนใบตอบรับไม่ได้ และสถานะไม่ถอยกลับ',
      async (status) => {
        prisma.systemConfig.findUnique.mockResolvedValue(null);
        prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
        prisma.studentCoop.findUnique.mockResolvedValue({ status });

        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-ACCEPTANCE'), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toMatch(/ออกหนังสือส่งตัวแล้ว/);
        expect(prisma.studentCoop.update).not.toHaveBeenCalled();
      },
    );

    test('403 — รอบยังไม่ตั้งปฏิทิน → ค่าเดิม T000 (isOpen = false)', async () => {
      prisma.documentRequirement.findFirst.mockResolvedValue({ id: 1 }); // valid docKey
      prisma.systemConfig.findUnique.mockResolvedValue({
        key: 'T000_CONFIG',
        value: JSON.stringify({ isOpen: false, startDate: null, endDate: null }),
      });
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'QUALIFIED' });
      prisma.coopPeriodMajor.findUnique.mockResolvedValue(null);

      const req = makeUploadReq('CP-CV');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    describe('ปฏิทินของรอบ', () => {
      const past = { startDate: new Date('2026-01-01T00:00:00Z'), deadlines: { T000: { due: '2020-01-01', mode: 'HARD' }, T002: { due: '2020-01-01', mode: 'HARD' } } };
      beforeEach(() => {
        prisma.documentRequirement.findFirst.mockResolvedValue({ id: 1, majorRules: [] });
        prisma.documentRequirement.findMany.mockResolvedValue([]);
        prisma.document.findFirst.mockResolvedValue(null);
        prisma.document.create.mockResolvedValue({ id: 99 });
        prisma.studentCoop.update.mockResolvedValue({});
        prisma.coopPeriodMajor.findUnique.mockResolvedValue(past);
        prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null, major: 'CS' });
      });

      test('403 — HARD เลยกำหนดส่ง (ส่งครั้งแรก) → ข้อความบอกวันและให้ขอขยายเวลา', async () => {
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'QUALIFIED' });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-CV'), res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0].message).toMatch(/เลยกำหนดส่ง .*ขยายเวลา/);
        expect(prisma.document.create).not.toHaveBeenCalled();
      });

      test('ส่งแก้ (EDITS_REQUIRED) หลังกำหนด → ผ่าน และกลับไปรอตรวจ', async () => {
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'EDITS_REQUIRED', submittedSteps: { T000: { at: 'x' } } });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-CV'), res);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, late: false });
        expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { status: 'WAITING_FOR_STAFF_CHECK', t000Status: 'EDITS_REQUIRED' } });
      });

      // ถูกสั่งแก้หลายไฟล์: ไฟล์แรกเปลี่ยนสถานะเป็น WAITING_FOR_STAFF_CHECK แล้ว — ไฟล์ที่สองต้องยังส่งแก้ได้
      // เริ่มจากคนที่ส่งครั้งแรกแล้ว (t000Status PENDING) แล้วถูกส่งกลับ — ทางส่งแก้ต้องเปลี่ยน t000Status ไม่งั้นไฟล์ที่สองติดกำหนด
      test('ส่งแก้ T000 หลายไฟล์หลังกำหนด → ไฟล์ที่สองก็ผ่าน', async () => {
        let status = 'EDITS_REQUIRED';
        let t000Status = 'PENDING';
        prisma.studentCoop.findUnique.mockImplementation(async () => ({ coopPeriodId: 1, status, t000Status, submittedSteps: { T000: { at: 'x' } } }));
        prisma.studentCoop.update.mockImplementation(async ({ data }) => {
          if (data.status) status = data.status;
          if (data.t000Status) t000Status = data.t000Status;
          return {};
        });
        const first = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-CV'), first);
        expect(first.json.mock.calls[0][0]).toMatchObject({ ok: true });
        expect(status).toBe('WAITING_FOR_STAFF_CHECK');
        const second = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-TRANSCRIPT'), second);
        expect(second.status).not.toHaveBeenCalledWith(403);
        expect(second.json.mock.calls[0][0]).toMatchObject({ ok: true, late: false });
      });

      describe('ส่ง T000 ครั้งแรก', () => {
        const open = { startDate: past.startDate, deadlines: { T000: { due: '2999-01-01' } } };
        beforeEach(() => {
          prisma.studentCoop.update.mockReset().mockResolvedValue({});
          prisma.coopPeriodMajor.findUnique.mockResolvedValue(open);
          prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'QUALIFIED', t000Status: 'WAITING', submittedSteps: null });
          prisma.documentRequirement.findMany.mockResolvedValue([{ docKey: 'CP-CV', majorRules: [] }, { docKey: 'CP-TRANSCRIPT', majorRules: [] }]);
          prisma.user.findMany.mockResolvedValue([{ id: 50 }]);
          prisma.notification.findMany.mockResolvedValue([]);
          prisma.notification.createMany.mockResolvedValue({ count: 1 });
        });
        const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };

        test('ไฟล์สุดท้ายที่ทำให้ครบหัวข้อบังคับ → รอเจ้าหน้าที่ตรวจ และแจ้งเจ้าหน้าที่', async () => {
          prisma.document.findMany.mockResolvedValue([{ type: 'CP-CV' }, { type: 'CP-TRANSCRIPT' }]);
          const res = makeRes();
          await docController.uploadDocument(makeUploadReq('CP-TRANSCRIPT'), res);
          await flush();
          expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
          expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { status: 'WAITING_FOR_STAFF_CHECK', t000Status: 'PENDING' } });
          expect(prisma.notification.createMany.mock.calls[0][0].data).toEqual([
            expect.objectContaining({ userId: 50, type: 'T000_SUBMITTED', link: '/admin/doct000' }),
          ]);
        });

        test('ยังไม่ครบหัวข้อบังคับ → ยังผ่านคุณสมบัติ ไม่แจ้งเจ้าหน้าที่', async () => {
          prisma.document.findMany.mockResolvedValue([{ type: 'CP-CV' }]);
          const res = makeRes();
          await docController.uploadDocument(makeUploadReq('CP-CV'), res);
          await flush();
          expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
          expect(prisma.studentCoop.update.mock.calls.filter((c) => c[0].data.status)).toEqual([]);
          expect(prisma.notification.createMany).not.toHaveBeenCalled();
        });

        // อัปโหลดทับไฟล์ที่ผ่านแล้ว — เดิมไฟล์ใหม่กลายเป็นรอตรวจ แต่สถานะยังเอกสารผ่าน/ออกหนังสือแล้ว ไม่มีใครเห็น
        test('409 — อัปโหลดทับไฟล์ T000 ที่ผ่านแล้ว ไม่ลบไฟล์เดิม', async () => {
          prisma.document.findFirst.mockResolvedValue({ id: 7, type: 'CP-CV', status: 'APPROVED', path: 'old.pdf' });
          prisma.document.delete.mockClear();
          prisma.document.create.mockClear();
          const res = makeRes();
          await docController.uploadDocument(makeUploadReq('CP-CV'), res);
          expect(res.status).toHaveBeenCalledWith(409);
          expect(prisma.document.delete).not.toHaveBeenCalled();
          expect(prisma.document.create).not.toHaveBeenCalled();
        });

        test('อัปโหลดทับไฟล์ที่ไม่ผ่าน → แทนที่ได้', async () => {
          prisma.document.findFirst.mockResolvedValue({ id: 7, type: 'CP-CV', status: 'REJECTED', path: 'old.pdf' });
          prisma.document.findMany.mockResolvedValue([{ type: 'CP-CV' }]);
          const res = makeRes();
          await docController.uploadDocument(makeUploadReq('CP-CV'), res);
          expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
          expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 7 } });
        });
      });

      test('ทรานแซกชันอัปโหลดอ่านแบบ READ COMMITTED (หลังรอล็อกแถวต้องเห็นไฟล์ที่อีกคำขอเพิ่ง commit)', async () => {
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null });
        prisma.coopPeriodMajor.findUnique.mockResolvedValue({ startDate: past.startDate, deadlines: { T002: { due: '2999-01-01' } } });
        await docController.uploadDocument(makeUploadReq('T002_FORM'), makeRes());
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
      });

      test('ส่งแก้ที่ยังไม่มีเวลาของขั้น → เวลาส่งไม่นับว่าช้า (backfill)', async () => {
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null });
        // ไฟล์ล่าสุดถูกตีกลับ = ส่งแก้ (สถานะหลักไม่เปลี่ยนแล้ว ดูจากไฟล์)
        prisma.document.findFirst.mockResolvedValue({ id: 7, path: 'old.pdf', status: 'REJECTED' });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('T002_FORM'), res);
        const stamp = prisma.studentCoop.update.mock.calls.find((c) => c[0].data.submittedSteps);
        expect(stamp[0].data.submittedSteps).toEqual({ T002: { at: expect.any(String), backfill: true } });
      });

      test('ส่ง T002 ครั้งแรกในเวลา → บันทึกเวลาส่ง', async () => {
        prisma.coopPeriodMajor.findUnique.mockResolvedValue({ startDate: past.startDate, deadlines: { T002: { due: '2999-01-01' } } });
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('T002_FORM'), res);
        expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, late: false });
        const stamp = prisma.studentCoop.update.mock.calls.find((c) => c[0].data.submittedSteps);
        expect(stamp[0].data.submittedSteps).toEqual({ T002: { at: expect.any(String) } });
      });

      test('SOFT เลยกำหนด → ส่งได้ ตอบ late: true', async () => {
        prisma.coopPeriodMajor.findUnique.mockResolvedValue({ startDate: past.startDate, deadlines: { T002: { due: '2020-01-01', mode: 'SOFT' } } });
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'INTERNSHIP_STARTED', submittedSteps: null });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('T002_FORM'), res);
        expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, late: true });
      });

      test('ยังไม่เลือกรอบ → ไม่มีกำหนด ส่งได้แม้ค่าเดิมปิดอยู่', async () => {
        prisma.systemConfig.findUnique.mockResolvedValue({ key: 'T000_CONFIG', value: JSON.stringify({ isOpen: false }) });
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: null, status: 'QUALIFIED' });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-CV'), res);
        expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
      });

      test('ใบตอบรับไม่ติดกำหนดส่ง', async () => {
        prisma.studentCoop.findUnique.mockResolvedValue({ coopPeriodId: 1, status: 'REQ_LETTER_ISSUED' });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq('CP-ACCEPTANCE'), res);
        expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
        expect(prisma.coopPeriodMajor.findUnique).not.toHaveBeenCalled();
      });
    });

    // เจ้าหน้าที่ตีกลับใบตอบรับ → "รอใบตอบรับ" (WAITING_FOR_PLACEMENT_LETTER) นักศึกษาอัปโหลดใหม่ได้
    // ข้อมูลเก่าที่ถูกตีกลับเป็น EDITS_REQUIRED ไปแล้ว (มีหนังสือขอความอนุเคราะห์แล้ว) ก็อัปโหลดใหม่ได้ ไม่ติดค้าง
    test.each([
      ['WAITING_FOR_PLACEMENT_LETTER', null],
      ['EDITS_REQUIRED', 'req-letter.pdf'],
    ])('200 — อัปโหลดใบตอบรับใหม่ในสถานะ %s → รอตรวจใบตอบรับ', async (status, reqLetterUrl) => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null });
      prisma.document.findFirst.mockResolvedValue({ id: 5, path: 'old-acc.pdf', status: 'REJECTED' });
      prisma.document.update.mockResolvedValue({ id: 5 });
      prisma.studentCoop.findUnique.mockResolvedValue({ status, reqLetterUrl });
      prisma.studentCoop.update.mockResolvedValue({});

      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('CP-ACCEPTANCE'), res);

      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.studentCoop.update).toHaveBeenCalledWith({
        where: { studentId: 10 },
        data: { acceptanceFileUrl: 'test.pdf', status: 'WAITING_FOR_STAFF_CHECK_LETTER' },
      });
    });

    // ใบตอบรับ/เอกสาร T000 เจ้าหน้าที่เป็นคนตรวจ (หน้า doct000) — อาจารย์ไม่มีเมนูรองรับ ไม่ต้องแจ้งอาจารย์
    test('แจ้งเตือนใบตอบรับที่นักศึกษาอัปโหลด → เฉพาะเจ้าหน้าที่', async () => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null });
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({ id: 6 });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'REQ_LETTER_ISSUED' });
      prisma.studentCoop.update.mockResolvedValue({});
      prisma.user.findMany.mockResolvedValue([{ id: 50 }]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      await docController.uploadDocument(makeUploadReq('CP-ACCEPTANCE'), makeRes());
      for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));

      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: 'staff' }, select: { id: true } });
      expect(prisma.notification.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ userId: 50, type: 'ACCEPTANCE_UPLOADED', link: '/admin/doct000' }),
      ]);
    });

    test('400 — EDITS_REQUIRED ของขั้นเอกสาร T000 (ยังไม่ออกหนังสือ) ส่งใบตอบรับไม่ได้', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'EDITS_REQUIRED', reqLetterUrl: null });

      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('CP-ACCEPTANCE'), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.studentCoop.update).not.toHaveBeenCalled();
    });

    test('200 — ส่ง T002 แล้วสร้าง/ผูกพี่เลี้ยงจากข้อ 3 ของแบบฟอร์ม (ทุกคน)', async () => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null, major: 'AI' });
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({ id: 99 });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED', companyId: 'c1' });
      prisma.studentCoop.update.mockResolvedValue({});
      prisma.coopT002Form.findUnique.mockResolvedValue({
        supervisorName: 'สมชาย ดูแลดี', supervisorPosition: 'หัวหน้าทีม',
        extraSupervisors: JSON.stringify([{ name: 'สมหญิง รักงาน' }]),
      });
      prisma.mentor.findMany.mockResolvedValue([]);
      prisma.mentor.create
        .mockResolvedValueOnce({ id: 'm1', firstName: 'สมชาย', lastName: 'ดูแลดี' })
        .mockResolvedValueOnce({ id: 'm2', firstName: 'สมหญิง', lastName: 'รักงาน' });

      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('T002_FORM'), res);

      expect(res.status).not.toHaveBeenCalled();
      // T002/T003 ไม่เขียนสถานะหลักอีกแล้ว
      expect(prisma.studentCoop.update.mock.calls.some((c) => c[0].data.status)).toBe(false);
      expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { mentors: { connect: [{ id: 'm1' }, { id: 'm2' }] } } });
      expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, mentorSync: { linked: 2, created: 2 } });

      // T002 อาจารย์ประจำวิชาสหกิจตรวจได้ (มีเมนู T002) → แจ้งเจ้าหน้าที่ + อาจารย์ประจำวิชาของหลักสูตรนักศึกษาเท่านั้น
      for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ role: 'staff' }, { role: 'teacher', teacher: { isCoopTeacher: true, coopMajors: { some: { major: 'AI' } } } }] },
      }));
    });
  });

  // T002/T003 เท่ากัน ไม่ต่อกัน — ส่งข้ามกันได้ · ส่งซ้ำได้เฉพาะตอนยังไม่ส่ง/ถูกตีกลับ · ไม่เขียนสถานะหลัก
  describe('uploadDocument — T002/T003 คู่ขนาน', () => {
    const makeUploadReq = (docType) => ({
      body: { docType },
      file: { path: '/tmp/test.pdf', filename: 'test.pdf', mimetype: 'application/pdf', originalname: 'test.pdf' },
      user: { id: 1 },
    });
    const setupUpload = ({ coopStatus = 'INTERNSHIP_STARTED', oldDoc = null } = {}) => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null, major: 'AI' });
      prisma.document.findFirst.mockResolvedValue(oldDoc);
      prisma.coopT002Form.findUnique.mockReset().mockResolvedValue(null); // ไม่มีพี่เลี้ยงให้ซิงก์ (กันค่าค้างจากเทสต์ก่อนหน้า)
      prisma.document.create.mockResolvedValue({ id: 99 });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: coopStatus, companyId: 'c1' });
      prisma.studentCoop.update.mockResolvedValue({});
    };
    const wroteStatus = () => prisma.studentCoop.update.mock.calls.some((c) => c[0].data && c[0].data.status);

    test('200 — ส่ง T003 ตอน INTERNSHIP_STARTED ได้เลยไม่ต้องมี T002 · ไม่เขียนสถานะหลัก', async () => {
      setupUpload();
      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('T003_FORM'), res);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true });
      expect(wroteStatus()).toBe(false);
    });

    test.each([['T002_FORM', 'WAITING'], ['T002_FORM', 'APPROVED'], ['T003_FORM', 'WAITING'], ['T003_FORM', 'APPROVED']])(
      '400 — ส่ง %s ทับไฟล์ %s ไม่ได้', async (type, status) => {
        setupUpload({ oldDoc: { id: 7, path: 'old.pdf', type, status } });
        const res = makeRes();
        await docController.uploadDocument(makeUploadReq(type), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('ส่งได้เมื่อยังไม่ส่ง หรือถูกตีกลับให้แก้');
      });

    test.each(['T002_FORM', 'T003_FORM'])('200 — ส่ง %s ทับไฟล์ที่ถูกตีกลับ (REJECTED) ได้', async (type) => {
      setupUpload({ oldDoc: { id: 7, path: 'old.pdf', type, status: 'REJECTED' } });
      const res = makeRes();
      await docController.uploadDocument(makeUploadReq(type), res);
      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(wroteStatus()).toBe(false);
    });

    test('200 — ส่ง T002 ตอนสถานะเก่า T003_APPROVED ที่ไม่มีไฟล์ T002 (ข้อมูลค้างก่อน migrate)', async () => {
      setupUpload({ coopStatus: 'T003_APPROVED' });
      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('T002_FORM'), res);
      expect(res.status).not.toHaveBeenCalled();
      expect(wroteStatus()).toBe(false);
    });

    test('400 — ยังไม่ถึงช่วงฝึกงาน ส่ง T003 ไม่ได้', async () => {
      setupUpload({ coopStatus: 'PLACEMENT_LETTER_ISSUED' });
      const res = makeRes();
      await docController.uploadDocument(makeUploadReq('T003_FORM'), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('saveT003Form — ร่างตอน INTERNSHIP_STARTED', () => {
    test('200 — บันทึกร่าง T003 ได้โดยไม่ต้องส่ง T002 ก่อน (เดิม 400)', async () => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });
      prisma.coopT003Form.upsert.mockResolvedValue({ id: 1 });
      const res = makeRes();
      await docController.saveT003Form({ user: { id: 1 }, body: { reportTitleTh: 'x' } }, res);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  // ─────────────────────────────────────────────────────────
  // saveT002Form — พี่เลี้ยงหลายคน
  // ─────────────────────────────────────────────────────────
  describe('saveT002Form', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'INTERNSHIP_STARTED' });
      prisma.coopT002Form.upsert.mockResolvedValue({ id: 1 });
    });

    test('บันทึกพี่เลี้ยงคนที่ 2 เป็นต้นไปเป็น JSON (บันทึกอัตโนมัติ ไม่สร้างพี่เลี้ยงในระบบ)', async () => {
      const req = { user: { id: 1 }, body: { supervisorName: 'สมชาย ดูแลดี', extraSupervisors: [{ name: ' สมหญิง รักงาน ', phone: '081' }] } };
      const res = makeRes();
      await docController.saveT002Form(req, res);

      const { update } = prisma.coopT002Form.upsert.mock.calls[0][0];
      expect(JSON.parse(update.extraSupervisors)).toEqual([{ name: 'สมหญิง รักงาน', position: '', dept: '', phone: '081', fax: '', email: '' }]);
      expect(prisma.mentor.create).not.toHaveBeenCalled();
    });

    test('ไม่ได้ส่ง extraSupervisors มา (หน้าเว็บเวอร์ชันเก่า) → ไม่แตะค่าที่บันทึกไว้', async () => {
      const res = makeRes();
      await docController.saveT002Form({ user: { id: 1 }, body: { supervisorName: 'สมชาย ดูแลดี' } }, res);
      expect(prisma.coopT002Form.upsert.mock.calls[0][0].update.extraSupervisors).toBeUndefined();
    });
  });
});
