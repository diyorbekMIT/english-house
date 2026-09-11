import { Router } from 'express';
import { db } from '../../db/client.js';
import { auditLogs, users } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { desc, eq, and, gte, lte, type SQL } from 'drizzle-orm';

export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate);

// Audit is strictly accessible ONLY by CEO (SUPER_ADMIN)
auditLogsRouter.get(
  '/',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { entityType, entityId, action, actorUserId, startDate, endDate, limit = '250' } = req.query;

    const conditions: SQL[] = [];

    if (actorUserId) {
      conditions.push(eq(auditLogs.actorUserId, Number(actorUserId)));
    }
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, String(entityType)));
    }
    if (entityId) {
      conditions.push(eq(auditLogs.entityId, Number(entityId)));
    }
    if (action) {
      conditions.push(eq(auditLogs.action, String(action)));
    }

    if (startDate && typeof startDate === 'string' && startDate.trim()) {
      const start = new Date(`${startDate.trim()}T00:00:00`);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(auditLogs.createdAt, start));
      }
    }
    if (endDate && typeof endDate === 'string' && endDate.trim()) {
      const end = new Date(`${endDate.trim()}T23:59:59.999`);
      if (!isNaN(end.getTime())) {
        conditions.push(lte(auditLogs.createdAt, end));
      }
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorName: users.fullName,
        actorPhone: users.phone,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        description: auditLogs.description,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(Math.min(Number(limit) || 250, 1000));

    res.json(rows);
  }),
);
