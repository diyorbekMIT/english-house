import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { monthlyPayments, commissions, commissionRules, students, users, roles } from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { RequestRejected, isUniqueViolation } from '../lib/httpErrors.js';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

export const paymentsRouter = Router({ mergeParams: true });
paymentsRouter.use(authenticate);

const PaymentSchema = z.object({
  amountUzs: z.number().int().positive().max(2_000_000_000),
  paidForMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM format'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  notes: z.string().max(500).optional(),
  meta: z.record(z.unknown()).optional(),
});

const VoidSchema = z.object({ reason: z.string().trim().min(1, 'Sababni yozing').max(500) });

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

// POST /students/:studentId/monthly-payments
// The whole flow (payment, student activation, commissions, audit trail) is one
// transaction, and the student row is locked first: two concurrent submits for the
// same student queue up instead of both being treated as the "first" payment, and a
// failure part-way can't leave a payment without its commissions.
paymentsRouter.post(
  '/',
  requireRole('SALES_MANAGER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    try {
      const payment = await db.transaction(async (tx) => {
        const [student] = await tx
          .select()
          .from(students)
          .where(eq(students.id, studentId))
          .for('update');
        if (!student) throw new RequestRejected(404, 'Student not found');

        const [existingPayment] = await tx
          .select({ id: monthlyPayments.id })
          .from(monthlyPayments)
          .where(and(eq(monthlyPayments.studentId, studentId), isNull(monthlyPayments.voidedAt)))
          .limit(1);
        const isFirstPayment = !existingPayment;

        // Admin's job starts only after a Sales Manager has already brought in the first
        // payment — they record every payment after that, never the first one.
        if (isFirstPayment && req.user!.role === 'ADMIN') {
          throw new RequestRejected(403, "Birinchi to'lovni faqat sotuv menejeri qabul qila oladi.");
        }

        const [rules] = await tx
          .select()
          .from(commissionRules)
          .where(eq(commissionRules.isActive, true))
          .orderBy(desc(commissionRules.id))
          .limit(1);

        // A single payment can't exceed the CEO-set special price — that price is meant
        // to represent the course's real value, so a larger payment would signal a data
        // entry error rather than a legitimate transaction. Skipped while unset (0).
        if (rules && rules.specialPriceUzs > 0 && parsed.data.amountUzs > rules.specialPriceUzs) {
          throw new RequestRejected(
            400,
            `To'lov summasi maxsus narxdan (${rules.specialPriceUzs} UZS) oshmasligi kerak.`,
          );
        }

        const [created] = await tx
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
        if (!created) throw new Error('Payment insert returned no row');

        // The first payment is what actually activates a student — this is what hands
        // them off from Sales Manager's lead list to Admin's ongoing-student list. Call
        // status is bumped to MADE_PAYMENT alongside it, so the lead pipeline reflects
        // reality without the Sales Manager having to update it by hand.
        if (isFirstPayment) {
          await tx
            .update(students)
            .set({ studyStatus: 'ACTIVE', callStatus: 'MADE_PAYMENT', updatedAt: new Date() })
            .where(eq(students.id, studentId));
        }

        if (rules && isEligibleForBonus(isFirstPayment, student.studyStatus)) {
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
                monthlyPaymentId: created.id,
                amountUzs: teacherAmount,
                type: commissionType,
                status: 'PENDING',
              });
            }
          }

          // Look up current active director of the student's school (so changing directors keeps commissions intact)
          let directorRecipientId = student.directorId;
          if (student.schoolId) {
            const [activeDirector] = await tx
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
              .orderBy(users.id)
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
                monthlyPaymentId: created.id,
                amountUzs: directorAmount,
                type: commissionType,
                status: 'PENDING',
              });
            }
          }

          if (commissionRows.length > 0) {
            await tx.insert(commissions).values(commissionRows);
          }
        }

        if (isFirstPayment) {
          await logAudit(tx, {
            actorUserId: req.user!.userId,
            action: 'STUDENT_STUDY_STATUS_UPDATE',
            entityType: 'student',
            entityId: studentId,
            description: `Student '${student.fullName}' study_status changed to ACTIVE (first payment received)`,
          });
        }

        await logAudit(tx, {
          actorUserId: req.user!.userId,
          action: 'MONTHLY_PAYMENT_CREATE',
          entityType: 'payment',
          entityId: created.id,
          description: `Monthly payment recorded for Student '${student.fullName}' (${parsed.data.paidForMonth}) by ${req.user!.role}${isFirstPayment ? ' — first payment' : ''}`,
          details: { amountUzs: parsed.data.amountUzs, paidForMonth: parsed.data.paidForMonth, isFirstPayment },
        });

        return created;
      });

      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof RequestRejected) { res.status(err.status).json({ error: err.message }); return; }
      // Backstop for the one-first-payment-per-student index; the row lock above makes
      // this unreachable in practice.
      if (isUniqueViolation(err)) { res.status(409).json({ error: "Bu to'lov allaqachon qayd etilgan." }); return; }
      throw err;
    }
  }),
);

