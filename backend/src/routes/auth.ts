import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, roles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const authRouter = Router();

const LoginSchema = z.object({
  phone: z.string().min(4),
  password: z.string().min(6),
});

authRouter.post('/login', asyncHandler(async (req, res) => {
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

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
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

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    role: user.roleName,
    userId: user.id,
    fullName: user.fullName,
    schoolId: user.schoolId,
  });
}));
