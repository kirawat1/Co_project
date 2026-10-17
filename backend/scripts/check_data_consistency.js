// scripts/check_data_consistency.js
// ตรวจข้อมูลที่ไม่ควรเกิด (อ่านอย่างเดียว ไม่แก้อะไร) — ใช้หลัง deploy หรือเมื่อสงสัยข้อมูลค้างจากบั๊กเก่า
//   เช่น สถานะ "ออกหนังสือแล้ว" แต่ไม่มีไฟล์ · สถานะถูกดึงย้อนกลับ (มีนัดนิเทศแต่ยังไม่ออกฝึก) · เลขที่หนังสือซ้ำข้ามฉบับ · ไฟล์หายจากดิสก์
//
// Usage (ในโฟลเดอร์ backend):
//   node scripts/check_data_consistency.js
//   FOUND = มีข้อมูลที่ต้องตรวจ (แสดงตัวอย่าง 4 รายการแรก) · ok = ไม่พบ
const path = require('path');
process.chdir(path.join(__dirname, '..'));
require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const ORDER = ['NOT_SUBMITTED', 'APPLYING', 'PENDING_GRADE', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED', 'QUALIFIED', 'DOCS_APPROVED', 'EDITS_REQUIRED', 'REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED', 'T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED', 'COMPLETED'];
const rank = (s) => ORDER.indexOf(s);
const rows = [];
const check = (name, list, show) => rows.push(`${list.length ? 'FOUND' : 'ok   '} ${name}: ${list.length}${list.length ? ' — ' + list.slice(0, 4).map(show).join(' ; ') : ''}`);

(async () => {
  const coops = await p.studentCoop.findMany({ where: { student: { deletedAt: null } }, include: { student: { select: { studentId: true, major: true } } } });
  const sid = (c) => `${c.student.studentId}(${c.status})`;
  check('ผ่านขั้นออกหนังสือขอความอนุเคราะห์แล้ว แต่ไม่มีไฟล์หนังสือ', coops.filter((c) => rank(c.status) >= rank('REQ_LETTER_ISSUED') && rank(c.status) <= rank('COMPLETED') && !c.reqLetterUrl), sid);
  check('ผ่านขั้นออกหนังสือส่งตัวแล้ว แต่ไม่มีไฟล์หนังสือส่งตัว', coops.filter((c) => rank(c.status) >= rank('PLACEMENT_LETTER_ISSUED') && !c.placeLetterUrl), sid);
  check('มีป้ายหนังสือรวม แต่ไม่มีไฟล์', coops.filter((c) => (c.reqLetterBatch && !c.reqLetterUrl) || (c.placeLetterBatch && !c.placeLetterUrl)), sid);
  check('ไฟล์หนังสือในข้อมูลสหกิจหายจากดิสก์', coops.filter((c) => [c.reqLetterUrl, c.placeLetterUrl].some((f) => f && !fs.existsSync(path.join('uploads', f)))), (c) => `${sid(c)} ${c.reqLetterUrl || ''} ${c.placeLetterUrl || ''}`);
  // หนังสือรวม: ทุกคนใน batch เลขเดียวกัน ไฟล์เดียวกัน
  const byBatch = {};
  for (const c of coops) { if (c.reqLetterBatch) (byBatch['R' + c.reqLetterBatch] ||= []).push([c.reqDocNumber, c.reqLetterUrl, c]); if (c.placeLetterBatch) (byBatch['P' + c.placeLetterBatch] ||= []).push([c.placeDocNumber, c.placeLetterUrl, c]); }
  check('หนังสือรวมฉบับเดียวกันแต่เลขที่/ไฟล์ไม่ตรงกัน', Object.entries(byBatch).filter(([, v]) => new Set(v.map((x) => x[0])).size > 1 || new Set(v.map((x) => x[1])).size > 1), ([k]) => k);
  // เลขที่หนังสือซ้ำข้ามฉบับ (คนละ batch หรือไม่มี batch)
  const dup = (field, batchField) => {
    const m = {};
    for (const c of coops) if (c[field]) (m[c[field]] ||= new Set()).add(c[batchField] || `solo:${c.studentId}`);
    return Object.entries(m).filter(([, s]) => s.size > 1);
  };
  check('เลขที่หนังสือขอความอนุเคราะห์ซ้ำข้ามฉบับ', dup('reqDocNumber', 'reqLetterBatch'), ([n]) => n);
  check('เลขที่หนังสือส่งตัวซ้ำข้ามฉบับ', dup('placeDocNumber', 'placeLetterBatch'), ([n]) => n);
  // รอบที่ผูกไว้ แต่หลักสูตรของนักศึกษาไม่ได้ตั้งในรอบนั้น
  const pm = new Set((await p.coopPeriodMajor.findMany({ select: { periodId: true, major: true } })).map((r) => `${r.periodId}|${r.major}`));
  check('นักศึกษาผูกรอบที่หลักสูตรตัวเองไม่ได้ตั้ง', coops.filter((c) => c.coopPeriodId && c.student.major && !pm.has(`${c.coopPeriodId}|${c.student.major}`)), (c) => `${c.student.studentId} ${c.student.major} รอบ${c.coopPeriodId}`);

  const appts = await p.supervisionAppointment.findMany({ where: { student: { deletedAt: null } }, include: { coTeachers: true, student: { select: { studentId: true } } } });
  check('อาจารย์หลักเป็นอาจารย์ร่วมของนัดตัวเองด้วย', appts.filter((a) => a.coTeachers.some((c) => c.teacherId === a.teacherId)), (a) => `นัด${a.id}`);
  check('ยืนยันวันแล้ว แต่ไม่มีวันนิเทศ', appts.filter((a) => ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'].includes(a.status) && !a.confirmedDate), (a) => `นัด${a.id} ${a.status}`);
  check('อัปโหลดหนังสือนิเทศแล้ว แต่ไม่มีไฟล์', appts.filter((a) => ['LETTER_UPLOADED'].includes(a.status) && !a.officialLetterPath), (a) => `นัด${a.id}`);
  check('ไฟล์หนังสือขอนิเทศหายจากดิสก์', appts.filter((a) => a.officialLetterPath && !fs.existsSync(path.join('uploads', 'supervision', a.officialLetterPath))), (a) => `นัด${a.id} ${a.officialLetterPath}`);
  const groups = {};
  for (const a of appts) if (a.groupId) (groups[a.groupId] ||= []).push(a);
  check('นัดกลุ่มเดียวกันแต่วันนิเทศไม่ตรงกัน', Object.values(groups).filter((g) => new Set(g.map((a) => a.confirmedDate && new Date(a.confirmedDate).toISOString().slice(0, 10))).size > 1), (g) => g.map((a) => a.id).join(','));
  const dupSup = {};
  for (const a of appts) if (a.letterDocNumber) (dupSup[a.letterDocNumber] ||= new Set()).add(a.groupId || `solo:${a.id}`);
  check('เลขที่หนังสือขอนิเทศซ้ำข้ามฉบับ', Object.entries(dupSup).filter(([, s]) => s.size > 1), ([n]) => n);
  // นัดนิเทศของนักศึกษาที่ยังไม่ออกฝึก
  check('มีนัดนิเทศทั้งที่นักศึกษายังไม่ออกฝึก', appts.filter((a) => { const c = coops.find((x) => x.studentId === a.studentId); return c && rank(c.status) < rank('INTERNSHIP_STARTED'); }), (a) => `นัด${a.id}`);

  const docs = await p.document.findMany({ where: { student: { deletedAt: null } }, select: { id: true, type: true, path: true, studentId: true } });
  check('เอกสารที่ไฟล์หายจากดิสก์', docs.filter((d) => d.path && !fs.existsSync(path.join('uploads', path.basename(d.path)))), (d) => `doc${d.id} ${d.type}`);

  const anns = await p.announcement.findMany();
  const majors = new Set((await p.coopCriteria.findMany({ select: { major: true } })).map((m) => m.major));
  check('ประกาศส่งถึงหลักสูตรที่ไม่มีในระบบ', anns.filter((a) => Array.isArray(a.targetMajors) && a.targetMajors.some((m) => !majors.has(m))), (a) => `${a.title} ${JSON.stringify(a.targetMajors)}`);
  check('ประกาศถึงเวลาแล้วแต่ยังไม่ได้แจ้ง (งานตั้งเวลาไม่ทำงาน?)', anns.filter((a) => a.publishAt && new Date(a.publishAt) < new Date(Date.now() - 5 * 60_000) && !a.notifiedAt), (a) => a.title);

  const users = await p.user.findMany({ where: { role: 'student' }, select: { id: true, email: true, student: { select: { id: true } } } });
  check('บัญชีนักศึกษาที่ไม่มีข้อมูลนักศึกษา (เข้าแล้วเจอ "ไม่พบข้อมูลนักศึกษา")', users.filter((u) => !u.student), (u) => u.email);

  console.log(rows.join('\n'));
  await p.$disconnect();
})();
