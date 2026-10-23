// สิทธิ์เปิดไฟล์ใน /uploads (middlewares/uploadsGuard.js) — เดิมใครมีลิงก์ก็เปิดได้โดยไม่ต้อง login
//   เจ้าหน้าที่                    → ทุกไฟล์
//   system/ · announcements/ · ไฟล์แนบประกาศ → ทุกคนที่ login (ตราสัญลักษณ์มหาวิทยาลัย แบบฟอร์มกลาง รูปประกอบหน้า ประกาศ)
//   ไฟล์ของนักศึกษา (เอกสาร หนังสือ ใบตอบรับ รูปถ่าย หนังสือขอนิเทศ) → เจ้าของ (หนังสือรวม = ทุกคนในฉบับ)
//                                   + อาจารย์ที่เห็นนักศึกษาคนนั้นอยู่แล้ว: ที่ปรึกษาโครงงานสหกิจ · หลักสูตรที่ดูแล · ผู้นิเทศ/นิเทศร่วม
//   ภาพแนบเรื่องที่แจ้ง (Feedback)   → คนแจ้ง
//   ไฟล์ที่ไม่มีเจ้าของในระบบ         → ไม่ให้
const prisma = require('../config/prismaClient');

const SHARED_DIRS = new Set(['system', 'announcements']);

// rel = path หลัง /uploads/ เช่น "1768-1.pdf" · "supervision/SUPERVISION_LETTER_1.pdf" · "system/KRUT_1.png"
async function uploadOwners(rel, db) {
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  const dir = parts.length > 1 ? parts[0] : '';
  if (SHARED_DIRS.has(dir)) return { shared: true };
  if (dir === 'supervision') {
    const appts = await db.supervisionAppointment.findMany({ where: { officialLetterPath: name }, select: { studentId: true } });
    return { studentIds: appts.map((a) => a.studentId) };
  }
  if (dir) return {};

  const [docs, coops, forms, ann, feedback] = await Promise.all([
    db.document.findMany({ where: { path: name }, select: { studentId: true } }),
    db.studentCoop.findMany({
      where: { OR: [{ reqLetterUrl: name }, { placeLetterUrl: name }, { acceptanceFileUrl: name }] },
      select: { studentId: true },
    }),
    db.coopApplicationForm.findMany({ where: { photoPath: name }, select: { studentId: true } }),
    db.annFile.findMany({ where: { path: name }, select: { id: true }, take: 1 }),
    db.feedback.findMany({ where: { imagePath: name }, select: { userId: true } }),
  ]);
  if (ann.length) return { shared: true };
  return {
    studentIds: [...new Set([...docs, ...coops, ...forms].map((x) => x.studentId))],
    userIds: feedback.map((f) => f.userId),
  };
}

async function teacherSeesAny(user, studentIds, db) {
  const teacher = await db.teacher.findUnique({ where: { userId: user.id }, select: { id: true, coopMajors: { select: { major: true } } } });
  if (!teacher) return false;
  const majors = (teacher.coopMajors || []).map((m) => m.major);
  const n = await db.student.count({
    where: {
      id: { in: studentIds },
      OR: [
        { coopAdvisorId: teacher.id },
        ...(majors.length ? [{ major: { in: majors } }] : []),
        { supervisionAppointment: { OR: [{ teacherId: teacher.id }, { coTeachers: { some: { teacherId: teacher.id } } }] } },
      ],
    },
  });
  return n > 0;
}

/** @param user req.user (ผ่านการตรวจ session แล้ว) · @param rel path หลัง /uploads/ */
async function canAccessUpload(user, rel, db = prisma) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'staff') return true;
  const owners = await uploadOwners(rel, db);
  if (owners.shared) return true;
  if ((owners.userIds || []).includes(user.id)) return true;
  const studentIds = owners.studentIds || [];
  if (!studentIds.length) return false;
  if (role === 'student') {
    const me = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    return !!me && studentIds.includes(me.id);
  }
  if (role === 'teacher') return teacherSeesAny(user, studentIds, db);
  return false;
}

module.exports = { canAccessUpload, uploadOwners };
