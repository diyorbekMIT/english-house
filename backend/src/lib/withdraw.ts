export interface WithdrawEligibility {
  availableUzs: number;
  withdrawableUzs: number;
  neededUzs: number;
}

// A director/teacher can withdraw once their pending commission balance (minus
// whatever they've already claimed via an open or completed withdraw request)
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
