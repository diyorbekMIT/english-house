"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRONTEND_URL = exports.PORT = exports.DATABASE_URL = exports.JWT_SECRET = void 0;
require("dotenv/config");
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        if (process.env['NODE_ENV'] !== 'test') {
            console.error(`❌ Missing required environment variable: ${key}`);
            console.error(`   Please set it in your .env file before starting the server.`);
            process.exit(1);
        }
    }
}
exports.JWT_SECRET = process.env['JWT_SECRET'] || 'dev-fallback-secret-for-testing';
exports.DATABASE_URL = process.env['DATABASE_URL'] || '';
exports.PORT = Number(process.env['PORT'] ?? 3001);
exports.FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
