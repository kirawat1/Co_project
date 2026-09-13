// scripts/set_default_student_passwords.js
// ตั้งรหัสผ่านเริ่มต้น (= รหัสนักศึกษาแบบมีขีด) ให้บัญชีนักศึกษาที่ยังไม่มีรหัสผ่าน
// ใช้ครั้งเดียวหลัง deploy ฟีเจอร์รหัสผ่านนักศึกษา — บัญชีที่นำเข้า/เพิ่มหลังจากนี้ได้รหัสเริ่มต้นเองแล้ว
//
// รัน (ดูก่อน ยังไม่เขียน DB):  node scripts/set_default_student_passwords.js
// รันจริง:                       node scripts/set_default_student_passwords.js --apply
//
// ไม่แตะบัญชีที่มีรหัสผ่านอยู่แล้ว (นักศึกษาเปลี่ยนเอง/บัญชีทดสอบ) และไม่แตะอาจารย์/เจ้าหน้าที่

require('dotenv').config();
const prisma = require('../config/prismaClient');
const { defaultStudentPassword, hashDefaultStudentPassword } = require('../utils/studentPassword');

const APPLY = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'student', password: null, student: { isNot: null } },
    select: { id: true, email: true, student: { select: { studentId: true } } },
    orderBy: { id: 'asc' },
  });

  const usable = users.filter(u => defaultStudentPassword(u.student.studentId));
  const noStudentId = users.length - usable.length;

  console.log(`บัญชีนักศึกษาที่ยังไม่มีรหัสผ่าน: ${users.length}`);
  if (noStudentId > 0) console.log(`  ข้าม ${noStudentId} บัญชีที่ไม่มีรหัสนักศึกษา`);
  const odd = usable.filter(u => !/^\d{9}-\d$/.test(defaultStudentPassword(u.student.studentId)));
  if (odd.length > 0) {
    console.log(`  ⚠ ${odd.length} บัญชีรหัสนักศึกษาไม่ใช่รูปแบบ 123456789-0 (จะใช้รหัสตามที่เก็บไว้):`);
    odd.slice(0, 10).forEach(u => console.log(`    id=${u.id} ${u.email} รหัส "${u.student.studentId}"`));
  }

  if (!APPLY) {
    console.log(`\nโหมดดูอย่างเดียว — ยังไม่เขียนฐานข้อมูล จะตั้งรหัสผ่านให้ ${usable.length} บัญชี`);
    console.log('ถ้าถูกต้องให้รันซ้ำด้วย --apply');
    return;
  }

  let done = 0, skipped = 0;
  for (const u of usable) {
    const password = await hashDefaultStudentPassword(u.student.studentId);
    // เงื่อนไข password: null กันทับรหัสที่เพิ่งถูกตั้งระหว่างสคริปต์กำลังรัน
    const r = await prisma.user.updateMany({ where: { id: u.id, password: null }, data: { password } });
    if (r.count === 1) done++; else skipped++;
    if ((done + skipped) % 50 === 0) console.log(`  ${done + skipped}/${usable.length}`);
  }
  console.log(`\nเสร็จสิ้น — ตั้งรหัสผ่านแล้ว ${done} บัญชี${skipped ? `, ข้าม ${skipped} บัญชีที่มีรหัสผ่านระหว่างรัน` : ''}`);
}

main()
  .catch(err => { console.error('Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
