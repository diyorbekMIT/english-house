import { describe, it, expect } from 'vitest';
import { normalizePhone, deriveStudyStatusOnCallStatusChange } from '../routes/students.js';
import { computeBalance } from '../lib/balance.js';

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

describe('Student Status Pipeline', () => {
  it('auto-activates study status only when call status reaches MADE_PAYMENT', () => {
    expect(deriveStudyStatusOnCallStatusChange('MADE_PAYMENT')).toBe('ACTIVE');
  });

  it('does not touch study status for any other call status', () => {
    const nonTriggeringStatuses = [
      'WAITING', 'CALLED', 'REGISTERED', 'FIRST_LESSON', 'STARTED_STUDYING', 'REJECTED',
    ] as const;
    for (const status of nonTriggeringStatuses) {
      expect(deriveStudyStatusOnCallStatusChange(status)).toBeUndefined();
    }
  });
});

describe('Balance Calculation', () => {
  it('sums commissions and completed payouts into a single balance', () => {
    const balance = computeBalance(
      [
        { amountUzs: 100_000, status: 'PAID' },
        { amountUzs: 50_000, status: 'PENDING' },
      ],
      [
        { amountUzs: 10_000_000, type: 'INITIAL_BONUS', status: 'COMPLETED' },
      ],
    );

    expect(balance.commissionTotalUzs).toBe(150_000);
    expect(balance.commissionPaidUzs).toBe(100_000);
    expect(balance.commissionPendingUzs).toBe(50_000);
    expect(balance.payoutsNetUzs).toBe(10_000_000);
    expect(balance.balanceUzs).toBe(10_150_000);
  });

  it('excludes PENDING and CANCELLED payouts from the balance', () => {
    const balance = computeBalance(
      [],
      [
        { amountUzs: 5_000_000, type: 'CREDIT', status: 'PENDING' },
        { amountUzs: 1_000_000, type: 'CREDIT', status: 'CANCELLED' },
      ],
    );

    expect(balance.payoutsNetUzs).toBe(0);
    expect(balance.balanceUzs).toBe(0);
  });

  it('subtracts completed DEBIT payouts from the balance', () => {
    const balance = computeBalance(
      [{ amountUzs: 10_000_000, status: 'PAID' }],
      [
        { amountUzs: 3_000_000, type: 'DEBIT', status: 'COMPLETED' },
      ],
    );

    expect(balance.payoutsNetUzs).toBe(-3_000_000);
    expect(balance.balanceUzs).toBe(7_000_000);
  });
});
