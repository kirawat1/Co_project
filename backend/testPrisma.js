const prisma = require('./config/prismaClient');

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users);

  const announcements = await prisma.announcement.findMany();
  console.log('Announcements:', announcements);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
