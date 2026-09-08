import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { schools } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { eq } from 'drizzle-orm';

export const schoolsRouter = Router();
schoolsRouter.use(authenticate);

const SchoolSchema = z.object({
  name: z.string().min(1),
  schoolNumber: z.string().optional(),
  shortName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  meta: z.record(z.unknown()).optional(),
});

schoolsRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schools);
  res.json(rows);
});

schoolsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params['id']);
  const [school] = await db.select().from(schools).where(eq(schools.id, id));
  if (!school) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(school);
});

schoolsRouter.post('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  const parsed = SchoolSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  let schoolNumber = parsed.data.schoolNumber?.trim() || null;
  if (!schoolNumber) {
    const match = parsed.data.name.match(/\d+/);
    if (match) schoolNumber = match[0];
  }

  const [school] = await db.insert(schools).values({
    name: parsed.data.name,
    schoolNumber: schoolNumber ?? null,
    shortName: parsed.data.shortName ?? schoolNumber ?? null,
    address: parsed.data.address ?? null,
    phone: parsed.data.phone ?? null,
    isActive: parsed.data.isActive,
    meta: parsed.data.meta ?? null,
  }).returning();

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'SCHOOL_CREATE',
    entityType: 'school',
    entityId: school!.id,
    description: `School '${school!.name}' (№ ${school!.schoolNumber || school!.id}) created by SuperAdmin`,
    details: { name: school!.name, schoolNumber: school!.schoolNumber },
  });
  res.status(201).json(school);
});

schoolsRouter.patch('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const id = Number(req.params['id']);
  const parsed = SchoolSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [school] = await db
    .update(schools)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schools.id, id))
    .returning();
  if (!school) { res.status(404).json({ error: 'Not found' }); return; }

  await logAudit(db, {
    actorUserId: req.user!.userId,
    action: 'SCHOOL_UPDATE',
    entityType: 'school',
    entityId: id,
    description: `School '${school.name}' updated`,
  });
  res.json(school);
});
