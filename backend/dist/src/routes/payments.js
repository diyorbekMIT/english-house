"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.paymentsRouter = (0, express_1.Router)({ mergeParams: true });
exports.paymentsRouter.use(auth_js_1.authenticate);
const PaymentSchema = zod_1.z.object({
    amountUzs: zod_1.z.number().int().positive(),
    paidForMonth: zod_1.z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
    paymentMethod: zod_1.z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
    notes: zod_1.z.string().optional(),
    meta: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.paymentsRouter.post('/', (0, auth_js_1.requireRole)('ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const [student] = await client_js_1.db.select().from(schema_js_1.students).where((0, drizzle_orm_1.eq)(schema_js_1.students.id, studentId));
    if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    // Fetch latest active commission rules
    const [rules] = await client_js_1.db
        .select()
        .from(schema_js_1.commissionRules)
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissionRules.isActive, true))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.commissionRules.id))
        .limit(1);
    // Create payment record
    const [payment] = await client_js_1.db
        .insert(schema_js_1.monthlyPayments)
        .values({
        studentId,
        amountUzs: parsed.data.amountUzs,
        paidForMonth: parsed.data.paidForMonth,
        paymentMethod: parsed.data.paymentMethod,
        createdByUserId: req.user.userId,
        notes: parsed.data.notes,
        meta: parsed.data.meta ?? null,
    })
        .returning();
    // Compute and insert commissions
    if (rules && payment) {
        const commissionRows = [];
        if (student.teacherId) {
            const teacherAmount = Math.floor((parsed.data.amountUzs * rules.teacherMonthlyPercent) / 10000);
            if (teacherAmount > 0) {
                commissionRows.push({
                    userId: student.teacherId,
                    studentId,
                    monthlyPaymentId: payment.id,
                    amountUzs: teacherAmount,
                    type: 'MONTHLY_COMMISSION',
                    status: 'PENDING',
                });
            }
        }
        // Look up current active director of the student's school (so changing directors keeps commissions intact)
        let directorRecipientId = student.directorId;
        if (student.schoolId) {
            const [activeDirector] = await client_js_1.db
                .select({ id: schema_js_1.users.id })
                .from(schema_js_1.users)
                .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.schoolId, student.schoolId), (0, drizzle_orm_1.eq)(schema_js_1.roles.name, 'DIRECTOR'), (0, drizzle_orm_1.eq)(schema_js_1.users.isActive, true)))
                .limit(1);
            if (activeDirector) {
                directorRecipientId = activeDirector.id;
            }
        }
        if (directorRecipientId) {
            const directorAmount = Math.floor((parsed.data.amountUzs * rules.directorMonthlyPercent) / 10000);
            if (directorAmount > 0) {
                commissionRows.push({
                    userId: directorRecipientId,
                    studentId,
                    monthlyPaymentId: payment.id,
                    amountUzs: directorAmount,
                    type: 'MONTHLY_COMMISSION',
                    status: 'PENDING',
                });
            }
        }
        if (commissionRows.length > 0) {
            await client_js_1.db.insert(schema_js_1.commissions).values(commissionRows);
        }
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'MONTHLY_PAYMENT_CREATE',
        entityType: 'payment',
        entityId: payment.id,
        description: `Monthly payment recorded for Student '${student.fullName}' (${parsed.data.paidForMonth}) by ${req.user.role}`,
        details: { amountUzs: parsed.data.amountUzs, paidForMonth: parsed.data.paidForMonth },
    });
    res.status(201).json(payment);
});
exports.paymentsRouter.get('/', (0, auth_js_1.requireRole)('ADMIN', 'DIRECTOR', 'TEACHER', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const studentId = Number(req.params['studentId']);
    const rows = await client_js_1.db
        .select()
        .from(schema_js_1.monthlyPayments)
        .where((0, drizzle_orm_1.eq)(schema_js_1.monthlyPayments.studentId, studentId))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.monthlyPayments.paidAt));
    res.json(rows);
});
