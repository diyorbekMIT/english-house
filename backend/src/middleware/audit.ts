import type { Db } from '../../db/client.js';
import { auditLogs } from '../../db/schema.js';

export interface AuditParams {
  actorUserId: number | undefined;
  action: string;
  entityType: string;
  entityId?: number;
  description: string;
  details?: Record<string, unknown>;
}

export const logAudit = async (db: Db, params: AuditParams): Promise<void> => {
  await db.insert(auditLogs).values({
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    details: params.details ?? null,
  });
};
