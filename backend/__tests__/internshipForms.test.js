// กติกาฟอร์ม T002/T003 แบบคู่ขนาน — สถานะหลักคงที่ที่ INTERNSHIP_STARTED, สถานะย่อยดูจากไฟล์ล่าสุดของแต่ละฟอร์ม
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  FORM_TYPES, LEGACY_INTERNSHIP_STATUSES, INTERNSHIP_STATUSES, isInternshipStatus,
  formState, canSubmitForm, reviewActions, latestFormDoc, reviewForm, formPendingStudent,
} = require('../utils/internshipForms');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.document.update.mockResolvedValue({});
});

describe('internshipForms', () => {
  test('FORM_TYPES / INTERNSHIP_STATUSES', () => {
    expect(FORM_TYPES).toEqual({ T002: 'T002_FORM', T003: 'T003_FORM' });
    expect(LEGACY_INTERNSHIP_STATUSES).toHaveLength(5);
    expect(INTERNSHIP_STATUSES).toEqual(['INTERNSHIP_STARTED', ...LEGACY_INTERNSHIP_STATUSES]);
  });

  test('isInternshipStatus: สถานะหลักและค่าเก่าทั้ง 5 เหมือนกัน · ช่วงอื่นไม่ใช่', () => {
    for (const s of ['INTERNSHIP_STARTED', 'T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED']) {
      expect(isInternshipStatus(s)).toBe(true);
    }
    expect(isInternshipStatus('PLACEMENT_LETTER_ISSUED')).toBe(false);
  });

  test('formState', () => {
    expect(formState(null)).toBe('NONE');
    expect(formState({ status: 'WAITING' })).toBe('WAITING');
    expect(formState({ status: 'PENDING' })).toBe('WAITING');
    expect(formState({ status: 'EDITS_REQUIRED' })).toBe('REJECTED');
    expect(formState({ status: 'REJECTED' })).toBe('REJECTED');
    expect(formState({ status: 'APPROVED' })).toBe('APPROVED');
  });

  test('canSubmitForm', () => {
    expect(canSubmitForm('INTERNSHIP_STARTED', 'NONE')).toBe(true);
    expect(canSubmitForm('T003_APPROVED', 'REJECTED')).toBe(true);
    expect(canSubmitForm('INTERNSHIP_STARTED', 'WAITING')).toBe(false);
    expect(canSubmitForm('INTERNSHIP_STARTED', 'APPROVED')).toBe(false);
    expect(canSubmitForm('PLACEMENT_LETTER_ISSUED', 'NONE')).toBe(false);
  });

  test('reviewActions', () => {
    expect(reviewActions('INTERNSHIP_STARTED', 'WAITING')).toEqual({ approve: true, reject: true });
    expect(reviewActions('INTERNSHIP_STARTED', 'APPROVED')).toEqual({ approve: false, reject: true });
    expect(reviewActions('INTERNSHIP_STARTED', 'REJECTED')).toEqual({ approve: false, reject: false });
    expect(reviewActions('INTERNSHIP_STARTED', 'NONE')).toEqual({ approve: false, reject: false });
    expect(reviewActions('PLACEMENT_LETTER_ISSUED', 'WAITING')).toEqual({ approve: false, reject: false });
  });

  test('latestFormDoc ดึงไฟล์ล่าสุดของชนิดฟอร์ม', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 9 });
    expect(await latestFormDoc(prisma, 10, 'T003')).toEqual({ id: 9 });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({ where: { studentId: 10, type: 'T003_FORM' }, orderBy: { id: 'desc' } });
  });

  describe('reviewForm', () => {
    const setup = (coopStatus, docStatus) => {
      prisma.studentCoop.findUnique.mockResolvedValue(coopStatus ? { status: coopStatus } : null);
      prisma.document.findFirst.mockResolvedValue(docStatus ? { id: 7, status: docStatus } : null);
    };

    test('WAITING + reject → ไฟล์ REJECTED พร้อมเหตุผล · ไม่แตะสถานะสหกิจ', async () => {
      setup('INTERNSHIP_STARTED', 'WAITING');
      await reviewForm(prisma, { studentId: 10, stepKey: 'T002', reject: true, comment: 'แก้ข้อ 2' });
      expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'REJECTED', rejectReason: 'แก้ข้อ 2' } });
      expect(prisma.studentCoop.update).not.toHaveBeenCalled();
    });

    test('PENDING + approve (สถานะเก่า T003_APPROVED) → APPROVED เคลียร์เหตุผล', async () => {
      setup('T003_APPROVED', 'PENDING');
      await reviewForm(prisma, { studentId: 10, stepKey: 'T003', reject: false, comment: 'x' });
      expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'APPROVED', rejectReason: null } });
    });

    test('APPROVED + reject (ตีกลับย้อนหลัง) ได้', async () => {
      setup('INTERNSHIP_STARTED', 'APPROVED');
      await reviewForm(prisma, { studentId: 10, stepKey: 'T003', reject: true, comment: 'ผิด' });
      expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'REJECTED', rejectReason: 'ผิด' } });
    });

    test('APPROVED + approve / REJECTED / ไม่มีไฟล์ / ไม่มีสหกิจ / นอกช่วงฝึกงาน → 400', async () => {
      for (const [c, d, reject] of [['INTERNSHIP_STARTED', 'APPROVED', false], ['INTERNSHIP_STARTED', 'REJECTED', false], ['INTERNSHIP_STARTED', 'REJECTED', true], ['INTERNSHIP_STARTED', null, false], [null, 'WAITING', false], ['PLACEMENT_LETTER_ISSUED', 'WAITING', false]]) {
        setup(c, d);
        await expect(reviewForm(prisma, { studentId: 10, stepKey: 'T002', reject })).rejects.toMatchObject({ is400: true });
      }
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  test('formPendingStudent', () => {
    expect(formPendingStudent('T003')).toEqual({ documents: { some: { type: 'T003_FORM', status: { in: ['WAITING', 'PENDING'] } } } });
  });
});
