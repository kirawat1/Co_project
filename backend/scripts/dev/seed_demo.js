// scripts/dev/seed_demo.js
// สร้างข้อมูลตัวอย่างครบทุกขั้นของกระบวนการสหกิจ สำหรับเปิดระบบดู/ใช้สอน — ชื่อคน บริษัท ลิงก์ เป็นข้อมูลสมมติทั้งหมด
//
// ใช้กับ "ฐานข้อมูลว่างที่เพิ่ง migrate" เท่านั้น — ถ้ามีบัญชีผู้ใช้อยู่แล้ว สคริปต์จะหยุดทันที (กันรันใส่ระบบจริง)
//
// ขั้นตอน (ในโฟลเดอร์ backend, ตั้ง DATABASE_URL ใน .env ให้ชี้ฐานใหม่ เช่น .../coop_demo):
//   npx prisma migrate deploy
//   node scripts/dev/seed_demo.js                      รหัสผ่านทุกบัญชี = Demo@1234
//   node scripts/dev/seed_demo.js --password=รหัสอื่น   กำหนดรหัสผ่านเอง
//
// ได้: เจ้าหน้าที่ 1 · อาจารย์ 5 (ประจำวิชา 3 หลักสูตร + ที่ปรึกษา) · บริษัท 4 · นักศึกษา 18 คนกระจายทุกสถานะ
//      รอบสหกิจ 2 รอบ · ฟอร์ม T002/T003 · นัดนิเทศ 3 แบบ · ประกาศ 3 · เรื่องแจ้งปัญหา 2 · บันทึกการใช้งาน
// ไฟล์เอกสารที่อัปโหลดเป็น PDF ตัวอย่างหน้าเดียว (backend/uploads/demo-*.pdf)

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prismaClient');

const PASSWORD = (process.argv.find((a) => a.startsWith('--password=')) || '--password=Demo@1234').slice('--password='.length);
const UPLOADS = path.join(__dirname, '../../uploads');

const DAY = 86400000;
const d = (n) => new Date(Date.now() + n * DAY);
const ymd = (n) => new Date(Date.now() + n * DAY).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const at = (n, h = 9) => new Date(`${ymd(n)}T${String(h).padStart(2, '0')}:00:00+07:00`);
const ago = (min) => new Date(Date.now() - min * 60000);

