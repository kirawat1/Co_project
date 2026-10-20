// การตั้งค่าแยกหลักสูตร — หน้าสรุป + ค่าเฉพาะหลักสูตรทีละช่อง (ค่ากลางยังแก้ที่ endpoint เดิมของแต่ละหน้า)
const prisma = require('../config/prismaClient');
const { REGISTRY, overrideKey, readGlobal, readOverride, validateOverride, writeOverride } = require('../utils/majorConfig');
const { getMajorScope } = require('../utils/majorScope');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const fail = (res, err) => {
  if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
  console.error(err);
  return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดที่ Server' });
};

// หลักสูตรที่ผู้ใช้ตั้งค่าได้ (เจ้าหน้าที่ = ทุกหลักสูตรที่มีในระบบ)
async function manageableMajors(req) {
  const scope = await getMajorScope(req, { ignoreFilter: true });
  const all = (await prisma.coopCriteria.findMany({ select: { major: true }, orderBy: { major: 'asc' } })).map((c) => c.major);
  return scope.all ? all : all.filter((m) => scope.majors.includes(m));
}

async function resolveTarget(req) {
  const spec = REGISTRY[req.params.key];
  if (!spec) throw httpError(404, 'ไม่รู้จักการตั้งค่านี้');
  const major = String(req.query.major || '').trim();
  if (!major) throw httpError(400, 'ต้องระบุหลักสูตร (?major=)');
  if (!(await manageableMajors(req)).includes(major)) throw httpError(403, 'ตั้งค่าได้เฉพาะหลักสูตรที่คุณดูแล');
  return { key: req.params.key, spec, major };
}

