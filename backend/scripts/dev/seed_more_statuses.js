// scripts/dev/seed_more_statuses.js
// เพิ่มนักศึกษาตัวอย่างอีกชุดให้หลายสถานะ/หลายแบบ — ต่อจาก seed_demo.js (ต้องรัน seed_demo.js ก่อน ใช้บัญชี/บริษัท/รอบของชุดนั้น)
// ห้ามรันบนระบบจริง: ต้องเป็นฐานในเครื่อง (localhost) และ NODE_ENV ไม่ใช่ production · รันซ้ำไม่ได้ (มีชุดนี้อยู่แล้ว = หยุด)
//
//   node scripts/dev/seed_more_statuses.js        รหัสผ่านทุกบัญชี = Demo@1234 (เหมือน seed_demo)
//
// ได้นักศึกษา ~45 คน (หลักสูตร CS/IT/AI/GIS/CYB · ภาคปกติ/พิเศษ) ทุกสถานะหลายคน + กรณีที่ชุดแรกไม่มี:
//   คำร้องส่งกลับแก้/ไม่ผ่าน (มีเหตุผล) · T000 ส่งไม่ครบ / ส่งกลับแก้ / ไม่ผ่านรายฉบับ / ขยายเวลา / ส่งแก้แล้วรอตรวจ
//   หนังสือรอลงนาม · ใบตอบรับถูกตีกลับ · บริษัทส่งใบตอบรับให้เจ้าหน้าที่โดยตรง · T002/T003 ยังไม่ส่ง/รอตรวจ/ตีกลับ/ผ่าน
//   นัดนิเทศ รออาจารย์/ปฏิเสธแล้ว/ยืนยันแล้ว/หนังสือรอลงนาม/ออกหนังสือแล้ว/นิเทศเสร็จ · อาจารย์ร่วม (ตอบแล้ว/ยังไม่ตอบ) · นิเทศรวม 3 คน
//   นักศึกษาที่ยังไม่เคยเข้าระบบ · นักศึกษาที่ถูกย้ายไปถังขยะ
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prismaClient');

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') { console.error('หยุด: NODE_ENV=production'); process.exit(1); }
try {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) { console.error(`หยุด: ฐานข้อมูลไม่ได้อยู่ในเครื่องนี้ (${host})`); process.exit(1); }
} catch (_) { console.error('หยุด: อ่าน DATABASE_URL ไม่ได้'); process.exit(1); }

const PASSWORD = 'Demo@1234';
const UPLOADS = path.join(__dirname, '../../uploads');
const DAY = 86400000;
const d = (n) => new Date(Date.now() + n * DAY);
const ymd = (n) => new Date(Date.now() + n * DAY).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const at = (n, h = 9) => new Date(`${ymd(n)}T${String(h).padStart(2, '0')}:00:00+07:00`);
// วันธรรมดาที่ใกล้ที่สุดตั้งแต่ n วันข้างหน้า (นัดนิเทศ)
const wd = (n) => { for (let i = n; i < n + 7; i++) { const w = new Date(`${ymd(i)}T12:00:00+07:00`).getUTCDay(); if (w && w !== 6) return i; } return n; };

