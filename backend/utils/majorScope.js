// ขอบเขตหลักสูตรของผู้ใช้ในงานจัดการ (แยกหลักสูตร Phase 2)
//   เจ้าหน้าที่           → ทุกหลักสูตร (รวมนักศึกษาที่ยังไม่มีหลักสูตร)
//   อาจารย์ประจำวิชา    → เฉพาะหลักสูตรที่ดูแล (CoopTeacherMajor)
//   อื่นๆ                 → ไม่มีหลักสูตร (อาจารย์ทั่วไปเห็นนักศึกษาผ่านการเป็นที่ปรึกษา ไม่ใช่ผ่านหลักสูตร)
// ตัวกรองหลักสูตรบนแถบบนหน้าจัดการ (header X-Major-Filter) ใช้ "ดู" เท่านั้น (GET) — ไม่ขยายสิทธิ์ และไม่ทำให้การกระทำโดน 403
const prisma = require('../config/prismaClient');

const ALL = Object.freeze({ all: true, majors: [], noMajor: false });
const NO_MAJOR = '__none__'; // ตัวกรอง "ยังไม่ระบุหลักสูตร" (เจ้าหน้าที่)

async function baseScope(req) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'staff') return ALL;
  if (role === 'teacher') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      select: { coopMajors: { select: { major: true } } },
    });
    return { all: false, majors: (teacher?.coopMajors || []).map((m) => m.major), noMajor: false };
  }
  return { all: false, majors: [], noMajor: false };
}

function applyViewFilter(scope, filter) {
  if (!filter) return scope;
  if (filter === NO_MAJOR) return scope.all ? { all: false, majors: [], noMajor: true } : scope;
  if (scope.all || scope.majors.includes(filter)) return { all: false, majors: [filter], noMajor: false };
  return scope; // กรองหลักสูตรที่ไม่ได้ดูแล = ไม่มีผล (ไม่ขยายสิทธิ์)
}

/** @param opts.ignoreFilter  true = ขอบเขตตามสิทธิ์จริง ไม่สนตัวกรองบนหน้าจอ */
async function getMajorScope(req, { ignoreFilter = false } = {}) {
  if (!req._majorScopeBase) req._majorScopeBase = await baseScope(req);
  const base = req._majorScopeBase;
  if (ignoreFilter || String(req.method || 'GET').toUpperCase() !== 'GET') return base;
  const filter = typeof req.get === 'function' ? String(req.get('x-major-filter') || '').trim() : '';
  return applyViewFilter(base, filter);
}

// where ของ prisma.student — ใส่ใน AND ได้ตรงๆ
function studentWhere(scope) {
  if (scope.all) return {};
  if (scope.noMajor) return { major: null };
  return { major: { in: scope.majors } };
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
  if (scope.majors.length || scope.noMajor) or.push(studentWhere(scope));
  return or.length ? { OR: or } : { id: -1 };
}

function inScope(scope, major) {
  if (scope.all) return true;
  if (!major) return !!scope.noMajor;
  return scope.majors.includes(major);
}

const outOfScope = () => Object.assign(new Error('นักศึกษาคนนี้ไม่อยู่ในหลักสูตรที่คุณดูแล'), { is403: true, status: 403 });

// ตรวจว่านักศึกษา (ตาม Student.id) อยู่ในขอบเขต — ใช้ก่อนทุกการกระทำกับนักศึกษารายคน
async function assertStudentInScope(req, studentId, db = prisma) {
  const scope = await getMajorScope(req, { ignoreFilter: true });
  if (scope.all) return;
  const s = await db.student.findUnique({ where: { id: studentId }, select: { major: true } });
  if (!s) return; // ให้ controller ตอบ 404 เอง
  if (!inScope(scope, s.major)) throw outOfScope();
}

module.exports = { getMajorScope, studentWhere, visibleStudentWhere, inScope, assertStudentInScope, outOfScope, NO_MAJOR };
