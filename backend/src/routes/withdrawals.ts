import { Router } from 'express';
import { z } from 'zod';
import { db, type Db } from '../../db/client.js';
import { withdrawRequests, commissionRules, commissions, payouts, users, roles } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { RequestRejected, isUniqueViolation } from '../lib/httpErrors.js';
import { computeUserWithdrawEligibility } from '../lib/withdraw.js';
import { and, desc, eq, sql } from 'drizzle-orm';

export const withdrawalsRouter = Router();
withdrawalsRouter.use(authenticate);

// The CEO can attach a note to every status change. Optional when approving or
// handing over, required when rejecting (the teacher/director needs to know why).
const OptionalCommentSchema = z.object({ comment: z.string().trim().max(500).optional() });
const RejectCommentSchema = z.object({ comment: z.string().trim().min(1, 'Rad etish sababini yozing').max(500) });

const getEligibilityForUser = async (exec: Pick<Db, 'select'>, userId: number, role: 'TEACHER' | 'DIRECTOR') => {
  const [rules] = await exec
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.isActive, true))
    .orderBy(desc(commissionRules.id))
    .limit(1);

  const limitUzs = role === 'TEACHER' ? rules?.withdrawLimitTeacherUzs ?? 0 : rules?.withdrawLimitDirectorUzs ?? 0;

  const [userCommissions, userPayouts, userRequests] = await Promise.all([
    exec.select().from(commissions).where(eq(commissions.userId, userId)),
    exec.select().from(payouts).where(eq(payouts.receiverId, userId)),
    exec.select().from(withdrawRequests).where(eq(withdrawRequests.userId, userId)),
  ]);

  return computeUserWithdrawEligibility(userCommissions, userPayouts, userRequests, limitUzs);
};

// GET /withdrawals/eligibility — a director/teacher checking their own withdraw eligibility.
withdrawalsRouter.get(
  '/eligibility',
  requireRole('TEACHER', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const role = req.user!.role as 'TEACHER' | 'DIRECTOR';
    res.json(await getEligibilityForUser(db, req.user!.userId, role));
  }),
);

// Arbitrary constant namespace for the per-user advisory lock below.
const WITHDRAW_LOCK_NAMESPACE = 7001;

// POST /withdrawals — a director/teacher requests a withdrawal. The amount is always
// recomputed server-side, never trusted from the client. Runs in a transaction behind a
// per-user advisory lock so a double-click or two open tabs can't both pass the
// eligibility check and create two requests for the same money.
withdrawalsRouter.post(
  '/',
  requireRole('TEACHER', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const role = req.user!.role as 'TEACHER' | 'DIRECTOR';

    try {
      const request = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${WITHDRAW_LOCK_NAMESPACE}, ${userId})`);

        const [openRequest] = await tx
          .select({ id: withdrawRequests.id })
          .from(withdrawRequests)
          .where(and(eq(withdrawRequests.userId, userId), eq(withdrawRequests.status, 'PENDING')))
          .limit(1);
        if (openRequest) {
          throw new RequestRejected(409, "Avvalgi so'rovingiz hali ko'rib chiqilmoqda.");
        }

        const eligibility = await getEligibilityForUser(tx, userId, role);
        if (eligibility.withdrawableUzs <= 0) {
          throw new RequestRejected(400, "Yechib olish uchun yetarli mukofot yig'ilmagan");
        }

        const [created] = await tx
          .insert(withdrawRequests)
          .values({ userId, amountUzs: eligibility.withdrawableUzs, status: 'PENDING' })
          .returning();
        if (!created) throw new Error('Withdraw request insert returned no row');

        await logAudit(tx, {
          actorUserId: userId,
          action: 'WITHDRAW_REQUEST_CREATE',
          entityType: 'withdraw_request',
          entityId: created.id,
          description: `Withdraw request for ${eligibility.withdrawableUzs} UZS created by ${req.user!.role}`,
        });

        return created;
      });

      res.status(201).json(request);
    } catch (err) {
      if (err instanceof RequestRejected) { res.status(err.status).json({ error: err.message }); return; }
      if (isUniqueViolation(err)) { res.status(409).json({ error: "Avvalgi so'rovingiz hali ko'rib chiqilmoqda." }); return; }
      throw err;
    }
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
