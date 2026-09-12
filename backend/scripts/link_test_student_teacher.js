require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../config/prismaClient');

// ── การ์ดกันรันผิดเครื่อง ──────────────────────────────────────────────────
// สคริปต์นี้เปลี่ยนอาจารย์ที่ปรึกษาของนักศึกษาในฐานข้อมูลที่ DATABASE_URL ชี้อยู่ ซึ่งบน
// เครื่อง production ก็คือฐานข้อมูลจริง โปรเจกต์นี้ไม่ได้ตั้ง NODE_ENV ไว้ที่ไหนเลย
// การเช็ค production จึงไม่ช่วยอะไร ใช้ fail-closed แทน ต้องเปิดสวิตช์เองทุกครั้ง
if (process.env.SEED_ALLOW !== '1') {
  console.error('');
  console.error('ปฏิเสธการรัน: สคริปต์นี้แก้อาจารย์ที่ปรึกษาในฐานข้อมูลที่ DATABASE_URL ชี้อยู่');
  console.error('ถ้าแน่ใจว่าเป็นเครื่อง dev ให้รันด้วย');
  console.error('  SEED_ALLOW=1 SEED_TEACHER_EMAIL=<อีเมลอาจารย์> node backend/scripts/link_test_student_teacher.js');
  console.error('');
  process.exit(1);
}

async function main() {
  // รับอีเมลอาจารย์จาก env ไม่ฝังอีเมลของบุคคลจริงไว้ใน repo
  const teacherEmail = process.env.SEED_TEACHER_EMAIL;
  if (!teacherEmail) {
    console.error('');
    console.error('ต้องระบุอีเมลอาจารย์ผ่าน SEED_TEACHER_EMAIL');
    console.error('');
    process.exit(1);
  }

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: teacherEmail } },
    include: { user: true }
  });
  console.log('Teacher:', teacher?.id, teacher?.user?.email);

  const student = await prisma.student.findFirst({ where: { studentId: '643040001-1' } });
  console.log('Student:', student?.id, 'generalAdvisorId:', student?.generalAdvisorId);

  if (teacher && student) {
    await prisma.student.update({
      where: { id: student.id },
      data: { generalAdvisorId: teacher.id }
    });
    console.log('Updated: student generalAdvisorId =', teacher.id);
  } else {
    console.log('Teacher or student not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
