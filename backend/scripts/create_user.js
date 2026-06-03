// scripts/create_user.js
// สร้าง User ใหม่ในฐานข้อมูล
//
// Usage:
//   node scripts/create_user.js --username=admin01 --email=admin@kku.ac.th --password=MyPass123 --role=staff
//
// Roles ที่รองรับ: student | teacher | staff

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');

const VALID_ROLES = ['student', 'teacher', 'staff'];

// ─── parse CLI args ───────────────────────────────────────────
function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    args[key] = rest.join('=');
  }
  return args;
}

// ─── main ─────────────────────────────────────────────────────
async function main() {
  const { username, email, password, role } = parseArgs();

  // Validate input
  const missing = ['username', 'password', 'role'].filter(k => !{ username, email, password, role }[k]);
  if (missing.length) {
    console.error(`\nError: ขาด argument: ${missing.join(', ')}`);
    console.error('Usage: node scripts/create_user.js --username=xxx --email=xxx --password=xxx --role=staff\n');
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`\nError: role "${role}" ไม่ถูกต้อง  ใช้ได้เฉพาะ: ${VALID_ROLES.join(' | ')}\n`);
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('\nError: password ต้องมีอย่างน้อย 6 ตัวอักษร\n');
    process.exit(1);
  }

  // Check duplicate username
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`\nError: username "${username}" มีอยู่แล้วในระบบ\n`);
    process.exit(1);
  }

  // Hash password
  const hashed = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      username,
      email: email || null,
      password: hashed,
      role,
      provider: 'credentials',
    },
  });

  console.log('\n✓ สร้าง User สำเร็จ');
  console.log('─────────────────────────────');
  console.log(`  id       : ${user.id}`);
  console.log(`  username : ${user.username}`);
  console.log(`  email    : ${user.email || '-'}`);
  console.log(`  role     : ${user.role}`);
  console.log(`  สร้างเมื่อ: ${user.createdAt.toLocaleString('th-TH')}`);
  console.log('─────────────────────────────\n');
}

main()
  .catch(err => {
    console.error('\nError:', err.message, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
