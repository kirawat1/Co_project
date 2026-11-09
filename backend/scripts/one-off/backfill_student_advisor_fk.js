// One-time data fix: some Student rows have advisorName (free text) set but
// generalAdvisorId/coopAdvisorId (the FK actually used by teacher dashboard
// stats and the advisee list) left null. This made a teacher's dashboard
// count students that never showed up in their real advisee list.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TITLE_PREFIXES = ['ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ดร.', 'ผศ.', 'รศ.', 'ศ.', 'อ.'];

function splitFullName(fullName) {
  let trimmed = (fullName || '').trim();
  for (const title of TITLE_PREFIXES) {
    if (trimmed.startsWith(title)) {
      trimmed = trimmed.slice(title.length).trim();
      break;
    }
  }
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  };
}

async function main() {
  const students = await prisma.student.findMany({
    where: { generalAdvisorId: null, coopAdvisorId: null, advisorName: { not: null } },
    select: { id: true, studentId: true, advisorName: true },
  });

  for (const s of students) {
    const { firstName, lastName } = splitFullName(s.advisorName);
    if (!firstName) continue;

    const matches = await prisma.teacher.findMany({ where: { firstName, lastName } });
    if (matches.length === 1) {
      await prisma.student.update({
        where: { id: s.id },
        data: { generalAdvisorId: matches[0].id },
      });
      console.log(`${s.studentId} (${s.advisorName}) -> Teacher#${matches[0].id}`);
    } else if (matches.length === 0) {
      console.log(`SKIP ${s.studentId}: no teacher matches "${s.advisorName}"`);
    } else {
      console.log(`SKIP ${s.studentId}: ${matches.length} teachers match "${s.advisorName}"`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