// PATCH /students/:studentId/monthly-payments/:paymentId/void — CEO-only correction for a
// mistaken payment. The payment stays on record but stops counting as revenue, and the
// commissions it generated become CANCELLED. A payment whose commissions were already
// paid out can't be voided here (the cash has left the building).
paymentsRouter.patch(
  '/:paymentId/void',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const paymentId = Number(req.params['paymentId']);
    const parsed = VoidSchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    try {
      const result = await db.transaction(async (tx) => {
        const [student] = await tx.select().from(students).where(eq(students.id, studentId)).for('update');
        if (!student) throw new RequestRejected(404, 'Student not found');

        const [payment] = await tx
          .select()
          .from(monthlyPayments)
          .where(and(eq(monthlyPayments.id, paymentId), eq(monthlyPayments.studentId, studentId)));
        if (!payment) throw new RequestRejected(404, 'Payment not found');
        if (payment.voidedAt) throw new RequestRejected(409, "Bu to'lov allaqachon bekor qilingan.");

        if (payment.isFirstPayment) {
          const activePayments = await tx
            .select({ id: monthlyPayments.id })
            .from(monthlyPayments)
            .where(and(eq(monthlyPayments.studentId, studentId), isNull(monthlyPayments.voidedAt)));
          if (activePayments.length > 1) {
            throw new RequestRejected(409, "Avval keyingi to'lovlarni bekor qiling — birinchi to'lov eng oxirida bekor qilinadi.");
          }
        }

        const paymentCommissions = await tx
          .select()
          .from(commissions)
          .where(eq(commissions.monthlyPaymentId, paymentId));
        if (paymentCommissions.some((c) => c.status === 'PAID')) {
          throw new RequestRejected(409, "Bu to'lovdan hisoblangan komissiya allaqachon to'langan, bekor qilib bo'lmaydi.");
        }

        const [voided] = await tx
          .update(monthlyPayments)
          .set({ voidedAt: new Date(), voidedByUserId: req.user!.userId, voidReason: parsed.data.reason })
          .where(eq(monthlyPayments.id, paymentId))
          .returning();

        const cancelIds = paymentCommissions
          .filter((c) => c.status === 'PENDING' || c.status === 'READY_TO_PAY')
          .map((c) => c.id);
        if (cancelIds.length > 0) {
          await tx
            .update(commissions)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(inArray(commissions.id, cancelIds));
        }

        // Without its first payment the student is no longer an activated/paid student.
        if (payment.isFirstPayment) {
          await tx
            .update(students)
            .set({ studyStatus: 'NOACTIVE', callStatus: 'STARTED_STUDYING', updatedAt: new Date() })
            .where(eq(students.id, studentId));
        }

        await logAudit(tx, {
          actorUserId: req.user!.userId,
          action: 'MONTHLY_PAYMENT_VOID',
          entityType: 'payment',
          entityId: paymentId,
          description: `Payment ${paymentId} of ${payment.amountUzs} UZS for Student '${student.fullName}' voided by SuperAdmin`,
          details: {
            reason: parsed.data.reason,
            wasFirstPayment: payment.isFirstPayment,
            cancelledCommissions: paymentCommissions
              .filter((c) => cancelIds.includes(c.id))
              .map((c) => ({ id: c.id, userId: c.userId, amountUzs: c.amountUzs })),
          },
        });

        return { payment: voided, cancelledCommissions: cancelIds.length };
      });

      res.json(result);
    } catch (err) {
      if (err instanceof RequestRejected) { res.status(err.status).json({ error: err.message }); return; }
      throw err;
    }
  }),
);

// Payment history is intentionally not visible to DIRECTOR/TEACHER. Voided payments are
// included (flagged) so the CEO/staff can see what was corrected and why.
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
        voidedAt: monthlyPayments.voidedAt,
        voidReason: monthlyPayments.voidReason,
        createdAt: monthlyPayments.createdAt,
      })
      .from(monthlyPayments)
      .leftJoin(users, eq(monthlyPayments.createdByUserId, users.id))
      .where(eq(monthlyPayments.studentId, studentId))
      .orderBy(desc(monthlyPayments.paidAt));
    res.json(rows);
  }),
);
