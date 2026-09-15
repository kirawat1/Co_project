// __tests__/adminDocController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  getAllStudentsForReview,
  getCoopApplications,
  getT000Config,
  getStudentsForT000,
  reviewStudentStatus,
  updateCoopApplicationStatus,
  markAcceptanceReceived,
  markLetterPending,
} = require('../controllers/adminDocController');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getAllStudentsForReview', () => {
  const mockStudents = [
    { id: 1, studentId: 'u640001', firstName: 'ก', coop: { coopPeriodId: 2, company: null }, documents: [] },
    { id: 2, studentId: 'u640002', firstName: 'ข', coop: { coopPeriodId: 3, company: null }, documents: [] },
  ];

  test('200 — คืนนักศึกษาทั้งหมดเมื่อไม่มี coopPeriodId', async () => {
    prisma.student.findMany.mockResolvedValue(mockStudents);
    prisma.student.count.mockResolvedValue(2);
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }] } })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].data).toHaveLength(2);
    expect(res.json.mock.calls[0][0].meta).toMatchObject({ total: 2, page: 1 });
  });

  test('200 — กรองตาม coopPeriodId=3', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[1]]);
    prisma.student.count.mockResolvedValue(1);
    const req = { query: { coopPeriodId: '3' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }, { coop: { coopPeriodId: 3 } }] } })
    );
    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
  });

  test('200 — กรองตาม status ที่ใช้ใน dashboard นับจำนวน', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudents[0]]);
    prisma.student.count.mockResolvedValue(7);
    const req = { query: { status: 'T002_SUBMITTED', limit: '1' } };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ deletedAt: null }, { coop: { status: 'T002_SUBMITTED' } }] },
        take: 1,
      })
    );
    expect(res.json.mock.calls[0][0].meta.total).toBe(7);
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('DB error'));
    const req = { query: {} };
    const res = makeRes();

    await getAllStudentsForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].ok).toBe(false);
  });
});

describe('getCoopApplications', () => {
  test('200 — กรอง student ที่ถูก soft-delete ออก', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([{ id: 1, status: 'QUALIFIED' }]);
    const req = {};
    const res = makeRes();

    await getCoopApplications(req, res);

    expect(prisma.studentCoop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['NOT_SUBMITTED'] }, student: { deletedAt: null } },
      })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });
});

