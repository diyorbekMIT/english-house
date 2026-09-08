import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const isProduction = process.env.NODE_ENV === 'production' || process.env['DATABASE_URL']?.includes('herokuapp.com');

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
    ssl: isProduction,
  },
});