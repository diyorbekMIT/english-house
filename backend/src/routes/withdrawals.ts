import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { withdrawRequests, commissionRules, users, roles } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getUserBalance } from '../lib/balance.js';
import { computeWithdrawEligibility } from '../lib/withdraw.js';
import { and, desc, eq, inArray } from 'drizzle-orm';

export const withdrawalsRouter = Router();
withdrawalsRouter.use(authenticate);

// The CEO can attach a note to every status change. Optional when approving or
// handing over, required when rejecting (the teacher/director needs to know why).
const OptionalCommentSchema = z.object({ comment: z.string().trim().max(500).optional() });
const RejectCommentSchema = z.object({ comment: z.string().trim().min(1, 'Rad etish sababini yozing').max(500) });

const CLAIMED_STATUSES: ('PENDING' | 'VERIFIED' | 'GIVEN')[] = ['PENDING', 'VERIFIED', 'GIVEN'];

const getEligibilityForUser = async (userId: number, role: 'TEACHER' | 'DIRECTOR') => {
  const [rules] = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.isActive, true))
    .orderBy(desc(commissionRules.id))
    .limit(1);

  const limitUzs = role === 'TEACHER' ? rules?.withdrawLimitTeacherUzs ?? 0 : rules?.withdrawLimitDirectorUzs ?? 0;

  const balance = await getUserBalance(db, userId);

  const claimedRows = await db
    .select({ amountUzs: withdrawRequests.amountUzs })
    .from(withdrawRequests)
    .where(and(eq(withdrawRequests.userId, userId), inArray(withdrawRequests.status, CLAIMED_STATUSES)));
  const alreadyClaimedUzs = claimedRows.reduce((sum, r) => sum + r.amountUzs, 0);

  const eligibility = computeWithdrawEligibility(balance.commissionPendingUzs, limitUzs, alreadyClaimedUzs);

  return { ...eligibility, pendingUzs: balance.commissionPendingUzs, limitUzs };
};

// GET /withdrawals/eligibility — a director/teacher checking their own withdraw eligibility.
withdrawalsRouter.get(
  '/eligibility',
  requireRole('TEACHER', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const role = req.user!.role as 'TEACHER' | 'DIRECTOR';
    res.json(await getEligibilityForUser(req.user!.userId, role));
  }),
);

// POST /withdrawals — a director/teacher requests a withdrawal. The amount is
// always recomputed server-side, never trusted from the client.
withdrawalsRouter.post(
  '/',
  requireRole('TEACHER', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const role = req.user!.role as 'TEACHER' | 'DIRECTOR';
    const eligibility = await getEligibilityForUser(req.user!.userId, role);

    if (eligibility.withdrawableUzs <= 0) {
      res.status(400).json({ error: "Yechib olish uchun yetarli mukofot yig'ilmagan" });
      return;
    }

    const [request] = await db
      .insert(withdrawRequests)
      .values({
        userId: req.user!.userId,
        amountUzs: eligibility.withdrawableUzs,
        status: 'PENDING',
      })
      .returning();

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'WITHDRAW_REQUEST_CREATE',
      entityType: 'withdraw_request',
      entityId: request!.id,
      description: `Withdraw request for ${eligibility.withdrawableUzs} UZS created by ${req.user!.role}`,
    });

    res.status(201).json(request);
  }),
);

// GET /withdrawals — CEO sees all (optional userId/status filters); director/teacher see only their own.
withdrawalsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'TEACHER', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { userId: userIdFilter, status } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'TEACHER' || user.role === 'DIRECTOR') {
      conditions.push(eq(withdrawRequests.userId, user.userId));
    } else if (userIdFilter) {
      conditions.push(eq(withdrawRequests.userId, Number(userIdFilter)));
    }

    if (status) {
      conditions.push(eq(withdrawRequests.status, String(status) as 'PENDING' | 'VERIFIED' | 'GIVEN' | 'REJECTED'));
    }

    const rows = await db
      .select({
        id: withdrawRequests.id,
        userId: withdrawRequests.userId,
        userFullName: users.fullName,
        userPhone: users.phone,
        userRole: roles.name,
        amountUzs: withdrawRequests.amountUzs,
        status: withdrawRequests.status,
        verifiedAt: withdrawRequests.verifiedAt,
        givenAt: withdrawRequests.givenAt,
        rejectedAt: withdrawRequests.rejectedAt,
        verifyComment: withdrawRequests.verifyComment,
        giveComment: withdrawRequests.giveComment,
        rejectComment: withdrawRequests.rejectComment,
        createdAt: withdrawRequests.createdAt,
      })
      .from(withdrawRequests)
      .innerJoin(users, eq(withdrawRequests.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(withdrawRequests.createdAt));

    res.json(rows);
  }),
);

// PATCH /withdrawals/:id/verify — CEO approves a pending request; the director/teacher
// is told (via their own withdraw history) that they can come collect the cash.
withdrawalsRouter.patch(
  '/:id/verify',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const parsed = OptionalCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const comment = parsed.data.comment || null;

    const [request] = await db
      .update(withdrawRequests)
      .set({ status: 'VERIFIED', verifiedAt: new Date(), verifiedByUserId: req.user!.userId, verifyComment: comment, updatedAt: new Date() })
      .where(and(eq(withdrawRequests.id, id), eq(withdrawRequests.status, 'PENDING')))
      .returning();

    if (!request) { res.status(404).json({ error: 'Pending withdraw request not found' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'WITHDRAW_REQUEST_VERIFY',
      entityType: 'withdraw_request',
      entityId: id,
      description: `Withdraw request ${id} verified by SuperAdmin`,
      details: comment ? { comment } : undefined,
    });

    res.json(request);
  }),
);

// PATCH /withdrawals/:id/give — CEO confirms the cash was physically handed over.
withdrawalsRouter.patch(
  '/:id/give',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const parsed = OptionalCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const comment = parsed.data.comment || null;

    const [request] = await db
      .update(withdrawRequests)
      .set({ status: 'GIVEN', givenAt: new Date(), givenByUserId: req.user!.userId, giveComment: comment, updatedAt: new Date() })
      .where(and(eq(withdrawRequests.id, id), eq(withdrawRequests.status, 'VERIFIED')))
      .returning();

    if (!request) { res.status(404).json({ error: 'Verified withdraw request not found' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'WITHDRAW_REQUEST_GIVE',
      entityType: 'withdraw_request',
      entityId: id,
      description: `Withdraw request ${id} marked as given by SuperAdmin`,
      details: comment ? { comment } : undefined,
    });

    res.json(request);
  }),
);

// PATCH /withdrawals/:id/reject — CEO turns down a pending request, with a required reason.
// REJECTED isn't a "claimed" status, so the amount goes straight back to being
// withdrawable and the teacher/director can request again.
withdrawalsRouter.patch(
  '/:id/reject',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const parsed = RejectCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const [request] = await db
      .update(withdrawRequests)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedByUserId: req.user!.userId,
        rejectComment: parsed.data.comment,
        updatedAt: new Date(),
      })
      .where(and(eq(withdrawRequests.id, id), eq(withdrawRequests.status, 'PENDING')))
      .returning();

    if (!request) { res.status(404).json({ error: 'Pending withdraw request not found' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'WITHDRAW_REQUEST_REJECT',
      entityType: 'withdraw_request',
      entityId: id,
      description: `Withdraw request ${id} rejected by SuperAdmin`,
      details: { comment: parsed.data.comment },
    });

    res.json(request);
  }),
);
