import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const rawUrl = process.env['DATABASE_URL'] || '';
const isLocal = !rawUrl || rawUrl.includes('localhost');

const url = isLocal || rawUrl.includes('sslmode=') 
  ? rawUrl 
  : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=no-verify`;

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
});