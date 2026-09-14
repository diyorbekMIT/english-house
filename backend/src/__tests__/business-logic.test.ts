import { describe, it, expect } from 'vitest';
import { normalizePhone, deriveStudyStatusOnCallStatusChange } from '../routes/students.js';
import { isEligibleForBonus, selectCommissionBaseUzs } from '../routes/payments.js';
import { computeBalance } from '../lib/balance.js';
import { computeWithdrawEligibility } from '../lib/withdraw.js';

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

describe('Course-Based Bonus Calculation', () => {
  it('the first payment is always eligible for a bonus, regardless of study status', () => {
    expect(isEligibleForBonus(true, 'NOACTIVE')).toBe(true);
    expect(isEligibleForBonus(true, 'ACTIVE')).toBe(true);
  });

  it('a later payment only earns a bonus while the student is ACTIVE', () => {
    expect(isEligibleForBonus(false, 'ACTIVE')).toBe(true);
    expect(isEligibleForBonus(false, 'NOACTIVE')).toBe(false);
  });

  it('uses the CEO-set special price as the bonus base when one is configured', () => {
    expect(selectCommissionBaseUzs(1_000_000, 650_000)).toBe(1_000_000);
  });

  it('falls back to the actual amount paid when no special price is configured', () => {
    expect(selectCommissionBaseUzs(null, 650_000)).toBe(650_000);
    expect(selectCommissionBaseUzs(undefined, 650_000)).toBe(650_000);
    expect(selectCommissionBaseUzs(0, 650_000)).toBe(650_000);
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

  it('a verified/given withdraw claim drops out of pending and the total balance entirely', () => {
    const balance = computeBalance(
      [{ amountUzs: 210_000, status: 'PENDING' }],
      [],
      210_000, // fully claimed via a withdraw request
    );

    expect(balance.commissionPendingUzs).toBe(0);
    expect(balance.balanceUzs).toBe(0);
  });

  it('a partial withdraw claim only reduces pending by the claimed amount', () => {
    const balance = computeBalance(
      [{ amountUzs: 700_000, status: 'PENDING' }],
      [],
      600_000,
    );

    expect(balance.commissionPendingUzs).toBe(100_000);
    expect(balance.balanceUzs).toBe(100_000);
  });

  it('never lets a claim push pending balance negative', () => {
    const balance = computeBalance(
      [{ amountUzs: 100_000, status: 'PENDING' }],
      [],
      999_000, // stale/over-claimed edge case
    );

    expect(balance.commissionPendingUzs).toBe(0);
  });
});

describe('Withdraw Eligibility', () => {
  it('is not withdrawable below the limit, and reports how much more is needed', () => {
    const eligibility = computeWithdrawEligibility(200_000, 300_000, 0);
    expect(eligibility.withdrawableUzs).toBe(0);
    expect(eligibility.neededUzs).toBe(100_000);
  });

  it('reaching exactly the limit unlocks withdrawing exactly the limit', () => {
    const eligibility = computeWithdrawEligibility(300_000, 300_000, 0);
    expect(eligibility.withdrawableUzs).toBe(300_000);
    expect(eligibility.neededUzs).toBe(0);
  });

  it('crossing the limit still only unlocks the nearest lower multiple, leaving a remainder', () => {
    // 400,000 pending against a 300,000 limit -> only 300,000 withdrawable, 100,000 stays pending
    const eligibility = computeWithdrawEligibility(400_000, 300_000, 0);
    expect(eligibility.withdrawableUzs).toBe(300_000);
    expect(eligibility.neededUzs).toBe(0);
  });

  it('reaching double the limit unlocks double the withdrawal amount', () => {
    // 700,000 pending against a 300,000 limit -> 600,000 withdrawable (2x), 100,000 remains
    const eligibility = computeWithdrawEligibility(700_000, 300_000, 0);
    expect(eligibility.withdrawableUzs).toBe(600_000);
  });

  it('subtracts amounts already claimed by an open or completed withdraw request', () => {
    // 700,000 pending, already claimed 600,000 via a prior request -> only 100,000 left, below the limit
    const eligibility = computeWithdrawEligibility(700_000, 300_000, 600_000);
    expect(eligibility.availableUzs).toBe(100_000);
    expect(eligibility.withdrawableUzs).toBe(0);
    expect(eligibility.neededUzs).toBe(200_000);
  });

  it('disables withdrawals entirely when the CEO has not configured a limit', () => {
    const eligibility = computeWithdrawEligibility(10_000_000, 0, 0);
    expect(eligibility.withdrawableUzs).toBe(0);
    expect(eligibility.neededUzs).toBe(0);
  });
});
