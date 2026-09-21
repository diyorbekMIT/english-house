# AGENTS.md — Referral Tracking Platform

## Product Manager (PM)
- Clarifies requirements about roles, dashboards, UZS commissions, and audit logs.
- Keeps `docs/api.md` and `docs/db-schema.md` in step with the code (they are the spec; there is no separate specs folder).
- Ensures MVP stays simple: no over-engineering, just the flows we described.

## Backend Engineer
- Owns `backend/` codebase (Node.js + TypeScript + Drizzle + PostgreSQL).
- Designs DB schema and migrations.
- Implements REST APIs for:
  - Auth and roles (SuperAdmin/CEO, Manager, Sales Manager, Admin, Director, Teacher).
  - CRUD for schools, users, students.
  - Monthly payments and commissions.
  - Audit logs.
- Writes basic unit and integration tests.

## Frontend Engineer
- Owns `frontend/` codebase (React + TS + Tailwind).
- Implements dashboards per role.
- Integrates with backend APIs via React Query.
- Focuses on usability for non-technical users (admins, directors, teachers).

## QA Engineer
- Reviews code and specs.
- Adds test cases for edge conditions:
  - Hierarchy validation (teacher belongs to director, director to school).
  - Commission calculation correctness.
  - UZS integer handling and audit logging.

## DevOps Engineer
- Configures environment variables for dev and production.
- Sets up Docker Compose or deployment scripts.
- Makes sure Antigravity and the app can run locally and in production
  with the same stack.

## Working agreements
- Migrations are hand-written, idempotent SQL in `backend/db/migrations/` and are applied by `npm run db:migrate` (also the Heroku release phase). Never use `drizzle-kit generate`.
- Money paths (payments, withdrawals, voids) run in one transaction and are covered by the integration suite in `backend/src/__tests__/integration/` (`npm test` rebuilds a throwaway `*_test` database from the real migrations). Add a test with every change to those paths.
- CI (`.github/workflows/ci.yml`) runs type-check + tests for the backend and type-check + build for the frontend.
- Authorization lives on the server: every route checks the role, and reads are scoped to the caller (teacher → own students, director → own school). The UI hiding a button is convenience, never the control.
