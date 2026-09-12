// สร้างนักศึกษาทดสอบพร้อม StudentCoop สำหรับ admin/doct000
// Usage: node backend/scripts/seed_test_student.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');

async function main() {
    // หา active period
    const period = await prisma.coopPeriod.findFirst({ where: { isActive: true } });

    // หา company แรกที่มีอยู่ (ถ้ามี)
    const company = await prisma.company.findFirst();

    const password = await bcrypt.hash('Test1234!', 10);

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
            gpa: 3.25,
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
    console.log(`  password : Test1234!`);
    console.log(`  studentId: ${student.studentId}`);
    console.log(`  coopId   : ${coop.id}  status: ${coop.status}`);
    console.log(`  period   : ${period ? `เทอม ${period.semester}/${period.academicYear}` : '(ไม่มี active period)'}`);
    console.log(`  company  : ${company ? company.name : '(ไม่มีบริษัทในระบบ)'}`);
    console.log('─────────────────────────────────────────\n');
}

main()
    .catch(err => { console.error('\nError:', err.message, '\n'); process.exit(1); })
    .finally(() => prisma.$disconnect());