// PDF หน้าเดียวที่ถูกต้องตามรูปแบบ (คำนวณตำแหน่ง xref เอง) — ใช้แทนไฟล์ที่นักศึกษาอัปโหลด
function samplePdf(label) {
  const text = `Demo document - ${label}`.replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 760 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
let fileN = 0;
const file = (label) => {
  const name = `demo-${++fileN}-${label}.pdf`;
  fs.writeFileSync(path.join(UPLOADS, name), samplePdf(label));
  return name;
};

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.error(`หยุด: ฐานข้อมูลนี้มีบัญชีผู้ใช้อยู่แล้ว ${existing} บัญชี — สคริปต์นี้ใช้กับฐานว่างที่เพิ่ง migrate เท่านั้น`);
    console.error('สร้างฐานใหม่ (เช่น coop_demo) แล้วตั้ง DATABASE_URL ใน .env ให้ชี้ฐานนั้น จากนั้นรัน npx prisma migrate deploy');
    process.exit(1);
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  const PW = bcrypt.hashSync(PASSWORD, 10);

  // ── ค่าตั้งค่าระบบ (ตัวอย่าง) ──
  const config = {
    DEAN_INFO: { deanName: 'รองศาสตราจารย์ ดร.ตัวอย่าง ใจดี', deanPosition: 'คณบดีวิทยาลัยการคอมพิวเตอร์' },
    GATEWAY_SETTINGS: {
      gradeSheetDescription: 'กรุณา Make a Copy แบบฟอร์มด้านล่าง แนบภาพหน้าจอผลการเรียนจากระบบ REG กรอกข้อมูลให้ครบ แล้วนำลิงก์ที่แชร์มาใส่ในช่องด้านล่าง',
      gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/EXAMPLE/copy',
      gradeSheetLinkText: '📋 Make a Copy แบบฟอร์ม',
      uploadDescription: 'เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)',
    },
    EVALUATION_FORMS: {
      instructionText: 'ขอให้นักศึกษาขอความอนุเคราะห์พี่เลี้ยงประเมินผลการปฏิบัติงาน (ก่อนกลับ 1 สัปดาห์) ตามแบบฟอร์ม T005 และ T006',
      ccEmails: '',
      t005Link: 'https://example.com/t005',
      t006Link: 'https://example.com/t006',
      templateLink: 'https://example.com/email-template',
    },
    CONFIG_T007: { instructionText: 'แบบประเมินสถานประกอบการ (T007) หลังปฏิบัติสหกิจศึกษาเสร็จแล้ว', t007Link: 'https://example.com/t007' },
    T000_CONFIG: { startDate: ymd(-30), endDate: ymd(60), isOpen: true },
    T002_CONFIG: { startDate: ymd(-30), endDate: ymd(90), isOpen: true },
    T003_CONFIG: { startDate: ymd(-30), endDate: ymd(100), isOpen: true },
  };
  for (const [key, value] of Object.entries(config)) await prisma.systemConfig.create({ data: { key, value: JSON.stringify(value) } });

  const majors = [['CS', 'วิทยาการคอมพิวเตอร์'], ['IT', 'เทคโนโลยีสารสนเทศ'], ['GIS', 'ภูมิสารสนเทศศาสตร์'], ['AI', 'ปัญญาประดิษฐ์'], ['CYB', 'ความมั่นคงปลอดภัยไซเบอร์']];
  for (const [major, nameTh] of majors) await prisma.coopCriteria.create({ data: { major, nameTh } });
  const reqs = [
    ['CP-TRANSCRIPT', 'ใบรับรองผลการศึกษา (Transcript)'], ['CP-CV', 'ประวัติส่วนตัว (CV / Resume)'], ['CP-STUDENT_CARD', 'สำเนาบัตรนักศึกษา'],
    ['CP-CITIZEN_CARD', 'สำเนาบัตรประชาชน'], ['CP-PARENTAL_CONSENT', 'ใบยินยอมผู้ปกครอง'],
  ];
  for (const [docKey, title] of reqs) await prisma.documentRequirement.create({ data: { docKey, title, isRequired: true, isActive: true } });

  // ── รอบสหกิจ: 2/2569 เปิดอยู่ · 1/2569 ปิดแล้ว ──
  const win = { startDate: d(-30), endDate: d(150) };
  const deadlines = { T000: { due: ymd(20) }, T002: { due: ymd(75) }, T003: { due: ymd(90) }, T005_T006: { due: ymd(120) }, T007: { due: ymd(125) }, T008: { due: ymd(140) } };
  const period = await prisma.coopPeriod.create({
    data: {
      academicYear: '2569', semester: 2, ...win,
      majors: { create: majors.map(([major]) => ({ major, ...win, isActive: true, isSupervisionOpen: true, supervisionStartDate: d(30), supervisionEndDate: d(110), deadlines })) },
    },
  });
  await prisma.coopPeriod.create({ data: { academicYear: '2569', semester: 1, startDate: d(-210), endDate: d(-60), majors: { create: majors.map(([major]) => ({ major, startDate: d(-210), endDate: d(-60), isActive: false })) } } });

  // ── ผู้ใช้ ──
  const accounts = [];
  const user = async (email, role, label) => {
    accounts.push([role, email, label]);
    return prisma.user.create({ data: { username: email, email, password: PW, role } });
  };
  const staffU = await user('staff@example.ac.th', 'staff', 'เจ้าหน้าที่ พรทิพย์ ใจดี');
  await prisma.staffProfile.create({ data: { userId: staffU.id, firstName: 'พรทิพย์', lastName: 'ใจดี', phone: '043-000000' } });
  const teacher = async (email, prefix, first, last, major, coop = [], label = '') => {
    const u = await user(email, 'teacher', `อาจารย์ ${prefix}${first} ${last}${label}`);
    const t = await prisma.teacher.create({ data: { userId: u.id, email, prefix, firstName: first, lastName: last, major, faculty: 'วิทยาลัยการคอมพิวเตอร์', phone: '043-000000', isCoopTeacher: coop.length > 0 } });
    if (coop.length) await prisma.coopTeacherMajor.createMany({ data: coop.map((m) => ({ teacherId: t.id, major: m })) });
    return t;
  };
  const tCoop = await teacher('somchai.r@example.ac.th', 'ผศ.ดร.', 'สมชาย', 'รักเรียน', 'CS', ['CS'], ' (ประจำวิชา CS)');
  const tAdv = await teacher('wilaiwan.s@example.ac.th', 'อ.ดร.', 'วิไลวรรณ', 'ศรีสุข', 'CS', [], ' (ที่ปรึกษาสหกิจ)');
  const tAdv2 = await teacher('kitti.p@example.ac.th', 'อ.', 'กิตติ', 'พัฒนากุล', 'CS', [], ' (ที่ปรึกษาทั่วไป)');
  await teacher('prasert.m@example.ac.th', 'รศ.ดร.', 'ประเสริฐ', 'มั่นคง', 'AI', ['AI'], ' (ประจำวิชา AI)');
  await teacher('nattaya.k@example.ac.th', 'ผศ.', 'ณัฐธยา', 'แก้วมณี', 'IT', ['IT'], ' (ประจำวิชา IT)');

  // ── บริษัท · ผู้ติดต่อ (HR) · พี่เลี้ยง ──
  const company = async (name, nameEn, province, district, hr, mentor) => {
    const slug = nameEn.split(' ')[0].toLowerCase();
    const c = await prisma.company.create({ data: { name, nameEn, addressNo: '99/9', road: 'มิตรภาพ', subDistrict: 'ในเมือง', district, province, zipcode: province === 'ขอนแก่น' ? '40000' : '10400', address: `99/9 ถนนมิตรภาพ ${district} ${province}`, phone: '02-000-0000', email: `hr@${slug}.example.com`, website: `https://www.${slug}.example.com`, createdById: staffU.id } });
    const contact = await prisma.companyContact.create({ data: { companyId: c.id, firstName: hr[0], lastName: hr[1], position: 'ผู้จัดการฝ่ายทรัพยากรบุคคล', department: 'ฝ่ายทรัพยากรบุคคล', email: `hr@${slug}.example.com`, phone: '02-000-0001', createdById: staffU.id } });
    const m = await prisma.mentor.create({ data: { companyId: c.id, firstName: mentor[0], lastName: mentor[1], position: 'Senior Software Engineer', department: 'ฝ่ายพัฒนาซอฟต์แวร์', email: `mentor@${slug}.example.com`, phone: '080-000-0000', createdById: staffU.id } });
    return { id: c.id, contactIds: [contact.id], mentorId: m.id, name };
  };
  const C = [
    await company('บริษัท สยามซอฟต์ โซลูชั่น จำกัด', 'Siamsoft Solution Co., Ltd.', 'กรุงเทพมหานคร', 'พญาไท', ['สุดารัตน์', 'บุญมา'], ['ธนวัฒน์', 'ศรีวงศ์']),
    await company('บริษัท ขอนแก่นดิจิทัล จำกัด', 'Khonkaen Digital Co., Ltd.', 'ขอนแก่น', 'เมืองขอนแก่น', ['วรรณา', 'ทองดี'], ['ปิยะพงษ์', 'คำแก้ว']),
    await company('บริษัท ไทยดาต้าเทค จำกัด', 'Thaidatatech Co., Ltd.', 'กรุงเทพมหานคร', 'บางรัก', ['อรุณี', 'แสงทอง'], ['ชัยวัฒน์', 'มณีรัตน์']),
    await company('บริษัท อีสานคลาวด์ จำกัด', 'Isancloud Co., Ltd.', 'ขอนแก่น', 'เมืองขอนแก่น', ['จิราพร', 'พลศรี'], ['สุรเชษฐ์', 'อินทร์แก้ว']),
  ];

  // ── นักศึกษา กระจายทุกสถานะ ──
  const S = {};
  let sn = 0;
  const AFTER_REQ = ['REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'];
  const HAS_ACCEPT = ['WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'];
  const AFTER_PLACE = ['PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'];
  const APPLY_STAGE = ['APPLYING', 'PENDING_GRADE', 'QUALIFIED', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED'];
  const student = async (key, prefix, first, last, firstEn, lastEn, status, o = {}) => {
    sn++;
    const code = `65304${String(1000 + sn * 7).slice(-4)}${sn % 10}`;
    const studentId = `${code.slice(0, 9)}-${code.slice(9)}`;
    const email = `${firstEn.toLowerCase()}.${lastEn.slice(0, 2).toLowerCase()}@example.com`;
    const u = await user(email, 'student', `นักศึกษา ${first} ${last} — ${status}`);
    const s = await prisma.student.create({ data: {
      userId: u.id, studentId, prefix, firstName: first, lastName: last, firstNameEn: firstEn, lastNameEn: lastEn, email,
      major: o.major || 'CS', year: '4', phone: `08${String(10000000 + sn * 1234567).slice(0, 8)}`, studyProgram: o.special ? 'special' : 'normal',
      coopAdvisorId: o.adv === undefined ? tAdv.id : o.adv, generalAdvisorId: tAdv2.id, advisorName: 'อ.กิตติ พัฒนากุล', jobPosition: o.job || 'Software Developer',
    } });
    const comp = C[o.company ?? (sn % C.length)];
    await prisma.studentCoop.create({ data: {
      studentId: s.id, status, coopPeriodId: period.id, companyId: comp.id, jobPosition: o.job || 'Software Developer',
      contacts: { connect: comp.contactIds.map((id) => ({ id })) },
      mentors: AFTER_PLACE.includes(status) ? { connect: [{ id: comp.mentorId }] } : undefined,
      teacherCheckComment: o.comment, t000Status: 'WAITING',
      ...(AFTER_REQ.includes(status) ? { reqDocNumber: `0000.00/${2400 + sn}`, reqDocDate: d(-20), reqLetterUrl: file('req'), reqLetterDelivery: 'STUDENT' } : {}),
      ...(HAS_ACCEPT.includes(status) ? { acceptanceFileUrl: file('acc') } : {}),
      ...(AFTER_PLACE.includes(status) ? { placeDocNumber: `0000.00/${2600 + sn}`, placeDocDate: d(-7), placeLetterUrl: file('place'), placeLetterDelivery: 'STUDENT', actualStartDate: at(-3), actualEndDate: at(110) } : {}),
    } });
    await prisma.coopApplicationForm.create({ data: {
      studentId: s.id, contactAddrNo: '123', contactRoad: 'มิตรภาพ', contactSubDistrict: 'ในเมือง', contactDistrict: 'เมืองขอนแก่น', contactProvince: 'ขอนแก่น', contactZipcode: '40002',
      contactAddress: '123 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40002', contactPhone: '0800000000', contactEmail: email,
      emergencyName: 'นางมาลี ' + last, emergencyRelation: 'มารดา', emergencyPhone: '0800000001', emergencyAddress: '45 หมู่ 3 ตำบลบ้านเป็ด อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
      startDate: at(15), endDate: at(125), careerObjective1: 'พัฒนาเว็บแอปพลิเคชัน', careerObjective2: 'ทำงานร่วมกับทีมพัฒนาซอฟต์แวร์', careerObjective3: 'เรียนรู้กระบวนการทำงานจริง',
      gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/EXAMPLE',
    } });
    for (const t of o.docs || []) await prisma.document.create({ data: { studentId: s.id, type: t.type, name: `${t.type}.pdf`, path: file(t.type.toLowerCase()), status: t.status || 'WAITING' } });
    if (APPLY_STAGE.includes(status)) await prisma.document.create({ data: { studentId: s.id, type: 'APPLICATION_DOC', name: 'ใบรายงานผลการศึกษา.pdf', path: file('app'), status: 'WAITING' } });
    S[key] = { pk: s.id, userId: u.id, name: `${first} ${last}` };
  };
  const T000 = (status = 'WAITING') => reqs.map(([type]) => ({ type, status }));
  const intern = [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'APPROVED' }];

  await student('fresh', 'MR', 'ธนากร', 'ศรีสวัสดิ์', 'Thanakorn', 'Srisawat', 'NOT_SUBMITTED', { company: 0 });
  await student('applying1', 'MS', 'ปริยากร', 'บุญเรือง', 'Priyakorn', 'Boonruang', 'APPLYING', { company: 1 });
  await student('applying2', 'MR', 'ณัฐวุฒิ', 'ทองคำ', 'Nattawut', 'Thongkham', 'APPLYING', { company: 2, special: true });
  await student('pending', 'MS', 'กมลชนก', 'วงศ์ใหญ่', 'Kamonchanok', 'Wongyai', 'PENDING_GRADE', { company: 3 });
  await student('edits', 'MR', 'ภาณุวัฒน์', 'แก้วประเสริฐ', 'Phanuwat', 'Kaewprasert', 'APPLICATION_EDITS_REQUIRED', { company: 1, comment: 'กรุณาแนบใบรายงานผลการศึกษาภาคเรียนล่าสุด' });
  await student('qualified', 'MS', 'ศิริพร', 'มหาวงศ์', 'Siriporn', 'Mahawong', 'QUALIFIED', { company: 0, docs: T000().slice(0, 2) });
  await student('t000wait1', 'MR', 'วีรภัทร', 'สุขสวัสดิ์', 'Weeraphat', 'Suksawat', 'WAITING_FOR_STAFF_CHECK', { company: 2, docs: T000() });
  await student('t000wait2', 'MS', 'อัญชลี', 'พรหมมา', 'Anchalee', 'Promma', 'WAITING_FOR_STAFF_CHECK', { company: 3, docs: T000() });
  await student('docsok', 'MR', 'จิรายุ', 'นาคสวัสดิ์', 'Jirayu', 'Naksawat', 'DOCS_APPROVED', { company: 0, docs: T000('APPROVED') });
  await student('docsok2', 'MS', 'พิมพ์ชนก', 'ศรีบุญ', 'Pimchanok', 'Sriboon', 'DOCS_APPROVED', { company: 0, docs: T000('APPROVED') });
  await student('reqissued', 'MR', 'กฤษดา', 'ใจมั่น', 'Kritsada', 'Jaiman', 'REQ_LETTER_ISSUED', { company: 1, docs: T000('APPROVED') });
  await student('accwait', 'MS', 'นันทิชา', 'คำมูล', 'Nanticha', 'Khammoon', 'WAITING_FOR_STAFF_CHECK_LETTER', { company: 2, docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE' }] });
  await student('accok', 'MR', 'ศุภกร', 'ชัยมงคล', 'Supakorn', 'Chaimongkol', 'ACCEPTANCE_CHECKED', { company: 3, docs: intern });
  await student('placed', 'MS', 'เบญจวรรณ', 'อุดมสุข', 'Benjawan', 'Udomsuk', 'PLACEMENT_LETTER_ISSUED', { company: 1, docs: intern });
  await student('intern', 'MR', 'อนุชา', 'พันธ์ดี', 'Anucha', 'Phandee', 'INTERNSHIP_STARTED', { company: 0, docs: [...intern, { type: 'T002_FORM' }, { type: 'T003_FORM' }] });
  await student('intern2', 'MS', 'สุภาวดี', 'แสนสุข', 'Supawadee', 'Saensuk', 'INTERNSHIP_STARTED', { company: 1, docs: [...intern, { type: 'T002_FORM', status: 'APPROVED' }, { type: 'T003_FORM' }] });
  await student('intern3', 'MR', 'ธีรวัฒน์', 'บุญมี', 'Theerawat', 'Boonmee', 'INTERNSHIP_STARTED', { company: 2, docs: [...intern, { type: 'T002_FORM', status: 'APPROVED' }, { type: 'T003_FORM', status: 'APPROVED' }] });
  await student('aiStudent', 'MS', 'ชนิดา', 'รุ่งเรือง', 'Chanida', 'Rungruang', 'APPLYING', { major: 'AI', company: 3, adv: null });

  // ── แบบฟอร์ม T002/T003 ของนักศึกษาที่เริ่มฝึกงานแล้ว ──
  for (const k of ['intern', 'intern2', 'intern3']) {
    const s = S[k];
    const { company: comp } = await prisma.studentCoop.findUnique({ where: { studentId: s.pk }, include: { company: true } });
    await prisma.coopT002Form.create({ data: {
      studentId: s.pk, companyNameTh: comp.name, companyNameEn: comp.nameEn, addressNo: '99/9', road: 'มิตรภาพ', subDistrict: 'ในเมือง', district: comp.district, province: comp.province, zipcode: comp.zipcode,
      companyPhone: comp.phone, companyEmail: comp.email, managerName: 'นายวิชัย เจริญผล', managerPosition: 'กรรมการผู้จัดการ', managerPhone: comp.phone,
      coordName: 'นางสาวสุดารัตน์ บุญมา', coordPosition: 'ผู้จัดการฝ่ายทรัพยากรบุคคล', coordPhone: '02-000-0001', coordEmail: comp.email,
      supervisorName: 'นายธนวัฒน์ ศรีวงศ์', supervisorPosition: 'Senior Software Engineer', supervisorDept: 'ฝ่ายพัฒนาซอฟต์แวร์', supervisorPhone: '080-000-0000', supervisorEmail: 'mentor@example.com',
      jobPosition: 'Software Developer (Intern)', jobDescription: 'พัฒนาระบบเว็บแอปพลิเคชันภายในองค์กรด้วย React และ Node.js ร่วมกับทีมพัฒนา เขียนเทสต์ และดูแลฐานข้อมูล',
      accomAddrNo: '55/12', accomRoad: 'พหลโยธิน', accomSubDistrict: 'สามเสนใน', accomDistrict: 'พญาไท', accomProvince: 'กรุงเทพมหานคร', accomZipcode: '10400',
      accommodationAddress: '55/12 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400', accommodationPhone: '0800000002',
      emergencyName: 'นางมาลี พันธ์ดี', emergencyPhone: '0800000001', emergencyAddress: '45 หมู่ 3 ตำบลบ้านเป็ด อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
    } });
    await prisma.coopT003Form.create({ data: {
      studentId: s.pk, reportTitleTh: 'การพัฒนาระบบติดตามงานซ่อมบำรุงด้วยเว็บแอปพลิเคชัน', reportTitleEn: 'Development of a Maintenance Tracking Web Application',
      objectives: '1. เพื่อพัฒนาระบบติดตามงานซ่อมบำรุงที่ใช้งานผ่านเว็บ\n2. เพื่อลดเวลาการติดตามสถานะงาน', expectedOutcomes: 'ได้ระบบที่ใช้งานได้จริงในองค์กร',
      significance: 'งานซ่อมบำรุงเดิมติดตามด้วยกระดาษ ทำให้ล่าช้าและข้อมูลตกหล่น', methodology: 'ศึกษาความต้องการ ออกแบบฐานข้อมูล พัฒนา ทดสอบ และส่งมอบ', scope: 'ระบบบันทึกงาน มอบหมายงาน และรายงานสรุป',
      workPlan: [{ task: 'ศึกษาระบบงานเดิม', weeks: [1, 2] }, { task: 'ออกแบบระบบ', weeks: [3, 4] }, { task: 'พัฒนาระบบ', weeks: [5, 12] }, { task: 'ทดสอบและส่งมอบ', weeks: [13, 16] }],
    } });
  }

  // ── นัดนิเทศ: รออาจารย์เลือกวัน · ยืนยันวันแล้ว · ออกหนังสือแล้ว ──
  await prisma.supervisionAppointment.create({ data: { studentId: S.intern.pk, teacherId: tAdv.id, supervisionType: 'ONLINE', onlineLink: 'https://meet.example.com/abc-defg-hij', proposedDates: JSON.stringify([`${ymd(35)}T09:00:00+07:00`, `${ymd(37)}T13:00:00+07:00`, `${ymd(40)}T10:00:00+07:00`]), status: 'PENDING_TEACHER' } });
  await prisma.supervisionAppointment.create({ data: { studentId: S.intern2.pk, teacherId: tAdv.id, supervisionType: 'ONSITE', proposedDates: JSON.stringify([`${ymd(42)}T09:00:00+07:00`, `${ymd(44)}T13:00:00+07:00`]), status: 'DATE_CONFIRMED', confirmedDate: at(42), confirmedEndDate: at(42, 12) } });
  await prisma.supervisionAppointment.create({ data: { studentId: S.intern3.pk, teacherId: tCoop.id, supervisionType: 'ONSITE', proposedDates: JSON.stringify([`${ymd(50)}T10:00:00+07:00`]), status: 'LETTER_UPLOADED', confirmedDate: at(50, 10), confirmedEndDate: at(50, 12), officialLetterPath: file('supervision'), letterDocNumber: '0000.00/2900', letterDocDate: d(-1) } });

  // ── ประกาศ ──
  const ann = (title, body, days, pinned = false) => prisma.announcement.create({ data: { title, body, date: d(days), year: '2/2569', pinned, authorId: staffU.id, targetMajors: [] } });
  await ann('กำหนดการปฐมนิเทศนักศึกษาสหกิจศึกษา ภาคเรียนที่ 2/2569', 'ขอเชิญนักศึกษาที่ผ่านการพิจารณาคำร้องเข้าร่วมปฐมนิเทศ เวลา 09.00–12.00 น.', -3, true);
  await ann(`เปิดรับเอกสารใบสมัคร (CP-T000) ถึงวันที่ ${ymd(20)}`, 'นักศึกษาที่ผ่านการพิจารณาคำร้องแล้ว กรุณาอัปโหลดเอกสารประกอบการสมัครให้ครบก่อนกำหนด', -6);
  await ann('แนวทางการนัดหมายนิเทศงานสหกิจศึกษา', 'นักศึกษาเสนอวันนิเทศได้หลังเริ่มปฏิบัติงานแล้ว อาจารย์ที่ปรึกษาจะเลือกวันที่สะดวกจากวันที่นักศึกษาเสนอ', -10);

  // ── เรื่องที่ผู้ใช้แจ้ง · บันทึกการใช้งาน ──
  await prisma.feedback.create({ data: { userId: S.qualified.userId, role: 'student', kind: 'BUG', message: 'อัปโหลดไฟล์บัตรนักศึกษาแล้วขึ้นว่าไฟล์ใหญ่เกินไป ไฟล์ขนาด 6 MB', pagePath: '/student/docs', contextNote: 'QUALIFIED', createdAt: ago(90) } });
  await prisma.feedback.create({ data: { userId: S.intern.userId, role: 'student', kind: 'SUGGEST', message: 'อยากให้หน้านัดหมายนิเทศแสดงชื่ออาจารย์ร่วมนิเทศด้วย', pagePath: '/student/supervision', contextNote: 'INTERNSHIP_STARTED', status: 'IN_PROGRESS', createdAt: ago(600) } });
  const log = (min, who, role, action, targetName, method, p) => prisma.auditLog.create({ data: { createdAt: ago(min), userId: who.userId, role, actorName: who.name, action, method, path: p, targetType: targetName ? 'student' : null, targetName, statusCode: 200, ip: '127.0.0.1' } });
  const staff = { userId: staffU.id, name: 'นางสาวพรทิพย์ ใจดี' };
  const coop = { userId: tCoop.userId, name: 'ผศ.ดร.สมชาย รักเรียน' };
  const adv = { userId: tAdv.userId, name: 'อ.ดร.วิไลวรรณ ศรีสุข' };
  await log(15, staff, 'staff', 'ออกหนังสือขอความอนุเคราะห์', S.reqissued.name, 'PUT', '/api/admin/t000/review');
  await log(32, staff, 'staff', 'อนุมัติเอกสาร T000 ทั้งหมด', S.docsok.name, 'POST', '/api/admin/t000/approve-all');
  await log(48, coop, 'teacher', 'พิจารณาคำร้อง: ผ่าน', S.qualified.name, 'PATCH', '/api/admin/coop-applications/status');
  await log(75, adv, 'teacher', 'ตรวจ T002: ผ่าน', S.intern2.name, 'PUT', '/api/teacher/documents/review-t002');
  await log(120, { userId: S.intern.userId, name: 'นายอนุชา พันธ์ดี' }, 'student', 'เสนอวันนิเทศ', S.intern.name, 'POST', '/api/coop/supervision/propose');
  await log(240, staff, 'staff', 'เข้าสู่ระบบ', null, 'POST', '/api/auth/signin');

  console.log(`สร้างข้อมูลตัวอย่างแล้ว — นักศึกษา ${Object.keys(S).length} คน · ไฟล์ตัวอย่าง ${fileN} ไฟล์ · รอบ 2/2569 (id ${period.id})`);
  console.log(`\nบัญชีสำหรับเข้าสู่ระบบ (รหัสผ่านทุกบัญชี: ${PASSWORD}) — เลือกบทบาทในหน้า login ให้ตรง`);
  for (const [role, email, label] of accounts) console.log(`  ${role.padEnd(8)} ${email.padEnd(34)} ${label}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
