"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const config_js_1 = require("../config.js");
exports.authRouter = (0, express_1.Router)();
const LoginSchema = zod_1.z.object({
    phone: zod_1.z.string().min(5),
    password: zod_1.z.string().min(6),
});
exports.authRouter.post('/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { phone, password } = parsed.data;
    const [user] = await client_js_1.db
        .select({
        id: schema_js_1.users.id,
        fullName: schema_js_1.users.fullName,
        phone: schema_js_1.users.phone,
        passwordHash: schema_js_1.users.passwordHash,
        isActive: schema_js_1.users.isActive,
        roleId: schema_js_1.users.roleId,
        schoolId: schema_js_1.users.schoolId,
        directorId: schema_js_1.users.directorId,
        managerId: schema_js_1.users.managerId,
        roleName: schema_js_1.roles.name,
    })
        .from(schema_js_1.users)
        .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.phone, phone));
    if (!user || !user.isActive) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const payload = {
        userId: user.id,
        role: user.roleName,
        fullName: user.fullName,
        phone: user.phone,
        schoolId: user.schoolId ?? undefined,
        directorId: user.directorId ?? undefined,
        managerId: user.managerId ?? undefined,
    };
    const token = jsonwebtoken_1.default.sign(payload, config_js_1.JWT_SECRET, { expiresIn: '7d' });
    res.json({
        token,
        role: user.roleName,
        userId: user.id,
        fullName: user.fullName,
        schoolId: user.schoolId,
    });
});
