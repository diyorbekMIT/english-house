import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '../config.js';
import { db } from '../../db/client.js';
import { users, roles } from '../../db/schema.js';

export interface JwtPayload {
  userId: number;
  role: string;
  fullName?: string;
  phone?: string;
  schoolId?: number;
  directorId?: number;
  managerId?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// The token only proves who the user is; everything else (active flag, role, school,
// hierarchy) is re-read from the database on every request. That way deactivating a
// user or changing their role takes effect immediately instead of when the token
// happens to expire.
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  let userId: number;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as { userId?: number };
    if (typeof payload.userId !== 'number') throw new Error('Malformed token');
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        isActive: users.isActive,
        schoolId: users.schoolId,
        directorId: users.directorId,
        managerId: users.managerId,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId));

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account disabled or removed' });
      return;
    }

    req.user = {
      userId: user.id,
      role: user.roleName,
      fullName: user.fullName,
      phone: user.phone,
      schoolId: user.schoolId ?? undefined,
      directorId: user.directorId ?? undefined,
      managerId: user.managerId ?? undefined,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...allowedRoles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
