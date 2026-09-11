import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { commissions, payouts } from '../../db/schema.js';

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
// without a database connection.
export const computeBalance = (
  userCommissions: CommissionLike[],
  userPayouts: PayoutLike[],
): UserBalance => {
  const commissionTotalUzs = userCommissions.reduce((sum, c) => sum + c.amountUzs, 0);
  const commissionPaidUzs = userCommissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + c.amountUzs, 0);
  const commissionPendingUzs = commissionTotalUzs - commissionPaidUzs;

  const payoutsNetUzs = userPayouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => (p.type === 'DEBIT' ? sum - p.amountUzs : sum + p.amountUzs), 0);

  return {
    commissionTotalUzs,
    commissionPaidUzs,
    commissionPendingUzs,
    payoutsNetUzs,
    balanceUzs: commissionTotalUzs + payoutsNetUzs,
  };
};

export const getUserBalance = async (db: Db, userId: number): Promise<UserBalance> => {
  const userCommissions = await db.select().from(commissions).where(eq(commissions.userId, userId));
  const userPayouts = await db.select().from(payouts).where(eq(payouts.receiverId, userId));

  return computeBalance(userCommissions, userPayouts);
};
