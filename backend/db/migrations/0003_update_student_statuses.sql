-- Migration: expand call_status pipeline, rename study_status to ACTIVE/NOACTIVE
-- call_status: WAITING, ACCEPTED, REJECTED -> WAITING, CALLED, REGISTERED, FIRST_LESSON,
--   STARTED_STUDYING, MADE_PAYMENT, REJECTED (existing ACCEPTED rows become CALLED)
-- study_status: STUDYING, STOPPED -> ACTIVE, NOACTIVE (renamed 1:1)
-- Each block is guarded to only run once — safe to re-run (e.g. by mistake) without
-- re-mapping already-migrated rows back to WAITING/NOACTIVE via the CASE's ELSE branch.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'call_status' AND e.enumlabel = 'CALLED'
  ) THEN
    ALTER TYPE "public"."call_status" RENAME TO "call_status_old";
    CREATE TYPE "public"."call_status" AS ENUM ('WAITING', 'CALLED', 'REGISTERED', 'FIRST_LESSON', 'STARTED_STUDYING', 'MADE_PAYMENT', 'REJECTED');
    ALTER TABLE "students" ALTER COLUMN "call_status" DROP DEFAULT;
    ALTER TABLE "students" ALTER COLUMN "call_status" TYPE "public"."call_status" USING (
      CASE "call_status"::text
        WHEN 'ACCEPTED' THEN 'CALLED'
        WHEN 'REJECTED' THEN 'REJECTED'
        ELSE 'WAITING'
      END
    )::"public"."call_status";
    ALTER TABLE "students" ALTER COLUMN "call_status" SET DEFAULT 'WAITING';
    DROP TYPE "public"."call_status_old";
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'study_status' AND e.enumlabel = 'ACTIVE'
  ) THEN
    ALTER TYPE "public"."study_status" RENAME TO "study_status_old";
    CREATE TYPE "public"."study_status" AS ENUM ('ACTIVE', 'NOACTIVE');
    ALTER TABLE "students" ALTER COLUMN "study_status" DROP DEFAULT;
    ALTER TABLE "students" ALTER COLUMN "study_status" TYPE "public"."study_status" USING (
      CASE "study_status"::text
        WHEN 'STUDYING' THEN 'ACTIVE'
        WHEN 'STOPPED' THEN 'NOACTIVE'
        ELSE 'NOACTIVE'
      END
    )::"public"."study_status";
    ALTER TABLE "students" ALTER COLUMN "study_status" SET DEFAULT 'NOACTIVE';
    DROP TYPE "public"."study_status_old";
  END IF;
END $$;
