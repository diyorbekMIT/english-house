-- Migration: track a student's first-ever monthly payment
-- Backfills isFirstPayment for existing data: the earliest paidAt (ties broken by
-- lowest id) per student becomes the first payment. Safe to re-run — the UPDATE
-- always recomputes from paid_at/id, and the ADD COLUMN is guarded.
ALTER TABLE "monthly_payments" ADD COLUMN IF NOT EXISTS "is_first_payment" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_payments_is_first_payment_idx" ON "monthly_payments" ("is_first_payment");
--> statement-breakpoint
UPDATE "monthly_payments" SET "is_first_payment" = false;
--> statement-breakpoint
UPDATE "monthly_payments" mp
SET "is_first_payment" = true
FROM (
  SELECT DISTINCT ON (student_id) id
  FROM "monthly_payments"
  ORDER BY student_id, paid_at ASC, id ASC
) AS first_per_student
WHERE mp.id = first_per_student.id;
