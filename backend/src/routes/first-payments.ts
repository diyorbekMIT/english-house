import { Router } from 'express';
import { db } from '../../db/client.js';
import { monthlyPayments, students, schools, users } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { and, desc, eq, inArray } from 'drizzle-orm';

export const firstPaymentsRouter = Router();
firstPaymentsRouter.use(authenticate);

// Not visible to DIRECTOR/TEACHER — same visibility rule as regular payment history.
firstPaymentsRouter.get(
  '/',
  requireRole('SALES_MANAGER', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { schoolId, teacherId } = req.query;

    const conditions = [eq(monthlyPayments.isFirstPayment, true)];
    if (schoolId) conditions.push(eq(students.schoolId, Number(schoolId)));
    if (teacherId) conditions.push(eq(students.teacherId, Number(teacherId)));

    const rows = await db
      .select({
        id: monthlyPayments.id,
        amountUzs: monthlyPayments.amountUzs,
        paidForMonth: monthlyPayments.paidForMonth,
        paidAt: monthlyPayments.paidAt,
        paymentMethod: monthlyPayments.paymentMethod,
        notes: monthlyPayments.notes,
        createdAt: monthlyPayments.createdAt,
        createdByName: users.fullName,
        studentId: students.id,
        studentFullName: students.fullName,
        studentPhone: students.phone,
        schoolId: schools.id,
        schoolName: schools.name,
        schoolNumber: schools.schoolNumber,
        teacherId: students.teacherId,
      })
      .from(monthlyPayments)
      .innerJoin(students, eq(monthlyPayments.studentId, students.id))
      .leftJoin(schools, eq(students.schoolId, schools.id))
      .leftJoin(users, eq(monthlyPayments.createdByUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(monthlyPayments.createdAt));

    // Teacher names resolved separately (students.teacherId -> users.fullName) since
    // joining users twice for both createdBy and teacher needs an alias; simpler to
    // batch-resolve here given the list is small (only first payments).
    const teacherIds = [...new Set(rows.map((r) => r.teacherId).filter((id): id is number => id != null))];
    const teachers = teacherIds.length
      ? await db
          .select({ id: users.id, fullName: users.fullName, phone: users.phone })
          .from(users)
          .where(inArray(users.id, teacherIds))
      : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    const result = rows.map((r) => ({
      ...r,
      teacherName: r.teacherId ? teacherMap.get(r.teacherId)?.fullName ?? null : null,
      teacherPhone: r.teacherId ? teacherMap.get(r.teacherId)?.phone ?? null : null,
    }));

    res.json(result);
  }),
);
