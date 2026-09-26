const XLSX = require('xlsx');
const { buildStudentExportWorkbook, EXPORT_HEADERS, ALL_DOCS_HEADERS, DOC_COLUMNS } = require('../utils/studentExport');

// คอลัมน์ไฟล์เอกสาร — นักศึกษาที่ยังไม่มีไฟล์แสดง '-'
const NO_FILES = Object.fromEntries(DOC_COLUMNS.map(([h]) => [h, '-']));

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

    expect(workbook.SheetNames).toEqual(['นักศึกษา', 'เอกสารทั้งหมด']);
    expect(sheetHeaders(buffer)).toEqual(EXPORT_HEADERS);
    expect(EXPORT_HEADERS).toEqual(expect.arrayContaining([
      'รูปแบบการศึกษา', 'อาจารย์ที่ปรึกษาโครงงานสหกิจ', 'อาจารย์นิเทศ', 'อาจารย์นิเทศร่วม', 'วันนิเทศ', 'สถานะนิเทศ',
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
        company: {
          name: 'บริษัท ทดสอบ จำกัด', addressNo: '123/4', moo: '5', soi: 'สุขใจ', road: 'มิตรภาพ',
          subDistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', zipcode: '40000',
          address: 'ข้อความเก่า ไม่ควรใช้เมื่อมีช่องแยก',
        },
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
      'หลักสูตร': 'วิทยาการคอมพิวเตอร์',
      'รูปแบบการศึกษา': 'ภาคพิเศษ',
      'ชั้นปี': '4',
      'อีเมล': 'somchai@kkumail.com',
      'เบอร์โทร': '0812345678',
      'รอบสหกิจ': '1/2569',
      'สถานะสหกิจ': 'ออกฝึกสหกิจ',
      'บริษัทที่ไปฝึกงาน': 'บริษัท ทดสอบ จำกัด',
      'ที่อยู่บริษัท': '123/4 หมู่ 5 ซอยสุขใจ ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
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
      ...NO_FILES,
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
      'หลักสูตร': '-',
      'รูปแบบการศึกษา': '-',
      'ชั้นปี': '-',
      'อีเมล': '-',
      'เบอร์โทร': '-',
      'รอบสหกิจ': '-',
      'สถานะสหกิจ': 'ยังไม่ยื่นสหกิจ',
      'บริษัทที่ไปฝึกงาน': '-',
      'ที่อยู่บริษัท': '-',
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
      ...NO_FILES,
    });
  });

  test('หลักสูตร: ไม่มีชื่อไทยใน criteria ใช้ค่าเดิม · รูปแบบการศึกษาภาคปกติ · อีเมลนักศึกษามาก่อนอีเมลบัญชี · นัดออนไลน์ยังไม่ยืนยันวัน', () => {
    const rows = sheetToRows(buildStudentExportWorkbook([{
      studentId: '1', prefix: null, firstName: 'ก', lastName: 'ข', major: 'AI', studyProgram: 'normal',
      email: 'student@kku.ac.th', user: { email: 'login@kku.ac.th' },
      coop: { status: 'INTERNSHIP_STARTED', company: null, mentors: [] },
      supervisionAppointment: { status: 'PENDING_TEACHER', supervisionType: 'ONLINE', confirmedDate: null, coTeacherName: null, teacher: null },
    }], { criteria }));

    expect(rows[0]).toMatchObject({
      'บริษัทที่ไปฝึกงาน': '-',
      'ที่อยู่บริษัท': '-',
      'หลักสูตร': 'AI',
      'รูปแบบการศึกษา': 'ภาคปกติ',
      'อีเมล': 'student@kku.ac.th',
      'พี่เลี้ยง': '-',
      'วันนิเทศ': '-',
      'รูปแบบนิเทศ': 'ออนไลน์',
      'สถานะนิเทศ': 'รออาจารย์เลือกวันนิเทศ',
    });
  });

  test.each([
    [{ name: 'A', addressNo: '99', road: 'พระราม 9', subDistrict: 'ห้วยขวาง', district: 'ห้วยขวาง', province: 'กรุงเทพมหานคร', zipcode: '10310' },
      '99 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310'],
    [{ name: 'B', address: '  88 ถนนศรีจันทร์ ขอนแก่น  ' }, '88 ถนนศรีจันทร์ ขอนแก่น'],
    [{ name: 'C', soi: 'ซอยรุ่งเรือง', road: 'ถนนหน้าเมือง', subDistrict: 'ต.ในเมือง', province: 'จ.ขอนแก่น' },
      'ซอยรุ่งเรือง ถนนหน้าเมือง ต.ในเมือง จ.ขอนแก่น'],
    [{ name: 'D', addressNo: '11', moo: '-', soi: '-', road: ' – ', subDistrict: 'ในเมือง', district: 'เมือง', province: 'ขอนแก่น', zipcode: 'ไม่มี' },
      '11 ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น'],
  ])('ที่อยู่บริษัท: กรุงเทพฯ ใช้แขวง/เขต · ไม่มีช่องแยกใช้ address เดิม · ไม่เติมคำนำหน้าซ้ำ (%#)', (company, expected) => {
    const rows = sheetToRows(buildStudentExportWorkbook([{ studentId: '1', firstName: 'ก', lastName: 'ข', coop: { status: 'INTERNSHIP_STARTED', company } }]));
    expect(rows[0]['ที่อยู่บริษัท']).toBe(expected);
  });
});

