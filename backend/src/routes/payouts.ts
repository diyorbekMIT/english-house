import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { payouts, users, roles } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getUserBalance } from '../lib/balance.js';
import { and, desc, eq } from 'drizzle-orm';

export const payoutsRouter = Router();
payoutsRouter.use(authenticate);

const CreatePayoutSchema = z.object({
  receiverId: z.number().int(),
  amountUzs: z.number().int().positive(),
  type: z.enum(['CREDIT', 'DEBIT']),
  comments: z.string().optional(),
});

// POST /payouts — SuperAdmin manually credits/debits a director or teacher.
// Created as PENDING; must be completed via a separate action before it affects balance.
payoutsRouter.post('/', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const parsed = CreatePayoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [receiver] = await db
    .select({ id: users.id, fullName: users.fullName, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, parsed.data.receiverId));

  if (!receiver) { res.status(404).json({ error: 'Receiver not found' }); return; }
  if (receiver.roleName !== 'DIRECTOR' && receiver.roleName !== 'TEACHER') {
    res.status(400).json({ error: 'Payouts can only be made to a DIRECTOR or TEACHER' });
    return;
  }

  const [payout] = await db
    .insert(payouts)
    .values({
      makerId: req.user!.userId,
      receiverId: parsed.data.receiverId,
      amountUzs: parsed.data.amountUzs,
      type: parsed.data.type,
      status: 'PENDING',
      comments: parsed.data.comments,
    })
    .returning();

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'PAYOUT_CREATE',
    entityType: 'payout',
    entityId: payout!.id,
    description: `${parsed.data.type} of ${parsed.data.amountUzs} UZS created for '${receiver.fullName}'`,
  });

  res.status(201).json(payout);
}));

// PATCH /payouts/:id/complete — SuperAdmin confirms a pending payout, applying it to the balance.
payoutsRouter.patch('/:id/complete', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);

  const [payout] = await db
    .update(payouts)
    .set({ status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(payouts.id, id), eq(payouts.status, 'PENDING')))
    .returning();

  if (!payout) { res.status(404).json({ error: 'Pending payout not found' }); return; }

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'PAYOUT_COMPLETE',
    entityType: 'payout',
    entityId: id,
    description: `Payout ${id} completed`,
  });

  res.json(payout);
}));

// PATCH /payouts/:id/cancel — SuperAdmin cancels a pending payout without affecting the balance.
payoutsRouter.patch('/:id/cancel', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);

  const [payout] = await db
    .update(payouts)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(and(eq(payouts.id, id), eq(payouts.status, 'PENDING')))
    .returning();

  if (!payout) { res.status(404).json({ error: 'Pending payout not found' }); return; }

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'PAYOUT_CANCEL',
    entityType: 'payout',
    entityId: id,
    description: `Payout ${id} cancelled`,
  });

  res.json(payout);
}));

// GET /payouts — SuperAdmin sees all (optional receiverId/status filters); Director/Teacher see only their own.
payoutsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'DIRECTOR', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { receiverId, status } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'DIRECTOR' || user.role === 'TEACHER') {
      conditions.push(eq(payouts.receiverId, user.userId));
    } else if (receiverId) {
      conditions.push(eq(payouts.receiverId, Number(receiverId)));
    }

    if (status) {
      conditions.push(eq(payouts.status, String(status) as 'PENDING' | 'COMPLETED' | 'CANCELLED'));
    }

    const rows = await db
      .select()
      .from(payouts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(payouts.createdAt));

    res.json(rows);
  }),
);

// GET /payouts/balance/:userId — SuperAdmin, or the user checking their own balance.
payoutsRouter.get('/balance/:userId', asyncHandler(async (req, res) => {
  const targetId = Number(req.params['userId']);
  const user = req.user!;

  if (user.role !== 'SUPER_ADMIN' && user.userId !== targetId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const balance = await getUserBalance(db, targetId);
  res.json(balance);
}));

// GET /payouts/balances?role=DIRECTOR|TEACHER — SuperAdmin only, batched for list pages.
payoutsRouter.get('/balances', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const { role: roleFilter } = req.query;

  const rows = await db
    .select({ id: users.id, fullName: users.fullName, phone: users.phone, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      roleFilter
        ? eq(roles.name, String(roleFilter))
        : undefined,
    );

  const targets = rows.filter((r) => r.roleName === 'DIRECTOR' || r.roleName === 'TEACHER');

  const balances = await Promise.all(
    targets.map(async (t) => ({
      userId: t.id,
      fullName: t.fullName,
      phone: t.phone,
      role: t.roleName,
      ...(await getUserBalance(db, t.id)),
    })),
  );

  res.json(balances);
}));
