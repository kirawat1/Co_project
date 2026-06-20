const XLSX = require('xlsx');
const { buildStudentExportWorkbook } = require('../utils/studentExport');

function sheetToRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

describe('buildStudentExportWorkbook', () => {
  test('สร้าง workbook ที่มี sheet ชื่อ "นักศึกษา" และ header ครบ 8 คอลัมน์', () => {
    const buffer = buildStudentExportWorkbook([]);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['นักศึกษา']);
  });

  test('แปลง 1 student เป็น 1 แถว พร้อม map ทุกคอลัมน์ถูกต้อง', () => {
    const students = [{
      studentId: '643021218',
      prefix: 'MR',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      major: 'วิทยาการคอมพิวเตอร์',
      year: '4',
      coop: { status: 'QUALIFIED', company: { name: 'บริษัท ทดสอบ จำกัด' } },
      generalAdvisor: { firstName: 'อาจารย์ก', lastName: 'นามสกุลก' },
      coopAdvisor: { firstName: 'อาจารย์ข', lastName: 'นามสกุลข' },
    }];

    const rows = sheetToRows(buildStudentExportWorkbook(students));

    expect(rows).toEqual([{
      'รหัสนักศึกษา': '643021218',
      'ชื่อ-นามสกุล': 'นาย สมชาย ใจดี',
      'สาขา': 'วิทยาการคอมพิวเตอร์',
      'ชั้นปี': '4',
      'สถานะสหกิจ': 'ผ่านคุณสมบัติ',
      'บริษัท': 'บริษัท ทดสอบ จำกัด',
      'อาจารย์ที่ปรึกษาทั่วไป': 'อาจารย์ก นามสกุลก',
      'อาจารย์ที่ปรึกษาสหกิจ': 'อาจารย์ข นามสกุลข',
    }]);
  });

  test('ใส่ "-" เมื่อ ไม่มี บริษัท/อาจารย์ที่ปรึกษา/coop', () => {
    const students = [{
      studentId: '643021219',
      prefix: 'MS',
      firstName: 'สมหญิง',
      lastName: 'ใจงาม',
      major: null,
      year: null,
      coop: null,
      generalAdvisor: null,
      coopAdvisor: null,
    }];

    const rows = sheetToRows(buildStudentExportWorkbook(students));

    expect(rows[0]).toEqual({
      'รหัสนักศึกษา': '643021219',
      'ชื่อ-นามสกุล': 'นางสาว สมหญิง ใจงาม',
      'สาขา': '-',
      'ชั้นปี': '-',
      'สถานะสหกิจ': 'ยังไม่ยื่นสหกิจ',
      'บริษัท': '-',
      'อาจารย์ที่ปรึกษาทั่วไป': '-',
      'อาจารย์ที่ปรึกษาสหกิจ': '-',
    });
  });
});