// =====================
// getT000Config
// =====================
describe('getT000Config', () => {
  test('200 — คืน config ที่บันทึกไว้', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      key: 'T000_CONFIG',
      value: JSON.stringify({ startDate: '2026-01-01', endDate: '2026-06-30', isOpen: true }),
    });
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.isOpen).toBe(true);
    expect(body.startDate).toBe('2026-01-01');
  });

  test('200 — คืน default เมื่อยังไม่มี config', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.isOpen).toBe(false);
    expect(body.startDate).toBe('');
    expect(body.endDate).toBe('');
  });

  test('500 — DB error คืน 500', async () => {
    prisma.systemConfig.findUnique.mockRejectedValue(new Error('DB fail'));
    const req = {};
    const res = makeRes();
    await getT000Config(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// getStudentsForT000
// =====================
describe('getStudentsForT000', () => {
  const mockStudent = {
    id: 1,
    studentId: 'u640001',
    firstName: 'ก',
    lastName: 'ข',
    major: 'CS',
    gpa: 3.5,
    advisorName: 'อ. เขียว ฟ้าคราม',
    generalAdvisor: { id: 5, prefix: 'อ.', firstName: 'เขียว', lastName: 'ฟ้าคราม' },
    coop: { status: 'WAITING_FOR_STAFF_CHECK', t000Comment: null, company: null },
    coopApplicationForm: null,
    documents: [{ uploadedAt: new Date('2026-03-01') }],
  };

  test('200 — map ข้อมูลนักศึกษาถูกต้อง', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudent]);
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    const data = res.json.mock.calls[0][0];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].studentId).toBe('u640001');
    expect(data[0].docStatus).toBe('WAITING_FOR_STAFF_CHECK');
    expect(data[0].advisorName).toBe('อ. เขียว ฟ้าคราม');
    expect(data[0].generalAdvisor.firstName).toBe('เขียว');
  });

  test('200 — majorNameTh แปลงรหัสสาขา (CS) เป็นชื่อไทยจาก criteria สำหรับหนังสือส่งตัว', async () => {
    prisma.student.findMany.mockResolvedValue([mockStudent, { ...mockStudent, id: 2, major: 'ZZ' }]);
    prisma.coopCriteria.findMany.mockResolvedValue([{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }]);
    const res = makeRes();
    await getStudentsForT000({}, res);
    const data = res.json.mock.calls[0][0];
    expect(data[0].major).toBe('CS');
    expect(data[0].majorNameTh).toBe('วิทยาการคอมพิวเตอร์');
    expect(data[1].majorNameTh).toBeNull();
  });

  test('200 — student ที่ไม่มี coop record ให้ docStatus = WAITING', async () => {
    prisma.student.findMany.mockResolvedValue([{ ...mockStudent, coop: null, documents: [] }]);
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    expect(res.json.mock.calls[0][0][0].docStatus).toBe('WAITING');
  });

  test('500 — DB error คืน 500', async () => {
    prisma.student.findMany.mockRejectedValue(new Error('fail'));
    const req = {};
    const res = makeRes();
    await getStudentsForT000(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =====================
// reviewStudentStatus
// =====================
describe('reviewStudentStatus', () => {
  beforeEach(() => {
    prisma.studentCoop.upsert.mockResolvedValue({ id: 1 });
    prisma.student.findUnique.mockResolvedValue({ userId: 10 });
    prisma.notification.createMany.mockResolvedValue({ count: 1 });
  });

  test('200 — อัปเดตสถานะสำเร็จ (ไม่มีไฟล์)', async () => {
    const req = {
      body: { studentId: '1', status: 'QUALIFIED', comment: 'ผ่าน' },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    expect(prisma.studentCoop.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 1 },
        update: expect.objectContaining({ status: 'QUALIFIED', t000Comment: 'ผ่าน' }),
      })
    );
    expect(res.json.mock.calls[0][0].ok).toBe(true);
  });

  test('200 — อัปเดตพร้อม actualStartDate และ actualEndDate', async () => {
    const req = {
      body: {
        studentId: '2',
        status: 'INTERNSHIP_STARTED',
        comment: null,
        actualStartDate: '2026-06-01',
        actualEndDate: '2026-09-30',
      },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    const upsertArg = prisma.studentCoop.upsert.mock.calls[0][0];
    expect(upsertArg.update.actualStartDate).toEqual(new Date('2026-06-01'));
    expect(upsertArg.update.actualEndDate).toEqual(new Date('2026-09-30'));
  });

  test('500 — DB error คืน 500', async () => {
    prisma.studentCoop.upsert.mockRejectedValue(new Error('DB fail'));
    const req = {
      body: { studentId: '1', status: 'QUALIFIED', comment: null },
      file: null,
    };
    const res = makeRes();
    await reviewStudentStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  // เจ้าหน้าที่เลือกวิธีจัดส่งหนังสือตอนออกหนังสือ — เก็บไว้ให้หน้านักศึกษา + ใส่ในแจ้งเตือน
  describe('วิธีจัดส่งหนังสือ (deliveryMethod)', () => {
    const letterFile = { filename: 'signed.pdf', originalname: 'signed.pdf' };
    const flush = () => new Promise((r) => setImmediate(r));
    const notifiedMessage = () => prisma.notification.createMany.mock.calls[0]?.[0]?.data?.[0]?.message;
    beforeEach(() => {
      prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
      prisma.studentCoop.findFirst.mockResolvedValue(null);
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({ id: 1 });
      prisma.notification.findMany.mockResolvedValue([]);
    });

    test.each([
      ['REQ_LETTER_ISSUED', 'DOCS_APPROVED', 'reqDocNumber', 'reqLetterDelivery', 'STAFF', /ออกหนังสือขอความอนุเคราะห์แล้ว.*เจ้าหน้าที่จัดส่งให้บริษัท.*ไม่ต้องนำไปยื่นเอง/],
      ['REQ_LETTER_ISSUED', 'DOCS_APPROVED', 'reqDocNumber', 'reqLetterDelivery', 'STUDENT', /ออกหนังสือขอความอนุเคราะห์แล้ว.*ดาวน์โหลด.*ยื่นบริษัท/],
      ['PLACEMENT_LETTER_ISSUED', 'ACCEPTANCE_CHECKED', 'placeDocNumber', 'placeLetterDelivery', 'STAFF', /ออกหนังสือส่งตัวแล้ว.*เจ้าหน้าที่จัดส่งให้บริษัท/],
      ['PLACEMENT_LETTER_ISSUED', 'ACCEPTANCE_CHECKED', 'placeDocNumber', 'placeLetterDelivery', 'STUDENT', /ออกหนังสือส่งตัวแล้ว.*ดาวน์โหลด/],
    ])('%s ส่ง %s→ เก็บ %s และแจ้งเตือนบอกวิธีจัดส่ง (%s)', async (status, current, numberField, deliveryField, method, messagePattern) => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status: current, reqLetterUrl: null, placeLetterUrl: null });
      const res = makeRes();
      await reviewStudentStatus({
        body: { studentId: '1', status, comment: 'x', [numberField]: '660301.26.6.2/55', docType: 'X', deliveryMethod: method },
        file: letterFile,
      }, res);
      await flush(); await flush();

      expect(prisma.studentCoop.upsert.mock.calls[0][0].update[deliveryField]).toBe(method);
      expect(notifiedMessage()).toMatch(messagePattern);
      expect(prisma.notification.createMany.mock.calls[0][0].data[0].link).toBe('/student/docs');
    });

    // เจ้าหน้าที่ส่งหนังสือส่งตัวให้บริษัทเอง → นักศึกษาไม่ต้องกดดาวน์โหลด สถานะเป็น "ออกฝึกสหกิจ" ทันที (ส่ง T002/นัดนิเทศได้)
    test.each([
      ['ACCEPTANCE_CHECKED', 'STAFF', 'INTERNSHIP_STARTED'],
      ['PLACEMENT_LETTER_ISSUED', 'STAFF', 'INTERNSHIP_STARTED'], // ค้างอยู่ก่อน → พิมพ์ซ้ำแบบเจ้าหน้าที่ส่งเองแล้วเดินต่อ
      ['ACCEPTANCE_CHECKED', 'STUDENT', 'PLACEMENT_LETTER_ISSUED'],
    ])('หนังสือส่งตัว จาก %s ส่งแบบ %s → สถานะ %s', async (current, method, expected) => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status: current, reqLetterUrl: null, placeLetterUrl: null });
      const res = makeRes();
      await reviewStudentStatus({
        body: { studentId: '1', status: 'PLACEMENT_LETTER_ISSUED', comment: 'x', placeDocNumber: '660301.26.6.2/60', docType: 'PLACEMENT_LETTER', deliveryMethod: method },
        file: letterFile,
      }, res);
      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.studentCoop.upsert.mock.calls[0][0].update.status).toBe(expected);
    });

    test('หนังสือส่งตัว STAFF แต่นักศึกษาส่ง T002 ไปแล้ว → คงสถานะเดิม (พิมพ์ซ้ำ)', async () => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'T002_SUBMITTED', reqLetterUrl: null, placeLetterUrl: 'old.pdf' });
      const res = makeRes();
      await reviewStudentStatus({
        body: { studentId: '1', status: 'PLACEMENT_LETTER_ISSUED', comment: 'x', placeDocNumber: '660301.26.6.2/61', docType: 'PLACEMENT_LETTER', deliveryMethod: 'STAFF' },
        file: letterFile,
      }, res);
      expect(prisma.studentCoop.upsert.mock.calls[0][0].update).not.toHaveProperty('status');
      expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, statusKept: true });
    });

    test('deliveryMethod ไม่ถูกต้อง / ไม่ส่งมา → ไม่บันทึก และแจ้งเตือนข้อความเดิม', async () => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'DOCS_APPROVED', reqLetterUrl: null, placeLetterUrl: null });
      const res = makeRes();
      await reviewStudentStatus({
        body: { studentId: '1', status: 'REQ_LETTER_ISSUED', comment: 'x', reqDocNumber: '660301.26.6.2/56', docType: 'X', deliveryMethod: 'POST' },
        file: letterFile,
      }, res);
      await flush(); await flush();

      expect(prisma.studentCoop.upsert.mock.calls[0][0].update).not.toHaveProperty('reqLetterDelivery');
      expect(notifiedMessage()).toBe('ออกหนังสือขอความอนุเคราะห์แล้ว');
    });

    test('ไม่มีไฟล์หนังสือ (ไม่ใช่การออกหนังสือ) → ไม่แตะวิธีจัดส่ง', async () => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status: 'WAITING_FOR_STAFF_CHECK', reqLetterUrl: null, placeLetterUrl: null });
      const res = makeRes();
      await reviewStudentStatus({ body: { studentId: '1', status: 'DOCS_APPROVED', comment: 'ok', deliveryMethod: 'STAFF' }, file: null }, res);
      const update = prisma.studentCoop.upsert.mock.calls[0][0].update;
      expect(update).not.toHaveProperty('reqLetterDelivery');
      expect(update).not.toHaveProperty('placeLetterDelivery');
    });
  });

  // ห้ามสถานะย้อนกลับ — ปุ่ม "พิมพ์ซ้ำ" หนังสือ และปุ่มตรวจเอกสารย้อนหลัง ส่งสถานะของขั้นตอนนั้นมาเสมอ
  describe('ไม่ให้สถานะย้อนกลับ', () => {
    const letterFile = { filename: 'new-letter.pdf', originalname: 'letter.pdf' };
    const withCurrent = (status) => prisma.studentCoop.findUnique.mockResolvedValue({ status, reqLetterUrl: null, placeLetterUrl: null });
    beforeEach(() => {
      prisma.studentCoop.findUnique.mockReset();
      prisma.studentCoop.findFirst.mockResolvedValue(null);
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({ id: 1 });
    });

    test.each([
      ['REQ_LETTER_ISSUED', 'INTERNSHIP_STARTED', 'reqDocNumber'],
      ['REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'reqDocNumber'],
      ['PLACEMENT_LETTER_ISSUED', 'T002_SUBMITTED', 'placeDocNumber'],
    ])('พิมพ์ซ้ำ %s ให้นักศึกษาที่อยู่ %s แล้ว → บันทึกหนังสือใหม่ แต่คงสถานะเดิม', async (target, current, numberField) => {
      withCurrent(current);
      const req = {
        body: { studentId: '1', status: target, comment: 'ออกใหม่', [numberField]: '660301.26.6.2/99', docType: 'DISPATCH_LETTER' },
        file: letterFile,
      };
      const res = makeRes();
      await reviewStudentStatus(req, res);

      expect(res.status).not.toHaveBeenCalled();
      const update = prisma.studentCoop.upsert.mock.calls[0][0].update;
      expect(update.status).toBeUndefined();
      expect(update[numberField]).toBe('660301.26.6.2/99');
    });

    test('ออกหนังสือขอความอนุเคราะห์ครั้งแรก (DOCS_APPROVED) → เปลี่ยนเป็น REQ_LETTER_ISSUED ตามปกติ', async () => {
      withCurrent('DOCS_APPROVED');
      const req = {
        body: { studentId: '1', status: 'REQ_LETTER_ISSUED', comment: 'ออก', reqDocNumber: '660301.26.6.2/100', docType: 'DISPATCH_LETTER' },
        file: letterFile,
      };
      const res = makeRes();
      await reviewStudentStatus(req, res);
      expect(prisma.studentCoop.upsert.mock.calls[0][0].update.status).toBe('REQ_LETTER_ISSUED');
    });

    test.each(['DOCS_APPROVED', 'EDITS_REQUIRED', 'ACCEPTANCE_CHECKED', 'INTERNSHIP_STARTED'])(
      '409 — นักศึกษาส่ง T003 แล้ว ตั้งสถานะย้อนเป็น %s ไม่ได้ และไม่บันทึกอะไร',
      async (target) => {
        withCurrent('T003_SUBMITTED');
        const req = { body: { studentId: '1', status: target, comment: 'x' }, file: null };
        const res = makeRes();
        await reviewStudentStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(prisma.studentCoop.upsert).not.toHaveBeenCalled();
      },
    );

    test.each([
      ['REQ_LETTER_ISSUED', 'DOCS_APPROVED', 'reqDocNumber', 'reqLetter'],
      ['PLACEMENT_LETTER_ISSUED', 'ACCEPTANCE_CHECKED', 'placeDocNumber', 'placeLetter'],
    ])('อัปโหลดฉบับลงนาม %s → ล้างป้าย "รอลงนาม" ของหนังสือนั้น', async (target, current, numberField, prefix) => {
      withCurrent(current);
      const req = {
        body: { studentId: '1', status: target, comment: 'ออก', [numberField]: '660301.26.6.2/101', docType: 'X_LETTER' },
        file: letterFile,
      };
      const res = makeRes();
      await reviewStudentStatus(req, res);
      const update = prisma.studentCoop.upsert.mock.calls[0][0].update;
      expect(update).toMatchObject({ [`${prefix}PendingAt`]: null, [`${prefix}DraftNumber`]: null, [`${prefix}DraftDate`]: null });
      const other = prefix === 'reqLetter' ? 'placeLetter' : 'reqLetter';
      expect(update).not.toHaveProperty(`${other}PendingAt`);
    });

    test('ไม่มีไฟล์ (ตรวจเอกสารธรรมดา) → ไม่แตะป้าย "รอลงนาม"', async () => {
      withCurrent('WAITING_FOR_STAFF_CHECK');
      const res = makeRes();
      await reviewStudentStatus({ body: { studentId: '1', status: 'DOCS_APPROVED', comment: 'ok' }, file: null }, res);
      const update = prisma.studentCoop.upsert.mock.calls[0][0].update;
      expect(update).not.toHaveProperty('reqLetterPendingAt');
      expect(update).not.toHaveProperty('placeLetterPendingAt');
    });

    test('409 — เลขที่หนังสือซ้ำกับร่างที่รอลงนามของนักศึกษาคนอื่น', async () => {
      withCurrent('DOCS_APPROVED');
      prisma.studentCoop.findFirst.mockResolvedValue({
        reqDocNumber: null, reqLetterDraftNumber: '660301.26.6.2/102',
        student: { studentId: '663380999-9', firstName: 'ข', lastName: 'ค' },
      });
      const req = {
        body: { studentId: '1', status: 'REQ_LETTER_ISSUED', comment: 'ออก', reqDocNumber: '660301.26.6.2/102', docType: 'DISPATCH_LETTER' },
        file: letterFile,
      };
      const res = makeRes();
      await reviewStudentStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json.mock.calls[0][0].message).toMatch(/รอลงนาม/);
      expect(prisma.studentCoop.upsert).not.toHaveBeenCalled();
    });

    test.each(['WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED'])(
      'ตีกลับใบตอบรับจาก %s → WAITING_FOR_PLACEMENT_LETTER (รอใบตอบรับ) + แจ้งเตือนให้อัปโหลดใหม่',
      async (current) => {
        withCurrent(current);
        prisma.notification.findMany.mockResolvedValue([]);
        const res = makeRes();
        await reviewStudentStatus({ body: { studentId: '1', status: 'WAITING_FOR_PLACEMENT_LETTER', comment: 'ใบตอบรับไม่มีลายเซ็น' }, file: null }, res);
        await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));

        expect(res.status).not.toHaveBeenCalled();
        expect(prisma.studentCoop.upsert.mock.calls[0][0].update).toMatchObject({ status: 'WAITING_FOR_PLACEMENT_LETTER', t000Comment: 'ใบตอบรับไม่มีลายเซ็น' });
        const note = prisma.notification.createMany.mock.calls[0]?.[0]?.data?.[0];
        expect(note?.message).toMatch(/ใบตอบรับต้องแก้ไข/);
        expect(note?.link).toBe('/student/docs');
      },
    );

    test('ช่วงก่อนฝึกงาน ตีกลับเอกสารจาก DOCS_APPROVED เป็น EDITS_REQUIRED ได้เหมือนเดิม', async () => {
      withCurrent('DOCS_APPROVED');
      const req = { body: { studentId: '1', status: 'EDITS_REQUIRED', comment: 'แก้ลายเซ็น' }, file: null };
      const res = makeRes();
      await reviewStudentStatus(req, res);
      expect(res.status).not.toHaveBeenCalled();
      expect(prisma.studentCoop.upsert.mock.calls[0][0].update.status).toBe('EDITS_REQUIRED');
    });
  });
});

