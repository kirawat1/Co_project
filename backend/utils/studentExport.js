const XLSX = require('xlsx');
const { getStatusLabelTh } = require('./coopStatusLabels');
const { resolveMajorNameTh } = require('./majorName');

const PREFIX_LABEL_TH = { MR: 'นาย', MS: 'นางสาว' };
const STUDY_PROGRAM_LABEL_TH = { normal: 'ภาคปกติ', special: 'ภาคพิเศษ' };
const SUPERVISION_TYPE_LABEL_TH = { ONLINE: 'ออนไลน์', ONSITE: 'ออนไซต์' };
// ตรงกับ Frontend/src/components/StatusBadge.tsx (ส่วนการนิเทศ)
const SUPERVISION_STATUS_LABEL_TH = {
  PENDING_TEACHER: 'รออาจารย์เลือกวันนิเทศ',
  TEACHER_REJECTED: 'แก้ไขวันนัดหมายนิเทศ',
  DATE_CONFIRMED: 'รอเจ้าหน้าที่พิจารณาหนังสือนิเทศ',
  LETTER_UPLOADED: 'อนุมัติหนังสือนิเทศแล้ว',
  COMPLETED: 'นิเทศเสร็จสิ้น',
};

const TEACHER_NAME_SELECT = { select: { prefix: true, firstName: true, lastName: true } };

// include ของ prisma.student.findMany ที่ใช้กับไฟล์ export (เจ้าหน้าที่ + อาจารย์ใช้ชุดเดียวกัน)
const STUDENT_EXPORT_INCLUDE = {
  user: { select: { email: true } },
  coop: { include: { company: true, coopPeriod: true, mentors: true } },
  generalAdvisor: TEACHER_NAME_SELECT,
  coopAdvisor: TEACHER_NAME_SELECT,
  supervisionAppointment: {
    select: { status: true, supervisionType: true, confirmedDate: true, coTeacherName: true, teacher: TEACHER_NAME_SELECT },
  },
  t003Form: { select: { reportTitleTh: true } },
  documents: { select: { name: true, path: true, type: true, status: true, uploadedAt: true }, orderBy: { uploadedAt: 'asc' } },
};

// เอกสารหลักที่แสดงเป็นคอลัมน์ในชีต "นักศึกษา" (ไฟล์ล่าสุดของแต่ละชนิด กดเปิดได้)
// [หัวคอลัมน์, Document.type ที่นับเป็นเอกสารนี้ (ชื่อเก่า/ใหม่ปนกันในข้อมูลจริง), ฟิลด์สำรองใน StudentCoop]
const DOC_COLUMNS = [
  ['ไฟล์: Transcript', ['CP-TRANSCRIPT', 'TRANSCRIPT']],
  ['ไฟล์: CV / Resume', ['CP-CV', 'CV']],
  ['ไฟล์: บัตรนักศึกษา', ['CP-STUDENT_CARD', 'STUDENT_CARD']],
  ['ไฟล์: บัตรประชาชน', ['CP-CITIZEN_CARD', 'CITIZEN_CARD']],
  ['ไฟล์: ใบยินยอมผู้ปกครอง', ['CP-PARENTAL_CONSENT', 'PARENTAL_CONSENT']],
  ['ไฟล์: ใบสมัคร T000 (ลงนาม)', ['T000_SIGNED', 'T000']],
  ['ไฟล์: หนังสือขอความอนุเคราะห์', ['DISPATCH_LETTER'], 'reqLetterUrl'],
  ['ไฟล์: ใบตอบรับ', ['CP-ACCEPTANCE', 'ACCEPTANCE_FORM']],
  ['ไฟล์: หนังสือส่งตัว', ['PLACEMENT_LETTER'], 'placeLetterUrl'],
  ['ไฟล์: T002', ['T002_FORM']],
  ['ไฟล์: T003', ['T003_FORM']],
];
const DOC_TYPE_LABEL_TH = {
  APPLICATION_DOC: 'เอกสารแนบคำร้องสหกิจ',
  OTHER: 'เอกสารอื่นๆ',
};
for (const [header, types] of DOC_COLUMNS) for (const t of types) DOC_TYPE_LABEL_TH[t] = header.replace(/^ไฟล์: /, '');
const DOC_STATUS_LABEL_TH = {
  WAITING: 'รอตรวจ', PENDING: 'รอตรวจ', APPROVED: 'ผ่าน', REJECTED: 'ไม่ผ่าน', EDITS_REQUIRED: 'ต้องแก้ไข',
};

