import {
  bigserial,
  boolean,
  index,
  uniqueIndex,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const callStatusEnum = pgEnum('call_status', [
  'WAITING',
  'ACCEPTED',
  'REJECTED',
]);

export const studyStatusEnum = pgEnum('study_status', [
  'STUDYING',
  'STOPPED',
]);

export const commissionTypeEnum = pgEnum('commission_type', [
  'SIGNUP_BONUS',
  'MONTHLY_COMMISSION',
]);

export const commissionStatusEnum = pgEnum('commission_status', [
  'PENDING',
  'READY_TO_PAY',
  'PAID',
]);

export const payoutTypeEnum = pgEnum('payout_type', [
  'INITIAL_BONUS',
  'CREDIT',
  'DEBIT',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const roles = pgTable('roles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
});

export const schools = pgTable(
  'schools',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    schoolNumber: text('school_number'),
    shortName: text('short_name'),
    address: text('address'),
    phone: text('phone'),
    isActive: boolean('is_active').notNull().default(true),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    schoolId: integer('school_id').references(() => schools.id),
    managerId: integer('manager_id'),   // soft FK → users (Manager above Admin)
    directorId: integer('director_id'), // soft FK → users (Director above Teacher)
    isActive: boolean('is_active').notNull().default(true),
    email: text('email'),               // optional, not used for auth
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneIdx: index('users_phone_idx').on(t.phone),
    roleIdIdx: index('users_role_id_idx').on(t.roleId),
    managerIdIdx: index('users_manager_id_idx').on(t.managerId),
    directorIdIdx: index('users_director_id_idx').on(t.directorId),
    schoolIdIdx: index('users_school_id_idx').on(t.schoolId),
  }),
);

export const students = pgTable(
  'students',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    secondaryPhone: text('secondary_phone'),
    schoolId: integer('school_id').references(() => schools.id),
    directorId: integer('director_id').references(() => users.id),
    teacherId: integer('teacher_id').references(() => users.id),
    callStatus: callStatusEnum('call_status').notNull().default('WAITING'),
    studyStatus: studyStatusEnum('study_status').notNull().default('STOPPED'),
    callNote: text('call_note'),              // Admin's note: rejection reason, waiting reason, etc.
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneIdx: uniqueIndex('students_phone_unique_idx').on(t.phone),
    teacherIdIdx: index('students_teacher_id_idx').on(t.teacherId),
    directorIdIdx: index('students_director_id_idx').on(t.directorId),
    schoolIdIdx: index('students_school_id_idx').on(t.schoolId),
    callStatusIdx: index('students_call_status_idx').on(t.callStatus),
    studyStatusIdx: index('students_study_status_idx').on(t.studyStatus),
  }),
);

export const monthlyPayments = pgTable('monthly_payments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  amountUzs: integer('amount_uzs').notNull(),
  paidForMonth: text('paid_for_month').notNull(), // YYYY-MM
  paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
  paymentMethod: text('payment_method'),           // CASH, CARD, etc.
  createdByUserId: integer('created_by_user_id')
    .notNull()
    .references(() => users.id),
  notes: text('notes'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const commissionRules = pgTable('commission_rules', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  teacherSignupBonusUzs: integer('teacher_signup_bonus_uzs').notNull().default(0),
  directorSignupBonusUzs: integer('director_signup_bonus_uzs').notNull().default(0),
  // Stored as integer basis points: 1000 = 10.00%
  teacherMonthlyPercent: integer('teacher_monthly_percent').notNull().default(0),
  directorMonthlyPercent: integer('director_monthly_percent').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const commissions = pgTable(
  'commissions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    monthlyPaymentId: integer('monthly_payment_id').references(() => monthlyPayments.id),
    type: commissionTypeEnum('type').notNull(),
    amountUzs: integer('amount_uzs').notNull(),
    status: commissionStatusEnum('status').notNull().default('PENDING'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('commissions_user_id_idx').on(t.userId),
    studentIdIdx: index('commissions_student_id_idx').on(t.studentId),
    statusIdx: index('commissions_status_idx').on(t.status),
  }),
);

// payouts: money moved between the company (CEO) and a director/teacher —
// the automatic one-time registration bonus, plus manual CEO credits/debits.
// Deliberately separate from `commissions` (per-student earnings) and
// `monthlyPayments` (money students pay the school).
export const payouts = pgTable(
  'payouts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    makerId: integer('maker_id').references(() => users.id), // null for system-granted INITIAL_BONUS
    receiverId: integer('receiver_id')
      .notNull()
      .references(() => users.id),
    amountUzs: integer('amount_uzs').notNull(),
    type: payoutTypeEnum('type').notNull(),
    status: payoutStatusEnum('status').notNull().default('PENDING'),
    comments: text('comments'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    receiverIdIdx: index('payouts_receiver_id_idx').on(t.receiverId),
    statusIdx: index('payouts_status_idx').on(t.status),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id'),
    description: text('description').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index('audit_logs_actor_user_id_idx').on(t.actorUserId),
    entityTypeIdx: index('audit_logs_entity_type_idx').on(t.entityType),
    entityIdIdx: index('audit_logs_entity_id_idx').on(t.entityId),
  }),
);
