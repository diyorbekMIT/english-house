import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 7002; // advisory lock so two deploys can't migrate at once
const BREAKPOINT = /^--> statement-breakpoint[ \t]*$/m;

export interface MigrateOptions {
  connectionString: string;
  // Mark every migration up to and including this numeric prefix (e.g. "0013") as
  // already applied WITHOUT running it. For adopting the runner on a database whose
  // schema was built by hand-applying these files.
  baseline?: string;
  log?: (msg: string) => void;
}

export const listMigrationFiles = (): string[] =>
  fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

const isLocal = (url: string) => url.includes('localhost') || url.includes('127.0.0.1');

// Applies pending db/migrations/*.sql in order and records each one in
// schema_migrations. Files are run statement-by-statement (split on drizzle's
// "--> statement-breakpoint" marker), the same way `psql -f` applied them so far; a
// failing file aborts the run and is NOT recorded, so it is retried next time.
export const runMigrations = async ({ connectionString, baseline, log = console.log }: MigrateOptions): Promise<string[]> => {
  const client = new pg.Client({ connectionString, ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false } });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const files = listMigrationFiles();
    const done = new Set<string>((await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));

    if (baseline) {
      if (done.size > 0) throw new Error('--baseline is only allowed while schema_migrations is empty.');
      const upTo = files.filter((f) => f.slice(0, 4) <= baseline.slice(0, 4));
      if (upTo.length === 0) throw new Error(`No migration matches baseline "${baseline}".`);
      for (const f of upTo) await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      log(`Baselined ${upTo.length} migrations (through ${upTo[upTo.length - 1]}) without running them.`);
      return upTo;
    }

    // An existing database that has never been tracked would replay 0000 (CREATE TABLE ...)
    // and fail half-way; force an explicit decision instead.
    if (done.size === 0) {
      const existing = await client.query(`SELECT to_regclass('public.users') AS t`);
      if (existing.rows[0]?.t) {
        throw new Error(
          'This database already has tables but no migration history. Baseline it first: ' +
            'npm run db:migrate -- --baseline <last-applied-prefix>   (e.g. --baseline 0013)',
        );
      }
    }

    for (const file of files) {
      if (done.has(file)) continue;
      log(`Applying ${file} ...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      for (const statement of sql.split(BREAKPOINT).map((s) => s.trim()).filter(Boolean)) {
        await client.query(statement);
      }
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      applied.push(file);
    }
    log(applied.length ? `Applied ${applied.length} migration(s).` : 'Database is up to date.');
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
};
