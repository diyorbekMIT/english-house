"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed script: creates roles + first SuperAdmin.
 * Run: cd backend && npm run seed
 *
 * Reads from env:
 *   ADMIN_PHONE    (default: +998900000001)
 *   ADMIN_PASSWORD (default: changeme123)
 */
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_js_1 = require("./client.js");
const schema_js_1 = require("./schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const ROLES = ['SUPER_ADMIN', 'MANAGER', 'ADMIN', 'DIRECTOR', 'TEACHER'];
const run = async () => {
    console.log('Seeding roles…');
    for (const name of ROLES) {
        const existing = await client_js_1.db.select().from(schema_js_1.roles).where((0, drizzle_orm_1.eq)(schema_js_1.roles.name, name));
        if (existing.length === 0) {
            await client_js_1.db.insert(schema_js_1.roles).values({ name });
            console.log(`  Role '${name}' created.`);
        }
    }
    const [superAdminRole] = await client_js_1.db
        .select()
        .from(schema_js_1.roles)
        .where((0, drizzle_orm_1.eq)(schema_js_1.roles.name, 'SUPER_ADMIN'));
    if (!superAdminRole)
        throw new Error('SuperAdmin role not found');
    const phone = process.env['ADMIN_PHONE'] ?? '+998900000001';
    const password = process.env['ADMIN_PASSWORD'] ?? 'changeme123';
    const existing = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.phone, phone));
    if (existing.length === 0) {
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const [admin] = await client_js_1.db.insert(schema_js_1.users).values({
            fullName: 'Super Admin',
            phone,
            passwordHash,
            roleId: superAdminRole.id,
        }).returning();
        console.log(`SuperAdmin created: phone=${phone}  password=${password}`);
        console.log(`  ID: ${admin.id}`);
    }
    else {
        console.log(`SuperAdmin already exists: phone=${phone}`);
    }
    // Default commission rules
    const existingRules = await client_js_1.db.select().from(schema_js_1.commissionRules);
    if (existingRules.length === 0) {
        await client_js_1.db.insert(schema_js_1.commissionRules).values({
            teacherSignupBonusUzs: 50000,
            directorSignupBonusUzs: 100000,
            teacherMonthlyPercent: 1000, // 10.00%
            directorMonthlyPercent: 500, // 5.00%
            isActive: true,
        });
        console.log('Default commission rules seeded (teacher 10%, director 5%).');
    }
    console.log('Seed complete.');
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
