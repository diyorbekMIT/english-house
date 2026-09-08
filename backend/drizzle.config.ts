import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost');

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
    ssl: !isLocal,
  },
});