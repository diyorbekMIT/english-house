import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { students, schools, users, roles, monthlyPayments, courses } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { RequestRejected, isUniqueViolation } from '../lib/httpErrors.js';
import { and, or, desc, eq, like, inArray, notInArray, isNull, SQL } from 'drizzle-orm';

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
  courseId: z.number().int().optional(),
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
      const caller = req.user!;
      // Staff need to know who already registered the lead; a teacher/director only
      // sees details about their own students, never another school's.
      const mayInspect =
        caller.role === 'SUPER_ADMIN' || caller.role === 'SALES_MANAGER' || caller.role === 'MANAGER' ||
        (caller.role === 'TEACHER' && existingStudent.teacherId === caller.userId) ||
        (caller.role === 'DIRECTOR' && caller.schoolId !== undefined && existingStudent.schoolId === caller.schoolId);

      if (!mayInspect) {
        res.status(409).json({
          error: "Ushbu telefon raqamli o'quvchi tizimda allaqachon mavjud! Takroriy ma'lumot kiritish taqiqlanadi.",
        });
        return;
      }

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

    // Who a student is attributed to decides who earns commissions on them, so the
    // school/teacher/director come from the caller's own hierarchy, never blindly from
    // the request body.
    let teacherId: number | undefined;
    let schoolId: number | undefined;
    let directorId: number | undefined;

    if (user.role === 'TEACHER') {
      teacherId = user.userId;
      schoolId = user.schoolId;
    } else if (user.role === 'DIRECTOR') {
      if (user.schoolId === undefined) {
        res.status(403).json({ error: 'Sizga maktab biriktirilmagan.' });
        return;
      }
      schoolId = user.schoolId;
      directorId = user.userId;
      teacherId = parsed.data.teacherId;
    } else {
      teacherId = parsed.data.teacherId;
      schoolId = parsed.data.schoolId;
      directorId = parsed.data.directorId;
    }

    if (teacherId !== undefined && user.role !== 'TEACHER') {
      const [teacher] = await db
        .select({ schoolId: users.schoolId, roleName: roles.name, isActive: users.isActive })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, teacherId));
      if (!teacher || teacher.roleName !== 'TEACHER' || !teacher.isActive) {
        res.status(400).json({ error: "O'qituvchi topilmadi." });
        return;
      }
      if (user.role === 'DIRECTOR' && teacher.schoolId !== user.schoolId) {
        res.status(403).json({ error: "Bu o'qituvchi sizning maktabingizga tegishli emas." });
        return;
      }
      if (schoolId === undefined && teacher.schoolId) schoolId = teacher.schoolId;
    }

    if (parsed.data.courseId !== undefined) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, parsed.data.courseId), eq(courses.isActive, true)));
      if (!course) {
        res.status(400).json({ error: 'Kurs topilmadi yoki faol emas.' });
        return;
      }
    }

    // Dynamic director assignment based on the school's active director
    if (schoolId && !directorId) {
      const [activeDir] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.schoolId, schoolId), eq(roles.name, 'DIRECTOR'), eq(users.isActive, true)))
        .orderBy(users.id)
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
          courseId: parsed.data.courseId ?? null,
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
      if (user.schoolId === undefined) {
        // A director with no school assigned must not fall through to "everything".
        res.json([]);
        return;
      }
      conditions.push(eq(students.schoolId, user.schoolId));
    }
    // SALES_MANAGER's job ends at the first payment — once that's recorded, the
    // student hands off to Admin, so it automatically drops off Sales Manager's list.
    if (user.role === 'SALES_MANAGER') {
      conditions.push(
        notInArray(
          students.id,
          db.select({ id: monthlyPayments.studentId }).from(monthlyPayments).where(and(eq(monthlyPayments.isFirstPayment, true), isNull(monthlyPayments.voidedAt))),
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
          db.select({ id: monthlyPayments.studentId }).from(monthlyPayments).where(and(eq(monthlyPayments.isFirstPayment, true), isNull(monthlyPayments.voidedAt))),
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
        courseId: students.courseId,
        courseName: courses.name,
      })
      .from(students)
      .leftJoin(schools, eq(students.schoolId, schools.id))
      .leftJoin(users, eq(students.teacherId, users.id))
      .leftJoin(courses, eq(students.courseId, courses.id))
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
      courseId: students.courseId,
      courseName: courses.name,
    })
    .from(students)
    .leftJoin(schools, eq(students.schoolId, schools.id))
    .leftJoin(users, eq(students.teacherId, users.id))
    .leftJoin(courses, eq(students.courseId, courses.id))
    .where(eq(students.id, id));

  if (!student) { res.status(404).json({ error: 'Not found' }); return; }

  // Teachers only see their own students, directors only their school's; anything
  // outside that scope answers 404 so the id can't even be probed.
  const viewer = req.user!;
  const outOfScope =
    (viewer.role === 'TEACHER' && student.teacherId !== viewer.userId) ||
    (viewer.role === 'DIRECTOR' && (viewer.schoolId === undefined || student.schoolId !== viewer.schoolId));
  if (outOfScope) { res.status(404).json({ error: 'Not found' }); return; }

  res.json(student);
}));

const UpdateStudentSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(4).max(30).optional(),
  secondaryPhone: z.string().trim().max(30).nullable().optional(),
  schoolId: z.number().int().nullable().optional(),
  teacherId: z.number().int().nullable().optional(),
  courseId: z.number().int().nullable().optional(),
});

// PATCH /students/:id — CEO-only correction of a student's details (a typo in the name
// or phone, or moving them to another teacher/school/course). Re-attribution changes
// who earns commissions on later payments, which is why only the CEO may do it.
studentsRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params['id']);
    const parsed = UpdateStudentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

    try {
      const updated = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(students).where(eq(students.id, id)).for('update');
        if (!before) throw new RequestRejected(404, 'Student not found');

        const patch: Partial<typeof students.$inferInsert> = {};
        if (parsed.data.fullName !== undefined) patch.fullName = parsed.data.fullName;
        if (parsed.data.phone !== undefined) patch.phone = normalizePhone(parsed.data.phone);
        if (parsed.data.secondaryPhone !== undefined) {
          patch.secondaryPhone = parsed.data.secondaryPhone ? normalizePhone(parsed.data.secondaryPhone) : null;
        }
        if (parsed.data.courseId !== undefined) {
          if (parsed.data.courseId !== null) {
            const [course] = await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, parsed.data.courseId));
            if (!course) throw new RequestRejected(400, 'Kurs topilmadi.');
          }
          patch.courseId = parsed.data.courseId;
        }
        if (parsed.data.teacherId !== undefined) {
          if (parsed.data.teacherId !== null) {
            const [teacher] = await tx
              .select({ schoolId: users.schoolId, roleName: roles.name })
              .from(users)
              .innerJoin(roles, eq(users.roleId, roles.id))
              .where(eq(users.id, parsed.data.teacherId));
            if (!teacher || teacher.roleName !== 'TEACHER') throw new RequestRejected(400, "O'qituvchi topilmadi.");
          }
          patch.teacherId = parsed.data.teacherId;
        }
        if (parsed.data.schoolId !== undefined) {
          if (parsed.data.schoolId !== null) {
            const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, parsed.data.schoolId));
            if (!school) throw new RequestRejected(400, 'Maktab topilmadi.');
          }
          patch.schoolId = parsed.data.schoolId;
          // The school's active director follows the school.
          if (parsed.data.schoolId !== null && parsed.data.schoolId !== before.schoolId) {
            const [activeDir] = await tx
              .select({ id: users.id })
              .from(users)
              .innerJoin(roles, eq(users.roleId, roles.id))
              .where(and(eq(users.schoolId, parsed.data.schoolId), eq(roles.name, 'DIRECTOR'), eq(users.isActive, true)))
              .orderBy(users.id)
              .limit(1);
            patch.directorId = activeDir?.id ?? null;
          }
        }

        const [row] = await tx
          .update(students)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(students.id, id))
          .returning();

        await logAudit(tx, {
          actorUserId: req.user!.userId,
          action: 'STUDENT_UPDATE',
          entityType: 'student',
          entityId: id,
          description: `Student '${before.fullName}' (ID: ${id}) updated by SuperAdmin`,
          details: {
            before: {
              fullName: before.fullName, phone: before.phone, secondaryPhone: before.secondaryPhone,
              schoolId: before.schoolId, teacherId: before.teacherId, courseId: before.courseId,
            },
            changes: parsed.data,
          },
        });
        return row;
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof RequestRejected) { res.status(err.status).json({ error: err.message }); return; }
      if (isUniqueViolation(err)) { res.status(409).json({ error: "Ushbu telefon raqamli o'quvchi allaqachon mavjud." }); return; }
      throw err;
    }
  }),
);

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
