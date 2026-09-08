"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogsRouter = void 0;
const express_1 = require("express");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.auditLogsRouter = (0, express_1.Router)();
exports.auditLogsRouter.use(auth_js_1.authenticate);
// Audit is strictly accessible ONLY by CEO (SUPER_ADMIN)
exports.auditLogsRouter.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const { entityType, entityId, action, actorUserId, startDate, endDate, limit = '250' } = req.query;
    const conditions = [];
    if (actorUserId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.auditLogs.actorUserId, Number(actorUserId)));
    }
    if (entityType) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.auditLogs.entityType, String(entityType)));
    }
    if (entityId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.auditLogs.entityId, Number(entityId)));
    }
    if (action) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.auditLogs.action, String(action)));
    }
    if (startDate && typeof startDate === 'string' && startDate.trim()) {
        const start = new Date(`${startDate.trim()}T00:00:00`);
        if (!isNaN(start.getTime())) {
            conditions.push((0, drizzle_orm_1.gte)(schema_js_1.auditLogs.createdAt, start));
        }
    }
    if (endDate && typeof endDate === 'string' && endDate.trim()) {
        const end = new Date(`${endDate.trim()}T23:59:59.999`);
        if (!isNaN(end.getTime())) {
            conditions.push((0, drizzle_orm_1.lte)(schema_js_1.auditLogs.createdAt, end));
        }
    }
    const rows = await client_js_1.db
        .select({
        id: schema_js_1.auditLogs.id,
        actorUserId: schema_js_1.auditLogs.actorUserId,
        actorName: schema_js_1.users.fullName,
        actorPhone: schema_js_1.users.phone,
        action: schema_js_1.auditLogs.action,
        entityType: schema_js_1.auditLogs.entityType,
        entityId: schema_js_1.auditLogs.entityId,
        description: schema_js_1.auditLogs.description,
        details: schema_js_1.auditLogs.details,
        createdAt: schema_js_1.auditLogs.createdAt,
    })
        .from(schema_js_1.auditLogs)
        .leftJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.auditLogs.actorUserId, schema_js_1.users.id))
        .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.auditLogs.createdAt))
        .limit(Math.min(Number(limit) || 250, 1000));
    res.json(rows);
});