// [หัวคอลัมน์, ความกว้าง (ตัวอักษร)]
const COLUMNS = [
  ['รหัสนักศึกษา', 14],
  ['ชื่อ-นามสกุล', 28],
  ['หลักสูตร', 22],
  ['รูปแบบการศึกษา', 13],
  ['ชั้นปี', 7],
  ['อีเมล', 28],
  ['เบอร์โทร', 13],
  ['รอบสหกิจ', 10],
  ['สถานะสหกิจ', 26],
  ['บริษัทที่ไปฝึกงาน', 32],
  ['ที่อยู่บริษัท', 50],
  ['พี่เลี้ยง', 32],
  ['วันเริ่มฝึกงาน', 14],
  ['วันสิ้นสุดฝึกงาน', 14],
  ['ชื่อรายงาน (T003)', 36],
  ['อาจารย์ที่ปรึกษาทั่วไป', 26],
  ['อาจารย์ที่ปรึกษาโครงงานสหกิจ', 26],
  ['อาจารย์นิเทศ', 26],
  ['อาจารย์นิเทศร่วม', 30],
  ['วันนิเทศ', 20],
  ['รูปแบบนิเทศ', 12],
  ['สถานะนิเทศ', 28],
];
const EXPORT_HEADERS = [...COLUMNS.map(([header]) => header), ...DOC_COLUMNS.map(([header]) => header)];
const COLUMN_WIDTHS = [...COLUMNS.map(([, wch]) => wch), ...DOC_COLUMNS.map(() => 24)];

// ชีต "เอกสารทั้งหมด" — ไฟล์ทุกไฟล์ 1 แถว (ชนิดที่มีหลายไฟล์ เช่น เอกสารแนบคำร้อง ก็ไม่ตกหล่น)
const ALL_DOCS_COLUMNS = [
  ['รหัสนักศึกษา', 14],
  ['ชื่อ-นามสกุล', 28],
  ['เอกสาร', 30],
  ['ชื่อไฟล์ (กดเปิด)', 40],
  ['สถานะเอกสาร', 12],
  ['วันที่อัปโหลด', 20],
];
const ALL_DOCS_HEADERS = ALL_DOCS_COLUMNS.map(([header]) => header);
const FILE_LINK_HEADER = 'ชื่อไฟล์ (กดเปิด)';

const dash = (value) => {
  const text = value == null ? '' : String(value).trim();
  return text || '-';
};

// ลิงก์เต็มไปยังไฟล์ — ไฟล์ Excel ถูกเปิดนอกเว็บ ลิงก์แบบ /uploads/... จึงใช้ไม่ได้
function fileUrl(baseUrl, filePath) {
  if (!baseUrl || !filePath) return null;
  const clean = String(filePath).replace(/^\/?uploads\//, '').split('/').map(encodeURIComponent).join('/');
  return `${baseUrl.replace(/\/+$/, '')}/uploads/${clean}`;
}

function fullNameOf(student) {
  const prefixLabel = PREFIX_LABEL_TH[student.prefix] || '';
  return [prefixLabel, student.firstName, student.lastName].filter(Boolean).join(' ');
}

// ไฟล์ล่าสุดของเอกสารแต่ละคอลัมน์ → { header: { name, path } }
function latestDocs(student) {
  const docs = Array.isArray(student.documents) ? student.documents : [];
  const out = {};
  for (const [header, types, coopField] of DOC_COLUMNS) {
    const matches = docs.filter((d) => types.includes(d.type) && d.path);
    const latest = matches[matches.length - 1];
    if (latest) out[header] = { name: latest.name || latest.path, path: latest.path };
    else if (coopField && student.coop?.[coopField]) out[header] = { name: student.coop[coopField], path: student.coop[coopField] };
  }
  return out;
}

function addLink(worksheet, r, c, url, tooltip) {
  if (!url || c < 0) return;
  const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
  if (cell) cell.l = { Target: url, Tooltip: tooltip };
}

function teacherName(teacher) {
  if (!teacher?.firstName) return '-';
  return `${teacher.prefix || ''}${teacher.firstName} ${teacher.lastName || ''}`.trim();
}

// วันที่ไทยตามเวลาประเทศไทย เช่น "8 ธ.ค. 2569" (เซิร์ฟเวอร์อาจไม่ได้ตั้ง timezone ไทย)
function thaiDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });
}