describe('ลิงก์เอกสารในไฟล์ export', () => {
  const BASE = 'https://coop.computing.kku.ac.th';
  const student = {
    studentId: '643021218', prefix: 'MR', firstName: 'สมชาย', lastName: 'ใจดี',
    coop: { status: 'INTERNSHIP_STARTED', reqLetterUrl: 'req-letter.pdf' },
    documents: [
      // ชื่อเก่า/ใหม่ปนกัน — ใช้ไฟล์ล่าสุด
      { type: 'TRANSCRIPT', name: 'transcript-old.pdf', path: 'old.pdf', status: 'REJECTED', uploadedAt: '2026-06-01T03:00:00Z' },
      { type: 'CP-TRANSCRIPT', name: 'transcript ใหม่.pdf', path: 'new file.pdf', status: 'APPROVED', uploadedAt: '2026-06-02T03:00:00Z' },
      { type: 'APPLICATION_DOC', name: 'แนบ1.pdf', path: 'a1.pdf', status: 'WAITING', uploadedAt: '2026-05-01T03:00:00Z' },
      { type: 'APPLICATION_DOC', name: 'แนบ2.pdf', path: 'a2.pdf', status: 'WAITING', uploadedAt: '2026-05-01T04:00:00Z' },
      { type: 'CUSTOM_KEY', name: 'อื่น.pdf', path: 'c.pdf', status: 'WAITING', uploadedAt: '2026-05-02T03:00:00Z' },
    ],
  };

  function read(opts) {
    return XLSX.read(buildStudentExportWorkbook([student], opts), { type: 'buffer' });
  }
  const linkOf = (sheet, header, headers, row = 1) =>
    sheet[XLSX.utils.encode_cell({ r: row, c: headers.indexOf(header) })]?.l?.Target;

  test('คอลัมน์ไฟล์ใช้ไฟล์ล่าสุด และกดเปิดได้ด้วยลิงก์เต็ม (encode ชื่อไฟล์)', () => {
    const wb = read({ baseUrl: BASE + '/' });
    const sheet = wb.Sheets['นักศึกษา'];
    const row = XLSX.utils.sheet_to_json(sheet)[0];
    expect(row['ไฟล์: Transcript']).toBe('transcript ใหม่.pdf');
    expect(linkOf(sheet, 'ไฟล์: Transcript', EXPORT_HEADERS)).toBe(`${BASE}/uploads/new%20file.pdf`);
    // ไม่มีใน documents แต่มีใน coop.reqLetterUrl
    expect(linkOf(sheet, 'ไฟล์: หนังสือขอความอนุเคราะห์', EXPORT_HEADERS)).toBe(`${BASE}/uploads/req-letter.pdf`);
    expect(row['ไฟล์: T002']).toBe('-');
    expect(linkOf(sheet, 'ไฟล์: T002', EXPORT_HEADERS)).toBeUndefined();
  });

  test('ชีต "เอกสารทั้งหมด" มีทุกไฟล์ รวมชนิดที่มีหลายไฟล์ และชื่อเอกสารที่เจ้าหน้าที่เพิ่มเอง', () => {
    const wb = read({ baseUrl: BASE, requirements: [{ docKey: 'CUSTOM_KEY', title: 'ใบรับรองแพทย์' }] });
    const sheet = wb.Sheets['เอกสารทั้งหมด'];
    const rows = XLSX.utils.sheet_to_json(sheet);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r['เอกสาร'])).toEqual(['Transcript', 'Transcript', 'เอกสารแนบคำร้องสหกิจ', 'เอกสารแนบคำร้องสหกิจ', 'ใบรับรองแพทย์']);
    expect(rows[1]['สถานะเอกสาร']).toBe('ผ่าน');
    expect(linkOf(sheet, 'ชื่อไฟล์ (กดเปิด)', ALL_DOCS_HEADERS, 4)).toBe(`${BASE}/uploads/a2.pdf`);
  });

  test('ไม่ส่ง baseUrl = แสดงชื่อไฟล์แต่ไม่มีลิงก์', () => {
    const wb = read({});
    expect(linkOf(wb.Sheets['นักศึกษา'], 'ไฟล์: Transcript', EXPORT_HEADERS)).toBeUndefined();
  });
});

describe('exportBaseUrl', () => {
  const { exportBaseUrl } = require('../utils/studentExport');
  const req = (headers) => ({ protocol: 'http', get: (h) => headers[h.toLowerCase()] });
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  test('ใช้ PUBLIC_BASE_URL ก่อน → Referer → FRONTEND_URL ตัวแรก', () => {
    process.env.PUBLIC_BASE_URL = 'https://env.example';
    expect(exportBaseUrl(req({ referer: 'https://coop.computing.kku.ac.th/admin/dashboard' }))).toBe('https://env.example');
    delete process.env.PUBLIC_BASE_URL;
    expect(exportBaseUrl(req({ referer: 'https://coop.computing.kku.ac.th/admin/dashboard' }))).toBe('https://coop.computing.kku.ac.th');
    process.env.FRONTEND_URL = 'https://a.example, https://b.example';
    expect(exportBaseUrl(req({}))).toBe('https://a.example');
  });
});
