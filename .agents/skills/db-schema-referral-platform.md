# Skill: DB Schema for Referral Platform

## Objective
Design and maintain a PostgreSQL schema for the referral tracking system
using Drizzle ORM, matching the business hierarchy:
SuperAdmin -> Manager -> Admin1/Admin2
SuperAdmin -> Director -> Teacher -> Student.

## Rules of Engagement
- Use Drizzle's `pgTable` to define tables.
- Normalize data; use foreign keys for relationships.
- Every table has `id` (bigserial), `created_at`, `updated_at`.
- All monetary fields are integer UZS amounts.
- Schema must support audit logging of actions.

## Instructions
1. Create or update the Drizzle schema in `backend/db/schema.ts` with tables:
   - `roles` (id, name).
   - `users` (id, full_name, email, password_hash, role_id, school_id,
     manager_id, director_id, is_active, timestamps).
   - `schools` (id, name, address, timestamps).
   - `students` (id, full_name, phone, school_id, director_id, teacher_id,
     call_status, study_status, timestamps).
   - `monthly_payments` (id, student_id, amount_uzs, paid_at).
   - `commission_rules` (id, teacher_signup_bonus_uzs, director_signup_bonus_uzs,
     teacher_monthly_percent, director_monthly_percent, timestamps).
   - `commissions` (id, user_id, student_id, monthly_payment_id,
     amount_uzs, type, status, timestamps).
   - `audit_logs` (id, actor_user_id, action, entity_type, entity_id,
     description, details_json, created_at).

2. Generate migrations using Drizzle migration tooling and save them in
   `backend/db/migrations/`.

3. Ensure indexes exist on foreign keys and commonly filtered fields:
   - `users.role_id`, `users.manager_id`, `users.director_id`.
   - `students.teacher_id`, `students.director_id`, `students.school_id`.
   - `audit_logs.entity_type`, `audit_logs.entity_id`, `audit_logs.actor_user_id`.

4. Validate that the schema can express:
   - “Admin1 created by SuperAdmin”.
   - “Student123 call_status set to ACCEPTED by Admin1”.
   - Monthly commissions per student and per teacher/director.

5. Document the final schema in `docs/db-schema.md`.
