"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.schoolsRouter = (0, express_1.Router)();
exports.schoolsRouter.use(auth_js_1.authenticate);
const SchoolSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    schoolNumber: zod_1.z.string().optional(),
    shortName: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional().default(true),
    meta: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.schoolsRouter.get('/', async (_req, res) => {
    const rows = await client_js_1.db.select().from(schema_js_1.schools);
    res.json(rows);
});
exports.schoolsRouter.get('/:id', async (req, res) => {
    const id = Number(req.params['id']);
    const [school] = await client_js_1.db.select().from(schema_js_1.schools).where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, id));
    if (!school) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(school);
});
exports.schoolsRouter.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const parsed = SchoolSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    let schoolNumber = parsed.data.schoolNumber?.trim() || null;
    if (!schoolNumber) {
        const match = parsed.data.name.match(/\d+/);
        if (match)
            schoolNumber = match[0];
    }
    const [school] = await client_js_1.db.insert(schema_js_1.schools).values({
        name: parsed.data.name,
        schoolNumber: schoolNumber ?? null,
        shortName: parsed.data.shortName ?? schoolNumber ?? null,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
        meta: parsed.data.meta ?? null,
    }).returning();
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'SCHOOL_CREATE',
        entityType: 'school',
        entityId: school.id,
        description: `School '${school.name}' (№ ${school.schoolNumber || school.id}) created by SuperAdmin`,
        details: { name: school.name, schoolNumber: school.schoolNumber },
    });
    res.status(201).json(school);
});
exports.schoolsRouter.patch('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const id = Number(req.params['id']);
    const parsed = SchoolSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const [school] = await client_js_1.db
        .update(schema_js_1.schools)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, id))
        .returning();
    if (!school) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'SCHOOL_UPDATE',
        entityType: 'school',
        entityId: id,
        description: `School '${school.name}' updated`,
    });
    res.json(school);
});
