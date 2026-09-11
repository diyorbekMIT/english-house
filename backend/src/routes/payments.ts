import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { monthlyPayments, commissions, commissionRules, students, users, roles } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { and, desc, eq } from 'drizzle-orm';

export const paymentsRouter = Router({ mergeParams: true });
paymentsRouter.use(authenticate);

const PaymentSchema = z.object({
  amountUzs: z.number().int().positive(),
  paidForMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  notes: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

// The first payment always earns a bonus (it's the activation trigger). Every
// payment after that only earns the ongoing bonus while the student is ACTIVE —
// once NOACTIVE, that recurring stream stops.
export const isEligibleForBonus = (isFirstPayment: boolean, studyStatus: string): boolean =>
  isFirstPayment || studyStatus === 'ACTIVE';

// Bonuses are calculated off the CEO-set special price (commissionRules.specialPriceUzs),
// not the actual amount paid — falls back to the real payment amount when the
// CEO hasn't set one yet (0/unset).
export const selectCommissionBaseUzs = (
  specialPriceUzs: number | null | undefined,
  amountUzs: number,
): number => (specialPriceUzs && specialPriceUzs > 0 ? specialPriceUzs : amountUzs);

paymentsRouter.post(
  '/',
  requireRole('SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const [existingPayment] = await db
      .select({ id: monthlyPayments.id })
      .from(monthlyPayments)
      .where(eq(monthlyPayments.studentId, studentId))
      .limit(1);
    const isFirstPayment = !existingPayment;

    // Admin's job starts only after a Sales Manager has already brought in the first
    // payment — they record every payment after that, never the first one.
    if (isFirstPayment && req.user!.role === 'ADMIN') {
      res.status(403).json({
        error: "Birinchi to'lovni faqat sotuv menejeri qabul qila oladi.",
      });
      return;
    }

    // Fetch latest active commission rules
    const [rules] = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.isActive, true))
      .orderBy(desc(commissionRules.id))
      .limit(1);

    // Create payment record
    const [payment] = await db
      .insert(monthlyPayments)
      .values({
        studentId,
        amountUzs: parsed.data.amountUzs,
        paidForMonth: parsed.data.paidForMonth,
        paymentMethod: parsed.data.paymentMethod,
        createdByUserId: req.user!.userId,
        isFirstPayment,
        notes: parsed.data.notes,
        meta: parsed.data.meta ?? null,
      })
      .returning();

    // The first payment is what actually activates a student — this is what hands
    // them off from Sales Manager's lead list to Admin's ongoing-student list. Call
    // status is bumped to MADE_PAYMENT alongside it, so the lead pipeline reflects
    // reality without the Sales Manager having to update it by hand.
    if (isFirstPayment) {
      await db.update(students).set({ studyStatus: 'ACTIVE', callStatus: 'MADE_PAYMENT', updatedAt: new Date() }).where(eq(students.id, studentId));
    }

    // Compute and insert commissions.
    if (rules && payment && isEligibleForBonus(isFirstPayment, student.studyStatus)) {
      const baseUzs = selectCommissionBaseUzs(rules.specialPriceUzs, parsed.data.amountUzs);

      const commissionType = isFirstPayment ? 'SIGNUP_BONUS' : 'MONTHLY_COMMISSION';
      const teacherPercent = isFirstPayment ? rules.teacherFirstPaymentPercent : rules.teacherMonthlyPercent;
      const directorPercent = isFirstPayment ? rules.directorFirstPaymentPercent : rules.directorMonthlyPercent;

      const commissionRows: (typeof commissions.$inferInsert)[] = [];

      if (student.teacherId) {
        const teacherAmount = Math.floor((baseUzs * teacherPercent) / 10000);
        if (teacherAmount > 0) {
          commissionRows.push({
            userId: student.teacherId,
            studentId,
            monthlyPaymentId: payment.id,
            amountUzs: teacherAmount,
            type: commissionType,
            status: 'PENDING',
          });
        }
      }

      // Look up current active director of the student's school (so changing directors keeps commissions intact)
      let directorRecipientId = student.directorId;
      if (student.schoolId) {
        const [activeDirector] = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(
            and(
              eq(users.schoolId, student.schoolId),
              eq(roles.name, 'DIRECTOR'),
              eq(users.isActive, true),
            ),
          )
          .limit(1);
        if (activeDirector) {
          directorRecipientId = activeDirector.id;
        }
      }

      if (directorRecipientId) {
        const directorAmount = Math.floor((baseUzs * directorPercent) / 10000);
        if (directorAmount > 0) {
          commissionRows.push({
            userId: directorRecipientId,
            studentId,
            monthlyPaymentId: payment.id,
            amountUzs: directorAmount,
            type: commissionType,
            status: 'PENDING',
          });
        }
      }

      if (commissionRows.length > 0) {
        await db.insert(commissions).values(commissionRows);
      }
    }

    if (isFirstPayment) {
      await logAudit(db, {
        actorUserId: req.user!.userId,
        action: 'STUDENT_STUDY_STATUS_UPDATE',
        entityType: 'student',
        entityId: studentId,
        description: `Student '${student.fullName}' study_status changed to ACTIVE (first payment received)`,
      });
    }

    await logAudit(db, {
      actorUserId: req.user!.userId,
      action: 'MONTHLY_PAYMENT_CREATE',
      entityType: 'payment',
      entityId: payment!.id,
      description: `Monthly payment recorded for Student '${student.fullName}' (${parsed.data.paidForMonth}) by ${req.user!.role}${isFirstPayment ? ' — first payment' : ''}`,
      details: { amountUzs: parsed.data.amountUzs, paidForMonth: parsed.data.paidForMonth, isFirstPayment },
    });

    res.status(201).json(payment);
  }),
);

// Payment history is intentionally not visible to DIRECTOR/TEACHER.
paymentsRouter.get(
  '/',
  requireRole('SALES_MANAGER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const rows = await db
      .select({
        id: monthlyPayments.id,
        studentId: monthlyPayments.studentId,
        amountUzs: monthlyPayments.amountUzs,
        paidForMonth: monthlyPayments.paidForMonth,
        paidAt: monthlyPayments.paidAt,
        paymentMethod: monthlyPayments.paymentMethod,
        notes: monthlyPayments.notes,
        isFirstPayment: monthlyPayments.isFirstPayment,
        createdByUserId: monthlyPayments.createdByUserId,
        createdByName: users.fullName,
        createdAt: monthlyPayments.createdAt,
      })
      .from(monthlyPayments)
      .leftJoin(users, eq(monthlyPayments.createdByUserId, users.id))
      .where(eq(monthlyPayments.studentId, studentId))
      .orderBy(desc(monthlyPayments.paidAt));
    res.json(rows);
  }),
);
