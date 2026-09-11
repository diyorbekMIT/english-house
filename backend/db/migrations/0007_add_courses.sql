-- Migration: add courses table + students.course_id link.
-- Course price is CEO-only at the application layer; nothing here restricts it,
-- the API route never returns price_uzs to non-SUPER_ADMIN callers.
CREATE TABLE IF NOT EXISTS "courses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_uzs" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "course_id" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_course_id_idx" ON "students" ("course_id");
