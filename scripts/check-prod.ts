import prisma from '../src/lib/prisma';
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, email: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
  const bots = await prisma.bot.findMany({ select: { id: true, name: true, userId: true, apiKey: true } });
  console.log('Bots:', JSON.stringify(bots, null, 2));
  await prisma.$disconnect();
}
main();
