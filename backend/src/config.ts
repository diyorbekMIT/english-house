import 'dotenv/config';

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    if (process.env['NODE_ENV'] !== 'test') {
      console.error(`❌ Missing required environment variable: ${key}`);
      console.error(`   Please set it in your .env file before starting the server.`);
      process.exit(1);
    }
  }
}

export const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-fallback-secret-for-testing';
export const DATABASE_URL = process.env['DATABASE_URL'] || '';
export const PORT = Number(process.env['PORT'] ?? 3001);
export const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
