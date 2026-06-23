// One-time data fix: many Teacher.major values were stored as full Thai names
// (e.g. "วิทยาการคอมพิวเตอร์") instead of the short codes used by CoopCriteria
// (e.g. "CS"), which broke the major filter/display on the teacher management page.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAME_TO_CODE = {
  'วิทยาการคอมพิวเตอร์': 'CS',
  'เทคโนโลยีสารสนเทศ': 'IT',
  'ภูมิสารสนเทศศาสตร์': 'GIS',
  'ความมั่นคงปลอดภัยไซเบอร์': 'CYB',
  'ปัญญาประดิษฐ์': 'AI',
  'วิทยาการข้อมูลและปัญญาประดิษฐ์': 'AI',
};

async function main() {
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    const result = await prisma.teacher.updateMany({
      where: { major: name },
      data: { major: code },
    });
    if (result.count > 0) console.log(`${name} -> ${code}: ${result.count} แถว`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
