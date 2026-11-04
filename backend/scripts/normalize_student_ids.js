// แก้ข้อมูลครั้งเดียว: รหัสนักศึกษาที่ถูกตัดขีดเหลือเลข 10 หลัก (6430400011) → คืนเป็นแบบระบบทะเบียน (643040001-1)
// สาเหตุ: หน้าข้อมูลนักศึกษาตัดตัวอักษรที่ไม่ใช่ตัวเลขทิ้งทุกครั้งที่นักศึกษากดบันทึก (ตั้งแต่ 2026-05) — แก้แล้ว 2026-11-04
// ผลที่เกิด: นำเข้า Excel จากระบบทะเบียนครั้งต่อไปชนกับบัญชีเดิม ("อีเมลนี้ถูกใช้โดยรหัส 6430400011 แล้ว") · ค้นด้วยรหัสแบบมีขีดไม่เจอ
// รหัสผ่านไม่กระทบ (รหัสผ่านเริ่มต้นใช้แบบมีขีดอยู่แล้ว)
//
// ใช้: node scripts/normalize_student_ids.js          ← ดูรายการเฉย ๆ (ไม่แก้อะไร)
//      node scripts/normalize_student_ids.js --apply  ← แก้จริง (ข้ามคนที่รหัสแบบมีขีดมีคนอื่นใช้อยู่แล้ว)
const prisma = require('../config/prismaClient');
const { normalizeStudentId } = require('../utils/studentId');

const APPLY = process.argv.includes('--apply');

async function main() {
  const all = await prisma.student.findMany({ select: { id: true, studentId: true, firstName: true, lastName: true, deletedAt: true } });
  const taken = new Set(all.map((s) => s.studentId));
  const fix = [];
  const conflict = [];
  for (const s of all) {
    if (!/^\d{10}$/.test(s.studentId)) continue;
    const target = normalizeStudentId(s.studentId);
    const row = { id: s.id, from: s.studentId, to: target, name: `${s.firstName || ''} ${s.lastName || ''}`.trim(), trashed: !!s.deletedAt };
    (taken.has(target) ? conflict : fix).push(row);
  }

  console.log(`รหัสเลข 10 หลักไม่มีขีด: ${fix.length + conflict.length} คน`);
  console.log(`\nแก้ได้: ${fix.length} คน`);
  for (const r of fix) console.log(`  ${r.from} → ${r.to}   ${r.name}${r.trashed ? ' (ถังขยะ)' : ''}`);
  console.log(`\nแก้ไม่ได้ — รหัสแบบมีขีดเป็นของอีกบัญชี (ให้เจ้าหน้าที่ตรวจว่าเป็นคนเดียวกันไหม): ${conflict.length} คน`);
  for (const r of conflict) console.log(`  ${r.from} (${r.name}) ชนกับ ${r.to}`);
  if (conflict.length) console.log('  → ถ้าเป็นคนเดียวกัน (บัญชีซ้ำ) ให้ย้ายบัญชีที่ไม่ใช้ลงถังขยะแล้วลบถาวร จากนั้นรันสคริปต์นี้อีกครั้ง');

  if (!APPLY) {
    console.log('\n(ดูอย่างเดียว — ใส่ --apply เพื่อแก้)');
    return;
  }
  let done = 0;
  for (const r of fix) {
    try {
      // แก้เฉพาะที่ยังเป็นค่าเดิม (กันทับค่าที่มีคนแก้ระหว่างรันสคริปต์)
      done += (await prisma.student.updateMany({ where: { id: r.id, studentId: r.from }, data: { studentId: r.to } })).count;
    } catch (err) {
      console.error(`  แก้ ${r.from} ไม่สำเร็จ: ${err.code || err.message}`);
    }
  }
  console.log(`\nแก้แล้ว ${done} คน`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
