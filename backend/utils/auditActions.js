/**
 * auditActions.js — แปลง request เป็น "ใครทำอะไร" ภาษาคน สำหรับบันทึกการใช้งาน
 *
 * ทุก request ที่เปลี่ยนข้อมูลถูกบันทึกหมด (ดู middlewares/auditLogger.js)
 * ตารางด้านล่างมีไว้ตั้งชื่อไทยให้งานสำคัญ — เส้นทางที่ไม่อยู่ในตารางจะใช้ "METHOD /path" แทน
 */

// ฟิลด์ที่ห้ามเก็บลง log เด็ดขาด — จับด้วยรูปแบบชื่อ ไม่ใช่รายชื่อตายตัว
// (เดิมใช้รายชื่อ แล้ว kkuPassword / id_token หลุดลง log เป็นข้อความธรรมดา)
const SECRET_KEY_PATTERN = /pass|pwd|secret|token|credential|api[_-]?key|hash|otp|pin$/i;
// ของใหญ่ที่ไม่ควรเก็บ (ไม่ใช่ความลับ แต่ทำให้ log บวม)
const BULKY_FIELDS = new Set(['image', 'base64', 'file', 'files']);
const isSecretKey = (key) => SECRET_KEY_PATTERN.test(String(key)) || BULKY_FIELDS.has(key);
// คงชื่อเดิมไว้ให้ส่วนที่อ้างถึง (เทสต์/เอกสาร)
const SECRET_FIELDS = { has: isSecretKey };

const DETAIL_MAX = 800;

// บางคนพิมพ์รหัสผ่านลงช่องอีเมล — ค่าที่ไม่ใช่อีเมลจะไม่ถูกเก็บลง log (ดู sanitizeBody/actorName)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const looksLikeEmail = (v) => EMAIL_RE.test(String(v || '').trim());

