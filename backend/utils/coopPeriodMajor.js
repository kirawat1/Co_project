// รอบสหกิจแยกหลักสูตร (Phase 5)
//   CoopPeriod      = ปีการศึกษา/ภาคเรียน ใช้ร่วมกันทุกหลักสูตร (StudentCoop.coopPeriodId ผูกกับอันนี้ ตัวกรองรอบทุกหน้าไม่เปลี่ยน)
//   CoopPeriodMajor = วันรับสมัคร / เปิด-ปิดรับสมัคร / ช่วงนิเทศ ของแต่ละหลักสูตร — ไม่มีแถว = หลักสูตรนั้นยังไม่ได้ตั้ง (ถือว่าปิด)
const prisma = require('../config/prismaClient');
const { isPeriodExpired } = require('./coopPeriodHelper');
const { getMajorScope, inScope } = require('./majorScope');

const PERIOD_ORDER = [{ academicYear: 'desc' }, { semester: 'desc' }];
const ROW_FIELDS = ['startDate', 'endDate', 'isActive', 'supervisionStartDate', 'supervisionEndDate', 'isSupervisionOpen'];

const err = (status, message) => Object.assign(new Error(message), { status });

// เปิดรับสมัครค้างไว้แต่เลยวันปิดแล้ว (ลืมกดปิด) → ปิดให้ (บันทึกลง DB) กันยื่นเกินกำหนด
async function autoCloseRows(rows, db = prisma) {
  const expired = rows.filter((r) => r && r.isActive && isPeriodExpired(r));
  if (!expired.length) return rows;
  await db.coopPeriodMajor.updateMany({
    where: { OR: expired.map((r) => ({ periodId: r.periodId, major: r.major })) },
    data: { isActive: false },
  });
  return rows.map((r) => (expired.includes(r) ? { ...r, isActive: false } : r));
}

// ทุกรอบ พร้อมแถวของทุกหลักสูตร (ปิดรอบที่หมดเขตให้แล้ว)
async function listPeriods(db = prisma) {
  const periods = await db.coopPeriod.findMany({ orderBy: PERIOD_ORDER, include: { majors: { orderBy: { major: 'asc' } } } });
  const rows = await autoCloseRows(periods.flatMap((p) => p.majors || []), db);
  const byKey = new Map(rows.map((r) => [`${r.periodId}|${r.major}`, r]));
  return periods.map((p) => ({ ...p, majors: (p.majors || []).map((r) => byKey.get(`${r.periodId}|${r.major}`)) }));
}

// แถวของหลักสูตรหนึ่งในรอบหนึ่ง (ปิดให้ถ้าหมดเขต) — null = หลักสูตรนี้ยังไม่ได้ตั้งรอบนี้
async function getRow(periodId, major, db = prisma) {
  if (!periodId || !major) return null;
  const row = await db.coopPeriodMajor.findUnique({ where: { periodId_major: { periodId, major } } });
  if (!row) return null;
  return (await autoCloseRows([row], db))[0];
}

const closedRow = (period, major) => ({
  periodId: period.id, major, startDate: period.startDate, endDate: period.endDate,
  isActive: false, supervisionStartDate: null, supervisionEndDate: null, isSupervisionOpen: false, configured: false,
});
const pickRow = (r) => Object.fromEntries(ROW_FIELDS.map((k) => [k, r[k] ?? null]));
const minDate = (ds) => { const v = ds.filter(Boolean).map((d) => new Date(d)); return v.length ? new Date(Math.min(...v)) : null; };
const maxDate = (ds) => { const v = ds.filter(Boolean).map((d) => new Date(d)); return v.length ? new Date(Math.max(...v)) : null; };

/**
 * รอบในมุมของผู้ดู — ค่าระดับบน (isActive, startDate, isSupervisionOpen, ...) คงรูปแบบเดิมให้หน้าที่อ่านแบบเดิมใช้ต่อได้
 * @param majors null = ทุกหลักสูตร (ระดับบน = รวม: เปิดถ้ามีหลักสูตรใดเปิด) · [m] = ค่าของหลักสูตร m ตรงๆ · [] = ไม่มีหลักสูตร (ปิด)
 */
function viewPeriod(period, majors) {
  const all = (period.majors || []).map((r) => ({ ...r, configured: true }));
  const { majors: _rows, legacyIsActive, legacySupervisionStartDate, legacySupervisionEndDate, legacyIsSupervisionOpen, ...base } = period;
  if (majors && majors.length === 1) {
    const row = all.find((r) => r.major === majors[0]) || closedRow(period, majors[0]);
    return { ...base, ...pickRow(row), major: row.major, configured: row.configured, majors: [row] };
  }
  const rows = majors ? all.filter((r) => majors.includes(r.major)) : all;
  return {
    ...base,
    isActive: rows.some((r) => r.isActive),
    isSupervisionOpen: rows.some((r) => r.isSupervisionOpen),
    startDate: minDate(rows.map((r) => r.startDate)) || period.startDate,
    endDate: maxDate(rows.map((r) => r.endDate)) || period.endDate,
    supervisionStartDate: minDate(rows.map((r) => r.supervisionStartDate)),
    supervisionEndDate: maxDate(rows.map((r) => r.supervisionEndDate)),
    majors: rows,
  };
}

// หลักสูตรที่ผู้ใช้ "ดู" — นักศึกษา = หลักสูตรตัวเอง ([] ถ้ายังไม่ระบุ) · อาจารย์ประจำวิชา = ที่ดูแล (ตามตัวกรองบนหน้าจอ) · อื่นๆ = ทุกหลักสูตร
async function viewerMajors(req) {
  if (String(req.user?.role || '').toLowerCase() === 'student') {
    const s = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { major: true } });
    return s?.major ? [s.major] : [];
  }
  const scope = await getMajorScope(req);
  return scope.all || scope.noMajor || !scope.majors.length ? null : scope.majors;
}

/**
 * หลักสูตรที่การแก้ไขนี้จะไปลง
 *   ระบุ major → ต้องอยู่ในหลักสูตรที่ดูแล (403)
 *   ไม่ระบุ   → อาจารย์ประจำวิชาที่ดูแลหลักสูตรเดียว = หลักสูตรนั้น · เจ้าหน้าที่ + allowAll = ทุกหลักสูตร (คืน null) · นอกนั้น 400
 */
async function targetMajors(req, major, { allowAll = false } = {}) {
  const scope = await getMajorScope(req, { ignoreFilter: true });
  const m = typeof major === 'string' ? major.trim() : '';
  if (m) {
    if (!inScope(scope, m)) throw err(403, `คุณไม่ได้ดูแลหลักสูตร ${m}`);
    return [m];
  }
  if (!scope.all && scope.majors.length === 1) return [scope.majors[0]];
  if (scope.all && allowAll) return null;
  throw err(400, 'กรุณาระบุหลักสูตร');
}

const allMajorCodes = async (db = prisma) => (await db.coopCriteria.findMany({ select: { major: true }, orderBy: { major: 'asc' } })).map((c) => c.major);

module.exports = { listPeriods, getRow, viewPeriod, viewerMajors, targetMajors, autoCloseRows, allMajorCodes, PERIOD_ORDER };
