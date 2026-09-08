"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const pg_1 = require("pg");
const run = async () => {
    const pool = new pg_1.Pool({ connectionString: process.env['DATABASE_URL'] });
    const db = (0, node_postgres_1.drizzle)(pool);
    await (0, migrator_1.migrate)(db, { migrationsFolder: './db/migrations' });
    console.log('Migrations applied successfully.');
    await pool.end();
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
