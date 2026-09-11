import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { students, schools, users, roles, monthlyPayments } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { and, or, desc, eq, like, inArray, notInArray, SQL } from 'drizzle-orm';

export const studentsRouter = Router();
studentsRouter.use(authenticate);

export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

const CreateStudentSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(4),
  secondaryPhone: z.string().optional(),
  schoolId: z.number().int().optional(),
  directorId: z.number().int().optional(),
  teacherId: z.number().int().optional(),
  callNote: z.string().max(500).optional(),
  meta: z.record(z.unknown()).optional(),
});

studentsRouter.post(
  '/',
  requireRole('TEACHER', 'SALES_MANAGER', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const parsed = CreateStudentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const rawPhone = parsed.data.phone.trim();
    const normalizedPhone = normalizePhone(rawPhone);
    const rawDigits = rawPhone.replace(/\D/g, '');

    // Check if student with this phone number already exists
    const checkConditions = [
      eq(students.phone, normalizedPhone),
      eq(students.phone, rawPhone),
    ];
    if (rawDigits.length >= 7) {
      checkConditions.push(like(students.phone, `%${rawDigits.slice(-9)}`));
    }

    const [existingStudent] = await db
      .select({
        id: students.id,
        fullName: students.fullName,
        phone: students.phone,
        teacherId: students.teacherId,
        schoolId: students.schoolId,
      })
      .from(students)
      .where(or(...checkConditions))
      .limit(1);

    if (existingStudent) {
      let teacherInfo = '';
      if (existingStudent.teacherId) {
        const [tUser] = await db
          .select({ fullName: users.fullName })
          .from(users)
          .where(eq(users.id, existingStudent.teacherId));
        if (tUser) teacherInfo = ` (Ustoz: ${tUser.fullName})`;
      }

      let schoolInfo = '';
      if (existingStudent.schoolId) {
        const [sch] = await db
          .select({ name: schools.name, schoolNumber: schools.schoolNumber })
          .from(schools)
          .where(eq(schools.id, existingStudent.schoolId));
        if (sch) schoolInfo = ` [№ ${sch.schoolNumber} — ${sch.name}]`;
      }

      res.status(409).json({
        error: `Ushbu telefon raqamli o'quvchi (${existingStudent.phone}) tizimda allaqachon mavjud! '${existingStudent.fullName}'${teacherInfo}${schoolInfo}. Takroriy ma'lumot kiritish taqiqlanadi.`,
        existingStudent: {
          id: existingStudent.id,
          fullName: existingStudent.fullName,
          phone: existingStudent.phone,
        },
      });
      return;
    }

    const user = req.user!;
    const teacherId =
      user.role === 'TEACHER' ? user.userId : (parsed.data.teacherId ?? undefined);
    let schoolId = parsed.data.schoolId;

    // Automatically link student to teacher's school
    if (user.role === 'TEACHER') {
      if (!schoolId && user.schoolId) {
        schoolId = user.schoolId;
      }
      if (!schoolId) {
        const [tUser] = await db.select().from(users).where(eq(users.id, user.userId));
        if (tUser?.schoolId) schoolId = tUser.schoolId;
      }
    } else if (teacherId && !schoolId) {
      const [tUser] = await db.select().from(users).where(eq(users.id, teacherId));
      if (tUser?.schoolId) schoolId = tUser.schoolId;
    }

    // Dynamic director assignment based on the school's active director
    let directorId = parsed.data.directorId;
    if (schoolId && !directorId) {
      const [activeDir] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.schoolId, schoolId), eq(roles.name, 'DIRECTOR'), eq(users.isActive, true)))
        .limit(1);
      if (activeDir) directorId = activeDir.id;
    }

    const normalizedSecondaryPhone = parsed.data.secondaryPhone?.trim()
      ? normalizePhone(parsed.data.secondaryPhone.trim())
      : null;

    try {
      const [student] = await db
        .insert(students)
        .values({
          fullName: parsed.data.fullName.trim(),
          phone: normalizedPhone,
          secondaryPhone: normalizedSecondaryPhone,
          schoolId,
          directorId,
          teacherId,
          // callStatus/studyStatus intentionally omitted: every new student
          // starts at the WAITING/NOACTIVE column defaults, no exceptions.
          callNote: parsed.data.callNote ?? null,
          meta: parsed.data.meta ?? null,
        })
        .returning();

      await logAudit(db, {
        actorUserId: user.userId,
        action: 'STUDENT_CREATE',
        entityType: 'student',
        entityId: student!.id,
        description: `Student '${student!.fullName}' (${normalizedPhone}) created by ${user.role}`,
      });
      res.status(201).json(student);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') {
        res.status(409).json({
          error: `Ushbu telefon raqamli o'quvchi (${normalizedPhone}) tizimda allaqachon mavjud! Takroriy o'quvchi kiritish taqiqlanadi.`,
        });
        return;
      }
      throw err;
    }
  }),
);

