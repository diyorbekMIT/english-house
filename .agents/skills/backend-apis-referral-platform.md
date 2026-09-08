# Skill: Backend APIs for Referral Platform

## Objective
Implement REST APIs in `backend/` to manage roles, students, payments,
commissions, and audit logs according to the DB schema.

## Rules of Engagement
- Use Node.js + TypeScript + Express/Fastify.
- Use Drizzle ORM for all DB operations.
- Validate request bodies with Zod.
- Every mutating endpoint writes an `audit_logs` row.

## Instructions
1. Implement auth endpoints:
   - `POST /auth/login` — returns JWT with `role`, `user_id`, hierarchy info.
   - `POST /auth/seed-super-admin` — optional endpoint or script to create
     the first SuperAdmin using environment variables.

2. Implement user management endpoints:
   - `POST /users/manager` — SuperAdmin creates Manager.
   - `POST /users/admin` — Manager creates Admin1/Admin2.
   - `POST /users/director` — SuperAdmin creates Director.
   - `POST /users/teacher` — Director creates Teacher.

3. Implement student and call endpoints:
   - `POST /students` — Teacher or Admin registers a new student/lead.
   - `PATCH /students/:id/call-status` — Admin1/Admin2 updates call_status.
   - `PATCH /students/:id/study-status` — Admin or Director marks STUDYING/STOPPED.

4. Implement payments and commissions:
   - `POST /students/:id/monthly-payments` — Admin records monthly payment.
   - On each payment, compute teacher/director commission from `commission_rules`
     and create `commissions` rows with status `PENDING`.

5. Implement audit log recording:
   - Create middleware or helper that, after each successful mutation,
     writes an `audit_logs` entry with:
       - actor_user_id (from JWT),
       - action (constant per endpoint),
       - entity_type (e.g. `user`, `student`, `payment`),
       - entity_id,
       - description (short human-readable string).

6. Implement basic role-based access control:
   - SuperAdmin can access everything.
   - Manager can manage Admins and see all students.
   - Admin1/Admin2 can manage students and call_status.
   - Director can manage Teachers in their school and see their students.
   - Teacher can see only their own students.

7. Document endpoints in `docs/api.md` with example requests/responses.
