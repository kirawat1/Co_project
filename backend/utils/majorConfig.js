// การตั้งค่าแยกหลักสูตร (แยกหลักสูตร Phase 4) — ค่ากลาง + ค่าเฉพาะหลักสูตร "ทีละช่อง"
//   ค่ากลาง:           SystemConfig key เดิม (เช่น GATEWAY_SETTINGS)
//   ค่าเฉพาะหลักสูตร:   SystemConfig "<key>@<major>" เก็บเฉพาะช่องที่ตั้งทับ (เช่น GATEWAY_SETTINGS@CS = { gradeSheetUrl })
//   ค่าที่ใช้จริง:       { ...ค่ากลาง, ...ค่าเฉพาะหลักสูตร }
const prisma = require('../config/prismaClient');

const GATEWAY_DEFAULTS = {
  gradeSheetDescription: 'กรุณา Make a Copy แบบฟอร์มด้านล่าง แล้วแนบภาพหน้าจอ (Screenshot) หน้าตรวจสอบการสำเร็จการศึกษาจากระบบ REG ลงในแบบฟอร์มนี้ด้วย จากนั้นกรอกข้อมูลให้ครบ แล้วนำลิงก์ที่แชร์มาใส่ในช่องด้านล่าง',
  gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/1HGWTsoScRc3XU0abUn6J9TgyFksAoi1V/copy',
  gradeSheetLinkText: '📋 Make a Copy แบบฟอร์ม',
  uploadDescription: 'เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)'
};

// กำหนดส่งเอกสาร T005–T008 (วันที่ตายตัว แสดงให้นักศึกษาเห็น — เลยกำหนดแล้วลิงก์ยังเปิดได้ เพราะฟอร์มอยู่นอกระบบ)
const DEADLINE_FIELD = { deadline: { label: 'กำหนดส่ง', type: 'date' } };

const WINDOW_FIELDS = {
  isOpen: { label: 'เปิดรับ', type: 'bool' },
  startDate: { label: 'วันเริ่ม', type: 'date' },
  endDate: { label: 'วันสิ้นสุด', type: 'date' },
};

// ช่องที่ตั้งทับรายหลักสูตรได้ — ช่องที่ไม่อยู่ในนี้เป็นค่ากลางอย่างเดียว (เช่น รูปประกอบ T008)
const REGISTRY = {
  APPLY_CONFIG: { label: 'ช่วงยื่นคำร้องสหกิจ', page: '/admin/coop-applications', fields: WINDOW_FIELDS },
  T000_CONFIG: { label: 'ช่วงรับเอกสาร T000', page: '/admin/doct000', fields: WINDOW_FIELDS },
  T002_CONFIG: { label: 'ช่วงรับเอกสาร T002', page: '/admin/doct002', fields: WINDOW_FIELDS },
  T003_CONFIG: { label: 'ช่วงรับเอกสาร T003', page: '/admin/doct003', fields: WINDOW_FIELDS },
  GATEWAY_SETTINGS: {
    label: 'ฟอร์มยื่นคำร้อง', page: '/admin/gateway-settings', defaults: GATEWAY_DEFAULTS,
    fields: {
      gradeSheetDescription: { label: 'คำอธิบายแบบฟอร์มตรวจสอบการสำเร็จการศึกษา', type: 'textarea', max: 500 },
      gradeSheetUrl: { label: 'ลิงก์แบบฟอร์ม (Google Sheets)', type: 'url' },
      gradeSheetLinkText: { label: 'ข้อความปุ่มลิงก์', type: 'text', max: 100 },
      uploadDescription: { label: 'คำอธิบายช่องอัปโหลดเอกสาร', type: 'textarea', max: 300 },
    },
  },
  EVALUATION_FORMS: {
    label: 'แบบประเมิน T005/T006', page: '/admin/doc-t005-006',
    fields: {
      instructionText: { label: 'ข้อความคำชี้แจง', type: 'textarea' },
      ccEmails: { label: 'อีเมลอาจารย์ (CC)', type: 'text' },
      t005Link: { label: 'ลิงก์ T005', type: 'url' },
      t006Link: { label: 'ลิงก์ T006', type: 'url' },
      templateLink: { label: 'ลิงก์ Template อีเมล', type: 'url' },
      ...DEADLINE_FIELD,
    },
  },
  CONFIG_T007: {
    label: 'แบบประเมิน T007', page: '/admin/doc-t007',
    fields: {
      instructionText: { label: 'ข้อความคำชี้แจง', type: 'textarea' },
      t007Link: { label: 'ลิงก์แบบประเมิน T007', type: 'url' },
      ...DEADLINE_FIELD,
    },
  },
  CONFIG_T008: {
    label: 'ส่งเล่มรายงาน T008', page: '/admin/doc-t008',
    fields: {
      instructionText: { label: 'ข้อความคำชี้แจง', type: 'textarea' },
      driveLink: { label: 'ลิงก์ Google Drive', type: 'url' },
      ...DEADLINE_FIELD,
    },
  },
  CONFIG_SUPERVISION_EVAL: {
    label: 'แบบประเมินการนิเทศ (อาจารย์)', page: '/admin/supervision-eval',
    fields: {
      instructionText: { label: 'คำชี้แจงถึงอาจารย์', type: 'textarea' },
      evalLink: { label: 'ลิงก์แบบประเมิน', type: 'url' },
      autoSend: { label: 'ส่งอัตโนมัติเมื่อกดนิเทศเสร็จ', type: 'bool' },
    },
  },
};

