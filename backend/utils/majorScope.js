// ขอบเขตหลักสูตรของผู้ใช้ในงานจัดการ (แยกหลักสูตร Phase 2)
//   เจ้าหน้าที่           → ทุกหลักสูตร (รวมนักศึกษาที่ยังไม่มีหลักสูตร)
//   อาจารย์ประจำวิชา    → เฉพาะหลักสูตรที่ดูแล (CoopTeacherMajor)
//   อื่นๆ                 → ไม่มีหลักสูตร (อาจารย์ทั่วไปเห็นนักศึกษาผ่านการเป็นที่ปรึกษา ไม่ใช่ผ่านหลักสูตร)
const prisma = require('../config/prismaClient');

const ALL = Object.freeze({ all: true, majors: [] });

async function getMajorScope(req) {
  if (req._majorScope) return req._majorScope;
  const role = String(req.user?.role || '').toLowerCase();
  let scope = { all: false, majors: [] };
  if (role === 'staff') scope = ALL;
  else if (role === 'teacher') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      select: { coopMajors: { select: { major: true } } },
    });
    scope = { all: false, majors: (teacher?.coopMajors || []).map((m) => m.major) };
  }
  req._majorScope = scope;
  return scope;
}

// where ของ prisma.student — ใส่ใน AND ได้ตรงๆ
function studentWhere(scope) {
  return scope.all ? {} : { major: { in: scope.majors } };
}

// นักศึกษาที่ผู้ใช้เห็นได้ในหน้าที่ใช้ร่วมกันระหว่างอาจารย์ทั่วไปกับอาจารย์ประจำวิชา:
// เจ้าหน้าที่ = ทุกคน · อาจารย์ = ในหลักสูตรที่ดูแล "หรือ" นักศึกษาที่ตัวเองเป็นที่ปรึกษาโครงงานสหกิจ (coopAdvisorId)
async function visibleStudentWhere(req) {
  const scope = await getMajorScope(req);
  if (scope.all) return {};
  const teacher = String(req.user?.role || '').toLowerCase() === 'teacher'
    ? await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } })
    : null;
  const or = [];
  if (teacher) or.push({ coopAdvisorId: teacher.id });
  if (scope.majors.length) or.push(studentWhere(scope));
  return or.length ? { OR: or } : { id: -1 };
}

function inScope(scope, major) {
  return scope.all || (!!major && scope.majors.includes(major));
}

const outOfScope = () => Object.assign(new Error('นักศึกษาคนนี้ไม่อยู่ในหลักสูตรที่คุณดูแล'), { is403: true, status: 403 });

// ตรวจว่านักศึกษา (ตาม Student.id) อยู่ในขอบเขต — ใช้ก่อนทุกการกระทำกับนักศึกษารายคน
async function assertStudentInScope(req, studentId, db = prisma) {
  const scope = await getMajorScope(req);
  if (scope.all) return;
  const s = await db.student.findUnique({ where: { id: studentId }, select: { major: true } });
  if (!s) return; // ให้ controller ตอบ 404 เอง
  if (!inScope(scope, s.major)) throw outOfScope();
}

module.exports = { getMajorScope, studentWhere, visibleStudentWhere, inScope, assertStudentInScope, outOfScope };
