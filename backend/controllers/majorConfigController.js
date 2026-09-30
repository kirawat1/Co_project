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
    const { key, major } = await resolveTarget(req);
    const override = validateOverride(key, req.body?.override ?? {});
    await writeOverride(key, major, override);
    res.json({ ok: true, override });
  } catch (err) { fail(res, err); }
};
