import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { commissions, payouts, withdrawRequests } from '../../db/schema.js';

export interface UserBalance {
  commissionTotalUzs: number;
  commissionPaidUzs: number;
  commissionPendingUzs: number;
  payoutsNetUzs: number;
  balanceUzs: number;
}

interface CommissionLike {
  amountUzs: number;
  status: string;
}

interface PayoutLike {
  amountUzs: number;
  type: string;
  status: string;
}

// Pure aggregation, kept separate from the DB fetch below so it can be unit-tested
// without a database connection. claimedWithdrawUzs is the sum of any VERIFIED/GIVEN
// withdraw requests — that money has been claimed and handed over outside the
// commissions ledger (tracked separately in withdraw history), so it stops counting
// as pending rather than moving to "paid".
// balanceUzs is what the Teacher/Director Bonus Card shows: only money actually credited
// (commissions marked paid plus completed payouts such as the registration bonus).
// Pending rewards ("Kutilayotgan mukofot") are reported separately and never added to it.
export const computeBalance = (
  allUserCommissions: CommissionLike[],
  userPayouts: PayoutLike[],
  claimedWithdrawUzs = 0,
): UserBalance => {
  // CANCELLED commissions belong to voided payments and never count toward anything.
  const userCommissions = allUserCommissions.filter((c) => c.status !== 'CANCELLED');
  const commissionTotalUzs = userCommissions.reduce((sum, c) => sum + c.amountUzs, 0);
  const commissionPaidUzs = userCommissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + c.amountUzs, 0);
  const commissionPendingRawUzs = commissionTotalUzs - commissionPaidUzs;
  const commissionPendingUzs = Math.max(0, commissionPendingRawUzs - claimedWithdrawUzs);

  const payoutsNetUzs = userPayouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => (p.type === 'DEBIT' ? sum - p.amountUzs : sum + p.amountUzs), 0);

  return {
    commissionTotalUzs,
    commissionPaidUzs,
    commissionPendingUzs,
    payoutsNetUzs,
    balanceUzs: commissionPaidUzs + payoutsNetUzs,
  };
};

export const getUserBalance = async (db: Db, userId: number): Promise<UserBalance> => {
  const userCommissions = await db.select().from(commissions).where(eq(commissions.userId, userId));
  const userPayouts = await db.select().from(payouts).where(eq(payouts.receiverId, userId));

  const claimedStatuses: ('VERIFIED' | 'GIVEN')[] = ['VERIFIED', 'GIVEN'];
  const claimedRows = await db
    .select({ amountUzs: withdrawRequests.amountUzs })
    .from(withdrawRequests)
    .where(and(eq(withdrawRequests.userId, userId), inArray(withdrawRequests.status, claimedStatuses)));
  const claimedWithdrawUzs = claimedRows.reduce((sum, r) => sum + r.amountUzs, 0);

  return computeBalance(userCommissions, userPayouts, claimedWithdrawUzs);
};
