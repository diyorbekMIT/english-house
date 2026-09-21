import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { commissions } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { validateIdParams, queryId, queryEnum } from '../lib/params.js';

export const commissionsRouter = Router();
commissionsRouter.use(authenticate);
validateIdParams(commissionsRouter, 'id');

commissionsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'DIRECTOR', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { userId: userIdFilter, status } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    // Scope by role
    if (user.role === 'TEACHER') {
      conditions.push(eq(commissions.userId, user.userId));
    } else if (user.role === 'DIRECTOR') {
      conditions.push(eq(commissions.userId, user.userId));
    } else if (userIdFilter) {
      conditions.push(eq(commissions.userId, queryId(userIdFilter, 'userId')!));
    }

    if (status) {
      conditions.push(eq(commissions.status, queryEnum(status, ['PENDING', 'READY_TO_PAY', 'PAID', 'CANCELLED'] as const, 'status')!));
    }

    const rows = await db
      .select()
      .from(commissions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(commissions.createdAt));

    res.json(rows);
  }),
);

// PATCH /commissions/:id/mark-paid — CEO only. Marking a commission PAID moves money
// out of a teacher/director's pending balance, which the withdraw flow otherwise gates
// behind the CEO-set limit, so no other role may do it. Only still-open commissions can
// be marked (not already PAID, not CANCELLED by a voided payment).
commissionsRouter.patch(
  '/:id/mark-paid',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const payable: ('PENDING' | 'READY_TO_PAY')[] = ['PENDING', 'READY_TO_PAY'];

    const [commission] = await db
      .update(commissions)
      .set({ status: 'PAID', paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(commissions.id, id), inArray(commissions.status, payable)))
      .returning();

    if (!commission) { res.status(404).json({ error: 'Payable commission not found' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'COMMISSION_MARK_PAID',
      entityType: 'commission',
      entityId: id,
      description: `Commission ${id} marked as PAID`,
    });
    res.json(commission);
  }),
);

// PATCH /commissions/:id/status — SuperAdmin can set any status
commissionsRouter.patch(
  '/:id/status',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const schema = z.object({ status: z.enum(['PENDING', 'READY_TO_PAY', 'PAID']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const [commission] = await db
      .update(commissions)
      .set({
        status: parsed.data.status,
        paidAt: parsed.data.status === 'PAID' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(commissions.id, id), ne(commissions.status, 'CANCELLED')))
      .returning();

    if (!commission) { res.status(404).json({ error: 'Not found (or cancelled)' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'COMMISSION_STATUS_UPDATE',
      entityType: 'commission',
      entityId: id,
      description: `Commission ${id} status set to ${parsed.data.status}`,
    });
    res.json(commission);
  }),
);
