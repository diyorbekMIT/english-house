"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const zod_1 = require("zod");
(0, vitest_1.describe)('Environment Guard Logic', () => {
    const validateEnv = (env, requiredKeys) => {
        const missing = [];
        for (const key of requiredKeys) {
            if (!env[key]) {
                missing.push(key);
            }
        }
        return { valid: missing.length === 0, missing };
    };
    (0, vitest_1.it)('validates required environment variables', () => {
        const validEnv = { JWT_SECRET: 'supersecret', DATABASE_URL: 'postgres://localhost:5432/db' };
        (0, vitest_1.expect)(validateEnv(validEnv, ['JWT_SECRET', 'DATABASE_URL']).valid).toBe(true);
        const missingEnv = { DATABASE_URL: 'postgres://localhost:5432/db' };
        const result = validateEnv(missingEnv, ['JWT_SECRET', 'DATABASE_URL']);
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.missing).toContain('JWT_SECRET');
    });
});
(0, vitest_1.describe)('Student Call Note & Status Schema Validation', () => {
    const CallStatusUpdateSchema = zod_1.z.object({
        callStatus: zod_1.z.enum(['WAITING', 'ACCEPTED', 'REJECTED']),
        callNote: zod_1.z.string().max(500).optional(),
    });
    (0, vitest_1.it)('allows valid call status transitions with callNote', () => {
        const input = {
            callStatus: 'REJECTED',
            callNote: "Narx to'g'ri kelmadi, boshqa o'quv markazni tanladi",
        };
        const parsed = CallStatusUpdateSchema.safeParse(input);
        (0, vitest_1.expect)(parsed.success).toBe(true);
        if (parsed.success) {
            (0, vitest_1.expect)(parsed.data.callStatus).toBe('REJECTED');
            (0, vitest_1.expect)(parsed.data.callNote).toBe("Narx to'g'ri kelmadi, boshqa o'quv markazni tanladi");
        }
    });
    (0, vitest_1.it)('allows callStatus without callNote', () => {
        const input = { callStatus: 'ACCEPTED' };
        const parsed = CallStatusUpdateSchema.safeParse(input);
        (0, vitest_1.expect)(parsed.success).toBe(true);
    });
    (0, vitest_1.it)('rejects invalid call statuses', () => {
        const input = { callStatus: 'UNKNOWN_STATUS' };
        const parsed = CallStatusUpdateSchema.safeParse(input);
        (0, vitest_1.expect)(parsed.success).toBe(false);
    });
    (0, vitest_1.it)('rejects callNote exceeding 500 characters', () => {
        const input = {
            callStatus: 'WAITING',
            callNote: 'A'.repeat(501),
        };
        const parsed = CallStatusUpdateSchema.safeParse(input);
        (0, vitest_1.expect)(parsed.success).toBe(false);
    });
});
