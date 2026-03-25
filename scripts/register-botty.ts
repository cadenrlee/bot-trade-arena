import prisma from '../src/lib/prisma';

async function main() {
  // Find Caden's account
  const user = await prisma.user.findUnique({ where: { username: 'caden' } });
  if (!user) {
    console.log('Create your account first (login at localhost:3000)');
    process.exit(1);
  }

  // Create or update BOTTY bot
  const bot = await prisma.bot.upsert({
    where: { id: 'botty-main' },
    update: { name: 'BOTTY', language: 'Python (Alpaca)', description: 'Multi-TF signal engine with EMA, RSI, MACD, ATR risk management' },
    create: {
      id: 'botty-main',
      userId: user.id,
      name: 'BOTTY',
      language: 'Python (Alpaca)',
      description: 'Multi-TF signal engine with EMA, RSI, MACD, ATR risk management',
      isPublic: true,
    },
  });

  console.log('BOTTY registered in Arena');
  console.log(`  Bot ID:  ${bot.id}`);
  console.log(`  API Key: ${bot.apiKey}`);
  console.log(`  Owner:   ${user.username}`);

  await prisma.$disconnect();
}
main();