studentsRouter.get(
  '/',
  requireRole('TEACHER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { callStatus, studyStatus, schoolId, teacherId, hasFirstPayment } = req.query;

    const conditions: SQL[] = [];
    if (user.role === 'TEACHER') {
      conditions.push(eq(students.teacherId, user.userId));
    }
    // DIRECTOR sees all students belonging to their school (not bound to personal directorId!)
    if (user.role === 'DIRECTOR') {
      let dirSchoolId = user.schoolId;
      if (!dirSchoolId) {
        const [dirUser] = await db.select().from(users).where(eq(users.id, user.userId));
        dirSchoolId = dirUser?.schoolId ?? undefined;
      }
      if (dirSchoolId) {
        conditions.push(eq(students.schoolId, dirSchoolId));
      }
    }
    // SALES_MANAGER's job ends at the first payment — once that's recorded, the
    // student hands off to Admin, so it automatically drops off Sales Manager's list.
    if (user.role === 'SALES_MANAGER') {
      conditions.push(
        notInArray(
          students.id,
          db.select({ id: monthlyPayments.studentId }).from(monthlyPayments).where(eq(monthlyPayments.isFirstPayment, true)),
        ),
      );
    }
    if (callStatus) conditions.push(eq(students.callStatus, String(callStatus) as typeof students.$inferSelect.callStatus));
    if (studyStatus) conditions.push(eq(students.studyStatus, String(studyStatus) as typeof students.$inferSelect.studyStatus));
    if (schoolId) conditions.push(eq(students.schoolId, Number(schoolId)));
    if (teacherId) conditions.push(eq(students.teacherId, Number(teacherId)));
    // Powers the Admin panel: only students a Sales Manager has already taken through
    // their first payment — that's the hand-off point where the work becomes Admin's.
    if (hasFirstPayment === 'true') {
      conditions.push(
        inArray(
          students.id,
          db.select({ id: monthlyPayments.studentId }).from(monthlyPayments).where(eq(monthlyPayments.isFirstPayment, true)),
        ),
      );
    }

    const rows = await db
      .select({
        id: students.id,
        fullName: students.fullName,
        phone: students.phone,
        secondaryPhone: students.secondaryPhone,
        schoolId: students.schoolId,
        directorId: students.directorId,
        teacherId: students.teacherId,
        callStatus: students.callStatus,
        studyStatus: students.studyStatus,
        callNote: students.callNote,
        meta: students.meta,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
        schoolName: schools.name,
        schoolNumber: schools.schoolNumber,
        teacherName: users.fullName,
        teacherPhone: users.phone,
      })
      .from(students)
      .leftJoin(schools, eq(students.schoolId, schools.id))
      .leftJoin(users, eq(students.teacherId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(students.createdAt));

    res.json(rows);
  }),
);

studentsRouter.get('/:id', requireRole('TEACHER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params['id']);
  const [student] = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      phone: students.phone,
      secondaryPhone: students.secondaryPhone,
      schoolId: students.schoolId,
      directorId: students.directorId,
      teacherId: students.teacherId,
      callStatus: students.callStatus,
      studyStatus: students.studyStatus,
      callNote: students.callNote,
      meta: students.meta,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
      schoolName: schools.name,
      schoolNumber: schools.schoolNumber,
      teacherName: users.fullName,
      teacherPhone: users.phone,
    })
    .from(students)
    .leftJoin(schools, eq(students.schoolId, schools.id))
    .leftJoin(users, eq(students.teacherId, users.id))
    .where(eq(students.id, id));

  if (!student) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(student);
}));

const CALL_STATUS_VALUES = [
  'WAITING',
  'CALLED',
  'REGISTERED',
  'FIRST_LESSON',
  'STARTED_STUDYING',
  'MADE_PAYMENT',
  'REJECTED',
] as const;

// Reaching MADE_PAYMENT automatically activates the student — this is what
// director/teacher commissions will be based on, so it's a one-way trigger,
// not something callStatus can silently undo again. Returns undefined when no
// automatic studyStatus change should happen.
export const deriveStudyStatusOnCallStatusChange = (
  callStatus: (typeof CALL_STATUS_VALUES)[number],
): 'ACTIVE' | undefined => (callStatus === 'MADE_PAYMENT' ? 'ACTIVE' : undefined);

// Only SALES_MANAGER and SUPER_ADMIN (CEO) may change call status — this is the lead
// pipeline SALES_MANAGER owns through MADE_PAYMENT; ADMIN takes over after that (see
// /:id/study-status below), so ADMIN is deliberately not included here.
studentsRouter.patch(
  '/:id/call-status',
  requireRole('SALES_MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const schema = z.object({
      callStatus: z.enum(CALL_STATUS_VALUES),
      callNote: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const updateData: {
      callStatus: typeof students.$inferSelect.callStatus;
      studyStatus?: typeof students.$inferSelect.studyStatus;
      updatedAt: Date;
      callNote?: string | null;
    } = {
      callStatus: parsed.data.callStatus,
      updatedAt: new Date(),
    };
    const derivedStudyStatus = deriveStudyStatusOnCallStatusChange(parsed.data.callStatus);
    if (derivedStudyStatus) {
      updateData.studyStatus = derivedStudyStatus;
    }
    // Always write callNote (even if empty string, to clear previous note)
    if (parsed.data.callNote !== undefined) {
      updateData.callNote = parsed.data.callNote || null;
    }

    const [student] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, id))
      .returning();
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const noteText = parsed.data.callNote ? ` | Izoh: "${parsed.data.callNote}"` : '';
    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'STUDENT_CALL_STATUS_UPDATE',
      entityType: 'student',
      entityId: id,
      description: `Student '${student.fullName}' call_status changed to ${parsed.data.callStatus} by ${req.user!.fullName || req.user!.role}${noteText}`,
      details: {
        studentId: id,
        studentName: student.fullName,
        callStatus: parsed.data.callStatus,
        callNote: parsed.data.callNote || null,
        adminId: req.user!.userId,
        adminName: req.user!.fullName,
      },
    });
    res.json(student);
  }),
);

studentsRouter.patch(
  '/:id/study-status',
  requireRole('ADMIN', 'SALES_MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const schema = z.object({ studyStatus: z.enum(['ACTIVE', 'NOACTIVE']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const [student] = await db
      .update(students)
      .set({ studyStatus: parsed.data.studyStatus, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'STUDENT_STUDY_STATUS_UPDATE',
      entityType: 'student',
      entityId: id,
      description: `Student '${student.fullName}' study_status changed to ${parsed.data.studyStatus}`,
    });
    res.json(student);
  }),
);
