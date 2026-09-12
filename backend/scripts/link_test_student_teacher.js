require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../config/prismaClient');

async function main() {
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: 'wongsar@kku.ac.th' } },
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
