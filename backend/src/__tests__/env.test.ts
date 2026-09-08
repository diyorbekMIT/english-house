import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Environment Guard Logic', () => {
  const validateEnv = (env: Record<string, string | undefined>, requiredKeys: string[]) => {
    const missing: string[] = [];
    for (const key of requiredKeys) {
      if (!env[key]) {
        missing.push(key);
      }
    }
    return { valid: missing.length === 0, missing };
  };

  it('validates required environment variables', () => {
    const validEnv = { JWT_SECRET: 'supersecret', DATABASE_URL: 'postgres://localhost:5432/db' };
    expect(validateEnv(validEnv, ['JWT_SECRET', 'DATABASE_URL']).valid).toBe(true);

    const missingEnv = { DATABASE_URL: 'postgres://localhost:5432/db' };
    const result = validateEnv(missingEnv, ['JWT_SECRET', 'DATABASE_URL']);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('JWT_SECRET');
  });
});

describe('Student Call Note & Status Schema Validation', () => {
  const CallStatusUpdateSchema = z.object({
    callStatus: z.enum(['WAITING', 'ACCEPTED', 'REJECTED']),
    callNote: z.string().max(500).optional(),
  });

  it('allows valid call status transitions with callNote', () => {
    const input = {
      callStatus: 'REJECTED',
      callNote: "Narx to'g'ri kelmadi, boshqa o'quv markazni tanladi",
    };
    const parsed = CallStatusUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.callStatus).toBe('REJECTED');
      expect(parsed.data.callNote).toBe("Narx to'g'ri kelmadi, boshqa o'quv markazni tanladi");
    }
  });

  it('allows callStatus without callNote', () => {
    const input = { callStatus: 'ACCEPTED' };
    const parsed = CallStatusUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid call statuses', () => {
    const input = { callStatus: 'UNKNOWN_STATUS' };
    const parsed = CallStatusUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it('rejects callNote exceeding 500 characters', () => {
    const input = {
      callStatus: 'WAITING',
      callNote: 'A'.repeat(501),
    };
    const parsed = CallStatusUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
