import 'dotenv/config';
import { runMigrations } from './migrator.js';

// npm run db:migrate                       apply pending migrations
// npm run db:migrate -- --baseline 0013    adopt an existing, hand-migrated database
const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const flagIndex = process.argv.indexOf('--baseline');
const baseline = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
if (flagIndex >= 0 && !baseline) {
  console.error('--baseline needs a migration prefix, e.g. --baseline 0013');
  process.exit(1);
}

runMigrations({ connectionString, baseline }).catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