function samplePdf(label) {
  const text = `Sample document - ${label}`.replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 760 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
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
const file = (label, dir = '') => {
  const name = `more-${++fileN}-${label}.pdf`;
  fs.mkdirSync(path.join(UPLOADS, dir), { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, dir, name), samplePdf(label));
  return name;
};

// ชื่อจริงแบบไทย + อักษรโรมัน (ใช้ทำอีเมล)
const NAMES = [
  ['MR', 'กิตติพงษ์', 'สายทอง', 'Kittipong', 'Saithong'], ['MS', 'ปวีณา', 'จันทร์หอม', 'Paweena', 'Janhom'], ['MR', 'ธนพล', 'วงศ์สวัสดิ์', 'Thanapol', 'Wongsawat'],
  ['MS', 'นภัสสร', 'แก้วกาญจนา', 'Napatsorn', 'Kaewkanjana'], ['MR', 'ศักดิ์ชัย', 'บุญประเสริฐ', 'Sakchai', 'Boonprasert'], ['MS', 'อรอุมา', 'ศรีสุข', 'Ornuma', 'Srisuk'],
  ['MR', 'พีรพัฒน์', 'ทองมา', 'Peerapat', 'Thongma'], ['MS', 'สุนิสา', 'พรมดี', 'Sunisa', 'Promdee'], ['MR', 'ณัฐพงษ์', 'ใจดี', 'Nattapong', 'Jaidee'],
  ['MS', 'วรัญญา', 'มีสุข', 'Waranya', 'Meesuk'], ['MR', 'อภิสิทธิ์', 'แสงอรุณ', 'Apisit', 'Saengarun'], ['MS', 'ชลธิชา', 'บัวแก้ว', 'Chonticha', 'Buakaew'],
  ['MR', 'วุฒิชัย', 'คำแสน', 'Wutthichai', 'Khamsaen'], ['MS', 'เกศินี', 'ทองสุข', 'Kesinee', 'Thongsuk'], ['MR', 'ชยพล', 'ศรีวิไล', 'Chayapol', 'Sriwilai'],
  ['MS', 'ธิดารัตน์', 'อินทร์สุข', 'Thidarat', 'Insuk'], ['MR', 'ปิยะพงศ์', 'นาคประเสริฐ', 'Piyapong', 'Nakprasert'], ['MS', 'มัณฑนา', 'จันทร์เพ็ญ', 'Mantana', 'Janpen'],
  ['MR', 'ภัทรพล', 'พึ่งทอง', 'Pattarapol', 'Puengthong'], ['MS', 'ศศิธร', 'วงศ์คำ', 'Sasithorn', 'Wongkham'], ['MR', 'ธีรภัทร', 'สุขเจริญ', 'Teerapat', 'Sukcharoen'],
  ['MS', 'พรรณนิภา', 'ศรีทอง', 'Pannipa', 'Srithong'], ['MR', 'จักรพันธ์', 'มั่นคง', 'Jakkapan', 'Mankong'], ['MS', 'กัญญารัตน์', 'บุญมา', 'Kanyarat', 'Boonma'],
  ['MR', 'สิทธิชัย', 'ทองแท้', 'Sittichai', 'Thongtae'], ['MS', 'รัชนก', 'พรหมสุวรรณ', 'Ratchanok', 'Promsuwan'], ['MR', 'วรวุฒิ', 'แก้วมณี', 'Worawut', 'Kaewmanee'],
  ['MS', 'ณิชาภัทร', 'สมบูรณ์', 'Nichapat', 'Somboon'], ['MR', 'กฤตภาส', 'ชัยวงศ์', 'Krittapas', 'Chaiwong'], ['MS', 'จุฑามาศ', 'คงสวัสดิ์', 'Juthamas', 'Kongsawat'],
  ['MR', 'นพดล', 'ศรีบุญเรือง', 'Noppadol', 'Sriboonruang'], ['MS', 'ปาริชาต', 'ทองดี', 'Parichat', 'Thongdee'], ['MR', 'อัครพล', 'วิเศษสุข', 'Akkarapol', 'Wisetsuk'],
  ['MS', 'สุพัตรา', 'จันทร์แก้ว', 'Supattra', 'Jankaew'], ['MR', 'ธนวินท์', 'บุญยืน', 'Thanawin', 'Boonyuen'], ['MS', 'อัจฉรา', 'พลอยงาม', 'Atchara', 'Ploy-ngam'],
  ['MR', 'เอกชัย', 'ศรีเมือง', 'Ekachai', 'Srimuang'], ['MS', 'ลลิตา', 'สุวรรณศรี', 'Lalita', 'Suwannasri'], ['MR', 'ภาคิน', 'ทองประเสริฐ', 'Pakin', 'Thongprasert'],
  ['MS', 'กมลวรรณ', 'แสงจันทร์', 'Kamonwan', 'Saengjan'], ['MR', 'ปฐมพงศ์', 'เจริญสุข', 'Patompong', 'Charoensuk'], ['MS', 'ธนัชพร', 'มณีวงศ์', 'Thanatchaporn', 'Maneewong'],
  ['MR', 'ชินวัตร', 'ดวงดี', 'Chinnawat', 'Duangdee'], ['MS', 'พิมพ์มาดา', 'ศรีสวัสดิ์', 'Pimmada', 'Srisawat'], ['MR', 'ศุภวิชญ์', 'อุดมศักดิ์', 'Supawit', 'Udomsak'],
  ['MS', 'วิภาวี', 'ชัยมงคล', 'Wipawee', 'Chaimongkol'], ['MR', 'คณิน', 'ทองงาม', 'Kanin', 'Thongngam'], ['MS', 'อริสา', 'ศรีประเสริฐ', 'Arisa', 'Sriprasert'],
  ['MR', 'ณัฐกิตติ์', 'บุญศรี', 'Nattakit', 'Boonsri'], ['MS', 'ภัทรวดี', 'แสนดี', 'Pattarawadee', 'Saendee'], ['MR', 'ธราธร', 'พรหมวงศ์', 'Tharathorn', 'Promwong'],
  ['MS', 'ชนัญชิดา', 'อินทรสุข', 'Chananchida', 'Intarasuk'], ['MR', 'ปรเมศวร์', 'แก้วใส', 'Poramet', 'Kaewsai'], ['MS', 'ญาณิศา', 'คำดี', 'Yanisa', 'Khamdee'],
  ['MR', 'สหรัฐ', 'มณีโชติ', 'Saharat', 'Maneechot'], ['MS', 'กานต์ธิดา', 'บุญเกิด', 'Kanthida', 'Boonkerd'], ['MR', 'วชิรวิทย์', 'สุขใจ', 'Wachirawit', 'Sukjai'],
];
const emailOf = ([, , , firstEn, lastEn]) => `${firstEn.toLowerCase().replace(/[^a-z]/g, '')}.${lastEn.slice(0, 2).toLowerCase()}@example.com`;

// --cleanup: ลบนักศึกษาชุดนี้ทั้งหมด (และไฟล์ more-*) — ชุด seed_demo เดิมไม่แตะ
async function cleanup() {
  const users = await prisma.user.findMany({ where: { username: { in: NAMES.map(emailOf) } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const pks = (await prisma.student.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((s) => s.id);
  const appts = (await prisma.supervisionAppointment.findMany({ where: { studentId: { in: pks } }, select: { id: true } })).map((a) => a.id);
  await prisma.supervisionCoTeacher.deleteMany({ where: { appointmentId: { in: appts } } });
  await prisma.supervisionAppointment.deleteMany({ where: { id: { in: appts } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  for (const m of ['document', 'coopT002Form', 'coopT003Form', 'coopApplicationForm', 'studentCoop']) await prisma[m].deleteMany({ where: { studentId: { in: pks } } });
  await prisma.student.deleteMany({ where: { id: { in: pks } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  let files = 0;
  for (const dir of ['', 'supervision']) {
    for (const f of fs.readdirSync(path.join(UPLOADS, dir)).filter((n) => /^more-\d+-.*\.pdf$/.test(n))) { fs.unlinkSync(path.join(UPLOADS, dir, f)); files++; }
  }
  console.log(`ลบชุดเพิ่มสถานะแล้ว: นักศึกษา ${pks.length} คน · ไฟล์ ${files}`);
}

async function main() {
  if (process.argv.includes('--cleanup')) return cleanup();
  const staff = await prisma.user.findFirst({ where: { username: 'staff@example.ac.th' } });
  if (!staff) { console.error('หยุด: ยังไม่มีข้อมูลชุด seed_demo.js (รัน node scripts/dev/seed_demo.js ก่อน)'); process.exit(1); }
  if (await prisma.user.findFirst({ where: { username: { startsWith: 'kittipong.sa@' } } })) { console.error('หยุด: มีข้อมูลชุดนี้อยู่แล้ว'); process.exit(1); }
  const PW = bcrypt.hashSync(PASSWORD, 10);
  const teacherBy = async (email) => prisma.teacher.findFirst({ where: { email } });
  const tCoop = await teacherBy('somchai.r@example.ac.th');
  const tAdv = await teacherBy('wilaiwan.s@example.ac.th');
  const tAdv2 = await teacherBy('kitti.p@example.ac.th');
  const tAI = await teacherBy('prasert.m@example.ac.th');
  const tIT = await teacherBy('nattaya.k@example.ac.th');
  const period = await prisma.coopPeriod.findFirst({ where: { academicYear: '2569', semester: 2 } });
  const companies = await prisma.company.findMany({ where: { createdById: staff.id }, include: { contacts: true, mentors: true }, orderBy: { name: 'asc' } });
  const reqs = (await prisma.documentRequirement.findMany({ where: { isActive: true, isRequired: true } })).map((r) => r.docKey).filter((k) => k !== 'CP-ACCEPTANCE');

  let sn = 0;
  const made = [];
  const S = {};
  const student = async (key, status, o = {}) => {
    const [prefix, first, last, firstEn, lastEn] = NAMES[sn];
    sn++;
    const code = `66304${String(2000 + sn * 13).slice(-4)}${sn % 10}`;
    const studentId = `${code.slice(0, 9)}-${code.slice(9)}`;
    const email = `${firstEn.toLowerCase().replace(/[^a-z]/g, '')}.${lastEn.slice(0, 2).toLowerCase()}@example.com`;
    const u = await prisma.user.create({ data: { username: email, email, password: PW, role: 'student' } });
    const major = o.major || 'CS';
    const s = await prisma.student.create({ data: {
      userId: u.id, studentId, prefix, firstName: first, lastName: last, firstNameEn: firstEn, lastNameEn: lastEn, email, major, year: '4',
      phone: `08${String(20000000 + sn * 7654321).slice(0, 8)}`, studyProgram: o.special ? 'special' : 'normal', gpa: o.gpa ?? 3.1,
      coopAdvisorId: o.adv === undefined ? tAdv.id : o.adv, generalAdvisorId: tAdv2.id, advisorName: 'อ.กิตติ พัฒนากุล', deletedAt: o.trashed ? d(-2) : null,
    } });
    const comp = companies[o.company ?? (sn % companies.length)];
    const AFTER_REQ = ['REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'];
    const AFTER_PLACE = ['PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'];
    const PAST_T000 = ['DOCS_APPROVED', ...AFTER_REQ];
    if (!o.noCoop) {
      await prisma.studentCoop.create({ data: {
        studentId: s.id, status, coopPeriodId: period.id, companyId: o.noCompany ? null : comp.id, jobPosition: o.job || 'Software Developer',
        contacts: o.noCompany ? undefined : { connect: comp.contacts.map((c) => ({ id: c.id })) },
        mentors: AFTER_PLACE.includes(status) ? { connect: comp.mentors.slice(0, 1).map((m) => ({ id: m.id })) } : undefined,
        teacherCheckComment: o.appReason ?? null, staffCheckComment: o.appReason ?? null,
        t000Status: o.t000Status || (status === 'WAITING_FOR_STAFF_CHECK' ? 'PENDING' : 'WAITING'), t000Comment: o.t000Comment ?? null,
        deadlineExtensions: o.ext ?? undefined,
        submittedSteps: PAST_T000.includes(status) || status === 'WAITING_FOR_STAFF_CHECK' || status === 'EDITS_REQUIRED' ? { T000: { at: d(-12).toISOString() } } : undefined,
        ...(AFTER_REQ.includes(status) ? { reqDocNumber: `660301.26.6.2/${3100 + sn}`, reqDocDate: d(-25), reqLetterUrl: file('req'), reqLetterDelivery: o.delivery || 'STUDENT' } : {}),
        ...(o.reqPending ? { reqLetterPendingAt: d(-1), reqLetterDraftNumber: `660301.26.6.2/${3300 + sn}`, reqLetterDraftDate: d(-1) } : {}),
        ...(o.acceptFile ? { acceptanceFileUrl: file('acc') } : {}),
        ...(o.placePending ? { placeLetterPendingAt: d(-1), placeLetterDraftNumber: `660301.26.6.2/${3500 + sn}`, placeLetterDraftDate: d(-1) } : {}),
        ...(AFTER_PLACE.includes(status) ? { placeDocNumber: `660301.26.6.2/${3700 + sn}`, placeDocDate: d(-10), placeLetterUrl: file('place'), placeLetterDelivery: o.delivery || 'STUDENT', actualStartDate: at(-5), actualEndDate: at(110) } : {}),
      } });
      await prisma.coopApplicationForm.create({ data: {
        studentId: s.id, contactAddrNo: '88', contactRoad: 'ศรีจันทร์', contactSubDistrict: 'ในเมือง', contactDistrict: 'เมืองขอนแก่น', contactProvince: 'ขอนแก่น', contactZipcode: '40000',
        contactAddress: '88 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000', contactPhone: '0811111111', contactEmail: email,
        emergencyName: `นางสมใจ ${last}`, emergencyRelation: 'มารดา', emergencyPhone: '0822222222', emergencyAddress: '12 หมู่ 5 ตำบลศิลา อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
        startDate: at(15), endDate: at(125), careerObjective1: o.job || 'นักพัฒนาซอฟต์แวร์', careerObjective2: 'เรียนรู้การทำงานเป็นทีม', gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/EXAMPLE',
      } });
    }
    for (const t of o.docs || []) {
      await prisma.document.create({ data: { studentId: s.id, type: t.type, name: `${t.type}.pdf`, path: file(t.type.toLowerCase()), status: t.status || 'WAITING', rejectReason: t.reason ?? null, uploadedAt: d(-(t.ago ?? 8)) } });
    }
    if (!o.noCoop && ['APPLYING', 'PENDING_GRADE', 'APPLICATION_EDITS_REQUIRED', 'QUALIFICATION_FAILED', 'QUALIFIED'].includes(status)) {
      await prisma.document.create({ data: { studentId: s.id, type: 'APPLICATION_DOC', name: 'ใบรายงานผลการศึกษา.pdf', path: file('app'), status: 'WAITING' } });
    }
    if (o.note) await prisma.notification.create({ data: { userId: u.id, type: 'STATUS_UPDATED', title: 'สถานะสหกิจศึกษาอัปเดต', message: o.note, link: '/student/dashboard', relatedId: String(s.id) } });
    S[key] = { pk: s.id, userId: u.id, comp };
    made.push([email, `${first} ${last}`, major, o.label || status]);
    return S[key];
  };
  const T000 = (status = 'WAITING', over = {}) => reqs.map((type) => ({ type, status: over[type]?.status || status, reason: over[type]?.reason }));
  const intern = (t002, t003, extra = {}) => [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'APPROVED' },
    ...(t002 ? [{ type: 'T002_FORM', status: t002[0], reason: t002[1] }] : []), ...(t003 ? [{ type: 'T003_FORM', status: t003[0], reason: t003[1] }] : []), ...(extra.docs || [])];
  const [k0, k1] = reqs;

  // ── ช่วงยื่นคำร้อง ──
  await student('neverIn', 'NOT_SUBMITTED', { noCoop: true, label: 'นำเข้าแล้ว ยังไม่เคยเข้าระบบ' });
  await student('noCompany', 'NOT_SUBMITTED', { noCompany: true, major: 'IT', label: 'เข้าระบบแล้ว ยังไม่เลือกบริษัท' });
  await student('apply1', 'APPLYING', { major: 'IT', label: 'รออาจารย์ตรวจคำร้อง (IT)' });
  await student('apply2', 'APPLYING', { major: 'GIS', special: true, label: 'รอตรวจคำร้อง (GIS ภาคพิเศษ)' });
  await student('apply3', 'APPLYING', { major: 'CYB', adv: null, label: 'รอตรวจคำร้อง (CYB ยังไม่มีที่ปรึกษา)' });
  await student('grade1', 'PENDING_GRADE', { major: 'AI', label: 'พักรอเกรด (AI)' });
  await student('grade2', 'PENDING_GRADE', { gpa: 2.49, label: 'พักรอเกรด (GPA ก้ำกึ่ง)' });
  await student('appEdit1', 'APPLICATION_EDITS_REQUIRED', { appReason: 'ลิงก์ผลการเรียนเปิดไม่ได้ กรุณาตั้งค่าแชร์ให้ทุกคนที่มีลิงก์ดูได้', note: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ', label: 'คำร้องส่งกลับแก้ (ลิงก์เปิดไม่ได้)' });
  await student('appEdit2', 'APPLICATION_EDITS_REQUIRED', { major: 'IT', appReason: 'แนบใบรายงานผลการศึกษาไม่ครบทุกภาคการศึกษา', note: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ', label: 'คำร้องส่งกลับแก้ (IT)' });
  await student('fail1', 'QUALIFICATION_FAILED', { gpa: 1.95, appReason: 'เกรดเฉลี่ยสะสมต่ำกว่าเกณฑ์ 2.00', note: 'คำร้องของคุณไม่ผ่านการพิจารณา', label: 'คำร้องไม่ผ่าน (GPA)' });
  await student('fail2', 'QUALIFICATION_FAILED', { major: 'AI', appReason: 'ยังลงทะเบียนวิชาบังคับก่อนสหกิจไม่ครบ', note: 'คำร้องของคุณไม่ผ่านการพิจารณา', label: 'คำร้องไม่ผ่าน (วิชาบังคับ · AI)' });

  // ── เอกสาร T000 ──
  await student('q0', 'QUALIFIED', { label: 'ผ่านคุณสมบัติ ยังไม่ส่ง T000' });
  await student('qPart', 'QUALIFIED', { major: 'IT', docs: T000().slice(0, 3), label: `ผ่านคุณสมบัติ ส่ง T000 ไป 3 จาก ${reqs.length}` });
  await student('qLate', 'QUALIFIED', { docs: T000().slice(0, 1), ext: { T000: ymd(7) }, label: 'ส่งไม่ครบ ได้ขยายเวลา T000' });
  await student('t000First', 'WAITING_FOR_STAFF_CHECK', { docs: T000(), label: 'ส่ง T000 ครบ รอตรวจ (ครั้งแรก)' });
  await student('t000First2', 'WAITING_FOR_STAFF_CHECK', { major: 'AI', special: true, docs: T000(), label: 'ส่ง T000 ครบ รอตรวจ (AI ภาคพิเศษ)' });
  await student('t000Resub', 'WAITING_FOR_STAFF_CHECK', { t000Status: 'EDITS_REQUIRED', t000Comment: 'สำเนาบัตรประชาชนไม่ชัด กรุณาสแกนใหม่', docs: T000('APPROVED', { [k1]: { status: 'WAITING' } }), label: 'ส่งแก้ T000 แล้ว รอตรวจซ้ำ' });
  await student('t000Edit', 'EDITS_REQUIRED', { t000Comment: 'ใบรับรองผลการศึกษาไม่มีลายเซ็นนายทะเบียน กรุณาแนบฉบับที่ลงนามแล้ว', note: 'เอกสาร T000 ต้องแก้ไข กรุณาตรวจสอบความคิดเห็น',
    docs: T000('APPROVED', { [k0]: { status: 'EDITS_REQUIRED', reason: 'ไม่มีลายเซ็นนายทะเบียน' } }), label: 'T000 ถูกส่งกลับแก้ 1 ฉบับ' });
  await student('t000Edit2', 'EDITS_REQUIRED', { major: 'IT', t000Comment: 'ใบยินยอมผู้ปกครองไม่มีลายมือชื่อ · CV ไม่ใช่ฉบับล่าสุด', note: 'เอกสาร T000 ต้องแก้ไข กรุณาตรวจสอบความคิดเห็น',
    docs: T000('APPROVED', { [k0]: { status: 'REJECTED', reason: 'ไม่ใช่เอกสารที่ขอ' }, [k1]: { status: 'EDITS_REQUIRED', reason: 'ไม่ใช่ฉบับล่าสุด' } }), label: 'T000 ไม่ผ่าน 1 + แก้ 1 ฉบับ (IT)' });
  await student('t000EditLate', 'EDITS_REQUIRED', { t000Comment: 'สำเนาบัตรนักศึกษาหมดอายุ', ext: { T000: ymd(3) }, docs: T000('APPROVED', { [k1]: { status: 'EDITS_REQUIRED', reason: 'บัตรหมดอายุ' } }), label: 'T000 ส่งกลับแก้ + ขยายเวลา' });
  await student('docsOk', 'DOCS_APPROVED', { docs: T000('APPROVED'), t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)', label: 'เอกสารผ่าน รอออกหนังสือ' });
  await student('docsOkIT', 'DOCS_APPROVED', { major: 'IT', company: 0, docs: T000('APPROVED'), t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)', label: 'เอกสารผ่าน รอออกหนังสือ (IT)' });
  await student('reqPending', 'DOCS_APPROVED', { docs: T000('APPROVED'), reqPending: true, label: 'หนังสือขอความอนุเคราะห์ รอลงนาม' });

  // ── หนังสือ / ใบตอบรับ ──
  await student('reqStaff', 'REQ_LETTER_ISSUED', { docs: T000('APPROVED'), delivery: 'STAFF', label: 'ออกหนังสือแล้ว (เจ้าหน้าที่ส่งบริษัทให้)' });
  await student('reqStudent', 'REQ_LETTER_ISSUED', { major: 'GIS', docs: T000('APPROVED'), label: 'ออกหนังสือแล้ว (นักศึกษานำไปยื่นเอง · GIS)' });
  await student('waitAcc', 'WAITING_FOR_PLACEMENT_LETTER', { docs: T000('APPROVED'), label: 'รับหนังสือแล้ว รอใบตอบรับ' });
  await student('accRejected', 'WAITING_FOR_PLACEMENT_LETTER', { t000Comment: 'ใบตอบรับไม่มีตราประทับบริษัท กรุณาขอฉบับที่ประทับตรา', note: 'ใบตอบรับต้องแก้ไข กรุณาดูความเห็นเจ้าหน้าที่แล้วอัปโหลดใหม่',
    docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'REJECTED', reason: 'ไม่มีตราประทับ' }], acceptFile: true, label: 'ใบตอบรับถูกตีกลับ' });
  await student('accWait1', 'WAITING_FOR_STAFF_CHECK_LETTER', { docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE' }], acceptFile: true, label: 'ส่งใบตอบรับแล้ว รอตรวจ' });
  await student('accWait2', 'WAITING_FOR_STAFF_CHECK_LETTER', { major: 'AI', docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE' }], acceptFile: true, label: 'ส่งใบตอบรับแล้ว รอตรวจ (AI)' });
  await student('accDirect', 'ACCEPTANCE_CHECKED', { docs: T000('APPROVED'), t000Comment: 'บริษัทส่งใบตอบรับทางอีเมลถึงงานสหกิจ', label: 'บริษัทส่งใบตอบรับให้เจ้าหน้าที่โดยตรง' });
  await student('placePending', 'ACCEPTANCE_CHECKED', { docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'APPROVED' }], acceptFile: true, placePending: true, label: 'หนังสือส่งตัว รอลงนาม' });
  await student('placed1', 'PLACEMENT_LETTER_ISSUED', { docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'APPROVED' }], acceptFile: true, label: 'ออกหนังสือส่งตัวแล้ว ยังไม่ดาวน์โหลด' });
  await student('placed2', 'PLACEMENT_LETTER_ISSUED', { major: 'IT', delivery: 'STAFF', docs: [...T000('APPROVED'), { type: 'CP-ACCEPTANCE', status: 'APPROVED' }], acceptFile: true, label: 'ออกหนังสือส่งตัวแล้ว (เจ้าหน้าที่ส่ง · IT)' });

  // ── ฝึกงาน: T002/T003 หลายแบบ ──
  const I = (key, t002, t003, label, o = {}) => student(key, 'INTERNSHIP_STARTED', { acceptFile: true, docs: intern(t002, t003), label, ...o });
  await I('i00', null, null, 'ฝึกงานแล้ว ยังไม่ส่ง T002/T003');
  await I('i10', ['WAITING'], null, 'T002 รอตรวจ · ยังไม่ส่ง T003', { major: 'IT' });
  await I('iRej2', ['REJECTED', 'ลักษณะงานสั้นเกินไป กรุณาอธิบายงานที่ได้รับมอบหมายให้ชัดเจน'], ['WAITING'], 'T002 ถูกตีกลับ · T003 รอตรวจ');
  await I('iRej3', ['APPROVED'], ['REJECTED', 'วัตถุประสงค์ไม่สอดคล้องกับขอบเขตงาน'], 'T002 ผ่าน · T003 ถูกตีกลับ', { major: 'AI' });
  await I('iLate', null, null, 'ยังไม่ส่ง T002 — ได้ขยายเวลา', { ext: { T002: ymd(80) } });

  // ── นัดนิเทศหลายแบบ (ทุกคน T002/T003 ผ่านแล้ว) ──
  const OK = [['APPROVED'], ['APPROVED']];
  const slot = (n, from, to, type = 'ONSITE') => `${ymd(wd(n))}|${from}-${to}|${type}`;
  const appt = async (s, data, co) => {
    const a = await prisma.supervisionAppointment.create({ data: { studentId: s.pk, teacherId: tAdv.id, supervisionType: 'ONSITE', ...data } });
    if (co) {
      await prisma.supervisionCoTeacher.create({ data: { appointmentId: a.id, teacherId: tAdv2.id, ...co } });
      await prisma.supervisionAppointment.update({ where: { id: a.id }, data: { coTeacherName: 'อ.กิตติ พัฒนากุล' } });
    }
    return a;
  };
  let s;
  s = await I('sNone', ...OK, 'T002/T003 ผ่าน ยังไม่นัดนิเทศ');
  s = await I('sPend', ...OK, 'เสนอวันนิเทศแล้ว รออาจารย์ (ออนไลน์ 2 ตัวเลือก)');
  await appt(s, { supervisionType: 'ONLINE', onlineLink: 'https://meet.google.com/abc-defg-hij', proposedDates: JSON.stringify([slot(35, '09:00', '10:00', 'ONLINE'), slot(37, '13:00', '14:00', 'ONLINE')]), status: 'PENDING_TEACHER' });
  s = await I('sPendCo', ...OK, 'รออาจารย์ · อาจารย์ร่วมยังไม่ระบุวันว่าง', { major: 'IT' });
  await appt(s, { proposedDates: JSON.stringify([slot(40, '10:00', '11:00'), slot(41, '10:00', '11:00')]), status: 'PENDING_TEACHER' }, { availableDates: null });
  s = await I('sPendCoAns', ...OK, 'รออาจารย์ · อาจารย์ร่วมว่าง 1 วัน');
  await appt(s, { proposedDates: JSON.stringify([slot(44, '13:00', '14:00'), slot(45, '13:00', '14:00')]), status: 'PENDING_TEACHER' }, { availableDates: JSON.stringify([ymd(wd(45))]), respondedAt: d(-1) });
  s = await I('sRej', ...OK, 'อาจารย์ปฏิเสธวัน ต้องเสนอใหม่');
  await appt(s, { proposedDates: JSON.stringify([slot(33, '09:00', '10:00')]), status: 'TEACHER_REJECTED', rejectReason: 'ติดสอบกลางภาคสัปดาห์นั้น ขอเลื่อนเป็นสัปดาห์ถัดไป' });
  await prisma.notification.create({ data: { userId: s.userId, type: 'SUPERVISION_UPDATE', title: 'นัดนิเทศ', message: 'อาจารย์ขอให้เสนอวันนิเทศใหม่: ติดสอบกลางภาคสัปดาห์นั้น', link: '/student/supervision', relatedId: String(s.pk) } });
  s = await I('sConf', ...OK, 'ยืนยันวันนิเทศแล้ว รอหนังสือขอนิเทศ', { major: 'AI' });
  await appt(s, { proposedDates: JSON.stringify([slot(48, '10:00', '11:00')]), status: 'DATE_CONFIRMED', confirmedDate: at(wd(48), 10), confirmedEndDate: at(wd(48), 11) }, { availableDates: JSON.stringify([ymd(wd(48))]), respondedAt: d(-3) });
  s = await I('sLetterPend', ...OK, 'ยืนยันวันแล้ว · หนังสือขอนิเทศรอลงนาม');
  await appt(s, { proposedDates: JSON.stringify([slot(52, '13:00', '14:00')]), status: 'DATE_CONFIRMED', confirmedDate: at(wd(52), 13), confirmedEndDate: at(wd(52), 14), letterPendingAt: d(-1), letterDraftNumber: '660301.26.6.2/3901', letterDraftDate: d(-1) });
  s = await I('sLetter', ...OK, 'ออกหนังสือขอนิเทศแล้ว รอวันนิเทศ');
  await appt(s, { proposedDates: JSON.stringify([slot(55, '09:00', '10:00')]), status: 'LETTER_UPLOADED', confirmedDate: at(wd(55), 9), confirmedEndDate: at(wd(55), 10), officialLetterPath: file('sup', 'supervision'), letterDocNumber: '660301.26.6.2/3902', letterDocDate: d(-2) });
  for (const [key, label, major] of [['sDone1', 'นิเทศเสร็จแล้ว · ส่งแบบประเมินแล้ว', 'CS'], ['sDone2', 'นิเทศเสร็จแล้ว · ยังไม่ส่งแบบประเมิน', 'IT']]) {
    s = await I(key, ...OK, label, { major });
    await appt(s, { proposedDates: JSON.stringify([slot(2, '10:00', '11:00')]), status: 'COMPLETED', confirmedDate: at(-6, 10), confirmedEndDate: at(-6, 11), officialLetterPath: file('sup', 'supervision'), letterDocNumber: `660301.26.6.2/${key === 'sDone1' ? 3903 : 3904}`, letterDocDate: d(-14), evalSentAt: key === 'sDone1' ? d(-5) : null });
  }
  // นิเทศรวม 3 คน บริษัทเดียวกัน วันเดียวกัน คนละช่วงเวลา + หนังสือรวมฉบับเดียว
  const groupId = crypto.randomUUID();
  const gDay = wd(60);
  const gLetter = file('sup-group', 'supervision');
  for (const [i, [from, to]] of [['09:00', '10:00'], ['10:00', '11:00'], ['13:00', '14:00']].entries()) {
    s = await I(`g${i}`, ...OK, `นิเทศรวม ${i + 1}/3 (บริษัทเดียวกัน ${from} น.)`, { company: 1 });
    await appt(s, { proposedDates: JSON.stringify([`${ymd(gDay)}|${from}-${to}|ONSITE`]), status: 'LETTER_UPLOADED', groupId,
      confirmedDate: at(gDay, Number(from.slice(0, 2))), confirmedEndDate: at(gDay, Number(to.slice(0, 2))), officialLetterPath: gLetter, letterDocNumber: '660301.26.6.2/3905', letterDocDate: d(-1) });
  }

  // ── อื่นๆ ──
  await student('trashed', 'APPLYING', { trashed: true, label: 'ย้ายไปถังขยะแล้ว (กู้คืนได้)' });

  // T002/T003 ฟอร์มข้อมูลของคนที่ส่ง T002 แล้ว (หน้าตรวจ/PDF ต้องใช้)
  const t002Students = await prisma.document.findMany({ where: { type: 'T002_FORM', student: { userId: { in: Object.values(S).map((x) => x.userId) } } }, select: { studentId: true }, distinct: ['studentId'] });
  for (const { studentId } of t002Students) {
    const c = await prisma.studentCoop.findUnique({ where: { studentId }, include: { company: true } });
    await prisma.coopT002Form.create({ data: {
      studentId, companyNameTh: c.company.name, companyNameEn: c.company.nameEn, addressNo: '99/9', road: 'มิตรภาพ', subDistrict: 'ในเมือง', district: c.company.district, province: c.company.province, zipcode: c.company.zipcode,
      companyPhone: c.company.phone, companyEmail: c.company.email, managerName: 'นายวิชัย เจริญผล', managerPosition: 'กรรมการผู้จัดการ', managerPhone: c.company.phone,
      coordName: 'นางสาวสุดารัตน์ บุญมา', coordPosition: 'ผู้จัดการฝ่ายทรัพยากรบุคคล', coordPhone: '02-000-0001', coordEmail: c.company.email,
      supervisorName: 'นายธนวัฒน์ ศรีวงศ์', supervisorPosition: 'Senior Software Engineer', supervisorDept: 'ฝ่ายพัฒนาซอฟต์แวร์', supervisorPhone: '080-000-0000', supervisorEmail: 'mentor@example.com',
      jobPosition: 'Software Developer (Intern)', jobDescription: 'พัฒนาและทดสอบระบบเว็บแอปพลิเคชันของบริษัทร่วมกับทีมพัฒนา',
      accomAddrNo: '55/12', accomRoad: 'พหลโยธิน', accomSubDistrict: 'สามเสนใน', accomDistrict: 'พญาไท', accomProvince: 'กรุงเทพมหานคร', accomZipcode: '10400',
      accommodationAddress: '55/12 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400', accommodationPhone: '0800000002',
      emergencyName: 'นางสมใจ ใจดี', emergencyPhone: '0822222222', emergencyAddress: '12 หมู่ 5 ตำบลศิลา อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
    } });
  }

  console.log(`\nเพิ่มนักศึกษา ${made.length} คน (รหัสผ่านทุกบัญชี: ${PASSWORD} · บทบาท นักศึกษา)`);
  for (const [email, name, major, label] of made) console.log(`  ${email.padEnd(34)} ${name.padEnd(26)} ${major.padEnd(4)} ${label}`);
  console.log(`\nอาจารย์ที่ปรึกษาสหกิจ (นัดนิเทศทั้งหมด): wilaiwan.s@example.ac.th · อาจารย์ร่วม: kitti.p@example.ac.th · ประจำวิชา: somchai.r (CS) prasert.m (AI) nattaya.k (IT) · เจ้าหน้าที่ staff@example.ac.th`);
  void tCoop; void tAI; void tIT;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
