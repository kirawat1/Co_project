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
};

// [หัวคอลัมน์, ความกว้าง (ตัวอักษร)]
const COLUMNS = [
  ['รหัสนักศึกษา', 14],
  ['ชื่อ-นามสกุล', 28],
  ['สาขา', 22],
  ['ระบบการศึกษา', 13],
  ['ชั้นปี', 7],
  ['อีเมล', 28],
  ['เบอร์โทร', 13],
  ['รอบสหกิจ', 10],
  ['สถานะสหกิจ', 26],
  ['บริษัท', 32],
  ['จังหวัด', 14],
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
const EXPORT_HEADERS = COLUMNS.map(([header]) => header);

const dash = (value) => {
  const text = value == null ? '' : String(value).trim();
  return text || '-';
};

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

function mentorsText(mentors) {
  if (!Array.isArray(mentors) || mentors.length === 0) return '-';
  return mentors
    .map((m) => [m.firstName, m.lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' ') + (m.phone ? ` (${String(m.phone).trim()})` : ''))
    .join(', ');
}

function studentToExportRow(student, criteria) {
  const prefixLabel = PREFIX_LABEL_TH[student.prefix] || '';
  const fullName = [prefixLabel, student.firstName, student.lastName].filter(Boolean).join(' ');
  const coop = student.coop;
  const period = coop?.coopPeriod;
  const sup = student.supervisionAppointment;

  return {
    'รหัสนักศึกษา': student.studentId,
    'ชื่อ-นามสกุล': fullName,
    // major เก็บเป็นรหัสสาขา (CS) — ใช้ชื่อไทยจาก criteria ถ้ามี
    'สาขา': dash(resolveMajorNameTh(student.major, criteria) || student.major),
    'ระบบการศึกษา': STUDY_PROGRAM_LABEL_TH[student.studyProgram] || '-',
    'ชั้นปี': dash(student.year),
    'อีเมล': dash(student.email || student.user?.email),
    'เบอร์โทร': dash(student.phone),
    'รอบสหกิจ': period ? `${period.semester}/${period.academicYear}` : '-',
    'สถานะสหกิจ': getStatusLabelTh(coop?.status),
    'บริษัท': dash(coop?.company?.name),
    'จังหวัด': dash(coop?.company?.province),
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
  };
}

function buildStudentExportWorkbook(students, { criteria } = {}) {
  const rows = students.map((s) => studentToExportRow(s, criteria));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  worksheet['!cols'] = COLUMNS.map(([, wch]) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'นักศึกษา');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildStudentExportWorkbook, studentToExportRow, STUDENT_EXPORT_INCLUDE, EXPORT_HEADERS };
