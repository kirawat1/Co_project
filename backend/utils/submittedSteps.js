// เวลาส่งครั้งแรกของแต่ละขั้น — StudentCoop.submittedSteps = { T000: { at, backfill? }, T002: {...}, T003: {...} }
// ใช้ตัดสิน "ส่งแล้ว/ยังไม่ส่ง" และ "ส่งช้า" ที่เดียว (ป้ายในหน้าตรวจ · แจ้งเตือนก่อนปิด · ไทม์ไลน์)
//   T000      = อัปโหลดครบทุกหัวข้อบังคับของหลักสูตรตัวเองครั้งแรก (อัปโหลดทีละหัวข้อ ไม่มีปุ่มส่ง)
//   T002/T003 = ส่งแบบฟอร์มครั้งแรก
// บันทึกครั้งเดียว — ส่งแก้ไม่ทับ · backfill: true = เติมย้อนหลังจากเอกสารเดิม (เวลาอาจเป็นการส่งแก้ครั้งล่าสุด ไม่ใช้ติดป้ายส่งช้า)
const { RULES_INCLUDE, withRules, appliesTo } = require('./docRequirementScope');

const TRACKED_STEPS = ['T000', 'T002', 'T003'];

// หัวข้อบังคับของหลักสูตรนี้ (docKey)
async function requiredDocKeys(db, major) {
  const reqs = await db.documentRequirement.findMany({
    where: { isActive: true, isRequired: true },
    select: { docKey: true, ...RULES_INCLUDE },
  });
  return (reqs || []).filter((r) => appliesTo(withRules(r), major)).map((r) => r.docKey);
}

// resubmission = อัปโหลดนี้เป็นการส่งแก้ (resolveDeadline) — ยังไม่มีเวลาของขั้น (ส่งก่อนเติมย้อนหลัง) → บันทึกแบบไม่นับว่าช้า
// เรียกในทรานแซกชันแบบ READ COMMITTED — ล็อกแถวก่อนอ่าน อัปโหลดพร้อมกันจึงไม่ทับกัน และเห็นไฟล์ที่อีกคำขอเพิ่ง commit
async function markSubmitted(db, { studentId, stepKey, major, now = new Date(), resubmission = false }) {
  if (!TRACKED_STEPS.includes(stepKey)) return;
  await db.$queryRaw`SELECT id FROM StudentCoop WHERE studentId = ${studentId} FOR UPDATE`;
  const coop = await db.studentCoop.findUnique({ where: { studentId }, select: { submittedSteps: true } });
  if (!coop) return;
  const steps = coop.submittedSteps || {};
  if (steps[stepKey]) return;

  if (stepKey === 'T000') {
    const keys = await requiredDocKeys(db, major);
    if (keys.length) {
      const docs = await db.document.findMany({ where: { studentId, type: { in: keys } }, select: { type: true } });
      const have = new Set((docs || []).map((d) => d.type));
      if (!keys.every((k) => have.has(k))) return;
    }
  }

  await db.studentCoop.update({
    where: { studentId },
    data: { submittedSteps: { ...steps, [stepKey]: { at: now.toISOString(), ...(resubmission ? { backfill: true } : {}) } } },
  });
}

// เติมย้อนหลังจากเอกสารที่มีอยู่ (scripts/backfill_submitted_steps.js) — คืน submittedSteps ใหม่ หรือ null ถ้าไม่มีอะไรเปลี่ยน
//   ส่งแก้แทนไฟล์เดิม (ลบแล้วสร้างใหม่) เวลาจึงอาจเป็นการส่งแก้ครั้งล่าสุด → ติด backfill ไว้ ไม่ใช้ติดป้ายส่งช้า
function backfillEntries(existing, docs, requiredKeys) {
  const steps = { ...(existing || {}) };
  const iso = (d) => new Date(d).toISOString();
  let changed = false;
  for (const [stepKey, type] of [['T002', 'T002_FORM'], ['T003', 'T003_FORM']]) {
    const doc = (docs || []).find((x) => x.type === type);
    if (doc && !steps[stepKey]) { steps[stepKey] = { at: iso(doc.uploadedAt), backfill: true }; changed = true; }
  }
  if (!steps.T000 && requiredKeys && requiredKeys.length) {
    const req = (docs || []).filter((x) => requiredKeys.includes(x.type));
    const have = new Set(req.map((x) => x.type));
    if (requiredKeys.every((k) => have.has(k))) {
      const latest = req.reduce((m, x) => (new Date(x.uploadedAt) > m ? new Date(x.uploadedAt) : m), new Date(0));
      steps.T000 = { at: latest.toISOString(), backfill: true };
      changed = true;
    }
  }
  return changed ? steps : null;
}

module.exports = { markSubmitted, requiredDocKeys, backfillEntries, TRACKED_STEPS };
