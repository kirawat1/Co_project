// ย้ายนักศึกษาที่ค้างสถานะหลักแบบเก่า (T002_SUBMITTED ... T003_APPROVED) -> INTERNSHIP_STARTED
//   เพราะ T002/T003 เป็นฟอร์มคู่ขนานแล้ว: สถานะหลักคงที่ ส่วนสถานะของแต่ละฟอร์มอ่านจากไฟล์ล่าสุด (Document.status)
//   ไฟล์ที่สถานะเก่าบอกว่า "ต้องแก้/ผ่านแล้ว" แต่ไฟล์ยัง WAITING ต้องแก้ให้ตรง ไม่งั้นข้อมูลจะหายไปตอนสถานะหลักเปลี่ยน
// รันครั้งเดียวหลัง deploy (รันซ้ำได้ — ไม่มีใครเหลือสถานะเก่าแล้ว จึง moved 0)
//   node scripts/migrate_internship_forms.js --dry-run   ดูว่าจะย้ายใคร (ไม่เขียนอะไร)
//   node scripts/migrate_internship_forms.js             เขียนจริง (ทรานแซกชันเดียว)
const { LEGACY_INTERNSHIP_STATUSES, FORM_TYPES, formState, latestFormDoc } = require('../utils/internshipForms');

// สถานะเก่า -> ฟอร์มที่สถานะนั้นหมายถึง + สถานะไฟล์ที่ควรเป็นเมื่อไฟล์ยัง WAITING
//   (T002_SUBMITTED/T003_SUBMITTED = รอตรวจจริง จึงไม่ต้องแก้ไฟล์)
const RULES = {
  T002_SUBMITTED: { form: 'T002' },
  T002_EDITS_REQUIRED: { form: 'T002', fixTo: 'REJECTED' },
  T003_SUBMITTED: { form: 'T003' },
  T003_EDITS_REQUIRED: { form: 'T003', fixTo: 'REJECTED' },
  T003_APPROVED: { form: 'T003', fixTo: 'APPROVED' },
};

async function migrateInternshipForms(db, { dryRun = false } = {}) {
  const run = async (client) => {
    const report = { byStatus: {}, moved: 0, docFixes: [], missingFile: [] };
    const coops = await client.studentCoop.findMany({
      where: { status: { in: LEGACY_INTERNSHIP_STATUSES } },
      select: { studentId: true, status: true },
    });
    for (const coop of coops) {
      const rule = RULES[coop.status];
      report.byStatus[coop.status] = (report.byStatus[coop.status] || 0) + 1;
      report.moved++;
      const doc = await latestFormDoc(client, coop.studentId, rule.form);
      // สถานะบอกว่าส่งแล้วแต่ไม่มีไฟล์ — ไม่เดา แค่รายงานให้คนตรวจ
      if (!doc) {
        report.missingFile.push({ studentId: coop.studentId, status: coop.status });
        continue;
      }
      if (rule.fixTo && formState(doc) === 'WAITING') {
        report.docFixes.push({ studentId: coop.studentId, type: FORM_TYPES[rule.form], from: doc.status, to: rule.fixTo });
        if (!dryRun) await client.document.update({ where: { id: doc.id }, data: { status: rule.fixTo } });
      }
    }
    if (!dryRun && coops.length) {
      await client.studentCoop.updateMany({
        where: { status: { in: LEGACY_INTERNSHIP_STATUSES } },
        data: { status: 'INTERNSHIP_STARTED' },
      });
    }
    return report;
  };
  // dry-run ไม่เขียนจึงไม่ต้องเปิดทรานแซกชัน; รันจริงต้องสำเร็จทั้งหมดหรือไม่เปลี่ยนเลย
  return dryRun ? run(db) : db.$transaction(run, { timeout: 60000 });
}

function printReport(report, dryRun) {
  const tag = dryRun ? '[dry-run] ' : '';
  console.log(`${tag}ย้ายสถานะหลัก -> INTERNSHIP_STARTED ทั้งหมด ${report.moved} คน`);
  for (const [status, n] of Object.entries(report.byStatus)) console.log(`${tag}  ${status}: ${n} คน`);
  console.log(`${tag}แก้สถานะไฟล์ ${report.docFixes.length} ไฟล์`);
  for (const f of report.docFixes) console.log(`${tag}  นักศึกษา #${f.studentId} ${f.type}: ${f.from} -> ${f.to}`);
  console.log(`${tag}สถานะบอกว่าส่งแล้วแต่ไม่มีไฟล์ ${report.missingFile.length} คน (ไม่แก้ไฟล์ ให้ตรวจเอง)`);
  for (const m of report.missingFile) console.log(`${tag}  นักศึกษา #${m.studentId} (${m.status})`);
}

module.exports = { migrateInternshipForms };

// require ในเทสต์ต้องไม่รันเอง
if (require.main === module) {
  require('dotenv').config();
  const prisma = require('../config/prismaClient');
  const dryRun = process.argv.includes('--dry-run');
  migrateInternshipForms(prisma, { dryRun })
    .then((report) => printReport(report, dryRun))
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
