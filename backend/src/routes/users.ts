import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, roles, schools, commissionRules, payouts } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { and, desc, eq } from 'drizzle-orm';

const isUniquePhoneViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

// Grants the one-time signup bonus (amount snapshotted from the currently active
// commission rules) to a newly created director/teacher. Later rule changes never
// retroactively affect this — the amount is fixed at grant time.
const grantInitialBonus = async (
  receiverId: number,
  bonusField: 'teacherSignupBonusUzs' | 'directorSignupBonusUzs',
  actorUserId: number,
): Promise<void> => {
  const [activeRules] = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.isActive, true))
    .orderBy(desc(commissionRules.id))
    .limit(1);

  const amountUzs = activeRules?.[bonusField] ?? 0;
  if (amountUzs <= 0) return;

  const [payout] = await db
    .insert(payouts)
    .values({
      makerId: null,
      receiverId,
      amountUzs,
      type: 'INITIAL_BONUS',
      status: 'COMPLETED',
      completedAt: new Date(),
      comments: "Ro'yxatdan o'tish boshlang'ich balansi",
    })
    .returning();

  await logAudit(db, {
    actorUserId,
    action: 'INITIAL_BONUS_GRANT',
    entityType: 'payout',
    entityId: payout!.id,
    description: `Initial bonus of ${amountUzs} UZS granted on registration`,
  });
};

export const usersRouter = Router();
usersRouter.use(authenticate);

const BaseUserSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(4),
  password: z.string().min(6),
  schoolId: z.number().int().optional(),
  email: z.string().email().optional(),
  meta: z.record(z.unknown()).optional(),
});

const createUser = async (
  roleName: string,
  body: unknown,
  actorUserId: number,
  extras: {
    managerId?: number;
    directorId?: number;
    schoolId?: number;
  } = {},
): Promise<{ error: unknown } | { user: { id: number; fullName: string; phone: string } }> => {
  const parsed = BaseUserSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
  if (!role) return { error: `Role ${roleName} not found` };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const [user] = await db
      .insert(users)
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
      .returning({ id: users.id, fullName: users.fullName, phone: users.phone });

    return { user: user! };
  } catch (err) {
    if (isUniquePhoneViolation(err)) {
      return { error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" };
    }
    throw err;
  }
};

// SuperAdmin creates Manager
usersRouter.post('/manager', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const result = await createUser('MANAGER', req.body, req.user!.userId);
  if ('error' in result) { res.status(400).json(result); return; }
  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'MANAGER_CREATE',
    entityType: 'user',
    entityId: result.user.id,
    description: `Manager '${result.user.fullName}' created by SuperAdmin`,
  });
  res.status(201).json(result.user);
}));

// Manager or SuperAdmin creates a Sales Manager (runs the call pipeline through first payment)
usersRouter.post('/sales-manager', requireRole('MANAGER', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const result = await createUser('SALES_MANAGER', req.body, req.user!.userId, {
    managerId: req.user!.role === 'MANAGER' ? req.user!.userId : undefined,
  });
  if ('error' in result) { res.status(400).json(result); return; }
  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'SALES_MANAGER_CREATE',
    entityType: 'user',
    entityId: result.user.id,
    description: `Sales manager '${result.user.fullName}' created`,
  });
  res.status(201).json(result.user);
}));

// Manager or SuperAdmin creates an Admin (takes over a student's ongoing study status
// and subsequent payments once a Sales Manager records the first payment)
usersRouter.post('/admin', requireRole('MANAGER', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const result = await createUser('ADMIN', req.body, req.user!.userId, {
    managerId: req.user!.role === 'MANAGER' ? req.user!.userId : undefined,
  });
  if ('error' in result) { res.status(400).json(result); return; }
  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'ADMIN_CREATE',
    entityType: 'user',
    entityId: result.user.id,
    description: `Admin '${result.user.fullName}' created`,
  });
  res.status(201).json(result.user);
}));