function thaiDateTime(value) {
  const date = thaiDate(value);
  if (date === '-') return '-';
  const time = new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  return `${date} ${time} น.`;
}

// ช่องที่ผู้กรอกใส่ "-" / "ไม่มี" แทนการเว้นว่าง
function addressPart(value) {
  const text = String(value || '').trim();
  return /^([-–—.\s]*|ไม่มี)$/.test(text) ? '' : text;
}

// เติมคำนำหน้า (ถนน/ตำบล/...) เฉพาะเมื่อผู้กรอกยังไม่ได้พิมพ์มาเอง
function withPrefix(value, prefix, existing) {
  const text = addressPart(value);
  if (!text) return '';
  return existing.test(text) ? text : `${prefix}${text}`;
}

// ที่อยู่บริษัทเต็มจากช่องแยก · กรุงเทพฯ ใช้แขวง/เขต · ไม่มีช่องแยกใช้ address (ข้อความเดิม)
function companyAddress(company) {
  if (!company) return '-';
  const bangkok = /กรุงเทพ|bangkok/i.test(company.province || '');
  const parts = [
    addressPart(company.addressNo),
    withPrefix(company.moo, 'หมู่ ', /^(หมู่|ม\.)/),
    withPrefix(company.soi, 'ซอย', /^(ซอย|ซ\.)/),
    withPrefix(company.road, 'ถนน', /^(ถนน|ถ\.)/),
    withPrefix(company.subDistrict, bangkok ? 'แขวง' : 'ตำบล', /^(ตำบล|ต\.|แขวง)/),
    withPrefix(company.district, bangkok ? 'เขต' : 'อำเภอ', /^(อำเภอ|อ\.|เขต)/),
    bangkok ? addressPart(company.province) : withPrefix(company.province, 'จังหวัด', /^(จังหวัด|จ\.)/),
    addressPart(company.zipcode),
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return dash(String(company.address || '').replace(/\s+/g, ' '));
}

function mentorsText(mentors) {
  if (!Array.isArray(mentors) || mentors.length === 0) return '-';
  return mentors
    .map((m) => [m.firstName, m.lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' ') + (m.phone ? ` (${String(m.phone).trim()})` : ''))
    .join(', ');
}

function studentToExportRow(student, criteria) {
  const fullName = fullNameOf(student);
  const files = latestDocs(student);
  const coop = student.coop;
  const period = coop?.coopPeriod;
  const sup = student.supervisionAppointment;

  return {
    'รหัสนักศึกษา': student.studentId,
    'ชื่อ-นามสกุล': fullName,
    // major เก็บเป็นรหัสสาขา (CS) — ใช้ชื่อไทยจาก criteria ถ้ามี
    'หลักสูตร': dash(resolveMajorNameTh(student.major, criteria) || student.major),
    'รูปแบบการศึกษา': STUDY_PROGRAM_LABEL_TH[student.studyProgram] || '-',
    'ชั้นปี': dash(student.year),
    'อีเมล': dash(student.email || student.user?.email),
    'เบอร์โทร': dash(student.phone),
    'รอบสหกิจ': period ? `${period.semester}/${period.academicYear}` : '-',
    'สถานะสหกิจ': getStatusLabelTh(coop?.status),
    'บริษัทที่ไปฝึกงาน': dash(coop?.company?.name),
    'ที่อยู่บริษัท': companyAddress(coop?.company),
    'พี่เลี้ยง': mentorsText(coop?.mentors),
    'วันเริ่มฝึกงาน': thaiDate(coop?.actualStartDate),
    'วันสิ้นสุดฝึกงาน': thaiDate(coop?.actualEndDate),
    'ชื่อรายงาน (T003)': dash(student.t003Form?.reportTitleTh),
    'อาจารย์ที่ปรึกษาทั่วไป': teacherName(student.generalAdvisor),
    // coopAdvisor = อาจารย์ที่ปรึกษาโครงงานสหกิจ (นักศึกษาเลือกเอง มีสิทธิ์ตรวจ/นิเทศ)
    'อาจารย์ที่ปรึกษาโครงงานสหกิจ': teacherName(student.coopAdvisor),
    'อาจารย์นิเทศ': teacherName(sup?.teacher),
    'อาจารย์นิเทศร่วม': dash(sup?.coTeacherName),
    'วันนิเทศ': thaiDateTime(sup?.confirmedDate),
    'รูปแบบนิเทศ': sup ? (SUPERVISION_TYPE_LABEL_TH[sup.supervisionType] || '-') : '-',
    'สถานะนิเทศ': sup ? (SUPERVISION_STATUS_LABEL_TH[sup.status] || '-') : 'ยังไม่นัดนิเทศ',
    ...Object.fromEntries(DOC_COLUMNS.map(([header]) => [header, files[header]?.name || '-'])),
  };
}

/**
 * @param baseUrl  โดเมนของเว็บ เช่น https://coop.computing.kku.ac.th — ใช้ทำลิงก์เปิดไฟล์ (ไม่ส่ง = ไม่มีลิงก์ แสดงแค่ชื่อไฟล์)
 * @param requirements  DocumentRequirement ({ docKey, title }) — ใช้ตั้งชื่อเอกสารที่เจ้าหน้าที่เพิ่มเอง
 */
function buildStudentExportWorkbook(students, { criteria, baseUrl, requirements } = {}) {
  const rows = students.map((s) => studentToExportRow(s, criteria));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  worksheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  students.forEach((student, i) => {
    const files = latestDocs(student);
    for (const [header] of DOC_COLUMNS) {
      addLink(worksheet, i + 1, EXPORT_HEADERS.indexOf(header), fileUrl(baseUrl, files[header]?.path), 'เปิดไฟล์');
    }
  });

  // ชีตที่ 2: ไฟล์ทุกไฟล์
  const reqTitle = Object.fromEntries((requirements || []).map((r) => [r.docKey, r.title]));
  const docRows = [];
  const docLinks = [];
  for (const student of students) {
    for (const d of Array.isArray(student.documents) ? student.documents : []) {
      if (!d.path) continue;
      docRows.push({
        'รหัสนักศึกษา': student.studentId,
        'ชื่อ-นามสกุล': fullNameOf(student),
        'เอกสาร': DOC_TYPE_LABEL_TH[d.type] || reqTitle[d.type] || dash(d.type),
        [FILE_LINK_HEADER]: d.name || d.path,
        'สถานะเอกสาร': DOC_STATUS_LABEL_TH[d.status] || '-',
        'วันที่อัปโหลด': thaiDateTime(d.uploadedAt),
      });
      docLinks.push(fileUrl(baseUrl, d.path));
    }
  }
  const docSheet = XLSX.utils.json_to_sheet(docRows, { header: ALL_DOCS_HEADERS });
  docSheet['!cols'] = ALL_DOCS_COLUMNS.map(([, wch]) => ({ wch }));
  const linkCol = ALL_DOCS_HEADERS.indexOf(FILE_LINK_HEADER);
  docLinks.forEach((url, i) => addLink(docSheet, i + 1, linkCol, url, 'เปิดไฟล์'));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'นักศึกษา');
  XLSX.utils.book_append_sheet(workbook, docSheet, 'เอกสารทั้งหมด');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// โดเมนสำหรับลิงก์ไฟล์: PUBLIC_BASE_URL → หน้าเว็บที่กด export (Referer) → FRONTEND_URL ตัวแรก → host ของคำขอ
function exportBaseUrl(req) {
  const fromEnv = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const ref = new URL(req.get('referer') || '');
    if (/^https?:$/.test(ref.protocol)) return ref.origin;
  } catch { /* ไม่มี Referer */ }
  const front = String(process.env.FRONTEND_URL || '').split(',')[0].trim();
  if (front) return front;
  return `${req.protocol}://${req.get('host')}`;
}

module.exports = {
  buildStudentExportWorkbook, studentToExportRow, exportBaseUrl,
  STUDENT_EXPORT_INCLUDE, EXPORT_HEADERS, ALL_DOCS_HEADERS, DOC_COLUMNS,
};
