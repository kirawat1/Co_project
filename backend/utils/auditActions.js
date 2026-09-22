/**
 * auditActions.js — แปลง request เป็น "ใครทำอะไร" ภาษาคน สำหรับบันทึกการใช้งาน
 *
 * ทุก request ที่เปลี่ยนข้อมูลถูกบันทึกหมด (ดู middlewares/auditLogger.js)
 * ตารางด้านล่างมีไว้ตั้งชื่อไทยให้งานสำคัญ — เส้นทางที่ไม่อยู่ในตารางจะใช้ "METHOD /path" แทน
 */

// ฟิลด์ที่ห้ามเก็บลง log เด็ดขาด — จับด้วยรูปแบบชื่อ ไม่ใช่รายชื่อตายตัว
// (เดิมใช้รายชื่อ แล้ว kkuPassword / id_token หลุดลง log เป็นข้อความธรรมดา)
const SECRET_KEY_PATTERN = /pass|pwd|secret|token|credential|api[_-]?key|otp|pin$/i;
// ของใหญ่ที่ไม่ควรเก็บ (ไม่ใช่ความลับ แต่ทำให้ log บวม)
const BULKY_FIELDS = new Set(['image', 'base64', 'file', 'files']);
const isSecretKey = (key) => SECRET_KEY_PATTERN.test(String(key)) || BULKY_FIELDS.has(key);
// คงชื่อเดิมไว้ให้ส่วนที่อ้างถึง (เทสต์/เอกสาร)
const SECRET_FIELDS = { has: isSecretKey };

const DETAIL_MAX = 800;

