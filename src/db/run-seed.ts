// ============================================================
// Seed Runner — Initialize the database with synthetic data
// Run with: npm run seed
// ============================================================

import { getDb, saveDb, closeDb } from './connection';
import { seedDatabase } from './seed';

async function main() {
  console.log('🌱 Seeding database...\n');

  const db = await getDb();
  const result = seedDatabase(db);
  saveDb();

  console.log(`✅ Seeded ${result.merchants} merchants`);
  console.log(`✅ Seeded ${result.products} products`);
  console.log('\n🎉 Database ready!\n');

  closeDb();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
