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

    test('409 — ไม่สามารถลบ T002 ที่อยู่ระหว่างการตรวจสอบ (T002_SUBMITTED)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: 'T002_FORM',
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'T002_SUBMITTED' });

      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('409 — ไม่สามารถลบ T003 ที่อยู่ระหว่างการตรวจสอบ (T003_SUBMITTED)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 6, path: 'test3.pdf', studentId: 10, type: 'T003_FORM',
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'T003_SUBMITTED' });

      const req = { params: { id: '6' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    test('200 — ลบ T002 ได้เมื่อสถานะเป็น T002_EDITS_REQUIRED (ยังไม่ lock)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 5, path: 'test.pdf', studentId: 10, type: 'T002_FORM',
        student: { userId: 1, deletedAt: null },
      });
      prisma.student.findUnique.mockResolvedValue({ deletedAt: null });
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'T002_EDITS_REQUIRED' });
      prisma.document.delete.mockResolvedValue({});

      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = makeRes();
      await docController.deleteDocument(req, res);
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
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

    test('403 — ระบบปิดรับเอกสาร T000 (isOpen = false)', async () => {
      prisma.documentRequirement.findFirst.mockResolvedValue({ id: 1 }); // valid docKey
      prisma.systemConfig.findUnique.mockResolvedValue({
        key: 'T000_CONFIG',
        value: JSON.stringify({ isOpen: false, startDate: null, endDate: null }),
      });
      prisma.student.findUnique.mockResolvedValue({ id: 10, deletedAt: null });

      const req = makeUploadReq('CP-CV');
      const res = makeRes();
      await docController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.document.create).not.toHaveBeenCalled();
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
      prisma.student.findUnique.mockResolvedValue({ id: 10, userId: 1, deletedAt: null });
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
      expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { status: 'T002_SUBMITTED' } });
      expect(prisma.studentCoop.update).toHaveBeenCalledWith({ where: { studentId: 10 }, data: { mentors: { connect: [{ id: 'm1' }, { id: 'm2' }] } } });
      expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, mentorSync: { linked: 2, created: 2 } });

      // T002 อาจารย์ประจำวิชาสหกิจตรวจได้ (มีเมนู T002) → แจ้งทั้งเจ้าหน้าที่และอาจารย์ประจำวิชา
      for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ role: 'staff' }, { role: 'teacher', teacher: { isCoopTeacher: true } }] },
      }));
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