// [method, รูปแบบ path, ชื่อการกระทำ, ประเภทเป้าหมาย, ฟิลด์ที่ใช้เป็น id เป้าหมาย]
// ':x' = ส่วนไหนก็ได้ 1 ชั้น
const RULES = [
  ['POST', '/api/auth/signin', 'เข้าสู่ระบบ', null, null],
  ['POST', '/api/auth/login/sso', 'เข้าสู่ระบบด้วย SSO', null, null],
  ['POST', '/api/auth/login/google', 'เข้าสู่ระบบด้วย Google', null, null],
  ['POST', '/api/auth/register', 'เพิ่มนักศึกษาใหม่', 'นักศึกษา', 'code:studentId'],
  ['PUT', '/api/auth/me/password', 'เปลี่ยนรหัสผ่าน', null, null],

  ['PUT', '/api/students/me', 'แก้ไขข้อมูลส่วนตัว', 'นักศึกษา', null],
  ['POST', '/api/students/sync-from-reg', 'ซิงก์ข้อมูลจากทะเบียน KKU', 'นักศึกษา', null],
  ['POST', '/api/students/acknowledge-dispatch', 'รับทราบหนังสือขอความอนุเคราะห์', 'นักศึกษา', null],
  ['POST', '/api/students/download-placement-letter', 'ดาวน์โหลดหนังสือส่งตัว', 'นักศึกษา', null],
  ['POST', '/api/admin/students/import-preview', 'ตรวจไฟล์นำเข้านักศึกษา (ยังไม่บันทึก)', 'นักศึกษา', null],
  ['POST', '/api/admin/students/import-excel', 'นำเข้านักศึกษาจาก Excel', 'นักศึกษา', null],
  ['POST', '/api/admin/students/create', 'เพิ่มนักศึกษา', 'นักศึกษา', 'code:studentId'],
  ['PUT', '/api/admin/students/:x', 'แก้ไขข้อมูลนักศึกษา', 'นักศึกษา', ':1'],
  ['PATCH', '/api/admin/students/:x/reset-password', 'รีเซ็ตรหัสผ่านนักศึกษา', 'นักศึกษา', ':1'],
  ['POST', '/api/admin/students/:x/password/reveal', 'ดูรหัสผ่านนักศึกษา', 'นักศึกษา', ':1'],
  ['DELETE', '/api/admin/students/:x', 'ลบนักศึกษา (ย้ายไปถังขยะ)', 'นักศึกษา', ':1'],
  ['POST', '/api/admin/students/:x/restore', 'กู้คืนนักศึกษา', 'นักศึกษา', ':1'],
  ['DELETE', '/api/admin/students/:x/permanent', 'ลบนักศึกษาถาวร', 'นักศึกษา', ':1'],

  ['POST', '/api/docs/upload', 'อัปโหลดเอกสาร', 'เอกสาร', 'docType'],
  ['DELETE', '/api/coop/documents/:x', 'ลบเอกสาร', 'เอกสาร', ':1'],
  ['DELETE', '/api/docs/delete/:x', 'ลบเอกสาร', 'เอกสาร', ':1'],
  ['DELETE', '/api/docs/document/type/:x', 'ลบเอกสารตามประเภท', 'เอกสาร', null],
  ['POST', '/api/docs/save-form', 'บันทึกแบบฟอร์มใบสมัคร (T000)', 'นักศึกษา', null],
  ['POST', '/api/docs/t002-form', 'ส่งแบบฟอร์ม T002', 'นักศึกษา', null],
  ['POST', '/api/docs/t003-form', 'ส่งแบบฟอร์ม T003', 'นักศึกษา', null],
  ['POST', '/api/coop/apply', 'ยื่นคำร้องสหกิจ', 'นักศึกษา', null],
  ['PUT', '/api/coop/status', 'เปลี่ยนสถานะสหกิจ', 'นักศึกษา', 'studentId'],

  ['PUT', '/api/admin/t000/review', 'ตรวจเอกสาร / เปลี่ยนสถานะนักศึกษา', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/approve-all', 'อนุมัติเอกสารทั้งหมด', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/acceptance-received', 'บันทึกรับใบตอบรับจากบริษัท', 'นักศึกษา', 'studentId'],
  ['POST', '/api/admin/t000/acceptance-replace', 'เปลี่ยนไฟล์ใบตอบรับแทนนักศึกษา', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/t000/letter-pending', 'โหลดร่างหนังสือ (รอลงนาม)', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/doc/:x/status', 'เปลี่ยนสถานะเอกสาร', 'เอกสาร', ':1'],
  ['PATCH', '/api/admin/coop-applications/:x/status', 'เปลี่ยนสถานะคำร้องสหกิจ', 'คำร้องสหกิจ', ':1'],
  // ตรวจ T002/T003 — เจ้าหน้าที่และอาจารย์ใช้คนละเส้นทางแต่ความหมายเดียวกัน (/api/teachers เป็นชื่อพ้องของ /api/teacher)
  ['PUT', '/api/admin/documents/review-t002', 'ตรวจเอกสาร T002', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/admin/documents/review-t003', 'ตรวจเอกสาร T003', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/teacher/documents/review-t002', 'ตรวจเอกสาร T002', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/teacher/documents/review-t003', 'ตรวจเอกสาร T003', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/teachers/documents/review-t002', 'ตรวจเอกสาร T002', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/teachers/documents/review-t003', 'ตรวจเอกสาร T003', 'นักศึกษา', 'studentId'],

  ['PUT', '/api/admin/supervisions/:x/confirmed-date', 'แก้วันนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/admin/supervisions/:x/upload-letter', 'ออกหนังสือขอนิเทศ', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/letter-pending', 'โหลดร่างหนังสือขอนิเทศ (รอลงนาม)', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/complete', 'ปิดงานนิเทศ', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/admin/supervisions/:x/co-teachers', 'จัดการอาจารย์นิเทศร่วม', 'นัดนิเทศ', ':1'],
  ['POST', '/api/admin/supervision-periods', 'ตั้งค่าช่วงเวลานิเทศ', 'รอบสหกิจ', 'periodId'],
  ['POST', '/api/coop/supervision/propose', 'เสนอวันนิเทศ', 'นัดนิเทศ', null],
  ['PUT', '/api/teacher/supervisions/:x/review', 'อาจารย์พิจารณาวันนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/teacher/supervisions/confirm-group', 'ยืนยันวันนิเทศแบบกลุ่ม', 'นัดนิเทศ', null],
  ['PUT', '/api/teacher/supervisions/:x/complete', 'ปิดงานนิเทศ', 'นัดนิเทศ', ':1'],
  ['PUT', '/api/teachers/supervisions/:x/review', 'อาจารย์พิจารณาวันนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/teachers/supervisions/confirm-group', 'ยืนยันวันนิเทศแบบกลุ่ม', 'นัดนิเทศ', null],
  ['PUT', '/api/teachers/supervisions/:x/complete', 'ปิดงานนิเทศ', 'นัดนิเทศ', ':1'],
  ['POST', '/api/visits', 'บันทึกการเยี่ยมสถานประกอบการ', 'นักศึกษา', 'studentId'],
  ['PUT', '/api/visits/:x/toggle', 'เปลี่ยนสถานะการเยี่ยมสถานประกอบการ', null, ':1'],
  ['DELETE', '/api/visits/:x', 'ลบการเยี่ยมสถานประกอบการ', null, ':1'],

  ['POST', '/api/companies', 'เพิ่มบริษัท', 'บริษัท', null],
  ['POST', '/api/companies/bulk', 'นำเข้าบริษัทหลายรายการ', 'บริษัท', null],
  ['PUT', '/api/companies/:x', 'แก้ไขบริษัท', 'บริษัท', ':1'],
  ['DELETE', '/api/companies/:x', 'ลบบริษัท', 'บริษัท', ':1'],
  ['POST', '/api/companies/:x/mentors', 'เพิ่มพี่เลี้ยง', 'บริษัท', ':1'],
  ['PUT', '/api/companies/mentors/:x', 'แก้ไขพี่เลี้ยง', 'พี่เลี้ยง', ':1'],
  ['DELETE', '/api/companies/mentors/:x', 'ลบพี่เลี้ยง', 'พี่เลี้ยง', ':1'],

  ['POST', '/api/admin/staff', 'เพิ่มบัญชีเจ้าหน้าที่', 'ผู้ใช้', null],
  ['PATCH', '/api/admin/staff/:x/password', 'รีเซ็ตรหัสผ่านเจ้าหน้าที่', 'ผู้ใช้', ':1'],
  ['DELETE', '/api/admin/staff/:x', 'ลบบัญชีเจ้าหน้าที่', 'ผู้ใช้', ':1'],
  ['PUT', '/api/teacher/me', 'แก้ไขข้อมูลส่วนตัว', 'อาจารย์', null],
  ['PUT', '/api/teachers/me', 'แก้ไขข้อมูลส่วนตัว', 'อาจารย์', null],
  ['PUT', '/api/teacher/:x', 'แก้ไขข้อมูลอาจารย์', 'อาจารย์', ':1'],
  ['PUT', '/api/teachers/:x', 'แก้ไขข้อมูลอาจารย์', 'อาจารย์', ':1'],
  ['POST', '/api/teacher/config/t002', 'ตั้งค่าแบบฟอร์ม T002', 'ตั้งค่า', null],
  ['POST', '/api/teacher/config/t003', 'ตั้งค่าแบบฟอร์ม T003', 'ตั้งค่า', null],
  ['POST', '/api/teachers/config/t002', 'ตั้งค่าแบบฟอร์ม T002', 'ตั้งค่า', null],
  ['POST', '/api/teachers/config/t003', 'ตั้งค่าแบบฟอร์ม T003', 'ตั้งค่า', null],
  ['POST', '/api/admin/teachers', 'เพิ่มอาจารย์', 'อาจารย์', null],
  ['PUT', '/api/admin/teachers/:x', 'แก้ไขข้อมูลอาจารย์', 'อาจารย์', ':1'],
  ['DELETE', '/api/admin/teachers/:x', 'ลบอาจารย์', 'อาจารย์', ':1'],
  ['PUT', '/api/admin/teachers/:x/password', 'รีเซ็ตรหัสผ่านอาจารย์', 'อาจารย์', ':1'],
  ['POST', '/api/admin/teachers/:x/password/reveal', 'ดูรหัสผ่านอาจารย์', 'อาจารย์', ':1'],
  ['POST', '/api/admin/coop-periods', 'เพิ่มรอบสหกิจ', 'รอบสหกิจ', null],
  ['PUT', '/api/admin/coop-periods/:x', 'แก้ไขรอบสหกิจ', 'รอบสหกิจ', ':1'],
  ['POST', '/api/admin/config/t000', 'ตั้งค่าระบบรับเอกสาร', 'ตั้งค่า', null],
  ['POST', '/api/admin/criteria', 'ตั้งค่าเกณฑ์สหกิจ', 'ตั้งค่า', null],
  ['POST', '/api/admin/doc-requirements', 'ตั้งค่าเอกสารที่ต้องส่ง', 'ตั้งค่า', null],
  ['PUT', '/api/admin/doc-requirements/:x', 'ตั้งค่าเอกสารที่ต้องส่ง (แก้ไขรายการ)', 'ตั้งค่า', null],
  ['DELETE', '/api/admin/doc-requirements/:x', 'ตั้งค่าเอกสารที่ต้องส่ง (ลบรายการ)', 'ตั้งค่า', null],
  ['PUT', '/api/admin/criteria/:x', 'ตั้งค่าเกณฑ์สหกิจ (แก้ไข)', 'ตั้งค่า', null],
  ['DELETE', '/api/admin/criteria/:x', 'ตั้งค่าเกณฑ์สหกิจ (ลบ)', 'ตั้งค่า', null],
  ['PATCH', '/api/admin/coop-periods/:x/toggle', 'เปิด/ปิดรอบสหกิจ', 'รอบสหกิจ', ':1'],
  ['DELETE', '/api/admin/coop-periods/:x', 'ลบรอบสหกิจ', 'รอบสหกิจ', ':1'],
  ['POST', '/api/admin/assets', 'อัปโหลดไฟล์ระบบ (โลโก้/ลายเซ็น)', 'ตั้งค่า', null],
  ['DELETE', '/api/admin/assets/:x', 'ลบไฟล์ระบบ', 'ตั้งค่า', null],
  ['POST', '/api/admin/config/dean-info', 'ตั้งค่าข้อมูลคณบดี', 'ตั้งค่า', null],
  ['POST', '/api/admin/config/t002', 'ตั้งค่าแบบฟอร์ม T002', 'ตั้งค่า', null],
  ['POST', '/api/admin/config/t003', 'ตั้งค่าแบบฟอร์ม T003', 'ตั้งค่า', null],
  ['PUT', '/api/admin/config/evaluation', 'ตั้งค่าแบบประเมิน (T005/T006)', 'ตั้งค่า', null],
  ['PUT', '/api/admin/config/t007', 'ตั้งค่าแบบประเมิน T007', 'ตั้งค่า', null],
  ['PUT', '/api/admin/config/t008', 'ตั้งค่าเล่มรายงาน T008', 'ตั้งค่า', null],
  ['PUT', '/api/admin/config/gateway', 'ตั้งค่าฟอร์มคำร้อง', 'ตั้งค่า', null],
  ['POST', '/api/announcements', 'เพิ่ม/แก้ไขประกาศ', 'ประกาศ', 'id'],
  ['DELETE', '/api/announcements/:x', 'ลบประกาศ', 'ประกาศ', ':1'],

  // ── ดึงข้อมูลออกเป็นไฟล์ (GET) — ใครดูดข้อมูลอะไรออกไป ──
  ['GET', '/api/admin/students/export', 'ดาวน์โหลดรายชื่อนักศึกษา (Excel)', null, null],
  ['GET', '/api/admin/logs/export', 'ดาวน์โหลดบันทึกการใช้งาน (Excel)', null, null],
  ['GET', '/api/admin/supervisions/export', 'ดาวน์โหลดตารางนิเทศ (Excel)', null, null],
  ['GET', '/api/teacher/students/export', 'ดาวน์โหลดรายชื่อนักศึกษาที่ดูแล (Excel)', null, null],
  ['GET', '/api/teachers/students/export', 'ดาวน์โหลดรายชื่อนักศึกษาที่ดูแล (Excel)', null, null],
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
  // คำร้องสหกิจ (ใช้ API เดียวกัน) — ตั้งชื่อชัดๆ ไม่ให้ไปปนกับตัวกรอง "เรื่องเอกสาร"
  QUALIFIED: 'อนุมัติคำร้องสหกิจ (ผ่านคุณสมบัติ)',
  QUALIFICATION_FAILED: 'คำร้องสหกิจไม่ผ่านคุณสมบัติ',
  APPLICATION_EDITS_REQUIRED: 'ให้แก้ไขคำร้องสหกิจ',
};

// ตัวกรอง "📄 เฉพาะเรื่องเอกสาร" ในหน้า /admin/logs — ชื่อการกระทำที่ขึ้นต้นด้วยคำเหล่านี้
// อยู่ที่เดียวกับชื่อการกระทำ (เดิมเขียนซ้ำไว้ใน controller เปลี่ยนชื่อแล้วตัวกรองพังเงียบ) · มีเทสต์กันเพี้ยน
const DOC_ACTION_PREFIXES = [
  // เจ้าหน้าที่ออก/ตรวจเอกสาร
  'ออกหนังสือ', 'โหลดร่าง', 'ยกเลิกรอลงนาม', 'อนุมัติเอกสาร', 'ให้แก้ไขเอกสาร', 'ตรวจเอกสาร', 'เปลี่ยนสถานะเอกสาร',
  'ตีกลับใบตอบรับ', 'ตรวจใบตอบรับ', 'บันทึกรับใบตอบรับ', 'เปลี่ยนไฟล์ใบตอบรับ', 'ยืนยันออกฝึก',
  // นักศึกษาส่ง/รับเอกสาร
  'อัปโหลดเอกสาร', 'ลบเอกสาร', 'ดาวน์โหลดหนังสือ', 'รับทราบหนังสือ', 'ส่งแบบฟอร์ม', 'บันทึกแบบฟอร์ม',
];
const LETTER_NAME = { REQUEST: 'หนังสือขอความอนุเคราะห์', PLACEMENT: 'หนังสือส่งตัว' };
const DELIVERY_TEXT = { STAFF: 'เจ้าหน้าที่จัดส่งให้บริษัท', STUDENT: 'นักศึกษานำไปยื่นเอง' };
const DOC_STATUS_ACTION = { APPROVED: 'ตรวจเอกสารผ่าน', REJECTED: 'ตรวจเอกสารไม่ผ่าน', EDITS_REQUIRED: 'ให้แก้ไขเอกสาร' };
// ตรวจ T002/T003: ส่ง <FORM>_EDITS_REQUIRED = ให้แก้ไข · ส่ง <FORM>_SUBMITTED = ตรวจผ่าน (ไฟล์ถูกตั้งเป็น APPROVED)
const formReviewActionText = (form) => ({ status }) => (
  String(status || '').endsWith('EDITS_REQUIRED') ? `ให้แก้ไขเอกสาร ${form}` : `ตรวจเอกสาร ${form} ผ่าน`
);
// สถานะคำร้องสหกิจ — ใช้ชื่อชุดเดียวกับการตรวจคำร้องในหน้าเจ้าหน้าที่
const APP_STATUS_ACTION = {
  QUALIFIED: 'อนุมัติคำร้องสหกิจ (ผ่านคุณสมบัติ)',
  QUALIFICATION_FAILED: 'คำร้องสหกิจไม่ผ่านคุณสมบัติ',
  APPLICATION_EDITS_REQUIRED: 'ให้แก้ไขคำร้องสหกิจ',
  EDITS_REQUIRED: 'ให้แก้ไขคำร้องสหกิจ',
  WAITING_FOR_STAFF_CHECK: 'ส่งคำร้องสหกิจกลับให้เจ้าหน้าที่ตรวจ',
};

const clean = (v) => (v == null ? '' : String(v).trim());
const withNo = (text, no) => (clean(no) ? `${text} เลขที่ ${clean(no)}` : text);
const isTrue = (v) => v === true || v === 'true';

// ── ข้อความของการกระทำด้านเอกสาร (ที่เดียว) — controller เรียกด้วย "ค่าที่บันทึกจริง" ─────────────
// ตาราง ACTION_DETAIL ด้านล่างเรียกด้วยค่าจาก body ใช้เป็นตัวสำรองเฉพาะเมื่อ controller ไม่ได้แนบรายละเอียด
// (เช่น คำขอล้มเหลวกลางทาง) — ถ้าชื่อฟิลด์ใน API เปลี่ยน ตัวสำรองอาจขาดเลขที่ แต่ log ของคำขอที่สำเร็จยังถูก
function reviewActionText({ status, docNumber, deliveryMethod, reprint = false }, base = 'ตรวจเอกสาร / เปลี่ยนสถานะนักศึกษา') {
  const name = REVIEW_STATUS_ACTION[status];
  if (!name) return status ? `${base} → ${status}` : base;
  let text = /LETTER_ISSUED$/.test(status) ? withNo(name, docNumber) : name;
  if (reprint) text += ' (พิมพ์ซ้ำ)';
  else if (DELIVERY_TEXT[deliveryMethod] && /LETTER_ISSUED$/.test(status)) text += ` (${DELIVERY_TEXT[deliveryMethod]})`;
  return text;
}
function letterPendingActionText({ letter, cancel, docNumber }) {
  const name = letter === 'SUPERVISION' ? 'หนังสือขอนิเทศ' : LETTER_NAME[letter];
  if (!name) return null;
  return isTrue(cancel) ? `ยกเลิกรอลงนาม${name}` : withNo(`โหลดร่าง${name} (รอลงนาม)`, docNumber);
}
const supervisionLetterActionText = ({ docNumber }) => withNo('ออกหนังสือขอนิเทศ', docNumber);

const ACTION_DETAIL = {
  'PUT /api/admin/t000/review': (b, base) => reviewActionText({
    status: b.status,
    docNumber: b.status === 'REQ_LETTER_ISSUED' ? b.reqDocNumber : b.placeDocNumber,
    deliveryMethod: b.deliveryMethod,
  }, base),
  'PUT /api/admin/t000/letter-pending': (b, base) => letterPendingActionText(b) || base,
  'POST /api/admin/supervisions/:x/upload-letter': (b) => supervisionLetterActionText(b),
  'PUT /api/admin/supervisions/:x/letter-pending': (b) => letterPendingActionText({ ...b, letter: 'SUPERVISION' }),
  'PUT /api/admin/doc/:x/status': (b, base) => DOC_STATUS_ACTION[b.status] || base,
  'PUT /api/admin/documents/review-t002': formReviewActionText('T002'),
  'PUT /api/admin/documents/review-t003': formReviewActionText('T003'),
  'PUT /api/teacher/documents/review-t002': formReviewActionText('T002'),
  'PUT /api/teacher/documents/review-t003': formReviewActionText('T003'),
  'PUT /api/teachers/documents/review-t002': formReviewActionText('T002'),
  'PUT /api/teachers/documents/review-t003': formReviewActionText('T003'),
  'PATCH /api/admin/coop-applications/:x/status': (b, base) => APP_STATUS_ACTION[b.status] || base,
};

// controller แนบรายละเอียดจากผลที่ทำจริง (เลขที่ที่บันทึก, พิมพ์ซ้ำ, นักศึกษาเป้าหมาย) — middleware ใช้แทนค่าที่เดาจาก request
function setAuditDetail(res, detail) {
  if (!res) return;
  if (!res.locals) res.locals = {};
  res.locals.audit = { ...(res.locals.audit || {}), ...detail };
}

// คืน { action, targetType, targetId, targetKey } ของ request หนึ่ง
// targetKey: 'id' = id ในฐานข้อมูล · 'code' = รหัสนักศึกษา (idSpec ขึ้นต้น "code:")
function describeRequest({ method, path, body }) {
  const upper = String(method || '').toUpperCase();
  const cleanPath = String(path || '').split('?')[0];
  for (const [m, pattern, action, targetType, idSpec] of RULES) {
    if (m !== upper) continue;
    const params = matchPath(pattern, cleanPath);
    if (!params) continue;
    const detail = ACTION_DETAIL[`${m} ${pattern}`];
    const fullAction = detail ? detail(body || {}, action) : action;
    const isCode = typeof idSpec === 'string' && idSpec.startsWith('code:');
    return {
      action: fullAction,
      targetType: targetType || null,
      targetId: pickTargetId(isCode ? idSpec.slice(5) : idSpec, params, body),
      targetKey: isCode ? 'code' : 'id',
    };
  }
  return { action: `${upper} ${cleanPath}`, targetType: null, targetId: null, targetKey: 'id' };
}

// ข้อมูลที่ส่งมาแบบย่อ — ตัดความลับและของใหญ่ออก
function sanitizeBody(body, { loginPath = false } = {}) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SECRET_FIELDS.has(k)) { out[k] = '[ซ่อน]'; continue; }
    // หน้า login: ถ้าค่าในช่องอีเมล/ชื่อผู้ใช้ไม่ใช่อีเมล อาจเป็นรหัสผ่านที่พิมพ์ผิดช่อง — ไม่เก็บ
    if (loginPath && /^(email|username)$/i.test(k) && !looksLikeEmail(v)) { out[k] = '[ซ่อน]'; continue; }
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

module.exports = {
  describeRequest, sanitizeBody, matchPath, RULES, SECRET_FIELDS, DETAIL_MAX, looksLikeEmail,
  setAuditDetail, reviewActionText, letterPendingActionText, supervisionLetterActionText,
  DOC_ACTION_PREFIXES,
};
