import pg from 'pg';
import { TEST_DATABASE_URL } from '../../vitest.config.js';
import { runMigrations } from '../../db/migrator.js';

const ROLES = ['SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'TEACHER'];

// Rebuilds the test database from scratch using the real migrations, then seeds the
// role rows the app expects. Refuses to run against anything not named *_test.
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, '');
  if (!/_test$/.test(dbName)) {
    throw new Error(`Refusing to reset "${dbName}": the test database name must end in "_test".`);
  }

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  await runMigrations({ connectionString: TEST_DATABASE_URL, log: () => undefined });

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    for (const name of ROLES) {
      await client.query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
  } finally {
    await client.end();
  }
}
