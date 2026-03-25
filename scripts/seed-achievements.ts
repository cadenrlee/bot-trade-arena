import { achievementService } from '../src/services/achievementService';

async function main() {
  const count = await achievementService.seedAchievements();
  console.log(`Seeded ${count} achievements`);
  process.exit(0);
}
main();
