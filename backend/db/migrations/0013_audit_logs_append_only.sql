-- Migration: make audit_logs append-only. The app only ever INSERTs audit rows; these
-- triggers make it impossible for a bug, a compromised endpoint or an injected query
-- to rewrite or erase history. (A database owner can still DISABLE TRIGGER for a
-- deliberate, out-of-band correction.)

CREATE OR REPLACE FUNCTION audit_logs_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON "audit_logs";
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_change();
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs";
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_reject_change();
