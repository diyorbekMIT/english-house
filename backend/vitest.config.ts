import { defineConfig } from 'vitest/config';

// Integration tests run against a throwaway database that is rebuilt from the real
// migrations on every run (see globalSetup). It must never be the dev or prod database.
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/english_house_test?sslmode=disable';

export default defineConfig({
  test: {
    globalSetup: ['./src/__tests__/globalSetup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'vitest-only-secret-0123456789abcdef',
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:5173',
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