// GET /api/admin/major-config — ภาพรวม: หลักสูตรไหนตั้งค่าช่องไหนแยกไว้บ้าง
exports.getSummary = async (req, res) => {
  try {
    const majors = await manageableMajors(req);
    const rows = await prisma.systemConfig.findMany({ where: { key: { in: Object.keys(REGISTRY).flatMap((k) => majors.map((m) => overrideKey(k, m))) } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings = Object.entries(REGISTRY).map(([key, spec]) => ({
      key, label: spec.label, page: spec.page,
      overrides: Object.fromEntries(majors.map((m) => {
        let fields = [];
        try { fields = Object.keys(JSON.parse(byKey[overrideKey(key, m)] || '{}')).filter((f) => spec.fields[f]); } catch { /* ignore */ }
        return [m, fields.map((f) => spec.fields[f].label)];
      })),
    }));
    res.json({ ok: true, majors, settings });
  } catch (err) { fail(res, err); }
};

/**
 * GET /api/admin/major-readiness — หลักสูตรพร้อมเปิดรับนักศึกษาหรือยัง (เช็กลิสต์ตอนเพิ่มหลักสูตรใหม่)
 *   ต้องมี (ไม่มี = นักศึกษาสมัคร/ถูกดูแลไม่ได้): ตั้งรอบล่าสุดแล้ว · มีอาจารย์ประจำวิชา
 *   ควรมี: อาจารย์ในหลักสูตร (นิเทศ/ที่ปรึกษา) · หัวข้อเอกสารที่ต้องอัปโหลด
 * เจ้าหน้าที่เห็นเพิ่ม: ชื่อหลักสูตรที่อาจารย์/นักศึกษาใช้อยู่แต่ยังไม่ได้เพิ่มในระบบ
 */
exports.getReadiness = async (req, res) => {
  try {
    const scope = await getMajorScope(req, { ignoreFilter: true });
    const majors = await manageableMajors(req);
    const criteria = await prisma.coopCriteria.findMany({ where: { major: { in: majors } }, select: { major: true, nameTh: true }, orderBy: { major: 'asc' } });
    const latest = await prisma.coopPeriod.findFirst({ orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }], select: { id: true, academicYear: true, semester: true } });

    const [periodRows, coopTeachers, teacherCounts, studentCounts, requirements] = await Promise.all([
      latest ? prisma.coopPeriodMajor.findMany({ where: { periodId: latest.id, major: { in: majors } }, select: { major: true, isActive: true } }) : [],
      prisma.coopTeacherMajor.findMany({ where: { major: { in: majors } }, select: { major: true, teacher: { select: { firstName: true, lastName: true } } } }),
      prisma.teacher.groupBy({ by: ['major'], where: { major: { not: null } }, _count: { _all: true } }),
      prisma.student.groupBy({ by: ['major'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.documentRequirement.findMany({ where: { isActive: true }, select: { id: true, majorRules: { select: { major: true, excluded: true } } } }),
    ]);
    const count = (rows, m) => rows.find((r) => r.major === m)?._count._all ?? 0;
    // หัวข้อที่มีแถว excluded=false = เฉพาะหลักสูตรนั้น · ไม่มี = ทุกหลักสูตร ยกเว้นหลักสูตรที่ excluded=true
    const docsFor = (m) => requirements.filter((r) => {
      const only = r.majorRules.filter((x) => !x.excluded).map((x) => x.major);
      if (only.length) return only.includes(m);
      return !r.majorRules.some((x) => x.excluded && x.major === m);
    }).length;

    const items = criteria.map(({ major, nameTh }) => {
      const pm = periodRows.find((r) => r.major === major);
      const teachersOfMajor = coopTeachers.filter((c) => c.major === major).map((c) => `${c.teacher.firstName} ${c.teacher.lastName}`.trim());
      const checks = [
        { key: 'period', required: true, ok: !!pm, page: '/admin/coop-period',
          label: latest ? `ตั้งรอบ ${latest.semester}/${latest.academicYear}` : 'ตั้งรอบสหกิจ',
          detail: !latest ? 'ยังไม่มีรอบสหกิจในระบบ' : pm ? (pm.isActive ? 'เปิดรับสมัครอยู่' : 'ตั้งแล้ว (ยังไม่เปิดรับสมัคร)') : 'ยังไม่ได้ตั้ง — นักศึกษาหลักสูตรนี้สมัครรอบนี้ไม่ได้' },
        { key: 'coopTeacher', required: true, ok: teachersOfMajor.length > 0, page: '/admin/teachers', label: 'อาจารย์ประจำวิชา',
          detail: teachersOfMajor.length ? teachersOfMajor.join(', ') : 'ยังไม่มี — ไม่มีใครตรวจเอกสาร/จัดการนักศึกษาหลักสูตรนี้นอกจากเจ้าหน้าที่' },
        { key: 'teachers', required: false, ok: count(teacherCounts, major) > 0, page: '/admin/teachers', label: 'อาจารย์ในหลักสูตร',
          detail: count(teacherCounts, major) ? `${count(teacherCounts, major)} คน` : 'ยังไม่มี — เลือกอาจารย์นิเทศ/ที่ปรึกษาของหลักสูตรนี้ไม่ได้' },
        { key: 'docs', required: false, ok: docsFor(major) > 0, page: '/admin/doc-requirements', label: 'หัวข้อเอกสารที่ต้องอัปโหลด',
          detail: docsFor(major) ? `${docsFor(major)} หัวข้อ` : 'ไม่มีหัวข้อที่ใช้กับหลักสูตรนี้' },
      ];
      return {
        major, nameTh,
        students: count(studentCounts, major),
        ready: checks.every((c) => !c.required || c.ok),
        checks,
      };
    });

    // ชื่อหลักสูตรที่มีคนใช้แต่ไม่มีในระบบ (เช่น อาจารย์ IT/GIS) — เจ้าหน้าที่เท่านั้น (อาจารย์ประจำวิชาเพิ่มหลักสูตรไม่ได้)
    let unregistered = [];
    if (scope.all) {
      const known = new Set((await prisma.coopCriteria.findMany({ select: { major: true } })).map((c) => c.major));
      const names = new Set([...teacherCounts, ...studentCounts].map((r) => r.major).filter((m) => m && !known.has(m)));
      unregistered = [...names].sort().map((m) => ({ major: m, teachers: count(teacherCounts, m), students: count(studentCounts, m) }));
    }

    res.json({
      ok: true,
      period: latest ? { academicYear: latest.academicYear, semester: latest.semester } : null,
      items,
      unregistered,
      studentsWithoutMajor: scope.all ? count(studentCounts, null) : 0,
    });
  } catch (err) { fail(res, err); }
};

// GET /api/admin/major-config/:key?major=CS — ค่ากลาง / ค่าเฉพาะ / ค่าที่ใช้จริง ของหลักสูตรนั้น
exports.getMajorConfig = async (req, res) => {
  try {
    const { key, spec, major } = await resolveTarget(req);
    const [global, override] = await Promise.all([readGlobal(key), readOverride(key, major)]);
    const globalWithDefaults = { ...(spec.defaults || {}), ...(global || {}) };
    res.json({
      ok: true, key, major, label: spec.label,
      fields: Object.entries(spec.fields).map(([name, f]) => ({ name, ...f })),
      global: globalWithDefaults,
      override,
      effective: { ...globalWithDefaults, ...override },
    });
  } catch (err) { fail(res, err); }
};

// PUT /api/admin/major-config/:key?major=CS { override: { ช่อง: ค่า | null } } — แทนที่ค่าเฉพาะทั้งชุด (ช่องที่ไม่ส่ง/null = ใช้ค่ากลาง)
exports.putMajorConfig = async (req, res) => {
  try {
    const { key, spec, major } = await resolveTarget(req);
    // ช่องที่เคยตั้งทับได้แต่เลิกตั้งที่นี่แล้ว (เช่น กำหนดส่ง → ปฏิทินของรอบ) — เก็บค่าเดิมไว้เป็นค่าสำรอง ไม่ให้ทำให้บันทึกช่องอื่นไม่ได้
    const stored = await readOverride(key, major);
    const retired = Object.fromEntries(Object.entries(stored).filter(([f]) => !spec.fields[f]));
    const incoming = { ...(req.body?.override ?? {}) };
    for (const f of Object.keys(retired)) delete incoming[f];
    const override = { ...retired, ...validateOverride(key, incoming) };
    await writeOverride(key, major, override);
    res.json({ ok: true, override });
  } catch (err) { fail(res, err); }
};
