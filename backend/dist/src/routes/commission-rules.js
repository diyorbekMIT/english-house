"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionRulesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.commissionRulesRouter = (0, express_1.Router)();
exports.commissionRulesRouter.use(auth_js_1.authenticate);
exports.commissionRulesRouter.get('/', async (_req, res) => {
    const [rules] = await client_js_1.db
        .select()
        .from(schema_js_1.commissionRules)
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissionRules.isActive, true))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.commissionRules.id))
        .limit(1);
    res.json(rules ?? null);
});
const RulesSchema = zod_1.z.object({
    teacherSignupBonusUzs: zod_1.z.number().int().min(0),
    directorSignupBonusUzs: zod_1.z.number().int().min(0),
    teacherMonthlyPercent: zod_1.z.number().int().min(0).max(10000),
    directorMonthlyPercent: zod_1.z.number().int().min(0).max(10000),
    validFrom: zod_1.z.string().datetime().optional(),
});
exports.commissionRulesRouter.put('/', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const parsed = RulesSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    // Insert a new active rules record (immutable history)
    const [rules] = await client_js_1.db.insert(schema_js_1.commissionRules).values({
        ...parsed.data,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        isActive: true,
    }).returning();
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'COMMISSION_RULES_UPDATE',
        entityType: 'commission_rules',
        entityId: rules.id,
        description: 'Commission rules updated by SuperAdmin',
        details: parsed.data,
    });
    res.json(rules);
});