// [method, รูปแบบ path, ชื่อการกระทำ, ประเภทเป้าหมาย, ฟิลด์ที่ใช้เป็น id เป้าหมาย]
// ':x' = ส่วนไหนก็ได้ 1 ชั้น
const RULES = [
  ['POST', '/api/auth/signin', 'เข้าสู่ระบบ', null, null],
  ['POST', '/api/auth/login/sso', 'เข้าสู่ระบบด้วย SSO', null, null],
  ['POST', '/api/auth/login/google', 'เข้าสู่ระบบด้วย Google', null, null],
  ['POST', '/api/auth/register', 'เพิ่มนักศึกษาใหม่', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/auth/me/password', 'เปลี่ยนรหัสผ่าน', null, null],

  ['PUT', '/api/students/me', 'แก้ไขข้อมูลส่วนตัว', 'นักศึกษา', null],
  ['POST', '/api/students/sync-from-reg', 'ซิงก์ข้อมูลจากทะเบียน KKU', 'นักศึกษา', null],
  ['POST', '/api/students/acknowledge-dispatch', 'รับทราบหนังสือขอความอนุเคราะห์', 'นักศึกษา', null],
  ['POST', '/api/students/download-placement-letter', 'ดาวน์โหลดหนังสือส่งตัว', 'นักศึกษา', null],
  ['POST', '/api/admin/students/import-preview', 'ตรวจไฟล์นำเข้านักศึกษา (ยังไม่บันทึก)', 'นักศึกษา', null],
  ['POST', '/api/admin/students/import-excel', 'นำเข้านักศึกษาจาก Excel', 'นักศึกษา', null],
  ['POST', '/api/admin/students/create', 'เพิ่มนักศึกษา', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/students/:x', 'แก้ไขข้อมูลนักศึกษา', 'นักศึกษา', ':1'],
  ['PATCH', '/api/admin/students/:x/reset-password', 'รีเซ็ตรหัสผ่านนักศึกษา', 'นักศึกษา', ':1'],
  ['DELETE', '/api/admin/students/:x', 'ลบนักศึกษา (ย้ายไปถังขยะ)', 'นักศึกษา', ':1'],
  ['POST', '/api/admin/students/:x/restore', 'กู้คืนนักศึกษา', 'นักศึกษา', ':1'],
  ['DELETE', '/api/admin/students/:x/permanent', 'ลบนักศึกษาถาวร', 'นักศึกษา', ':1'],

  ['POST', '/api/docs/upload', 'อัปโหลดเอกสาร', 'เอกสาร', 'docType'],
  ['DELETE', '/api/coop/documents/:x', 'ลบเอกสาร', 'เอกสาร', ':1'],
  ['POST', '/api/coop/apply', 'ยื่นคำร้องสหกิจ', 'นักศึกษา', null],
  ['PUT', '/api/coop/status', 'เปลี่ยนสถานะสหกิจ', 'นักศึกษา', 'studentId'],

  ['PUT', '/api/admin/t000/review', 'ตรวจเอกสาร / เปลี่ยนสถานะนักศึกษา', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/approve-all', 'อนุมัติเอกสารทั้งหมด', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/acceptance-received', 'บันทึกรับใบตอบรับจากบริษัท', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/acceptance-replace', 'เปลี่ยนไฟล์ใบตอบรับแทนนักศึกษา', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/t000/letter-pending', 'โหลดร่างหนังสือ (รอลงนาม)', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/doc/:x/status', 'เปลี่ยนสถานะเอกสาร', 'เอกสาร', ':1'],

  ['PUT', '/api/admin/supervisions/:x/confirmed-date', 'แก้วันนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/admin/supervisions/:x/upload-letter', 'ออกหนังสือขอนิเทศ', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/letter-pending', 'โหลดร่างหนังสือขอนิเทศ (รอลงนาม)', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/complete', 'ปิดงานนิเทศ', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/co-teachers', 'จัดการอาจารย์นิเทศร่วม', 'นัดนิเทศ', ':1'],
  ['POST', '/api/admin/supervision-periods', 'ตั้งค่าช่วงเวลานิเทศ', 'รอบสหกิจ', 'periodId'],
  ['POST', '/api/coop/supervision/propose', 'เสนอวันนิเทศ', 'นัดนิเทศ', null],
  ['PUT', '/api/teacher/supervisions/:x/review', 'อาจารย์พิจารณาวันนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/teacher/supervisions/confirm-group', 'ยืนยันวันนิเทศแบบกลุ่ม', 'นัดนิเทศ', null],

  ['POST', '/api/companies', 'เพิ่มบริษัท', 'บริษัท', null],
  ['PUT', '/api/companies/:x', 'แก้ไขบริษัท', 'บริษัท', ':1'],
  ['DELETE', '/api/companies/:x', 'ลบบริษัท', 'บริษัท', ':1'],
  ['POST', '/api/companies/:x/mentors', 'เพิ่มพี่เลี้ยง', 'บริษัท', ':1'],
  ['PUT', '/api/companies/mentors/:x', 'แก้ไขพี่เลี้ยง', 'พี่เลี้ยง', ':1'],
  ['DELETE', '/api/companies/mentors/:x', 'ลบพี่เลี้ยง', 'พี่เลี้ยง', ':1'],

  ['POST', '/api/admin/staff', 'เพิ่มบัญชีเจ้าหน้าที่', 'ผู้ใช้', null],
  ['PATCH', '/api/admin/staff/:x/password', 'รีเซ็ตรหัสผ่านเจ้าหน้าที่', 'ผู้ใช้', ':1'],
  ['DELETE', '/api/admin/staff/:x', 'ลบบัญชีเจ้าหน้าที่', 'ผู้ใช้', ':1'],
  ['POST', '/api/admin/teachers', 'เพิ่มอาจารย์', 'อาจารย์', null],
  ['PUT', '/api/admin/teachers/:x', 'แก้ไขข้อมูลอาจารย์', 'อาจารย์', ':1'],
  ['DELETE', '/api/admin/teachers/:x', 'ลบอาจารย์', 'อาจารย์', ':1'],
  ['POST', '/api/admin/coop-periods', 'เพิ่มรอบสหกิจ', 'รอบสหกิจ', null],
  ['PUT', '/api/admin/coop-periods/:x', 'แก้ไขรอบสหกิจ', 'รอบสหกิจ', ':1'],
  ['POST', '/api/admin/config/t000', 'ตั้งค่าระบบรับเอกสาร', 'ตั้งค่า', null],
  ['POST', '/api/admin/criteria', 'ตั้งค่าเกณฑ์สหกิจ', 'ตั้งค่า', null],
  ['POST', '/api/admin/doc-requirements', 'ตั้งค่าเอกสารที่ต้องส่ง', 'ตั้งค่า', null],
  ['POST', '/api/notifications/mark-read', 'อ่านการแจ้งเตือน', null, null],
];

// เทียบ path กับรูปแบบที่มี :x — คืน array ของส่วนที่ match (สำหรับดึง id)
function matchPath(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('?')[0].split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === ':x') { params.push(b[i]); continue; }
    if (a[i] !== b[i]) return null;
  }
  return params;
}

function pickTargetId(spec, params, body) {
  if (!spec) return null;
  if (spec.startsWith(':')) {
    const idx = parseInt(spec.slice(1), 10) - 1;
    return params[idx] != null ? String(params[idx]) : null;
  }
  const v = body?.[spec];
  return v == null || v === '' ? null : String(v).slice(0, 50);
}

// ── ใครออกเอกสารอะไร — ขยายชื่อการกระทำตามข้อมูลที่ส่งมา (สถานะที่ตั้ง, เลขที่หนังสือ, วิธีจัดส่ง) ──
const REVIEW_STATUS_ACTION = {
  REQ_LETTER_ISSUED: 'ออกหนังสือขอความอนุเคราะห์',
  PLACEMENT_LETTER_ISSUED: 'ออกหนังสือส่งตัว',
  DOCS_APPROVED: 'อนุมัติเอกสาร T000',
  EDITS_REQUIRED: 'ให้แก้ไขเอกสาร T000',
  WAITING_FOR_PLACEMENT_LETTER: 'ตีกลับใบตอบรับ',
  ACCEPTANCE_CHECKED: 'ตรวจใบตอบรับผ่าน',
  INTERNSHIP_STARTED: 'ยืนยันออกฝึกสหกิจ',
};
const LETTER_NAME = { REQUEST: 'หนังสือขอความอนุเคราะห์', PLACEMENT: 'หนังสือส่งตัว' };
const DELIVERY_TEXT = { STAFF: 'เจ้าหน้าที่จัดส่งให้บริษัท', STUDENT: 'นักศึกษานำไปยื่นเอง' };
const DOC_STATUS_ACTION = { APPROVED: 'ตรวจเอกสารผ่าน', REJECTED: 'ตรวจเอกสารไม่ผ่าน', EDITS_REQUIRED: 'ให้แก้ไขเอกสาร' };

const clean = (v) => (v == null ? '' : String(v).trim());
const withNo = (text, no) => (clean(no) ? `${text} เลขที่ ${clean(no)}` : text);
const isTrue = (v) => v === true || v === 'true';

const ACTION_DETAIL = {
  'PUT /api/admin/t000/review': (b, base) => {
    const name = REVIEW_STATUS_ACTION[b.status];
    if (!name) return b.status ? `${base} → ${b.status}` : base;
    let text = name;
    if (b.status === 'REQ_LETTER_ISSUED') text = withNo(text, b.reqDocNumber);
    if (b.status === 'PLACEMENT_LETTER_ISSUED') text = withNo(text, b.placeDocNumber);
    if (DELIVERY_TEXT[b.deliveryMethod] && /LETTER_ISSUED$/.test(b.status)) text += ` (${DELIVERY_TEXT[b.deliveryMethod]})`;
    return text;
  },
  'PUT /api/admin/t000/letter-pending': (b, base) => {
    const letter = LETTER_NAME[b.letter];
    if (!letter) return base;
    return isTrue(b.cancel) ? `ยกเลิกรอลงนาม${letter}` : withNo(`โหลดร่าง${letter} (รอลงนาม)`, b.docNumber);
  },
  'POST /api/admin/supervisions/:x/upload-letter': (b, base) => withNo(base, b.docNumber),
  'PUT /api/admin/supervisions/:x/letter-pending': (b) => (isTrue(b.cancel)
    ? 'ยกเลิกรอลงนามหนังสือขอนิเทศ'
    : withNo('โหลดร่างหนังสือขอนิเทศ (รอลงนาม)', b.docNumber)),
  'PUT /api/admin/doc/:x/status': (b, base) => DOC_STATUS_ACTION[b.status] || base,
};

// คืน { action, targetType, targetId } ของ request หนึ่ง
function describeRequest({ method, path, body }) {
  const upper = String(method || '').toUpperCase();
  const cleanPath = String(path || '').split('?')[0];
  for (const [m, pattern, action, targetType, idSpec] of RULES) {
    if (m !== upper) continue;
    const params = matchPath(pattern, cleanPath);
    if (!params) continue;
    const detail = ACTION_DETAIL[`${m} ${pattern}`];
    const fullAction = detail ? detail(body || {}, action) : action;
    return { action: fullAction, targetType: targetType || null, targetId: pickTargetId(idSpec, params, body) };
  }
  return { action: `${upper} ${cleanPath}`, targetType: null, targetId: null };
}

// ข้อมูลที่ส่งมาแบบย่อ — ตัดความลับและของใหญ่ออก
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SECRET_FIELDS.has(k)) { out[k] = '[ซ่อน]'; continue; }
    if (v == null) continue;
    if (typeof v === 'string') { out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v; continue; }
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; continue; }
    if (Array.isArray(v)) { out[k] = `[${v.length} รายการ]`; continue; }
    out[k] = '[object]';
  }
  const text = JSON.stringify(out);
  if (text === '{}') return null;
  return text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX)}…` : text;
}

module.exports = { describeRequest, sanitizeBody, matchPath, RULES, SECRET_FIELDS, DETAIL_MAX };
