import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { commissionRules } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { desc, eq } from 'drizzle-orm';

export const commissionRulesRouter = Router();
commissionRulesRouter.use(authenticate);

commissionRulesRouter.get('/', async (_req, res) => {
  const [rules] = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.isActive, true))
    .orderBy(desc(commissionRules.id))
    .limit(1);
  res.json(rules ?? null);
});

const RulesSchema = z.object({
  teacherSignupBonusUzs: z.number().int().min(0),
  directorSignupBonusUzs: z.number().int().min(0),
  teacherMonthlyPercent: z.number().int().min(0).max(10000),
  directorMonthlyPercent: z.number().int().min(0).max(10000),
  validFrom: z.string().datetime().optional(),
});

commissionRulesRouter.put('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  const parsed = RulesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  // Insert a new active rules record (immutable history)
  const [rules] = await db.insert(commissionRules).values({
    ...parsed.data,
    validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
    isActive: true,
  }).returning();

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'COMMISSION_RULES_UPDATE',
    entityType: 'commission_rules',
    entityId: rules!.id,
    description: 'Commission rules updated by SuperAdmin',
    details: parsed.data as Record<string, unknown>,
  });

  res.json(rules);
});