// =====================
// updateCoopApplicationStatus
// =====================
describe('updateCoopApplicationStatus', () => {
  test('403 — teacher เป็นแค่ที่ปรึกษาทั่วไป (generalAdvisorId) ไม่ใช่ที่ปรึกษาโครงงานสหกิจ → อนุมัติคำร้องไม่ได้', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({
      status: 'WAITING_FOR_STAFF_CHECK',
      student: { deletedAt: null, id: 1, coopAdvisorId: 99 },
    });
    prisma.teacher.findUnique.mockResolvedValue({ id: 7 });

    const req = { params: { id: '1' }, body: { status: 'QUALIFIED' }, user: { id: 1, role: 'teacher' } };
    const res = makeRes();
    await updateCoopApplicationStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('200 — teacher เป็นที่ปรึกษาโครงงานสหกิจ (coopAdvisorId) ตัวจริง → อนุมัติได้', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({
      status: 'WAITING_FOR_STAFF_CHECK',
      student: { deletedAt: null, id: 1, coopAdvisorId: 7 },
    });
    prisma.teacher.findUnique.mockResolvedValue({ id: 7 });
    prisma.studentCoop.update.mockResolvedValue({ id: 1, status: 'QUALIFIED' });

    const req = { params: { id: '1' }, body: { status: 'QUALIFIED' }, user: { id: 1, role: 'teacher' } };
    const res = makeRes();
    await updateCoopApplicationStatus(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(prisma.studentCoop.update).toHaveBeenCalled();
  });
});

// =====================
// markAcceptanceReceived — บริษัทส่งใบตอบรับมาที่เจ้าหน้าที่โดยตรง
// =====================
describe('markAcceptanceReceived', () => {
  const file = { filename: 'acc-from-company.pdf', originalname: 'acceptance.pdf', path: '/nonexistent/acc-from-company.pdf' };
  beforeEach(() => {
    prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
    prisma.student.findUnique.mockResolvedValue({ id: 1, userId: 10, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'WAITING_FOR_PLACEMENT_LETTER', acceptanceFileUrl: null });
    prisma.studentCoop.update.mockResolvedValue({});
    prisma.document.findFirst.mockResolvedValue(null);
    prisma.document.create.mockResolvedValue({ id: 5 });
    prisma.document.update.mockResolvedValue({ id: 5 });
    prisma.notification.createMany.mockResolvedValue({ count: 1 });
  });

  test('200 — ไม่แนบไฟล์ → สถานะเป็น "ตรวจใบตอบรับแล้ว" พร้อมข้อความว่าได้รับจากบริษัท', async () => {
    const res = makeRes();
    await markAcceptanceReceived({ body: { studentId: '1' }, file: undefined }, res);

    expect(res.status).not.toHaveBeenCalled();
    const { data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(data.status).toBe('ACCEPTANCE_CHECKED');
    expect(data.t000Comment).toMatch(/ได้รับใบตอบรับจากบริษัท/);
    expect(data.acceptanceFileUrl).toBeUndefined();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test('200 — แนบไฟล์ → เก็บเป็นเอกสารใบตอบรับของนักศึกษา (ผ่านแล้ว) + หมายเหตุจากเจ้าหน้าที่', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'REQ_LETTER_ISSUED', acceptanceFileUrl: null });
    const res = makeRes();
    await markAcceptanceReceived({ body: { studentId: '1', note: 'บริษัทส่งทางอีเมล' }, file }, res);

    expect(prisma.document.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      studentId: 1, type: 'CP-ACCEPTANCE', path: 'acc-from-company.pdf', name: 'acceptance.pdf', status: 'APPROVED',
    }) });
    const { data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(data).toMatchObject({ status: 'ACCEPTANCE_CHECKED', acceptanceFileUrl: 'acc-from-company.pdf' });
    expect(data.t000Comment).toMatch(/บริษัทส่งทางอีเมล/);
  });

  test('200 — มีเอกสารใบตอบรับเดิมอยู่แล้ว → แทนที่ไฟล์เดิม ไม่สร้างซ้ำ', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 5, path: 'old.pdf' });
    const res = makeRes();
    await markAcceptanceReceived({ body: { studentId: '1' }, file }, res);

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 5 }, data: expect.objectContaining({ path: 'acc-from-company.pdf', status: 'APPROVED' }) });
  });

  test.each(['WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'DOCS_APPROVED', 'INTERNSHIP_STARTED'])(
    '400 — สถานะ %s ไม่ใช่ช่วงรอใบตอบรับ → ไม่บันทึก',
    async (status) => {
      prisma.studentCoop.findUnique.mockResolvedValue({ status });
      const res = makeRes();
      await markAcceptanceReceived({ body: { studentId: '1' }, file: undefined }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.studentCoop.update).not.toHaveBeenCalled();
    },
  );

  test('404 — ไม่พบนักศึกษา / อยู่ในถังขยะ', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: new Date() });
    const res = makeRes();
    await markAcceptanceReceived({ body: { studentId: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400 — studentId ไม่ถูกต้อง', async () => {
    const res = makeRes();
    await markAcceptanceReceived({ body: { studentId: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// =====================
// markLetterPending — ดาวน์โหลดร่างหนังสือไปเซ็น → ป้าย "รอลงนาม" สำหรับเจ้าหน้าที่
// =====================
describe('markLetterPending', () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
    prisma.student.findUnique.mockResolvedValue({ id: 1, deletedAt: null });
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'DOCS_APPROVED' });
    prisma.studentCoop.findFirst.mockResolvedValue(null);
    prisma.studentCoop.update.mockResolvedValue({});
  });

  test('200 — หนังสือขอความอนุเคราะห์: บันทึกเวลา + เลขที่/วันที่ร่าง (ตัด "ที่ อว" ออก)', async () => {
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'REQUEST', docNumber: 'ที่ อว 660301.26.6.2/150', docDate: '2026-09-14' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    const { where, data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(where).toEqual({ studentId: 1 });
    expect(data.reqLetterPendingAt).toBeInstanceOf(Date);
    expect(data.reqLetterDraftNumber).toBe('660301.26.6.2/150');
    expect(data.reqLetterDraftDate.toISOString().slice(0, 10)).toBe('2026-09-14');
    expect(data).not.toHaveProperty('placeLetterPendingAt');
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, draftNumber: '660301.26.6.2/150' });
  });

  test('200 — หนังสือส่งตัว ใช้ช่อง placeLetter*', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'ACCEPTANCE_CHECKED' });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'PLACEMENT', docNumber: '660301.26.6.2/151' } }, res);

    const { data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(data.placeLetterPendingAt).toBeInstanceOf(Date);
    expect(data.placeLetterDraftNumber).toBe('660301.26.6.2/151');
    expect(data.placeLetterDraftDate).toBeNull();
    expect(data).not.toHaveProperty('reqLetterPendingAt');
  });

  test('200 — เลขที่ยังเป็นเทมเพลต (ไม่มีเลขหลัง "/") → ยังขึ้นรอลงนาม แต่ไม่เก็บเลขที่ และไม่เช็คซ้ำ', async () => {
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'REQUEST', docNumber: '660301.26.6.2/' } }, res);

    const { data } = prisma.studentCoop.update.mock.calls[0][0];
    expect(data.reqLetterPendingAt).toBeInstanceOf(Date);
    expect(data.reqLetterDraftNumber).toBeNull();
    expect(prisma.studentCoop.findFirst).not.toHaveBeenCalled();
  });

  test('200 — พิมพ์ซ้ำให้คนที่ฝึกงานแล้วก็ขึ้นรอลงนามได้', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'T002_SUBMITTED' });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'PLACEMENT' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.studentCoop.update).toHaveBeenCalled();
  });

  test('409 — เลขที่ซ้ำกับหนังสือที่ออกให้คนอื่นไปแล้ว', async () => {
    prisma.studentCoop.findFirst.mockResolvedValue({
      reqDocNumber: '660301.26.6.2/150', reqLetterDraftNumber: null,
      student: { studentId: '663380111-1', firstName: 'ก', lastName: 'ข' },
    });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'REQUEST', docNumber: '660301.26.6.2/150' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/663380111-1/);
    expect(prisma.studentCoop.findFirst.mock.calls[0][0].where).toMatchObject({ studentId: { not: 1 } });
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('409 — เลขที่ซ้ำกับร่างที่รอลงนามของคนอื่น → บอกให้ยกเลิกรอลงนามคนนั้นก่อน', async () => {
    prisma.studentCoop.findFirst.mockResolvedValue({
      reqDocNumber: null, reqLetterDraftNumber: '660301.26.6.2/150',
      student: { studentId: '663380111-1', firstName: 'ก', lastName: 'ข' },
    });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'REQUEST', docNumber: '660301.26.6.2/150' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/รอลงนาม/);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test.each([
    ['REQUEST', 'WAITING_FOR_STAFF_CHECK'],
    ['REQUEST', 'EDITS_REQUIRED'],
    ['PLACEMENT', 'REQ_LETTER_ISSUED'],
    ['PLACEMENT', 'WAITING_FOR_STAFF_CHECK_LETTER'],
  ])('400 — %s ตอนสถานะ %s ยังไม่ถึงขั้นออกหนังสือ', async (letter, status) => {
    prisma.studentCoop.findUnique.mockResolvedValue({ status });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('200 — cancel ล้างป้ายรอลงนามของหนังสือนั้น (ไม่ต้องเช็คสถานะ)', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue({ status: 'WAITING_FOR_STAFF_CHECK' });
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'PLACEMENT', cancel: true } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.studentCoop.update.mock.calls[0][0].data).toEqual({
      placeLetterPendingAt: null, placeLetterDraftNumber: null, placeLetterDraftDate: null,
    });
  });

  test.each([
    [{ studentId: '1', letter: 'OTHER' }],
    [{ studentId: 'abc', letter: 'REQUEST' }],
    [{ studentId: '1', letter: 'REQUEST', docDate: 'not-a-date' }],
  ])('400 — ข้อมูลไม่ถูกต้อง %o', async (body) => {
    const res = makeRes();
    await markLetterPending({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.studentCoop.update).not.toHaveBeenCalled();
  });

  test('404 — ไม่พบนักศึกษา / ยังไม่มีข้อมูลสหกิจ', async () => {
    prisma.studentCoop.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await markLetterPending({ body: { studentId: '1', letter: 'REQUEST' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
