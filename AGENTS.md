# AGENTS.md — Referral Tracking Platform

## Product Manager (PM)
- Clarifies requirements about roles, dashboards, UZS commissions, and audit logs.
- Writes and updates `docs/specs/*.md` before coding begins.
- Ensures MVP stays simple: no over-engineering, just the flows we described.

## Backend Engineer
- Owns `backend/` codebase (Node.js + TypeScript + Drizzle + PostgreSQL).
- Designs DB schema and migrations.
- Implements REST APIs for:
  - Auth and roles (SuperAdmin, Manager, Admin, Director, Teacher).
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
