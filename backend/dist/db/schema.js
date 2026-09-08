"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogs = exports.commissions = exports.commissionRules = exports.monthlyPayments = exports.students = exports.users = exports.schools = exports.roles = exports.commissionStatusEnum = exports.commissionTypeEnum = exports.studyStatusEnum = exports.callStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ─── Enums ────────────────────────────────────────────────────────────────────
exports.callStatusEnum = (0, pg_core_1.pgEnum)('call_status', [
    'WAITING',
    'ACCEPTED',
    'REJECTED',
]);
exports.studyStatusEnum = (0, pg_core_1.pgEnum)('study_status', [
    'STUDYING',
    'STOPPED',
]);
exports.commissionTypeEnum = (0, pg_core_1.pgEnum)('commission_type', [
    'SIGNUP_BONUS',
    'MONTHLY_COMMISSION',
]);
exports.commissionStatusEnum = (0, pg_core_1.pgEnum)('commission_status', [
    'PENDING',
    'READY_TO_PAY',
    'PAID',
]);
// ─── Tables ───────────────────────────────────────────────────────────────────
exports.roles = (0, pg_core_1.pgTable)('roles', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    name: (0, pg_core_1.text)('name').notNull().unique(),
});
exports.schools = (0, pg_core_1.pgTable)('schools', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    schoolNumber: (0, pg_core_1.text)('school_number'),
    shortName: (0, pg_core_1.text)('short_name'),
    address: (0, pg_core_1.text)('address'),
    phone: (0, pg_core_1.text)('phone'),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    meta: (0, pg_core_1.jsonb)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    fullName: (0, pg_core_1.text)('full_name').notNull(),
    phone: (0, pg_core_1.text)('phone').notNull().unique(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    roleId: (0, pg_core_1.integer)('role_id')
        .notNull()
        .references(() => exports.roles.id),
    schoolId: (0, pg_core_1.integer)('school_id').references(() => exports.schools.id),
    managerId: (0, pg_core_1.integer)('manager_id'), // soft FK → users (Manager above Admin)
    directorId: (0, pg_core_1.integer)('director_id'), // soft FK → users (Director above Teacher)
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    email: (0, pg_core_1.text)('email'), // optional, not used for auth
    meta: (0, pg_core_1.jsonb)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    phoneIdx: (0, pg_core_1.index)('users_phone_idx').on(t.phone),
    roleIdIdx: (0, pg_core_1.index)('users_role_id_idx').on(t.roleId),
    managerIdIdx: (0, pg_core_1.index)('users_manager_id_idx').on(t.managerId),
    directorIdIdx: (0, pg_core_1.index)('users_director_id_idx').on(t.directorId),
    schoolIdIdx: (0, pg_core_1.index)('users_school_id_idx').on(t.schoolId),
}));
exports.students = (0, pg_core_1.pgTable)('students', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    fullName: (0, pg_core_1.text)('full_name').notNull(),
    phone: (0, pg_core_1.text)('phone').notNull(),
    secondaryPhone: (0, pg_core_1.text)('secondary_phone'),
    schoolId: (0, pg_core_1.integer)('school_id').references(() => exports.schools.id),
    directorId: (0, pg_core_1.integer)('director_id').references(() => exports.users.id),
    teacherId: (0, pg_core_1.integer)('teacher_id').references(() => exports.users.id),
    callStatus: (0, exports.callStatusEnum)('call_status').notNull().default('WAITING'),
    studyStatus: (0, exports.studyStatusEnum)('study_status').notNull().default('STOPPED'),
    callNote: (0, pg_core_1.text)('call_note'), // Admin's note: rejection reason, waiting reason, etc.
    meta: (0, pg_core_1.jsonb)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    phoneIdx: (0, pg_core_1.uniqueIndex)('students_phone_unique_idx').on(t.phone),
    teacherIdIdx: (0, pg_core_1.index)('students_teacher_id_idx').on(t.teacherId),
    directorIdIdx: (0, pg_core_1.index)('students_director_id_idx').on(t.directorId),
    schoolIdIdx: (0, pg_core_1.index)('students_school_id_idx').on(t.schoolId),
    callStatusIdx: (0, pg_core_1.index)('students_call_status_idx').on(t.callStatus),
    studyStatusIdx: (0, pg_core_1.index)('students_study_status_idx').on(t.studyStatus),
}));
exports.monthlyPayments = (0, pg_core_1.pgTable)('monthly_payments', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    studentId: (0, pg_core_1.integer)('student_id')
        .notNull()
        .references(() => exports.students.id),
    amountUzs: (0, pg_core_1.integer)('amount_uzs').notNull(),
    paidForMonth: (0, pg_core_1.text)('paid_for_month').notNull(), // YYYY-MM
    paidAt: (0, pg_core_1.timestamp)('paid_at', { withTimezone: true }).defaultNow().notNull(),
    paymentMethod: (0, pg_core_1.text)('payment_method'), // CASH, CARD, etc.
    createdByUserId: (0, pg_core_1.integer)('created_by_user_id')
        .notNull()
        .references(() => exports.users.id),
    notes: (0, pg_core_1.text)('notes'),
    meta: (0, pg_core_1.jsonb)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.commissionRules = (0, pg_core_1.pgTable)('commission_rules', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    teacherSignupBonusUzs: (0, pg_core_1.integer)('teacher_signup_bonus_uzs').notNull().default(0),
    directorSignupBonusUzs: (0, pg_core_1.integer)('director_signup_bonus_uzs').notNull().default(0),
    // Stored as integer basis points: 1000 = 10.00%
    teacherMonthlyPercent: (0, pg_core_1.integer)('teacher_monthly_percent').notNull().default(0),
    directorMonthlyPercent: (0, pg_core_1.integer)('director_monthly_percent').notNull().default(0),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    validFrom: (0, pg_core_1.timestamp)('valid_from', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.commissions = (0, pg_core_1.pgTable)('commissions', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    userId: (0, pg_core_1.integer)('user_id')
        .notNull()
        .references(() => exports.users.id),
    studentId: (0, pg_core_1.integer)('student_id')
        .notNull()
        .references(() => exports.students.id),
    monthlyPaymentId: (0, pg_core_1.integer)('monthly_payment_id').references(() => exports.monthlyPayments.id),
    type: (0, exports.commissionTypeEnum)('type').notNull(),
    amountUzs: (0, pg_core_1.integer)('amount_uzs').notNull(),
    status: (0, exports.commissionStatusEnum)('status').notNull().default('PENDING'),
    paidAt: (0, pg_core_1.timestamp)('paid_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    userIdIdx: (0, pg_core_1.index)('commissions_user_id_idx').on(t.userId),
    studentIdIdx: (0, pg_core_1.index)('commissions_student_id_idx').on(t.studentId),
    statusIdx: (0, pg_core_1.index)('commissions_status_idx').on(t.status),
}));
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    actorUserId: (0, pg_core_1.integer)('actor_user_id').references(() => exports.users.id),
    action: (0, pg_core_1.text)('action').notNull(),
    entityType: (0, pg_core_1.text)('entity_type').notNull(),
    entityId: (0, pg_core_1.integer)('entity_id'),
    description: (0, pg_core_1.text)('description').notNull(),
    details: (0, pg_core_1.jsonb)('details'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    actorIdx: (0, pg_core_1.index)('audit_logs_actor_user_id_idx').on(t.actorUserId),
    entityTypeIdx: (0, pg_core_1.index)('audit_logs_entity_type_idx').on(t.entityType),
    entityIdIdx: (0, pg_core_1.index)('audit_logs_entity_id_idx').on(t.entityId),
}));
