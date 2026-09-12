// อัพเดทนักศึกษาทดสอบให้ถึงขั้นพร้อมออกหนังสือส่งตัว (ACCEPTANCE_CHECKED)
// Usage: node backend/scripts/seed_advance_to_placement.js
require('dotenv').config();
const prisma = require('../config/prismaClient');

async function main() {
    const student = await prisma.student.findUnique({
        where: { studentId: '643040001-1' },
        include: { coop: true },
    });

    if (!student) {
        console.error('\nError: ไม่พบนักศึกษา 643040001-1 — รัน seed_test_student.js ก่อน\n');
        process.exit(1);
    }

    const now = new Date();
    const reqDate = new Date('2026-08-01');
    const startDate = new Date('2026-07-01');
    const endDate = new Date('2026-10-31');

    await prisma.studentCoop.update({
        where: { studentId: student.id },
        data: {
            // Zone 1 passed: อาจารย์อนุมัติแล้ว
            status: 'ACCEPTANCE_CHECKED',
            teacherCheckComment: 'ผ่านเกณฑ์ คุณสมบัติครบถ้วน',
            teacherCheckDate: new Date('2026-07-10'),

            // Zone 2: เจ้าหน้าที่อนุมัติเอกสาร + ออกเอกสารยื่นสหกิจ (ใบแรก)
            t000Status: 'APPROVED',
            staffCheckComment: null,
            reqDocNumber: 'อว 660301/2026-001',
            reqDocDate: reqDate,
            reqLetterUrl: null,

            // Zone 3: นักศึกษายื่นใบตอบรับบริษัทแล้ว + ตรวจผ่าน
            acceptanceFileUrl: 'mock-acceptance.pdf',
            actualStartDate: startDate,
            actualEndDate: endDate,
        },
    });

    // สร้าง Document records เพื่อให้โชว์ใน T000 page (filter: shouldShow = hasDoc)
    const docDefs = [
        { name: 'ใบสมัครงานสหกิจ T000', type: 'T000_SIGNED', status: 'APPROVED' },
        { name: 'Transcript', type: 'TRANSCRIPT', status: 'APPROVED' },
        { name: 'CV', type: 'CV', status: 'APPROVED' },
        { name: 'บัตรนักศึกษา', type: 'STUDENT_CARD', status: 'APPROVED' },
        { name: 'ใบตอบรับจากบริษัท', type: 'ACCEPTANCE_FORM', status: 'APPROVED' },
    ];
    for (const d of docDefs) {
        const existing = await prisma.document.findFirst({ where: { studentId: student.id, type: d.type } });
        if (!existing) {
            await prisma.document.create({
                data: { studentId: student.id, name: d.name, path: `mock/${d.type}.pdf`, type: d.type, status: d.status },
            });
        }
    }

    console.log('\n✓ อัพเดทข้อมูลสำเร็จ');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  นักศึกษา   : ${student.firstName} ${student.lastName} (${student.studentId})`);
    console.log(`  status     : ACCEPTANCE_CHECKED`);
    console.log(`  reqDocNumber: อว 660301/2026-001  reqDocDate: 01/08/2569`);
    console.log(`  วันงาน     : 01/07/2569 – 31/10/2569`);
    console.log(`  Documents  : T000_SIGNED, TRANSCRIPT, CV, STUDENT_CARD, ACCEPTANCE_FORM (APPROVED)`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('\n  ✅ พร้อมทดสอบ "ออกหนังสือส่งตัว" ในหน้า admin/doct000\n');
}

main()
    .catch(err => { console.error('\nError:', err.message, '\n'); process.exit(1); })
    .finally(() => prisma.$disconnect());
