"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_js_1.authenticate);
const BaseUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(5),
    password: zod_1.z.string().min(6),
    schoolId: zod_1.z.number().int().optional(),
    email: zod_1.z.string().email().optional(),
    meta: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const createUser = async (roleName, body, actorUserId, extras = {}) => {
    const parsed = BaseUserSchema.safeParse(body);
    if (!parsed.success)
        return { error: parsed.error.flatten() };
    const [role] = await client_js_1.db.select().from(schema_js_1.roles).where((0, drizzle_orm_1.eq)(schema_js_1.roles.name, roleName));
    if (!role)
        return { error: `Role ${roleName} not found` };
    const passwordHash = await bcryptjs_1.default.hash(parsed.data.password, 12);
    const [user] = await client_js_1.db
        .insert(schema_js_1.users)
        .values({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        passwordHash,
        roleId: role.id,
        schoolId: extras.schoolId ?? parsed.data.schoolId,
        managerId: extras.managerId,
        directorId: extras.directorId,
        email: parsed.data.email,
        meta: parsed.data.meta ?? null,
    })
        .returning({ id: schema_js_1.users.id, fullName: schema_js_1.users.fullName, phone: schema_js_1.users.phone });
    return { user: user };
};
// SuperAdmin creates Manager
exports.usersRouter.post('/manager', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const result = await createUser('MANAGER', req.body, req.user.userId);
    if ('error' in result) {
        res.status(400).json(result);
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'MANAGER_CREATE',
        entityType: 'user',
        entityId: result.user.id,
        description: `Manager '${result.user.fullName}' created by SuperAdmin`,
    });
    res.status(201).json(result.user);
});
// Manager or SuperAdmin creates Admin
exports.usersRouter.post('/admin', (0, auth_js_1.requireRole)('MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const result = await createUser('ADMIN', req.body, req.user.userId, {
        managerId: req.user.role === 'MANAGER' ? req.user.userId : undefined,
    });
    if ('error' in result) {
        res.status(400).json(result);
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'ADMIN_CREATE',
        entityType: 'user',
        entityId: result.user.id,
        description: `Admin '${result.user.fullName}' created`,
    });
    res.status(201).json(result.user);
});
// SuperAdmin creates Director
exports.usersRouter.post('/director', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const BodySchema = BaseUserSchema.extend({ schoolId: zod_1.z.number().int() });
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    // Validate school exists
    const [school] = await client_js_1.db.select().from(schema_js_1.schools).where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, parsed.data.schoolId));
    if (!school) {
        res.status(404).json({ error: 'School not found' });
        return;
    }
    const result = await createUser('DIRECTOR', parsed.data, req.user.userId, {
        schoolId: parsed.data.schoolId,
    });
    if ('error' in result) {
        res.status(400).json(result);
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'DIRECTOR_CREATE',
        entityType: 'user',
        entityId: result.user.id,
        description: `Director '${result.user.fullName}' created for School '${school.name}' by SuperAdmin`,
    });
    res.status(201).json(result.user);
});
// Director (or SuperAdmin) creates Teacher
exports.usersRouter.post('/teacher', (0, auth_js_1.requireRole)('DIRECTOR', 'SUPER_ADMIN'), async (req, res) => {
    const user = req.user;
    let schoolId = user.schoolId;
    if (user.role === 'SUPER_ADMIN') {
        const parsedBody = req.body;
        if (parsedBody.schoolId)
            schoolId = Number(parsedBody.schoolId);
    }
    if (!schoolId && user.role === 'DIRECTOR') {
        const [dUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
        if (dUser?.schoolId)
            schoolId = dUser.schoolId;
    }
    const result = await createUser('TEACHER', req.body, user.userId, {
        directorId: user.role === 'DIRECTOR' ? user.userId : undefined,
        schoolId,
    });
    if ('error' in result) {
        res.status(400).json(result);
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: user.userId,
        action: 'TEACHER_CREATE',
        entityType: 'user',
        entityId: result.user.id,
        description: `Teacher '${result.user.fullName}' created by ${user.role}`,
    });
    res.status(201).json(result.user);
});
// GET /users?role=TEACHER&schoolId=...
exports.usersRouter.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER', 'ADMIN', 'DIRECTOR'), async (req, res) => {
    const { role: roleFilter, schoolId: schoolFilter } = req.query;
    const user = req.user;
    let dirSchoolId = undefined;
    if (user.role === 'DIRECTOR') {
        dirSchoolId = user.schoolId;
        if (!dirSchoolId) {
            const [dUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
            dirSchoolId = dUser?.schoolId ?? undefined;
        }
    }
    const rows = await client_js_1.db
        .select({
        id: schema_js_1.users.id,
        fullName: schema_js_1.users.fullName,
        phone: schema_js_1.users.phone,
        email: schema_js_1.users.email,
        isActive: schema_js_1.users.isActive,
        role: schema_js_1.roles.name,
        schoolId: schema_js_1.users.schoolId,
        directorId: schema_js_1.users.directorId,
        managerId: schema_js_1.users.managerId,
        meta: schema_js_1.users.meta,
        createdAt: schema_js_1.users.createdAt,
    })
        .from(schema_js_1.users)
        .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
        .where((0, drizzle_orm_1.and)(roleFilter ? (0, drizzle_orm_1.eq)(schema_js_1.roles.name, String(roleFilter)) : undefined, user.role === 'DIRECTOR'
        ? (dirSchoolId ? (0, drizzle_orm_1.eq)(schema_js_1.users.schoolId, dirSchoolId) : (0, drizzle_orm_1.eq)(schema_js_1.users.directorId, user.userId))
        : schoolFilter
            ? (0, drizzle_orm_1.eq)(schema_js_1.users.schoolId, Number(schoolFilter))
            : undefined));
    res.json(rows);
});
// GET /users/:id
exports.usersRouter.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER', 'ADMIN', 'DIRECTOR'), async (req, res) => {
    const id = Number(req.params['id']);
    const [row] = await client_js_1.db
        .select({ id: schema_js_1.users.id, fullName: schema_js_1.users.fullName, phone: schema_js_1.users.phone, email: schema_js_1.users.email, isActive: schema_js_1.users.isActive, role: schema_js_1.roles.name, schoolId: schema_js_1.users.schoolId, meta: schema_js_1.users.meta })
        .from(schema_js_1.users)
        .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
