-- Migration: move the bonus-calculation "special price" off individual courses
-- and onto commission_rules as a single CEO-set value used for every course.

ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "special_price_uzs" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

ALTER TABLE "courses" DROP COLUMN IF EXISTS "special_price_uzs";
