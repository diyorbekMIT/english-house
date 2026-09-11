/**
 * Seed script: creates roles + first SuperAdmin.
 * Run: cd backend && npm run seed
 *
 * Reads from env:
 *   ADMIN_PHONE    (default: +998900000001)
 *   ADMIN_PASSWORD (default: changeme123)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './client.js';
import { roles, users, commissionRules } from './schema.js';
import { eq } from 'drizzle-orm';

const ROLES = ['SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'TEACHER'] as const;

const run = async (): Promise<void> => {
  console.log('Seeding roles…');
  for (const name of ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.name, name));
    if (existing.length === 0) {
      await db.insert(roles).values({ name });
      console.log(`  Role '${name}' created.`);
    }
  }

  const [superAdminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, 'SUPER_ADMIN'));

  if (!superAdminRole) throw new Error('SuperAdmin role not found');

  const phone = process.env['ADMIN_PHONE'] ?? '+998900000001';
  const password = process.env['ADMIN_PASSWORD'] ?? 'changeme123';

  const existing = await db.select().from(users).where(eq(users.phone, phone));
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash(password, 12);
    const [admin] = await db.insert(users).values({
      fullName: 'Super Admin',
      phone,
      passwordHash,
      roleId: superAdminRole.id,
    }).returning();
    console.log(`SuperAdmin created: phone=${phone}  password=${password}`);
    console.log(`  ID: ${admin!.id}`);
  } else {
    console.log(`SuperAdmin already exists: phone=${phone}`);
  }

  // Default commission rules
  const existingRules = await db.select().from(commissionRules);
  if (existingRules.length === 0) {
    await db.insert(commissionRules).values({
      teacherSignupBonusUzs: 5_000_000,
      directorSignupBonusUzs: 10_000_000,
      teacherMonthlyPercent: 1000,          // 10.00% ongoing, while ACTIVE
      directorMonthlyPercent: 500,          // 5.00% ongoing, while ACTIVE
      teacherFirstPaymentPercent: 2000,     // 20.00% on the first payment only
      directorFirstPaymentPercent: 1000,    // 10.00% on the first payment only
      specialPriceUzs: 0,                   // unset — CEO configures this later; falls back to actual amount paid
      withdrawLimitTeacherUzs: 0,            // unset — withdrawals disabled until CEO sets a limit
      withdrawLimitDirectorUzs: 0,
      isActive: true,
    });
    console.log('Default commission rules seeded (teacher 10%/20% first, director 5%/10% first).');
  }

  console.log('Seed complete.');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
