-- Migration: money-integrity constraints and payment voiding.
--   * one non-voided "first payment" per student (stops two concurrent first payments
--     both earning the signup bonus)
--   * one commission per (payment, recipient)
--   * at most one open (PENDING) withdraw request per user
--   * payments can be voided by the CEO with a reason; their commissions become CANCELLED
--   * indexes for the queries the app actually runs

ALTER TYPE "commission_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
--> statement-breakpoint

ALTER TABLE "monthly_payments" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "monthly_payments" ADD COLUMN IF NOT EXISTS "voided_by_user_id" integer REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "monthly_payments" ADD COLUMN IF NOT EXISTS "void_reason" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_payments_one_first_per_student_idx"
  ON "monthly_payments" ("student_id") WHERE "is_first_payment" AND "voided_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_payments_student_month_idx"
  ON "monthly_payments" ("student_id", "paid_for_month");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "commissions_payment_user_unique_idx"
  ON "commissions" ("monthly_payment_id", "user_id") WHERE "monthly_payment_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commissions_user_status_idx" ON "commissions" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commissions_monthly_payment_id_idx" ON "commissions" ("monthly_payment_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx" ON "audit_logs" ("action", "created_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "withdraw_requests_one_pending_per_user_idx"
  ON "withdraw_requests" ("user_id") WHERE "status" = 'PENDING';
