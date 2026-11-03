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

// ผลตรวจของไฟล์ล่าสุดที่ขัดกับสิ่งที่สถานะเก่าบอก — แค่รายงาน ไม่แก้ (คนต้องดูเอง)
const CONFLICTS = {
  T003_APPROVED: { form: 'T003', actual: 'REJECTED' },
  T002_EDITS_REQUIRED: { form: 'T002', actual: 'APPROVED' },
  T003_EDITS_REQUIRED: { form: 'T003', actual: 'APPROVED' },
};

async function migrateInternshipForms(db, { dryRun = false } = {}) {
  const run = async (client) => {
    const report = { byStatus: {}, moved: 0, docFixes: [], missingFile: [], conflicts: [], duplicates: [] };
    const coops = await client.studentCoop.findMany({
      where: { status: { in: LEGACY_INTERNSHIP_STATUSES } },
      select: { studentId: true, status: true },
    });
    for (const coop of coops) {
      const rule = RULES[coop.status];
      report.byStatus[coop.status] = (report.byStatus[coop.status] || 0) + 1;
      report.moved++;
      // สถานะ T003_* บอกเป็นนัยว่าเคยส่ง T002 แล้ว — ไม่มีไฟล์ T002 ก็รายงาน (ไม่เดา)
      if (rule.form === 'T003' && !(await latestFormDoc(client, coop.studentId, 'T002'))) {
        report.missingFile.push({ studentId: coop.studentId, status: coop.status, form: FORM_TYPES.T002 });
      }
      const doc = await latestFormDoc(client, coop.studentId, rule.form);
      // สถานะบอกว่าส่งแล้วแต่ไม่มีไฟล์ — ไม่เดา แค่รายงานให้คนตรวจ
      if (!doc) {
        report.missingFile.push({ studentId: coop.studentId, status: coop.status, form: FORM_TYPES[rule.form] });
        continue;
      }
      const conflict = CONFLICTS[coop.status];
      if (conflict && formState(doc) === conflict.actual) {
        report.conflicts.push({ studentId: coop.studentId, status: coop.status, type: FORM_TYPES[conflict.form], fileStatus: doc.status });
      }
      if (rule.fixTo && formState(doc) === 'WAITING') {
        report.docFixes.push({ studentId: coop.studentId, type: FORM_TYPES[rule.form], from: doc.status, to: rule.fixTo });
        if (!dryRun) await client.document.update({ where: { id: doc.id }, data: { status: rule.fixTo } });
      }
    }
    // นักศึกษาที่มีแถวซ้ำของฟอร์มเดียวกัน — ระบบใช้แถว id มากสุดเป็นไฟล์ล่าสุด ไม่ลบแถวเก่า รายงานให้รู้เฉยๆ
    const formDocs = await client.document.findMany({
      where: { type: { in: Object.values(FORM_TYPES) } },
      select: { studentId: true, type: true },
    });
    const counts = new Map();
    for (const d of formDocs) {
      const key = `${d.studentId}:${d.type}`;
      counts.set(key, { studentId: d.studentId, type: d.type, count: (counts.get(key)?.count || 0) + 1 });
    }
    report.duplicates = [...counts.values()].filter((c) => c.count > 1);
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
  for (const m of report.missingFile) console.log(`${tag}  นักศึกษา #${m.studentId} (${m.status}) ไม่มีไฟล์ ${m.form}`);
  console.log(`${tag}ผลตรวจของไฟล์ล่าสุดขัดกับสถานะเก่า ${report.conflicts.length} คน (ไม่แก้ ให้ตรวจเอง)`);
  for (const c of report.conflicts) console.log(`${tag}  นักศึกษา #${c.studentId} (${c.status}) ${c.type} ไฟล์ล่าสุดเป็น ${c.fileStatus}`);
  console.log(`${tag}มีไฟล์ฟอร์มซ้ำหลายแถว ${report.duplicates.length} รายการ (ระบบใช้แถวล่าสุด ไม่ลบแถวเก่า)`);
  for (const d of report.duplicates) console.log(`${tag}  นักศึกษา #${d.studentId} ${d.type}: ${d.count} แถว`);
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
