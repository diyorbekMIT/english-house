import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { courses } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { eq } from 'drizzle-orm';

export const coursesRouter = Router();
coursesRouter.use(authenticate);

const CourseSchema = z.object({
  name: z.string().min(1),
  priceUzs: z.number().int().nonnegative(),
  isActive: z.boolean().optional().default(true),
});

// Price is CEO-only, enforced here — not a client-side hide. Every other role
// (teacher included) gets the course name only, so they can select a course
// when registering a student without ever seeing what it costs.
const toVisibleCourse = (course: typeof courses.$inferSelect, isSuperAdmin: boolean) =>
  isSuperAdmin ? course : { id: course.id, name: course.name, isActive: course.isActive };

coursesRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db.select().from(courses);
  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  res.json(rows.map((c) => toVisibleCourse(c, isSuperAdmin)));
}));

coursesRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toVisibleCourse(course, req.user!.role === 'SUPER_ADMIN'));
}));

coursesRouter.post('/', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const parsed = CourseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [course] = await db.insert(courses).values({
    name: parsed.data.name,
    priceUzs: parsed.data.priceUzs,
    isActive: parsed.data.isActive,
  }).returning();

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'COURSE_CREATE',
    entityType: 'course',
    entityId: course!.id,
    description: `Course '${course!.name}' created (${course!.priceUzs} UZS) by SuperAdmin`,
  });
  res.status(201).json(course);
}));

// The only way a course's price ever changes — always logged, always CEO-only.
coursesRouter.patch('/:id', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const parsed = CourseSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [existing] = await db.select().from(courses).where(eq(courses.id, id));
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const [course] = await db
    .update(courses)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning();

  const priceChanged = parsed.data.priceUzs !== undefined && parsed.data.priceUzs !== existing.priceUzs;
  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'COURSE_UPDATE',
    entityType: 'course',
    entityId: id,
    description: `Course '${course!.name}' updated` + (priceChanged ? ` (price ${existing.priceUzs} -> ${course!.priceUzs} UZS)` : ''),
  });
  res.json(course);
}));
