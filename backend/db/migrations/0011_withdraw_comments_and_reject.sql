-- Migration: let the CEO reject a withdraw request, and attach a comment to each
-- status change (verify / give / reject).

ALTER TYPE "withdraw_status" ADD VALUE IF NOT EXISTS 'REJECTED';
--> statement-breakpoint

ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "rejected_by_user_id" integer REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "verify_comment" text;
--> statement-breakpoint
ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "give_comment" text;
--> statement-breakpoint
ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "reject_comment" text;
