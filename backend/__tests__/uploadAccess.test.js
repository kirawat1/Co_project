// สิทธิ์เปิดไฟล์ใน /uploads — เดิมใครมีลิงก์ก็เปิดได้โดยไม่ต้อง login (บัตรประชาชน ใบเกรด หนังสือยินยอม ฯลฯ)
// เจ้าหน้าที่ = ทุกไฟล์ · ไฟล์ส่วนกลาง (system/ ประกาศ) = ทุกคนที่ login · ไฟล์ของนักศึกษา = เจ้าของ + อาจารย์ที่เห็นนักศึกษาคนนั้นอยู่แล้ว
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');
const { canAccessUpload } = require('../utils/uploadAccess');

const STAFF = { id: 1, role: 'staff' };
const STUDENT_10 = { id: 100, role: 'student' }; // Student.id 10
const STUDENT_11 = { id: 101, role: 'student' }; // Student.id 11
const TEACHER = { id: 200, role: 'teacher' };

function owners({ docs = [], coops = [], forms = [], ann = [], feedback = [], supervision = [] } = {}) {
  prisma.document.findMany.mockResolvedValue(docs.map((studentId) => ({ studentId })));
  prisma.studentCoop.findMany.mockResolvedValue(coops.map((studentId) => ({ studentId })));
  prisma.coopApplicationForm.findMany.mockResolvedValue(forms.map((studentId) => ({ studentId })));
  prisma.annFile.findMany.mockResolvedValue(ann);
  prisma.feedback.findMany.mockResolvedValue(feedback.map((userId) => ({ userId })));
  prisma.supervisionAppointment.findMany.mockResolvedValue(supervision.map((studentId) => ({ studentId })));
}

beforeEach(() => {
  jest.clearAllMocks();
  owners();
  prisma.student.findUnique.mockImplementation(async ({ where }) => ({ 100: { id: 10 }, 101: { id: 11 } })[where.userId] || null);
  prisma.teacher.findUnique.mockResolvedValue({ id: 20, coopMajors: [{ major: 'AI' }] });
  prisma.student.count.mockResolvedValue(0);
});

describe('canAccessUpload', () => {
  test('เจ้าหน้าที่เปิดได้ทุกไฟล์ (ไม่ต้องค้นเจ้าของ)', async () => {
    expect(await canAccessUpload(STAFF, 'anything.pdf')).toBe(true);
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  test('ไฟล์ระบบ / โฟลเดอร์ประกาศ = ทุกคนที่ login', async () => {
    expect(await canAccessUpload(STUDENT_10, 'system/KRUT_1.png')).toBe(true);
    expect(await canAccessUpload(TEACHER, 'announcements/a.pdf')).toBe(true);
  });

  test('โฟลเดอร์อื่นที่ไม่รู้จัก → ไม่ให้', async () => {
    expect(await canAccessUpload(STUDENT_10, 'secret/x.pdf')).toBe(false);
  });

  test('เอกสารของนักศึกษา: เจ้าของเปิดได้ คนอื่นไม่ได้', async () => {
    owners({ docs: [10] });
    expect(await canAccessUpload(STUDENT_10, '1768954473557-1.pdf')).toBe(true);
    expect(await canAccessUpload(STUDENT_11, '1768954473557-1.pdf')).toBe(false);
    expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({ path: '1768954473557-1.pdf' });
  });

  test('หนังสือรวมหลายคน (ไฟล์เดียวกัน) → ทุกคนในหนังสือเปิดได้', async () => {
    owners({ coops: [10, 11] });
    expect(await canAccessUpload(STUDENT_11, 'letter.pdf')).toBe(true);
  });

  test('หนังสือขอนิเทศ (supervision/) → นักศึกษาในนัดนั้น', async () => {
    owners({ supervision: [10] });
    expect(await canAccessUpload(STUDENT_10, 'supervision/SUPERVISION_LETTER_1.pdf')).toBe(true);
    expect(await canAccessUpload(STUDENT_11, 'supervision/SUPERVISION_LETTER_1.pdf')).toBe(false);
    expect(prisma.supervisionAppointment.findMany.mock.calls[0][0].where).toEqual({ officialLetterPath: 'SUPERVISION_LETTER_1.pdf' });
  });

  test('ไฟล์แนบประกาศ (ชื่อไฟล์อยู่ใน AnnFile) → ทุกคนที่ login', async () => {
    owners({ ann: [{ id: 'a' }] });
    expect(await canAccessUpload(STUDENT_11, 'ann.pdf')).toBe(true);
  });

  test('ภาพแนบเรื่องที่แจ้ง → คนแจ้งเปิดได้ คนอื่นไม่ได้', async () => {
    owners({ feedback: [100] });
    expect(await canAccessUpload(STUDENT_10, 'shot.png')).toBe(true);
    expect(await canAccessUpload(STUDENT_11, 'shot.png')).toBe(false);
  });

  test('อาจารย์: เปิดได้เมื่อเห็นนักศึกษาเจ้าของไฟล์ (ที่ปรึกษา / หลักสูตรที่ดูแล / ผู้นิเทศ / นิเทศร่วม)', async () => {
    owners({ docs: [10] });
    prisma.student.count.mockResolvedValue(1);
    expect(await canAccessUpload(TEACHER, 'd.pdf')).toBe(true);
    expect(prisma.student.count.mock.calls[0][0].where).toEqual({
      id: { in: [10] },
      OR: [
        { coopAdvisorId: 20 },
        { major: { in: ['AI'] } },
        { supervisionAppointment: { OR: [{ teacherId: 20 }, { coTeachers: { some: { teacherId: 20 } } }] } },
      ],
    });
  });

  test('อาจารย์ที่ไม่เกี่ยวกับนักศึกษา → ไม่ให้', async () => {
    owners({ docs: [10] });
    prisma.student.count.mockResolvedValue(0);
    expect(await canAccessUpload(TEACHER, 'd.pdf')).toBe(false);
  });

  test('อาจารย์ทั่วไป (ไม่ได้ดูแลหลักสูตร) → ไม่ใส่เงื่อนไขหลักสูตร', async () => {
    owners({ docs: [10] });
    prisma.teacher.findUnique.mockResolvedValue({ id: 21, coopMajors: [] });
    await canAccessUpload(TEACHER, 'd.pdf');
    expect(prisma.student.count.mock.calls[0][0].where.OR).toHaveLength(2);
  });

  test('ไฟล์ที่ไม่มีเจ้าของในระบบ → ไม่ให้ (ยกเว้นเจ้าหน้าที่)', async () => {
    expect(await canAccessUpload(STUDENT_10, 'orphan.pdf')).toBe(false);
    expect(await canAccessUpload(TEACHER, 'orphan.pdf')).toBe(false);
  });
});
