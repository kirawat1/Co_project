// scripts/migrate_passwords.js
// รัน: node scripts/migrate_passwords.js
// ทำหน้าที่: หา user ที่ password ยังเป็น plaintext แล้ว hash ให้ทั้งหมด

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');

const BCRYPT_PREFIX = /^\$2[ab]\$/; // bcrypt hash เริ่มด้วย $2a$ หรือ $2b$

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true }
  });

  const plaintext = users.filter(u => u.password && !BCRYPT_PREFIX.test(u.password));

  if (plaintext.length === 0) {
    console.log('ไม่พบ password ที่ยังเป็น plaintext ทุก user เรียบร้อยแล้ว');
    return;
  }

  console.log(`พบ ${plaintext.length} user ที่ password ยังเป็น plaintext — เริ่ม hash...`);

  for (const user of plaintext) {
    const hashed = await bcrypt.hash(user.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed }
    });
    console.log(`  ✓ ${user.email} (id=${user.id})`);
  }

  console.log('เสร็จสิ้น — password ทุก user ถูก hash แล้ว');
}

main()
  .catch(err => { console.error('Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