const overrideKey = (key, major) => `${key}@${major}`;

function parse(row) {
  if (!row?.value) return null;
  try {
    const v = JSON.parse(row.value);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

async function readGlobal(key, db = prisma) {
  return parse(await db.systemConfig.findUnique({ where: { key } }));
}

async function readOverride(key, major, db = prisma) {
  if (!major) return {};
  return parse(await db.systemConfig.findUnique({ where: { key: overrideKey(key, major) } })) || {};
}

// ค่าที่ใช้จริงของหลักสูตร — ไม่มีทั้งค่ากลางและค่าเฉพาะ → null (คงความหมายเดิม "ยังไม่ตั้งค่า")
async function readEffective(key, major, db = prisma) {
  const [global, override] = await Promise.all([readGlobal(key, db), readOverride(key, major, db)]);
  if (!global && !Object.keys(override).length) return null;
  return { ...(global || {}), ...override };
}

// หลักสูตรของผู้เรียก (นักศึกษา) — บทบาทอื่นได้ค่ากลาง
async function callerMajor(req, db = prisma) {
  if (String(req.user?.role || '').toLowerCase() !== 'student') return null;
  const s = await db.student.findUnique({ where: { userId: req.user.id }, select: { major: true } });
  return s?.major || null;
}

async function studentMajor(studentId, db = prisma) {
  const s = await db.student.findUnique({ where: { id: studentId }, select: { major: true } });
  return s?.major || null;
}

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function safeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    return ['https:', 'http:'].includes(u.protocol) ? String(raw).trim() : null;
  } catch { return null; }
}

// ตรวจค่าที่ตั้งทับ — null/undefined = กลับไปใช้ค่ากลางสำหรับช่องนั้น
function validateOverride(key, raw) {
  const spec = REGISTRY[key];
  if (!spec) throw badRequest('ไม่รู้จักการตั้งค่านี้');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('override ต้องเป็น object');
  const out = {};
  for (const [field, value] of Object.entries(raw)) {
    const f = spec.fields[field];
    if (!f) throw badRequest(`ช่อง "${field}" ตั้งค่าแยกหลักสูตรไม่ได้`);
    if (value === null || value === undefined) continue;
    if (f.type === 'bool') {
      if (typeof value !== 'boolean') throw badRequest(`${f.label}: ต้องเป็น true/false`);
      out[field] = value;
    } else if (f.type === 'date') {
      if (value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw badRequest(`${f.label}: รูปแบบวันที่ต้องเป็น YYYY-MM-DD`);
      out[field] = value;
    } else if (f.type === 'url') {
      if (value === '') { out[field] = null; continue; }
      const url = safeUrl(value);
      if (!url) throw badRequest(`${f.label}: ต้องเป็น URL แบบ http/https`);
      out[field] = url;
    } else {
      if (typeof value !== 'string') throw badRequest(`${f.label}: ต้องเป็นข้อความ`);
      out[field] = f.max ? value.slice(0, f.max) : value.slice(0, 5000);
    }
  }
  if (out.startDate && out.endDate && out.endDate < out.startDate) throw badRequest('วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม');
  return out;
}

async function writeOverride(key, major, override, db = prisma) {
  const k = overrideKey(key, major);
  if (!Object.keys(override).length) {
    await db.systemConfig.deleteMany({ where: { key: k } });
    return;
  }
  await db.systemConfig.upsert({ where: { key: k }, update: { value: JSON.stringify(override) }, create: { key: k, value: JSON.stringify(override) } });
}

module.exports = {
  REGISTRY, GATEWAY_DEFAULTS, overrideKey, readGlobal, readOverride, readEffective,
  callerMajor, studentMajor, validateOverride, writeOverride,
};
