const XLSX = require('xlsx');
const { getStatusLabelTh } = require('./coopStatusLabels');

const PREFIX_LABEL_TH = { MR: 'นาย', MS: 'นางสาว' };

function advisorName(advisor) {
  if (!advisor) return '-';
  return `${advisor.firstName} ${advisor.lastName}`;
}

function studentToExportRow(student) {
  const prefixLabel = PREFIX_LABEL_TH[student.prefix] || '';
  const fullName = [prefixLabel, student.firstName, student.lastName].filter(Boolean).join(' ');

  return {
    'รหัสนักศึกษา': student.studentId,
    'ชื่อ-นามสกุล': fullName,
    'สาขา': student.major || '-',
    'ชั้นปี': student.year || '-',
    'สถานะสหกิจ': getStatusLabelTh(student.coop?.status),
    'บริษัท': student.coop?.company?.name || '-',
    'อาจารย์ที่ปรึกษาทั่วไป': advisorName(student.generalAdvisor),
    'อาจารย์ที่ปรึกษาสหกิจ': advisorName(student.coopAdvisor),
  };
}

function buildStudentExportWorkbook(students) {
  const rows = students.map(studentToExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'สาขา', 'ชั้นปี',
      'สถานะสหกิจ', 'บริษัท', 'อาจารย์ที่ปรึกษาทั่วไป', 'อาจารย์ที่ปรึกษาสหกิจ',
    ],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'นักศึกษา');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildStudentExportWorkbook, studentToExportRow };
