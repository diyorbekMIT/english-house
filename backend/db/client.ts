import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const isProduction = process.env.NODE_ENV === 'production' || process.env['DATABASE_URL']?.includes('herokuapp.com');

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;