# DB Schema — Referral Tracking Platform

PostgreSQL 16+, Drizzle ORM for typing (`backend/db/schema.ts`). The schema is created by the
hand-written SQL files in `backend/db/migrations/` (see [Migrations](#migrations)); Drizzle is
not used to generate them. Money is integer UZS (`integer`, max ≈ 2.1 bn — payment amounts are
capped at 2 000 000 000). Percents are integer basis points (`1000` = 10.00 %).

## Enums

| Enum | Values |
|---|---|
| `call_status` | `WAITING`, `CALLED`, `REGISTERED`, `FIRST_LESSON`, `STARTED_STUDYING`, `MADE_PAYMENT`, `REJECTED` |
| `study_status` | `ACTIVE`, `NOACTIVE` |
| `commission_type` | `SIGNUP_BONUS` (a student's first-payment bonus), `MONTHLY_COMMISSION` (every later payment) |
| `commission_status` | `PENDING`, `READY_TO_PAY`, `PAID`, `CANCELLED` (its payment was voided) |
| `payout_type` | `INITIAL_BONUS`, `CREDIT`, `DEBIT` |
| `payout_status` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `withdraw_status` | `PENDING`, `VERIFIED`, `GIVEN`, `REJECTED` |

## Tables

`?` = nullable. Every table also has `id bigserial` and, unless noted, `created_at` / `updated_at`.

| Table | Columns and notes |
|---|---|
| `roles` | `name` unique: `SUPER_ADMIN`, `MANAGER`, `SALES_MANAGER`, `ADMIN`, `DIRECTOR`, `TEACHER` |
| `schools` | `name`, `school_number?`, `short_name?`, `address?`, `phone?`, `is_active`, `meta?` (jsonb) |
| `users` | `full_name`, `phone` **unique** (the login), `password_hash`, `role_id`→roles, `school_id?`→schools, `manager_id?` / `director_id?` (soft references, no FK), `is_active`, `email?`, `meta?`. Users are deactivated, never deleted. |
| `courses` | `name`, `price_uzs` (CEO-only in every API response), `is_active` |
| `students` | `full_name`, `phone` **unique** (normalised `+998…`), `secondary_phone?`, `school_id?`, `director_id?`, `teacher_id?`→users, `course_id?`→courses, `call_status` (default `WAITING`), `study_status` (default `NOACTIVE`), `call_note?`, `meta?` |
| `monthly_payments` | `student_id`, `amount_uzs`, `paid_for_month` (`YYYY-MM`), `paid_at`, `payment_method?`, `created_by_user_id`, `is_first_payment`, `notes?`, `meta?`, **`voided_at?`, `voided_by_user_id?`, `void_reason?`** (a voided payment stays on record). Partial unique index: one non-voided first payment per student. Several payments per month are allowed. |
| `commission_rules` | Insert-only history; the newest `is_active` row applies. `teacher_/director_signup_bonus_uzs` (registration payout), `teacher_/director_monthly_percent`, `teacher_/director_first_payment_percent` (bp), `special_price_uzs` (base the percents apply to; 0 = use the amount actually paid), `withdraw_limit_teacher_/director_uzs` (0 = withdrawals disabled), `valid_from?` (written, currently unused) |
| `commissions` | `user_id` (earner), `student_id`, `monthly_payment_id?`, `type`, `amount_uzs`, `status`, `paid_at?`. Unique per `(monthly_payment_id, user_id)`. |
| `payouts` | CEO-managed money movements: `maker_id?` (null = system), `receiver_id`, `amount_uzs`, `type`, `status`, `comments?`, `completed_at?`. The registration bonus is an auto-`COMPLETED` `INITIAL_BONUS`. |
| `withdraw_requests` | `user_id`, `amount_uzs`, `status`, `verified_by_user_id?` / `verified_at?` / `verify_comment?`, `given_by_user_id?` / `given_at?` / `give_comment?`, `rejected_by_user_id?` / `rejected_at?` / `reject_comment?`. Partial unique index: one `PENDING` request per user. |
| `audit_logs` | `actor_user_id?`, `action`, `entity_type`, `entity_id?`, `description`, `details?` (jsonb), `created_at`. **Append-only**: triggers reject UPDATE/DELETE/TRUNCATE. |
| `schema_migrations` | `filename` (pk), `applied_at` — written by the migration runner. |

## Money model in one paragraph

A student's **first** payment gives the teacher and the school's active director
`firstPaymentPercent × specialPrice` (`SIGNUP_BONUS`); every **later** payment while the student is
`ACTIVE` gives `monthlyPercent × specialPrice` (`MONTHLY_COMMISSION`). Earned commissions sit in
`PENDING`. A person's *pending* balance is `sum(commissions not PAID/CANCELLED) − VERIFIED/GIVEN
withdrawals`; once it reaches the CEO's limit they can request a withdrawal of the largest whole
multiple of the limit. Voiding a payment turns its commissions `CANCELLED`.

## Migrations

- Files: `backend/db/migrations/NNNN_name.sql`, applied in order by `npm run db:migrate`
  (`db/migrator.ts`), which records each in `schema_migrations`. Statements are split on
  `--> statement-breakpoint`; write them **idempotently** (`IF NOT EXISTS`, `DO $$ … EXCEPTION`).
- The Heroku release phase (`Procfile`) runs the runner before each release, so schema and code deploy together.
- A database that predates the runner must be adopted once: `npm run db:migrate -- --baseline <last-applied-prefix>`.
  The runner refuses to touch an untracked, non-empty database.
- A database built only from these files is identical (columns, indexes, constraints) to production — `0014` closed the last drift.
- Do **not** use `drizzle-kit generate`: it would emit a competing history.
