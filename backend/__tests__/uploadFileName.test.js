// ชื่อไฟล์ตอนบันทึกจาก /uploads — เดิมได้ชื่อตัวเลขที่ใช้เก็บบนเครื่อง (เช่น 17053928123-884912.pdf)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { friendlyUploadName, inlineDisposition } = require('../utils/uploadFileName');

const SOMCHAI = { studentId: '653380123-4', firstName: 'สมชาย', lastName: 'ใจดี' };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.supervisionAppointment.findMany.mockResolvedValue([]);
  prisma.studentCoop.findMany.mockResolvedValue([]);
  prisma.document.findMany.mockResolvedValue([]);
  prisma.student.findUnique.mockResolvedValue(SOMCHAI);
});

describe('friendlyUploadName', () => {
  test('หนังสือขอความอนุเคราะห์ฉบับลงนาม (StudentCoop.reqLetterUrl) → รหัส_ชื่อ_นามสกุล_ประเภท.pdf', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([{ studentId: 10, reqLetterUrl: '1705-1.pdf' }]);
    expect(await friendlyUploadName('1705-1.pdf')).toBe('653380123-4_สมชาย_ใจดี_หนังสือขอความอนุเคราะห์.pdf');
    expect(prisma.student.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 10 } }));
  });

  test('หนังสือส่งตัว (placeLetterUrl)', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([{ studentId: 10, reqLetterUrl: 'other.pdf' }]);
    expect(await friendlyUploadName('1705-2.pdf')).toBe('653380123-4_สมชาย_ใจดี_หนังสือส่งตัว.pdf');
  });

  test('หนังสือรวมหลายคนใช้ไฟล์เดียวกัน → ประเภท_รวม N คน (ไม่ใส่ชื่อคนใดคนหนึ่ง)', async () => {
    prisma.studentCoop.findMany.mockResolvedValue([{ studentId: 10, reqLetterUrl: 'b.pdf' }, { studentId: 11, reqLetterUrl: 'b.pdf' }, { studentId: 12, reqLetterUrl: 'b.pdf' }]);
    expect(await friendlyUploadName('b.pdf')).toBe('หนังสือขอความอนุเคราะห์_รวม 3 คน.pdf');
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  test('หนังสือขอนิเทศ (supervision/)', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ studentId: 10 }]);
    expect(await friendlyUploadName('supervision/SUPERVISION_LETTER_1.pdf')).toBe('653380123-4_สมชาย_ใจดี_หนังสือขอนิเทศ.pdf');
  });

  test('เอกสารที่นักศึกษาอัปโหลด (Document.type) → ชื่อประเภทภาษาไทย · นามสกุลไฟล์ตามจริง', async () => {
    prisma.document.findMany.mockResolvedValue([{ studentId: 10, type: 'TRANSCRIPT' }]);
    expect(await friendlyUploadName('1705-3.JPG')).toBe('653380123-4_สมชาย_ใจดี_ใบแสดงผลการเรียน.jpg');
  });

  test('ไม่รู้จักประเภท / ไม่มีเจ้าของ / โฟลเดอร์ส่วนกลาง → null (ใช้ชื่อเดิม)', async () => {
    prisma.document.findMany.mockResolvedValue([{ studentId: 10, type: 'OTHER' }]);
    expect(await friendlyUploadName('x.pdf')).toBeNull();
    prisma.document.findMany.mockResolvedValue([]);
    expect(await friendlyUploadName('y.pdf')).toBeNull();
    expect(await friendlyUploadName('system/KRUT_1.png')).toBeNull();
  });

  test('อักขระที่ใช้ในชื่อไฟล์ไม่ได้ถูกแทนด้วย -', async () => {
    prisma.student.findUnique.mockResolvedValue({ studentId: '653380123-4', firstName: 'a/b', lastName: 'c:d' });
    prisma.document.findMany.mockResolvedValue([{ studentId: 10, type: 'DISPATCH_LETTER' }]);
    expect(await friendlyUploadName('z.pdf')).toBe('653380123-4_a-b_c-d_หนังสือขอความอนุเคราะห์.pdf');
  });
});

describe('inlineDisposition', () => {
  test('inline (ยังเปิดดูในเบราว์เซอร์) + filename* แบบ UTF-8 + ชื่อสำรอง ASCII', () => {
    const v = inlineDisposition('653380123-4_สมชาย_หนังสือส่งตัว.pdf', '1705-2.pdf');
    expect(v.startsWith('inline; filename="1705-2.pdf"; filename*=UTF-8\'\'')).toBe(true);
    expect(decodeURIComponent(v.split("UTF-8''")[1])).toBe('653380123-4_สมชาย_หนังสือส่งตัว.pdf');
  });
});
