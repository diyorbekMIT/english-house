import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, roles, schools, commissionRules, payouts } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { RequestRejected, isUniqueViolation } from '../lib/httpErrors.js';
import { and, desc, eq, ne, count } from 'drizzle-orm';
import { validateIdParams, queryId, queryEnum } from '../lib/params.js';

const isUniquePhoneViolation = isUniqueViolation;

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
validateIdParams(usersRouter, 'id');

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
  let schoolId: number | undefined;

  if (user.role === 'DIRECTOR') {
    // A director always creates teachers in their own school; nothing in the body can
    // redirect a teacher to another school.
    if (user.schoolId === undefined) {
      res.status(403).json({ error: 'Sizga maktab biriktirilmagan.' });
      return;
    }
    schoolId = user.schoolId;
  } else {
    const requested = (req.body as { schoolId?: unknown } | undefined)?.schoolId;
    if (requested !== undefined && requested !== null) {
      const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, Number(requested)));
      if (!school) { res.status(404).json({ error: 'School not found' }); return; }
      schoolId = school.id;
    }
  }

  const result = await createUser('TEACHER', { ...(req.body as object), schoolId }, user.userId, {
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

  const dirSchoolId = user.role === 'DIRECTOR' ? user.schoolId : undefined;

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
        // The CEO account is invisible to every other role.
        user.role === 'SUPER_ADMIN' ? undefined : ne(roles.name, 'SUPER_ADMIN'),
        user.role === 'DIRECTOR'
          ? (dirSchoolId ? eq(users.schoolId, dirSchoolId) : eq(users.directorId, user.userId))
          : schoolFilter
          ? eq(users.schoolId, queryId(schoolFilter, 'schoolId')!)
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

  // Directors only see their own school's people; nobody but the CEO sees the CEO.
  const viewer = req.user!;
  const outOfScope =
    (viewer.role !== 'SUPER_ADMIN' && row.role === 'SUPER_ADMIN') ||
    (viewer.role === 'DIRECTOR' && (viewer.schoolId === undefined || row.schoolId !== viewer.schoolId));
  if (outOfScope) { res.status(404).json({ error: 'Not found' }); return; }

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

  if (id === caller.userId) {
    res.status(400).json({ error: "O'zingizni nofaol qila olmaysiz." });
    return;
  }
  const [targetRole] = await db
    .select({ name: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, id));
  if (targetRole?.name === 'SUPER_ADMIN') {
    const [{ activeCeos }] = await db
      .select({ activeCeos: count() })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(roles.name, 'SUPER_ADMIN'), eq(users.isActive, true)));
    if ((activeCeos ?? 0) <= 1) {
      res.status(400).json({ error: "Oxirgi faol bosh administratorni nofaol qilib bo'lmaydi." });
      return;
    }
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


// ── Self-service and CEO account management ─────────────────────────────────────

const NewPasswordSchema = z.string().min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak").max(72);

// PATCH /users/me/password — any signed-in user changes their own password. Needs the
// current one, so a stolen session alone can't lock the owner out.
usersRouter.patch('/me/password', asyncHandler(async (req, res) => {
  const parsed = z
    .object({ currentPassword: z.string().min(1), newPassword: NewPasswordSchema })
    .safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [me] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, req.user!.userId));
  if (!me || !(await bcrypt.compare(parsed.data.currentPassword, me.passwordHash))) {
    res.status(400).json({ error: "Joriy parol noto'g'ri." });
    return;
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    res.status(400).json({ error: "Yangi parol joriy paroldan farq qilishi kerak." });
    return;
  }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), updatedAt: new Date() })
    .where(eq(users.id, req.user!.userId));

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'PASSWORD_CHANGE',
    entityType: 'user',
    entityId: req.user!.userId,
    description: `User ${req.user!.userId} changed their own password`,
  });
  res.json({ message: "Parol o'zgartirildi." });
}));

// PATCH /users/:id/password — CEO resets someone's password (forgotten password).
usersRouter.patch('/:id/password', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const parsed = z.object({ newPassword: NewPasswordSchema }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [target] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, id));
  if (!target) { res.status(404).json({ error: 'Foydalanuvchi topilmadi' }); return; }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), updatedAt: new Date() })
    .where(eq(users.id, id));

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: id,
    description: `Password of '${target.fullName}' (ID: ${id}) reset by SuperAdmin`,
  });
  res.json({ message: "Parol yangilandi." });
}));

// PATCH /users/:id/reactivate — undo a deactivation.
usersRouter.patch('/:id/reactivate', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const [target] = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ fullName: users.fullName });
  if (!target) { res.status(404).json({ error: 'Foydalanuvchi topilmadi' }); return; }

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'USER_REACTIVATE',
    entityType: 'user',
    entityId: id,
    description: `Foydalanuvchi '${target.fullName}' (ID: ${id}) CEO tomonidan qayta faollashtirildi`,
  });
  res.json({ message: 'Foydalanuvchi faollashtirildi.' });
}));

// PATCH /users/:id — CEO fixes a user's basic details (typos in name/phone/email, or a
// school change).
usersRouter.patch('/:id', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const parsed = z
    .object({
      fullName: z.string().trim().min(1).max(200).optional(),
      phone: z.string().trim().min(4).max(30).optional(),
      email: z.string().email().nullable().optional(),
      schoolId: z.number().int().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  try {
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(users).where(eq(users.id, id));
      if (!before) throw new RequestRejected(404, 'Foydalanuvchi topilmadi');
      if (parsed.data.schoolId) {
        const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, parsed.data.schoolId));
        if (!school) throw new RequestRejected(404, 'School not found');
      }
      const [row] = await tx
        .update(users)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id, fullName: users.fullName, phone: users.phone, email: users.email, schoolId: users.schoolId });
      await logAudit(tx, {
        actorUserId: req.user!.userId,
        action: 'USER_UPDATE',
        entityType: 'user',
        entityId: id,
        description: `User '${before.fullName}' (ID: ${id}) updated by SuperAdmin`,
        details: { changes: parsed.data },
      });
      return row;
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof RequestRejected) { res.status(err.status).json({ error: err.message }); return; }
    if (isUniquePhoneViolation(err)) { res.status(409).json({ error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" }); return; }
    throw err;
  }
}));
