import prisma from '../src/lib/prisma';
async function main() {
  const bot = await prisma.bot.findUnique({ where: { id: 'botty-main' } });
  if (bot) console.log(bot.apiKey);
  else console.log('NOT_FOUND');
  await prisma.$disconnect();
}
main();
