// ปฏิทินของรอบ — กำหนดส่งของแต่ละขั้น (ฟังก์ชันล้วน ไม่แตะ DB)
// เก็บบน CoopPeriod.deadlines (ค่าตั้งต้นของวิทยาลัย) และ CoopPeriodMajor.deadlines (ค่าที่ใช้จริงของหลักสูตร)
//   { T000: { due: "YYYY-MM-DD", mode: "HARD"|"SOFT", closed: bool }, ..., T007: { due } }
// due = ปิดที่ 23:59:59.999 เวลาไทย · ไม่มี due = ไม่มีกำหนด
// HARD = เลยกำหนดส่งครั้งแรกไม่ได้ · SOFT = ส่งได้แต่นับว่าช้า · closed = ปิดรับชั่วคราว (ส่งครั้งแรกไม่ได้ทุกกรณี)
// ส่งแก้ (resubmission) ไม่ติดกำหนด/สวิตช์ใดๆ
const { periodCloseAt } = require('./coopPeriodHelper');

const STEP_KEYS = ['T000', 'T002', 'T003', 'T005_T006', 'T007', 'T008'];
// ขั้นที่ส่งในระบบ (ปิดรับ/ติดป้ายส่งช้าได้) — T005–T008 เป็นฟอร์มนอกระบบ แสดงวันอย่างเดียว
const MODE_STEPS = ['T000', 'T002', 'T003'];
const MODES = ['HARD', 'SOFT'];

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function isValidDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// ตรวจรูป + ตัดค่าว่าง — ผิดรูป = 400
function normalizeDeadlines(input) {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw badRequest('กำหนดส่งต้องเป็น object');
  const out = {};
  for (const [key, entry] of Object.entries(input)) {
    if (!STEP_KEYS.includes(key)) throw badRequest(`ไม่รู้จักขั้น "${key}"`);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw badRequest(`${key}: ต้องเป็น object`);
    const hasMode = MODE_STEPS.includes(key);
    const norm = {};
    for (const [field, value] of Object.entries(entry)) {
      if (field === 'due') {
        if (value == null || value === '') norm.due = null;
        else if (!isValidDay(value)) throw badRequest(`${key}: วันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)`);
        else norm.due = value;
      } else if (field === 'mode') {
        if (!hasMode) throw badRequest(`${key}: ขั้นนี้ไม่มีโหมดปิดรับ`);
        if (!MODES.includes(value)) throw badRequest(`${key}: โหมดต้องเป็น HARD หรือ SOFT`);
        norm.mode = value;
      } else if (field === 'closed') {
        if (!hasMode) throw badRequest(`${key}: ขั้นนี้ปิดรับชั่วคราวไม่ได้`);
        if (typeof value !== 'boolean') throw badRequest(`${key}: closed ต้องเป็น true/false`);
        norm.closed = value;
      } else {
        throw badRequest(`${key}: ไม่รู้จักช่อง "${field}"`);
      }
    }
    if (!('due' in norm)) norm.due = null;
    out[key] = norm;
  }
  return out;
}

const pastDay = (day, now) => !!day && now > periodCloseAt(day);

function evaluateDeadline(entry, now, opts = {}) {
  const { resubmission = false, extensionUntil = null } = opts;
  const due = entry?.due || null;
  const mode = entry?.mode === 'SOFT' ? 'SOFT' : 'HARD';
  const closed = entry?.closed === true;
  const configured = !!entry && (!!due || closed);
  const pastDue = pastDay(due, now);
  const late = pastDue && !resubmission;

  let canSubmit;
  if (resubmission) canSubmit = true;
  else if (closed) canSubmit = false;
  else if (!pastDue) canSubmit = true;
  else if (mode === 'SOFT') canSubmit = true;
  else canSubmit = !!extensionUntil && !pastDay(extensionUntil, now);

  return { configured, due, mode, closed, canSubmit, late };
}

// ตรรกะเดิมของ docController.checkSystemOpen (SystemConfig T000/T002/T003_CONFIG) — ใช้กับรอบที่ยังไม่ตั้งปฏิทิน
//   ไม่มี config = เปิด · isOpen=false = ปิด · ยังไม่ถึงวันเริ่ม = ปิด · เลยสิ้นวันสิ้นสุด = ปิด · แล้วส่งแก้ทับ
function evaluateLegacyWindow(config, now, opts = {}) {
  const { resubmission = false } = opts;
  if (!config) return { configured: false, due: null, mode: 'HARD', closed: false, canSubmit: true, late: false };
  const startDate = typeof config.startDate === 'string' && config.startDate.trim() ? config.startDate.trim() : null;
  const endDate = typeof config.endDate === 'string' && config.endDate.trim() ? config.endDate.trim() : null;
  const closed = !config.isOpen;
  const notYet = !!startDate && new Date(startDate) > now;
  const ended = pastDay(endDate, now);
  const late = ended && !resubmission;
  const canSubmit = resubmission || (!closed && !notYet && !ended);
  return { configured: true, due: endDate, mode: 'HARD', closed, canSubmit, late };
}

// เทียบค่าของขั้นแบบไม่สนลำดับช่อง/ค่าที่ไม่ได้ใส่
const canon = (e) => (e ? JSON.stringify([e.due || null, e.mode || null, e.closed === true]) : null);

// บันทึกค่าวิทยาลัย → ใช้กับหลักสูตรที่ติ๊ก เฉพาะขั้นที่ค่าวิทยาลัยเปลี่ยนในครั้งนี้
function applyCollegeChange(oldCollege, newCollege, rows, applyTo) {
  const before = oldCollege || {};
  const after = newCollege || {};
  const changed = STEP_KEYS.filter((k) => canon(before[k]) !== canon(after[k]));
  const picked = new Set(applyTo || []);
  return (rows || [])
    .filter((r) => picked.has(r.major))
    .map((r) => {
      const deadlines = { ...(r.deadlines || {}) };
      for (const k of changed) {
        if (after[k]) deadlines[k] = { ...after[k] };
        else delete deadlines[k];
      }
      return { major: r.major, deadlines };
    });
}

// คัดลอกจากปีก่อน — เลื่อน due ทุกขั้นตามจำนวนปี (29 ก.พ. ที่ปลายทางไม่มี → 28 ก.พ.)
function shiftYears(deadlines, years) {
  const out = {};
  for (const [k, e] of Object.entries(deadlines || {})) {
    const next = { ...e };
    if (e && e.due) {
      const [y, m, d] = e.due.split('-').map(Number);
      const ny = y + years;
      const lastDay = new Date(Date.UTC(ny, m, 0)).getUTCDate();
      next.due = `${ny}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
    }
    out[k] = next;
  }
  return out;
}

module.exports = {
  STEP_KEYS, MODE_STEPS, badRequest, isValidDay, normalizeDeadlines, evaluateDeadline, evaluateLegacyWindow,
  applyCollegeChange, shiftYears,
};
