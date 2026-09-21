import { computeBalance } from './balance.js';

export interface WithdrawEligibility {
  availableUzs: number;
  withdrawableUzs: number;
  neededUzs: number;
}

// A director/teacher can withdraw once their pending commission balance (minus any
// amount still claimed by an open request that the balance doesn't reflect yet)
// reaches the CEO-set limit — and in multiples of it: reaching 2x the limit
// unlocks withdrawing 2x the limit at once, leaving any remainder pending.
// limitUzs <= 0 means the CEO hasn't configured a limit yet, so withdrawals stay
// disabled.
export const computeWithdrawEligibility = (
  pendingUzs: number,
  limitUzs: number,
  alreadyClaimedUzs: number,
): WithdrawEligibility => {
  const availableUzs = Math.max(0, pendingUzs - alreadyClaimedUzs);

  if (limitUzs <= 0) {
    return { availableUzs, withdrawableUzs: 0, neededUzs: 0 };
  }

  const multiples = Math.floor(availableUzs / limitUzs);
  const withdrawableUzs = multiples * limitUzs;
  const neededUzs = withdrawableUzs > 0 ? 0 : limitUzs - availableUzs;

  return { availableUzs, withdrawableUzs, neededUzs };
};

interface CommissionLike { amountUzs: number; status: string }
interface PayoutLike { amountUzs: number; type: string; status: string }
interface WithdrawRequestLike { amountUzs: number; status: string }

// The full eligibility picture for one user, from raw rows. computeBalance already
// removes VERIFIED/GIVEN requests from pending, so only still-open (PENDING)
// requests are subtracted here — subtracting VERIFIED/GIVEN again would count them
// twice and understate what the user can withdraw next.
export const computeUserWithdrawEligibility = (
  userCommissions: CommissionLike[],
  userPayouts: PayoutLike[],
  userRequests: WithdrawRequestLike[],
  limitUzs: number,
): WithdrawEligibility & { pendingUzs: number; limitUzs: number } => {
  const confirmedUzs = userRequests
    .filter((r) => r.status === 'VERIFIED' || r.status === 'GIVEN')
    .reduce((sum, r) => sum + r.amountUzs, 0);
  const openUzs = userRequests
    .filter((r) => r.status === 'PENDING')
    .reduce((sum, r) => sum + r.amountUzs, 0);

  const balance = computeBalance(userCommissions, userPayouts, confirmedUzs);
  const eligibility = computeWithdrawEligibility(balance.commissionPendingUzs, limitUzs, openUzs);

  return { ...eligibility, pendingUzs: balance.commissionPendingUzs, limitUzs };
};
