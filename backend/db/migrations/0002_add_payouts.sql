-- Migration: add payouts table (director/teacher initial bonus + CEO manual credits/debits)
DO $$ BEGIN
 CREATE TYPE "public"."payout_type" AS ENUM('INITIAL_BONUS', 'CREDIT', 'DEBIT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"maker_id" integer,
	"receiver_id" integer NOT NULL,
	"amount_uzs" integer NOT NULL,
	"type" "payout_type" NOT NULL,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"comments" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_receiver_id_idx" ON "payouts" ("receiver_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_status_idx" ON "payouts" ("status");
