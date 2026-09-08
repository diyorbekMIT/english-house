import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const isProduction = process.env.NODE_ENV === 'production' || process.env['DATABASE_URL']?.includes('herokuapp.com');

const run = async (): Promise<void> => {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './db/migrations' });
  console.log('Migrations applied successfully.');
  await pool.end();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});