// DELETE /users/:id — Strict Protection: Directors CANNOT delete teachers
exports.usersRouter.delete('/:id', async (req, res) => {
    const caller = req.user;
    // Directors are strictly forbidden from deleting teachers
    if (caller.role === 'DIRECTOR') {
        res.status(403).json({
            error: "Direktorlar o'qituvchilarni o'chira olmaydi. Barcha o'qituvchilar va ularning o'quvchilari tarixi, shuningdek hisoblangan komissiyalar tizimda to'liq saqlanadi.",
        });
        return;
    }
    // Only SUPER_ADMIN can manage deletion / deactivation
    if (caller.role !== 'SUPER_ADMIN') {
        res.status(403).json({
            error: "Faqat bosh administrator (CEO) foydalanuvchilarni o'chirish yoki nofaol qilish huquqiga ega.",
        });
        return;
    }
    const id = Number(req.params['id']);
    const [targetUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    if (!targetUser) {
        res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        return;
    }
    // Deactivate user rather than hard delete to preserve relational integrity with students and commissions
    await client_js_1.db.update(schema_js_1.users).set({ isActive: false }).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: caller.userId,
        action: 'USER_DEACTIVATE',
        entityType: 'user',
        entityId: id,
        description: `Foydalanuvchi '${targetUser.fullName}' (ID: ${id}) CEO tomonidan nofaol holatga o'tkazildi`,
    });
    res.json({ message: "Foydalanuvchi muvaffaqiyatli nofaol holatga o'tkazildi" });
});
