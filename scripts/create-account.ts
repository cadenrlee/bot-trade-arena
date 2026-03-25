import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('Arena2026!', 12);
  const user = await prisma.user.upsert({
    where: { username: 'caden' },
    update: {},
    create: {
      email: 'cadenlee777@gmail.com',
      username: 'caden',
      passwordHash: hash,
      displayName: 'Caden',
      elo: 1000,
      tier: 'BRONZE',
    },
  });
  console.log('Account created:', user.username, user.email);
  await prisma.$disconnect();
}
main();
