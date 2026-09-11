-- Migration: rename the ADMIN role to SALES_MANAGER
-- Only touches the roles.name string — role_id foreign keys on users are untouched,
-- so every existing ADMIN user becomes SALES_MANAGER automatically. Idempotent: a
-- second run matches zero rows since no role is named 'ADMIN' anymore.
UPDATE roles SET name = 'SALES_MANAGER' WHERE name = 'ADMIN';
