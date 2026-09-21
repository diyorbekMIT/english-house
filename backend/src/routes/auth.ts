import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, roles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { rateLimit } from 'express-rate-limit';
import { JWT_SECRET } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logAudit } from '../middleware/audit.js';

export const authRouter = Router();

// Only failed attempts count, so normal users are never throttled. Two windows: a few
// failures against one account from one address, and a wider cap per address to stop
// someone spraying many phone numbers.
const failedLoginLimit = { windowMs: 15 * 60 * 1000, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false } as const;
const perAccountLimiter = rateLimit({
  ...failedLoginLimit,
  limit: 8,
  keyGenerator: (req) => `${req.ip}:${String((req.body as { phone?: unknown } | undefined)?.phone ?? '')}`,
  message: { error: "Juda ko'p muvaffaqiyatsiz urinish. 15 daqiqadan so'ng qayta urinib ko'ring." },
});
const perAddressLimiter = rateLimit({
  ...failedLoginLimit,
  limit: 40,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: "Juda ko'p muvaffaqiyatsiz urinish. 15 daqiqadan so'ng qayta urinib ko'ring." },
});

// Compared against when the phone is unknown/inactive so a wrong-phone attempt costs
// the same time as a wrong-password one (no account enumeration by response time).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// A session lasts one working day; user status is re-checked on every request anyway.
const TOKEN_TTL = '12h';

const LoginSchema = z.object({
  phone: z.string().min(4),
  password: z.string().min(6),
});

authRouter.post('/login', perAddressLimiter, perAccountLimiter, asyncHandler(async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { phone, password } = parsed.data;

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      roleId: users.roleId,
      schoolId: users.schoolId,
      directorId: users.directorId,
      managerId: users.managerId,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.phone, phone));

  const valid = await bcrypt.compare(password, user && user.isActive ? user.passwordHash : DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    await logAudit(db, {
      actorUserId: user?.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user?.id,
      description: `Failed login attempt for phone '${phone}'`,
      details: { ip: req.ip },
    });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Only identity goes in the token; role/school/active are read from the DB per request.
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: 'HS256' });

  await logAudit(db, {
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    description: `User '${user.fullName}' (${user.roleName}) logged in`,
    details: { ip: req.ip },
  });

  res.json({
    token,
    role: user.roleName,
    userId: user.id,
    fullName: user.fullName,
    schoolId: user.schoolId,
  });
}));
