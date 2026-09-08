import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../routes/students.js';

describe('Phone Normalization', () => {
  it('normalizes 9-digit Uzbek phone number', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
  });

  it('normalizes 12-digit number starting with 998', () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567');
  });

  it('handles spaces, dashes, and parentheses', () => {
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567');
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
  });
});

describe('Commission Calculation Math', () => {
  // teacherMonthlyPercent and directorMonthlyPercent are stored in basis points (1000 = 10.00%, 500 = 5.00%)
  const calculateCommission = (amountUzs: number, percentBasisPoints: number): number => {
    return Math.floor((amountUzs * percentBasisPoints) / 10000);
  };

  it('calculates exact integer UZS amounts without floating point errors', () => {
    // 500,000 UZS with 10% (1000 bp)
    expect(calculateCommission(500000, 1000)).toBe(50000);

    // 500,000 UZS with 5% (500 bp)
    expect(calculateCommission(500000, 500)).toBe(25000);

    // 333,333 UZS with 7.5% (750 bp)
    // 333333 * 750 / 10000 = 24999.975 -> Math.floor -> 24999
    expect(calculateCommission(333333, 750)).toBe(24999);
    expect(Number.isInteger(calculateCommission(333333, 750))).toBe(true);
  });

  it('returns 0 when amount or rate is zero', () => {
    expect(calculateCommission(0, 1000)).toBe(0);
    expect(calculateCommission(500000, 0)).toBe(0);
  });
});
