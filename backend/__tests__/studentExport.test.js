const XLSX = require('xlsx');
const { buildStudentExportWorkbook, EXPORT_HEADERS } = require('../utils/studentExport');

function sheetToRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

function sheetHeaders(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
}

const criteria = [{ major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' }];

describe('buildStudentExportWorkbook', () => {
  test('สร้าง workbook ที่มี sheet ชื่อ "นักศึกษา" และ header ครบตามลำดับ แม้ไม่มีข้อมูล', () => {
    const buffer = buildStudentExportWorkbook([]);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['นักศึกษา']);
    expect(sheetHeaders(buffer)).toEqual(EXPORT_HEADERS);
    expect(EXPORT_HEADERS).toEqual(expect.arrayContaining([
      'ระบบการศึกษา', 'อาจารย์ที่ปรึกษาโครงงานสหกิจ', 'อาจารย์นิเทศ', 'อาจารย์นิเทศร่วม', 'วันนิเทศ', 'สถานะนิเทศ',
    ]));
  });

  test('แปลง 1 student เป็น 1 แถว พร้อม map ทุกคอลัมน์ถูกต้อง', () => {
    const students = [{
      studentId: '643021218',
      prefix: 'MR',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      major: 'CS',
      studyProgram: 'special',
      year: '4',
      email: null,
      phone: '0812345678',
      user: { email: 'somchai@kkumail.com' },
      coop: {
        status: 'INTERNSHIP_STARTED',
        company: { name: 'บริษัท ทดสอบ จำกัด', province: 'ขอนแก่น' },
        coopPeriod: { semester: 1, academicYear: '2569' },
        actualStartDate: new Date('2026-11-01T00:00:00+07:00'),
        actualEndDate: new Date('2027-02-28T00:00:00+07:00'),
        mentors: [
          { firstName: 'พี่เลี้ยง', lastName: 'หนึ่ง', phone: '0899999999' },
          { firstName: 'พี่เลี้ยง', lastName: 'สอง', phone: null },
        ],
      },
      generalAdvisor: { firstName: 'อาจารย์ก', lastName: 'นามสกุลก' },
      coopAdvisor: { prefix: 'ผศ.ดร.', firstName: 'อาจารย์ข', lastName: 'นามสกุลข' },
      supervisionAppointment: {
        status: 'LETTER_UPLOADED',
        supervisionType: 'ONSITE',
        confirmedDate: new Date('2026-12-08T10:15:00+07:00'),
        coTeacherName: 'อ.ร่วม หนึ่ง, อ.ร่วม สอง',
        teacher: { prefix: 'อ.', firstName: 'นิเทศ', lastName: 'หลัก' },
      },
      t003Form: { reportTitleTh: 'ระบบจัดการคลังสินค้า' },
    }];

    const rows = sheetToRows(buildStudentExportWorkbook(students, { criteria }));

    expect(rows).toEqual([{
      'รหัสนักศึกษา': '643021218',
      'ชื่อ-นามสกุล': 'นาย สมชาย ใจดี',
      'สาขา': 'วิทยาการคอมพิวเตอร์',
      'ระบบการศึกษา': 'ภาคพิเศษ',
      'ชั้นปี': '4',
      'อีเมล': 'somchai@kkumail.com',
      'เบอร์โทร': '0812345678',
      'รอบสหกิจ': '1/2569',
      'สถานะสหกิจ': 'ออกฝึกสหกิจ',
      'บริษัท': 'บริษัท ทดสอบ จำกัด',
      'จังหวัด': 'ขอนแก่น',
      'พี่เลี้ยง': 'พี่เลี้ยง หนึ่ง (0899999999), พี่เลี้ยง สอง',
      'วันเริ่มฝึกงาน': '1 พ.ย. 2569',
      'วันสิ้นสุดฝึกงาน': '28 ก.พ. 2570',
      'ชื่อรายงาน (T003)': 'ระบบจัดการคลังสินค้า',
      'อาจารย์ที่ปรึกษาทั่วไป': 'อาจารย์ก นามสกุลก',
      'อาจารย์ที่ปรึกษาโครงงานสหกิจ': 'ผศ.ดร.อาจารย์ข นามสกุลข',
      'อาจารย์นิเทศ': 'อ.นิเทศ หลัก',
      'อาจารย์นิเทศร่วม': 'อ.ร่วม หนึ่ง, อ.ร่วม สอง',
      'วันนิเทศ': '8 ธ.ค. 2569 10:15 น.',
      'รูปแบบนิเทศ': 'ออนไซต์',
      'สถานะนิเทศ': 'อนุมัติหนังสือนิเทศแล้ว',
    }]);
  });

  test('ใส่ "-" เมื่อ ไม่มี บริษัท/อาจารย์/coop/นัดนิเทศ · สถานะนิเทศ = ยังไม่นัดนิเทศ', () => {
    const students = [{
      studentId: '643021219',
      prefix: 'MS',
      firstName: 'สมหญิง',
      lastName: 'ใจงาม',
      major: null,
      studyProgram: null,
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
      'ระบบการศึกษา': '-',
      'ชั้นปี': '-',
      'อีเมล': '-',
      'เบอร์โทร': '-',
      'รอบสหกิจ': '-',
      'สถานะสหกิจ': 'ยังไม่ยื่นสหกิจ',
      'บริษัท': '-',
      'จังหวัด': '-',
      'พี่เลี้ยง': '-',
      'วันเริ่มฝึกงาน': '-',
      'วันสิ้นสุดฝึกงาน': '-',
      'ชื่อรายงาน (T003)': '-',
      'อาจารย์ที่ปรึกษาทั่วไป': '-',
      'อาจารย์ที่ปรึกษาโครงงานสหกิจ': '-',
      'อาจารย์นิเทศ': '-',
      'อาจารย์นิเทศร่วม': '-',
      'วันนิเทศ': '-',
      'รูปแบบนิเทศ': '-',
      'สถานะนิเทศ': 'ยังไม่นัดนิเทศ',
    });
  });

  test('สาขา: ไม่มีชื่อไทยใน criteria ใช้ค่าเดิม · ระบบการศึกษาภาคปกติ · อีเมลนักศึกษามาก่อนอีเมลบัญชี · นัดออนไลน์ยังไม่ยืนยันวัน', () => {
    const rows = sheetToRows(buildStudentExportWorkbook([{
      studentId: '1', prefix: null, firstName: 'ก', lastName: 'ข', major: 'AI', studyProgram: 'normal',
      email: 'student@kku.ac.th', user: { email: 'login@kku.ac.th' },
      coop: { status: 'INTERNSHIP_STARTED', company: null, mentors: [] },
      supervisionAppointment: { status: 'PENDING_TEACHER', supervisionType: 'ONLINE', confirmedDate: null, coTeacherName: null, teacher: null },
    }], { criteria }));

    expect(rows[0]).toMatchObject({
      'สาขา': 'AI',
      'ระบบการศึกษา': 'ภาคปกติ',
      'อีเมล': 'student@kku.ac.th',
      'พี่เลี้ยง': '-',
      'วันนิเทศ': '-',
      'รูปแบบนิเทศ': 'ออนไลน์',
      'สถานะนิเทศ': 'รออาจารย์เลือกวันนิเทศ',
    });
  });
});
