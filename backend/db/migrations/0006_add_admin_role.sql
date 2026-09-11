-- Migration: add a new ADMIN role, distinct from the just-renamed SALES_MANAGER.
-- SALES_MANAGER runs the call pipeline through the first payment; ADMIN takes over
-- a student's ongoing study-status tracking and subsequent payments after that.
INSERT INTO roles (name)
SELECT 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ADMIN');
