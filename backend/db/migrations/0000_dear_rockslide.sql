DO $$ BEGIN
 CREATE TYPE "public"."call_status" AS ENUM('WAITING', 'ACCEPTED', 'REJECTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commission_status" AS ENUM('PENDING', 'READY_TO_PAY', 'PAID');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commission_type" AS ENUM('SIGNUP_BONUS', 'MONTHLY_COMMISSION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."study_status" AS ENUM('STUDYING', 'STOPPED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"description" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"teacher_signup_bonus_uzs" integer DEFAULT 0 NOT NULL,
	"director_signup_bonus_uzs" integer DEFAULT 0 NOT NULL,
	"teacher_monthly_percent" integer DEFAULT 0 NOT NULL,
	"director_monthly_percent" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"monthly_payment_id" integer,
	"type" "commission_type" NOT NULL,
	"amount_uzs" integer NOT NULL,
	"status" "commission_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"amount_uzs" integer NOT NULL,
	"paid_for_month" text NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method" text,
	"created_by_user_id" integer NOT NULL,
	"notes" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schools" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_number" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_school_number_unique" UNIQUE("school_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"secondary_phone" text,
	"school_id" integer,
	"director_id" integer,
	"teacher_id" integer,
	"call_status" "call_status" DEFAULT 'WAITING' NOT NULL,
	"study_status" "study_status" DEFAULT 'STUDYING' NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" integer NOT NULL,
	"school_id" integer,
	"manager_id" integer,
	"director_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"email" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commissions" ADD CONSTRAINT "commissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commissions" ADD CONSTRAINT "commissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commissions" ADD CONSTRAINT "commissions_monthly_payment_id_monthly_payments_id_fk" FOREIGN KEY ("monthly_payment_id") REFERENCES "public"."monthly_payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_payments" ADD CONSTRAINT "monthly_payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_payments" ADD CONSTRAINT "monthly_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_director_id_users_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_idx" ON "audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commissions_user_id_idx" ON "commissions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commissions_student_id_idx" ON "commissions" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commissions_status_idx" ON "commissions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schools_school_number_idx" ON "schools" ("school_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_phone_idx" ON "students" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_teacher_id_idx" ON "students" ("teacher_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_director_id_idx" ON "students" ("director_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_school_id_idx" ON "students" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_call_status_idx" ON "students" ("call_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_study_status_idx" ON "students" ("study_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_id_idx" ON "users" ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_manager_id_idx" ON "users" ("manager_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_director_id_idx" ON "users" ("director_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_school_id_idx" ON "users" ("school_id");