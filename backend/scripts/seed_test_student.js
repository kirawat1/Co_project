// สร้างนักศึกษาทดสอบพร้อม StudentCoop สำหรับ admin/doct000
// Usage: node backend/scripts/seed_test_student.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');

// ── การ์ดกันรันผิดเครื่อง ──────────────────────────────────────────────────
// สคริปต์นี้เขียนข้อมูลทดสอบลงฐานข้อมูลที่ DATABASE_URL ชี้อยู่ ซึ่งบนเครื่อง production
// ก็คือฐานข้อมูลจริง โปรเจกต์นี้ไม่ได้ตั้ง NODE_ENV ไว้ที่ไหนเลย การเช็ค production จึง
// ไม่ช่วยอะไร ใช้ fail-closed แทน คือต้องเปิดสวิตช์เองทุกครั้งถึงจะรันได้
if (process.env.SEED_ALLOW !== '1') {
    console.error('');
    console.error('ปฏิเสธการรัน: สคริปต์นี้เขียนข้อมูลลงฐานข้อมูลที่ DATABASE_URL ชี้อยู่');
    console.error('ถ้าแน่ใจว่าเป็นเครื่อง dev ให้รันด้วย');
    console.error('  SEED_ALLOW=1 SEED_PASSWORD=<รหัสผ่าน> node backend/scripts/seed_test_student.js');
    console.error('');
    process.exit(1);
}

async function main() {
    // หา active period
    const period = await prisma.coopPeriod.findFirst({ where: { isActive: true } });

    // หา company แรกที่มีอยู่ (ถ้ามี)
    const company = await prisma.company.findFirst();

    // ไม่ฝังรหัสผ่านไว้ใน repo — ถ้าฝังไว้ ใครอ่านโค้ดได้ก็รู้รหัสของบัญชีนี้ทันที
    const rawPassword = process.env.SEED_PASSWORD;
    if (!rawPassword) {
        console.error('');
        console.error('ต้องระบุรหัสผ่านเองผ่าน SEED_PASSWORD');
        console.error('  SEED_ALLOW=1 SEED_PASSWORD=<รหัสผ่าน> node backend/scripts/seed_test_student.js');
        console.error('');
        process.exit(1);
    }
    const password = await bcrypt.hash(rawPassword, 10);

    // สร้าง user
    const user = await prisma.user.upsert({
        where: { username: 'test_student_01' },
        update: {},
        create: {
            username: 'test_student_01',
            email: 'teststudent01@kku.ac.th',
            password,
            role: 'student',
            provider: 'credentials',
        },
    });

    // สร้าง student
    const student = await prisma.student.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            studentId: '643040001-1',
            prefix: 'MR',
            firstName: 'ทดสอบ',
            lastName: 'ระบบ',
            firstNameEn: 'Test',
            lastNameEn: 'System',
            major: 'วิทยาการคอมพิวเตอร์',
            year: '4',
            phone: '0812345678',
            email: 'teststudent01@kku.ac.th',
            userId: user.id,
        },
    });

    // สร้าง StudentCoop
    const coop = await prisma.studentCoop.upsert({
        where: { studentId: student.id },
        update: {},
        create: {
            studentId: student.id,
            status: 'APPLYING',
            t000Status: 'WAITING',
            coopPeriodId: period?.id ?? null,
            companyId: company?.id ?? null,
            jobPosition: 'Software Developer',
        },
    });

    console.log('\n✓ สร้างนักศึกษาทดสอบสำเร็จ');
    console.log('─────────────────────────────────────────');
    console.log(`  username : test_student_01`);
    console.log(`  password : (ตามที่ระบุใน SEED_PASSWORD)`);
    console.log(`  studentId: ${student.studentId}`);
    console.log(`  coopId   : ${coop.id}  status: ${coop.status}`);
    console.log(`  period   : ${period ? `เทอม ${period.semester}/${period.academicYear}` : '(ไม่มี active period)'}`);
    console.log(`  company  : ${company ? company.name : '(ไม่มีบริษัทในระบบ)'}`);
    console.log('─────────────────────────────────────────\n');
}

main()
    .catch(err => { console.error('\nError:', err.message, '\n'); process.exit(1); })
    .finally(() => prisma.$disconnect());
