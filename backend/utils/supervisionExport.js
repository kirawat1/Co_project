const XLSX = require('xlsx');
const { resolveSlotEnd, dateKey, timeKey } = require('./supervisionClash');

const SUPERVISION_TYPE_LABEL_TH = { ONLINE: 'ออนไลน์', ONSITE: 'ออนไซต์' };
const SUPERVISION_STATUS_LABEL_TH = {
  DATE_CONFIRMED: 'รอเจ้าหน้าที่พิจารณาหนังสือนิเทศ',
  LETTER_UPLOADED: 'อนุมัติหนังสือนิเทศแล้ว',
  COMPLETED: 'นิเทศเสร็จสิ้น',
};
const PREFIX_LABEL_TH = { MR: 'นาย', MS: 'นางสาว' };
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const TEACHER_NAME_SELECT = { select: { prefix: true, firstName: true, lastName: true } };

// รายการนิเทศที่ยืนยันวันแล้ว — ใช้ทั้งตารางบนหน้าเว็บและไฟล์ Excel
const SUPERVISION_SCHEDULE_SELECT = {
  id: true,
  confirmedDate: true,
  confirmedEndDate: true,
  proposedDates: true,
  supervisionType: true,
  status: true,
  coTeacherName: true,
  onlineLink: true,
  groupId: true,
  teacher: TEACHER_NAME_SELECT,
  student: {
    select: {
      studentId: true, prefix: true, firstName: true, lastName: true, major: true,
      coopAdvisor: TEACHER_NAME_SELECT,
      coop: {
        select: {
          coopPeriodId: true,
          company: { select: { name: true, province: true } },
        },
      },
    },
  },
};

const dash = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? '-' : s;
};

function teacherName(teacher) {
  if (!teacher) return '';
  return `${teacher.prefix || ''}${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
}

function thaiDate(date) {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

// ตารางจริงของคณะแบ่งเป็นรอบเช้า/บ่าย — ดูจากเวลาเริ่ม
const sessionLabel = (start) => (start.getHours() < 12 ? 'เช้า' : 'บ่าย');

// แถวเดียวของตารางนิเทศ (ใช้ร่วมกันระหว่างหน้าเว็บกับ Excel)
function toScheduleRow(appt) {
  const start = new Date(appt.confirmedDate);
  const end = resolveSlotEnd(start, appt);
  const student = appt.student || {};
  const prefixLabel = PREFIX_LABEL_TH[student.prefix] || '';
  return {
    id: appt.id,
    date: dateKey(start),
    dateLabel: thaiDate(start),
    session: sessionLabel(start),
    start: timeKey(start),
    end: timeKey(end),
    studentCode: student.studentId || '',
    studentName: [prefixLabel, student.firstName, student.lastName].filter(Boolean).join(' '),
    companyName: student.coop?.company?.name || '',
    companyProvince: student.coop?.company?.province || '',
    teacherName: teacherName(appt.teacher),
    coTeacherName: appt.coTeacherName || '',
    coopAdvisorName: teacherName(student.coopAdvisor),
    supervisionType: appt.supervisionType,
    typeLabel: SUPERVISION_TYPE_LABEL_TH[appt.supervisionType] || '-',
    status: appt.status,
    statusLabel: SUPERVISION_STATUS_LABEL_TH[appt.status] || appt.status,
    onlineLink: appt.onlineLink || '',
    groupId: appt.groupId || null,
  };
}

// [หัวคอลัมน์, ความกว้าง]
const COLUMNS = [
  ['วันที่', 16],
  ['ช่วง', 7],
  ['เวลา', 14],
  ['รหัสนักศึกษา', 14],
  ['ชื่อ-นามสกุล', 28],
  ['บริษัท', 34],
  ['จังหวัด', 14],
  ['อาจารย์ผู้นิเทศ', 26],
  ['อาจารย์นิเทศร่วม', 30],
  ['อาจารย์ที่ปรึกษาโครงงานสหกิจ', 26],
  ['รูปแบบ', 10],
  ['สถานะ', 28],
];
const EXPORT_HEADERS = COLUMNS.map(([h]) => h);

function rowToExcel(row) {
  return {
    'วันที่': row.dateLabel,
    'ช่วง': row.session,
    'เวลา': `${row.start}-${row.end}`,
    'รหัสนักศึกษา': dash(row.studentCode),
    'ชื่อ-นามสกุล': dash(row.studentName),
    'บริษัท': dash(row.companyName),
    'จังหวัด': dash(row.companyProvince),
    'อาจารย์ผู้นิเทศ': dash(row.teacherName),
    'อาจารย์นิเทศร่วม': dash(row.coTeacherName),
    'อาจารย์ที่ปรึกษาโครงงานสหกิจ': dash(row.coopAdvisorName),
    'รูปแบบ': row.typeLabel,
    'สถานะ': row.statusLabel,
  };
}

// เรียงตามวันแล้วเวลา — ตารางนิเทศอ่านตามลำดับวันเสมอ
function sortSchedule(rows) {
  return [...rows].sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
}

function buildSupervisionScheduleWorkbook(appointments) {
  const rows = sortSchedule(appointments.map(toScheduleRow)).map(rowToExcel);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  worksheet['!cols'] = COLUMNS.map(([, wch]) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ตารางนิเทศ');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  SUPERVISION_SCHEDULE_SELECT,
  toScheduleRow,
  sortSchedule,
  rowToExcel,
  buildSupervisionScheduleWorkbook,
  EXPORT_HEADERS,
};