// SuperAdmin creates Director
usersRouter.post('/director', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const BodySchema = BaseUserSchema.extend({ schoolId: z.number().int() });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  // Validate school exists
  const [school] = await db.select().from(schools).where(eq(schools.id, parsed.data.schoolId));
  if (!school) { res.status(404).json({ error: 'School not found' }); return; }

  const result = await createUser('DIRECTOR', parsed.data, req.user!.userId, {
    schoolId: parsed.data.schoolId,
  });
  if ('error' in result) { res.status(400).json(result); return; }
  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'DIRECTOR_CREATE',
    entityType: 'user',
    entityId: result.user.id,
    description: `Director '${result.user.fullName}' created for School '${school.name}' by SuperAdmin`,
  });
  await grantInitialBonus(result.user.id, 'directorSignupBonusUzs', req.user!.userId);
  res.status(201).json(result.user);
}));

// Director (or SuperAdmin) creates Teacher
usersRouter.post('/teacher', requireRole('DIRECTOR', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const user = req.user!;
  let schoolId = user.schoolId;
  if (user.role === 'SUPER_ADMIN') {
    const parsedBody = req.body as { schoolId?: number };
    if (parsedBody.schoolId) schoolId = Number(parsedBody.schoolId);
  }
  if (!schoolId && user.role === 'DIRECTOR') {
    const [dUser] = await db.select().from(users).where(eq(users.id, user.userId));
    if (dUser?.schoolId) schoolId = dUser.schoolId;
  }
  const result = await createUser('TEACHER', req.body, user.userId, {
    directorId: user.role === 'DIRECTOR' ? user.userId : undefined,
    schoolId,
  });
  if ('error' in result) { res.status(400).json(result); return; }
  await logAudit(db, {
    actorUserId: user.userId,
    action: 'TEACHER_CREATE',
    entityType: 'user',
    entityId: result.user.id,
    description: `Teacher '${result.user.fullName}' created by ${user.role}`,
  });
  await grantInitialBonus(result.user.id, 'teacherSignupBonusUzs', user.userId);
  res.status(201).json(result.user);
}));

// GET /users?role=TEACHER&schoolId=...
usersRouter.get('/', requireRole('SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR'), asyncHandler(async (req, res) => {
  const { role: roleFilter, schoolId: schoolFilter } = req.query;
  const user = req.user!;

  let dirSchoolId: number | undefined = undefined;
  if (user.role === 'DIRECTOR') {
    dirSchoolId = user.schoolId;
    if (!dirSchoolId) {
      const [dUser] = await db.select().from(users).where(eq(users.id, user.userId));
      dirSchoolId = dUser?.schoolId ?? undefined;
    }
  }

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      isActive: users.isActive,
      role: roles.name,
      schoolId: users.schoolId,
      directorId: users.directorId,
      managerId: users.managerId,
      meta: users.meta,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        roleFilter ? eq(roles.name, String(roleFilter)) : undefined,
        user.role === 'DIRECTOR'
          ? (dirSchoolId ? eq(users.schoolId, dirSchoolId) : eq(users.directorId, user.userId))
          : schoolFilter
          ? eq(users.schoolId, Number(schoolFilter))
          : undefined,
      ),
    );

  res.json(rows);
}));

// GET /users/:id
usersRouter.get('/:id', requireRole('SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const [row] = await db
    .select({ id: users.id, fullName: users.fullName, phone: users.phone, email: users.email, isActive: users.isActive, role: roles.name, schoolId: users.schoolId, meta: users.meta })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, id));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
}));

// DELETE /users/:id — Strict Protection: Directors CANNOT delete teachers
usersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const caller = req.user!;

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
  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) {
    res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    return;
  }

  // Deactivate user rather than hard delete to preserve relational integrity with students and commissions
  await db.update(users).set({ isActive: false }).where(eq(users.id, id));

  await logAudit(db, {
    actorUserId: caller.userId,
    action: 'USER_DEACTIVATE',
    entityType: 'user',
    entityId: id,
    description: `Foydalanuvchi '${targetUser.fullName}' (ID: ${id}) CEO tomonidan nofaol holatga o'tkazildi`,
  });

  res.json({ message: "Foydalanuvchi muvaffaqiyatli nofaol holatga o'tkazildi" });
}));
