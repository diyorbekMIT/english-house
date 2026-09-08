# Project: Referral Tracking Platform
# Antigravity Rules — place this file at the repository root

## Tech Stack
- Backend: Node.js 20, TypeScript, Express/Fastify
- ORM: Drizzle ORM + PostgreSQL
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Data fetching: TanStack Query (React Query)

## Business Context
- Education center referral system in Tashkent.
- Roles:
  - SuperAdmin -> Manager -> Admin1, Admin2
  - SuperAdmin -> Director -> Teacher -> Student
- Currency: UZS (so'm), stored as integer amounts.
- Students pay physically at the center; platform only tracks leads, study status, and monthly payments.
- SuperAdmin configures all monetary amounts (signup bonuses, monthly commissions).

## Code Style
- Always use TypeScript; enable `strict` mode in `tsconfig.json`.
- Never use `any`; use `unknown` + proper narrowing.
- Use `const` arrow functions for React components and pure utilities.
- Prefer named exports over default exports for shared modules.
- Folder structure:
  - `backend/` for Node API.
  - `frontend/` for React app.
  - `db/` for Drizzle schema and migrations.

## Backend Rules
- Use Drizzle ORM for all DB access.
- Design a normalized schema for:
  - `roles`, `users`, `schools`, `students`, `monthly_payments`,
    `commission_rules`, `commissions`, `audit_logs`.
- Every mutating API must write to `audit_logs` with:
  - `actor_user_id`, `action`, `entity_type`, `entity_id`, `description`, `created_at`.
- Auth:
  - JWT-based auth.
  - Include `role` and hierarchy info in JWT claims (e.g. director, teacher).
- UZS amounts:
  - Always integers; no floats.
  - Commission amounts computed from `commission_rules` configured by SuperAdmin.

## Frontend Rules
- Build separate dashboards:
  - SuperAdmin: global overview, commission rule settings.
  - Manager/Admins: student list, call status updates, monthly payments.
  - Directors: teachers and their students.
  - Teachers: their own students, study status, monthly payments.
- Use Tailwind utility classes; avoid inline styles.
- Use React Query for server state (students, users, payments).
- Components:
  - Reusable table components for listing students, users, logs.
  - Forms for creating users and students.

## Commands (for humans & agents)
- Backend dev server: `cd backend && npm run dev`
- Frontend dev server: `cd frontend && npm run dev`
- Run migrations: `cd backend && npm run db:migrate`
- Run tests: `npm test` in each package.

- Always read `frontend/DESIGN.md` before generating or changing any UI.
- All colors, components, and layouts must follow this design system.