-- Migration: add CEO-set withdraw limits (teacher/director) and the withdraw_requests
-- table backing the director/teacher-initiated cash-out flow (PENDING -> VERIFIED -> GIVEN).

ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "withdraw_limit_teacher_uzs" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "withdraw_limit_director_uzs" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "withdraw_status" AS ENUM ('PENDING', 'VERIFIED', 'GIVEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "withdraw_requests" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "amount_uzs" integer NOT NULL,
  "status" "withdraw_status" DEFAULT 'PENDING' NOT NULL,
  "verified_by_user_id" integer REFERENCES "users"("id"),
  "verified_at" timestamp with time zone,
  "given_by_user_id" integer REFERENCES "users"("id"),
  "given_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "withdraw_requests_user_id_idx" ON "withdraw_requests" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdraw_requests_status_idx" ON "withdraw_requests" ("status");
