-- Migration: add courses.special_price_uzs + commission_rules first-payment percents.
-- Bonuses will be calculated off the course's special price rather than the actual
-- amount paid; the first payment earns a separate (typically higher) rate than
-- every payment after it.

-- special_price_uzs is NOT NULL, so backfill existing courses with their current
-- price_uzs before adding the constraint (CEO can adjust each afterward).
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "special_price_uzs" integer;
--> statement-breakpoint
UPDATE "courses" SET "special_price_uzs" = "price_uzs" WHERE "special_price_uzs" IS NULL;
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "special_price_uzs" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "teacher_first_payment_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "director_first_payment_percent" integer DEFAULT 0 NOT NULL;
