// scripts/sync_username_with_email.js
// ตั้ง username = อีเมล ให้บัญชีนักศึกษาและอาจารย์ที่ username ยังไม่ใช่อีเมล
// (เช่น นักศึกษาที่นำเข้า Excel ก่อนหน้านี้ ซึ่ง username เป็นรหัสนักศึกษา)
// ใช้ครั้งเดียวหลัง deploy — หลังจากนี้นำเข้า/เพิ่ม/แก้อีเมล จะตั้ง username = อีเมลให้เอง
//
// รัน (ดูก่อน ยังไม่เขียน DB):  node scripts/sync_username_with_email.js
// รันจริง:                       node scripts/sync_username_with_email.js --apply
//
// ไม่แตะบัญชีเจ้าหน้าที่ (ตั้ง username เองในหน้าจัดการเจ้าหน้าที่) และบัญชีที่ไม่มีอีเมล
// ถ้าอีเมลนั้นถูกใช้เป็น username ของบัญชีอื่นอยู่แล้ว จะข้ามและแสดงรายการให้ตรวจเอง

require('dotenv').config();
const prisma = require('../config/prismaClient');
const { normalizeEmail } = require('../utils/userEmail');

const APPLY = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['student', 'teacher'] }, email: { not: null } },
    select: { id: true, role: true, username: true, email: true },
    orderBy: { id: 'asc' },
  });

  const targets = users.filter((u) => normalizeEmail(u.email) && normalizeEmail(u.username) !== normalizeEmail(u.email));
  const byRole = targets.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] || 0) + 1 }), {});
  console.log(`บัญชีที่ username ยังไม่ใช่อีเมล: ${targets.length} (${Object.entries(byRole).map(([r, n]) => `${r} ${n}`).join(', ') || '-'})`);
  targets.slice(0, 5).forEach((u) => console.log(`  ตัวอย่าง id=${u.id} ${u.role}: "${u.username}" → "${normalizeEmail(u.email)}"`));

  // อีเมลที่ถูกใช้เป็น username ของบัญชีอื่น (หรือซ้ำกันเองในรายการ) → ข้าม
  const allUsernames = new Map((await prisma.user.findMany({ select: { id: true, username: true } })).map((u) => [normalizeEmail(u.username), u.id]));
  const seen = new Map();
  const conflicts = [];
  const ok = [];
  for (const u of targets) {
    const email = normalizeEmail(u.email);
    const ownerId = allUsernames.get(email);
    if ((ownerId && ownerId !== u.id) || seen.has(email)) { conflicts.push(u); continue; }
    seen.set(email, u.id);
    ok.push(u);
  }
  if (conflicts.length > 0) {
    console.log(`\n⚠ ข้าม ${conflicts.length} บัญชี เพราะอีเมลซ้ำกับ username ของบัญชีอื่น (ตรวจเอง):`);
    conflicts.forEach((u) => console.log(`  id=${u.id} ${u.role} username="${u.username}" email="${u.email}"`));
  }

  if (!APPLY) {
    console.log(`\nโหมดดูอย่างเดียว — ยังไม่เขียนฐานข้อมูล จะเปลี่ยน username ${ok.length} บัญชี`);
    console.log('ถ้าถูกต้องให้รันซ้ำด้วย --apply');
    return;
  }

  let done = 0;
  for (const u of ok) {
    // เงื่อนไข username เดิม กันทับถ้ามีการแก้บัญชีระหว่างสคริปต์รัน
    const r = await prisma.user.updateMany({ where: { id: u.id, username: u.username }, data: { username: normalizeEmail(u.email) } });
    done += r.count;
    if (done > 0 && done % 100 === 0) console.log(`  ${done}/${ok.length}`);
  }
  console.log(`\nเสร็จสิ้น — เปลี่ยน username เป็นอีเมลแล้ว ${done} บัญชี`);
}

main()
  .catch((err) => { console.error('Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
