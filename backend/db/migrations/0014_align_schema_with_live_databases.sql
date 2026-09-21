-- Migration: bring the migration history in line with what the live databases actually
-- are. Before this, a database built purely from db/migrations/*.sql differed from
-- dev/production, whose schema had been adjusted by hand:
--   * schools.address / phone / school_number are optional (the app never required them)
--   * schools.school_number is NOT unique
--   * students.phone is UNIQUE (the duplicate-lead guarantee); the history only created
--     a plain, non-unique index
-- Every statement is a no-op on dev/production, which already look like this.

ALTER TABLE "schools" ALTER COLUMN "address" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "phone" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "school_number" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" DROP CONSTRAINT IF EXISTS "schools_school_number_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "schools_school_number_idx";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "students_phone_unique_idx" ON "students" ("phone");
--> statement-breakpoint
DROP INDEX IF EXISTS "students_phone_idx";
