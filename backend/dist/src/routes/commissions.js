"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.commissionsRouter = (0, express_1.Router)();
exports.commissionsRouter.use(auth_js_1.authenticate);
exports.commissionsRouter.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER', 'ADMIN', 'DIRECTOR', 'TEACHER'), async (req, res) => {
    const user = req.user;
    const { userId: userIdFilter, status } = req.query;
    const conditions = [];
    // Scope by role
    if (user.role === 'TEACHER') {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.commissions.userId, user.userId));
    }
    else if (user.role === 'DIRECTOR') {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.commissions.userId, user.userId));
    }
    else if (userIdFilter) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.commissions.userId, Number(userIdFilter)));
    }
    if (status) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.commissions.status, String(status)));
    }
    const rows = await client_js_1.db
        .select()
        .from(schema_js_1.commissions)
        .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.commissions.createdAt));
    res.json(rows);
});
// PATCH /commissions/:id/mark-paid
exports.commissionsRouter.patch('/:id/mark-paid', (0, auth_js_1.requireRole)('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const id = Number(req.params['id']);
    const [commission] = await client_js_1.db
        .update(schema_js_1.commissions)
        .set({ status: 'PAID', paidAt: new Date(), updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissions.id, id))
        .returning();
    if (!commission) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'COMMISSION_MARK_PAID',
        entityType: 'commission',
        entityId: id,
        description: `Commission ${id} marked as PAID`,
    });
    res.json(commission);
});
// PATCH /commissions/:id/status — SuperAdmin can set any status
exports.commissionsRouter.patch('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const id = Number(req.params['id']);
    const schema = zod_1.z.object({ status: zod_1.z.enum(['PENDING', 'READY_TO_PAY', 'PAID']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const [commission] = await client_js_1.db
        .update(schema_js_1.commissions)
        .set({
        status: parsed.data.status,
        paidAt: parsed.data.status === 'PAID' ? new Date() : null,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissions.id, id))
        .returning();
    if (!commission) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'COMMISSION_STATUS_UPDATE',
        entityType: 'commission',
        entityId: id,
        description: `Commission ${id} status set to ${parsed.data.status}`,
    });
    res.json(commission);
});
