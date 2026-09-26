# API Reference — Referral Tracking Platform

Base URL (dev): `http://localhost:3001` · JSON in/out · all amounts are integer UZS.
Roles: `SUPER_ADMIN` (CEO), `MANAGER`, `SALES_MANAGER`, `ADMIN`, `DIRECTOR`, `TEACHER`.

## Conventions

- **Auth**: `Authorization: Bearer <token>` on everything except `POST /auth/login` and `GET /health`.
- **Sessions are re-checked on every request.** The token only proves identity (`userId`, 12 h lifetime, HS256). Role, school and active flag are read from the database each time, so deactivating a user or changing their role takes effect on the next call (`401 Account disabled or removed`).
- **Errors**: `{ "error": "..." }` (or a zod `flatten()` object on validation errors). `400` validation (including malformed ids and unknown filter values — e.g. `GET /students/abc`, `?status=bogus`), `401` no/invalid session, `403` wrong role, `404` not found *or out of scope*, `409` conflict, `413` body over 100 kB, `429` too many failed logins.
- **Out-of-scope reads answer `404`**, not `403`, so ids can't be probed (a teacher asking for another teacher's student, a director for another school's user, anyone but the CEO for the CEO).
- **Percents** are stored and sent as integer basis points (`1000` = 10.00 %).
- **Audit**: every mutation writes an `audit_logs` row (in the same transaction for money changes). The table is append-only at the database level.

---

## Auth

### `POST /auth/login`
Body `{ "phone", "password" }` → `{ token, role, userId, fullName, schoolId }`.
Only failed attempts are rate limited: 8 per phone+address and 40 per address per 15 min (`429`). Wrong-phone and wrong-password answers look identical. Audit: `LOGIN_SUCCESS` / `LOGIN_FAILED`.

## Users

| Endpoint | Roles | Notes |
|---|---|---|
| `POST /users/manager` | CEO | |
| `POST /users/sales-manager`, `POST /users/admin` | CEO, MANAGER | |
| `POST /users/director` | CEO | body needs `schoolId`; grants the registration bonus |
| `POST /users/teacher` | CEO, DIRECTOR | a director always creates in **their own school** (body `schoolId` ignored; `403` if they have none); grants the registration bonus |
| `GET /users?role=&schoolId=` | CEO, MANAGER, SALES_MANAGER, ADMIN, DIRECTOR | directors see only their school; the CEO account is hidden from everyone else |
| `GET /users/:id` | same | directors: own school only; CEO account only visible to the CEO |
| `PATCH /users/me/password` | any | `{ currentPassword, newPassword }` (min 8 chars) |
| `PATCH /users/:id` | CEO | `{ fullName?, phone?, email?, schoolId? }` |
| `PATCH /users/:id/password` | CEO | `{ newPassword }` — reset a forgotten password |
| `PATCH /users/:id/reactivate` | CEO | |
| `DELETE /users/:id` | CEO | *deactivates* (never deletes); cannot deactivate yourself or the last active CEO |

## Schools & courses

- `GET /schools`, `GET /schools/:id` (any role); `POST /schools`, `PATCH /schools/:id` (CEO).
- `GET /courses`, `GET /courses/:id`: the **CEO** gets `{ id, name, priceUzs, isActive }`; every other role gets `{ id, name, isActive }` — the price is stripped server-side. `POST /courses`, `PATCH /courses/:id` (CEO).

## Students

### `POST /students`
Roles: TEACHER, SALES_MANAGER, DIRECTOR, MANAGER, CEO. Body `{ fullName, phone, secondaryPhone?, schoolId?, teacherId?, directorId?, courseId?, callNote?, meta? }`.
Attribution decides who earns commissions, so it comes from the caller: a **teacher** is always the teacher and their school; a **director** is always the director of their own school and may only assign teachers of that school (`403` otherwise); staff roles may set them freely (teacher must exist and be an active TEACHER). `courseId` must be an active course.
Duplicate phone → `409`. Staff and the owning teacher/director get the existing student's details; anyone else gets a generic message.

### Reads
- `GET /students` — TEACHER: own students · DIRECTOR: own school (empty list if they have none) · SALES_MANAGER: only students *without* a first payment · others: all. Filters: `callStatus`, `studyStatus`, `schoolId`, `teacherId`, `hasFirstPayment`.
- `GET /students/:id` — TEACHER own / DIRECTOR own school, otherwise `404`.

### Updates
- `PATCH /students/:id` (CEO) — `{ fullName?, phone?, secondaryPhone?, schoolId?, teacherId?, courseId? }`; re-attribution is CEO-only because it changes who earns future commissions. Audit: `STUDENT_UPDATE` (with before/after).
- `PATCH /students/:id/call-status` (SALES_MANAGER, CEO) — `MADE_PAYMENT` is only accepted once the student has a recorded, non-voided payment (`409` otherwise): recording the first payment sets it automatically, and that payment is what creates the teacher/director bonus. `MADE_PAYMENT` also activates the student.
- `PATCH /students/:id/study-status` (ADMIN, SALES_MANAGER, CEO) — `ACTIVE` / `NOACTIVE`.

Call statuses: `WAITING → CALLED → REGISTERED → FIRST_LESSON → STARTED_STUDYING → MADE_PAYMENT`, or `REJECTED`. Study statuses: `ACTIVE`, `NOACTIVE`.

## Payments

### `POST /students/:studentId/monthly-payments`
Roles: SALES_MANAGER, ADMIN, MANAGER, CEO (**not** DIRECTOR). Body `{ amountUzs (≤ 2 000 000 000), paidForMonth "YYYY-MM", paymentMethod? CASH|CARD|TRANSFER, notes? (≤ 500) }`.
- One database transaction with the student row locked: concurrent submits for one student queue up, so exactly one payment is "first".
- ADMIN cannot take the *first* payment (`403`).
- A payment above the CEO-set special price is rejected (`400`, the message states the cap). Skipped while the special price is 0.
- **First payment**: student becomes `ACTIVE` / `MADE_PAYMENT`; teacher and director each earn `firstPaymentPercent × specialPrice` (type `SIGNUP_BONUS`).
- **Every later payment** while the student is `ACTIVE`: `monthlyPercent × specialPrice` (type `MONTHLY_COMMISSION`). A `NOACTIVE` student's payments earn nothing.
- If no special price is configured the actual amount paid is the base. Several payments in one month are allowed; each earns its own bonus.
- Audit: `MONTHLY_PAYMENT_CREATE` (+ `STUDENT_STUDY_STATUS_UPDATE` on the first).

### `PATCH /students/:studentId/monthly-payments/:paymentId/void` (CEO)
Body `{ reason }` (required). The payment stays on record (`voidedAt`, `voidReason`) but stops counting as revenue / first payment, and its `PENDING`/`READY_TO_PAY` commissions become `CANCELLED`.
`409` if already voided, if any of its commissions was already `PAID`, or if it is the first payment while later non-voided payments exist (void those first). Voiding the first payment returns the student to `NOACTIVE` / `STARTED_STUDYING`. Audit: `MONTHLY_PAYMENT_VOID`.

### `GET /students/:studentId/monthly-payments`
Roles: SALES_MANAGER, ADMIN, MANAGER, CEO. Includes voided rows (flagged).

### `GET /first-payments`
Roles: SALES_MANAGER, MANAGER, CEO. Non-voided first payments; filters `schoolId`, `teacherId`.

## Commissions & rules

- `GET /commissions` — TEACHER/DIRECTOR: own; MANAGER, SALES_MANAGER, CEO: all (`?userId=`, `?status=`). Statuses: `PENDING`, `READY_TO_PAY`, `PAID`, `CANCELLED`. Each row also carries `studentName` and `paidForMonth` of the payment that earned it (never the amount the student paid).
- `PATCH /commissions/:id/mark-paid` — **CEO only**, and only from `PENDING`/`READY_TO_PAY`. (Payouts to people go through the withdraw flow below.)
- `PATCH /commissions/:id/status` — CEO; cannot touch `CANCELLED` rows.
- `GET /commission-rules` — **CEO only** (percents, bonuses, special price and withdraw limits are confidential).
- `PUT /commission-rules` — CEO. Inserts a new active row (history is immutable). Body: `teacherSignupBonusUzs, directorSignupBonusUzs, teacherMonthlyPercent, directorMonthlyPercent, teacherFirstPaymentPercent, directorFirstPaymentPercent` (bp), `specialPriceUzs, withdrawLimitTeacherUzs, withdrawLimitDirectorUzs` (0 = unset/disabled).

## Balances & payouts

Balance rule (`lib/balance.ts`): `CANCELLED` commissions count for nothing; withdrawals that are `VERIFIED`/`GIVEN` are removed from *pending*; `balance = paid + net completed payouts` (the Bonus Card figure). Pending rewards (`commissionPendingUzs`, "Kutilayotgan mukofot") are reported separately and never added to the balance.

- `GET /payouts/balance/:userId` (CEO, or the user themselves) → `{ commissionTotalUzs, commissionPaidUzs, commissionPendingUzs, payoutsNetUzs, balanceUzs }`; `GET /payouts/balances?role=` (CEO).
- `POST /payouts`, `PATCH /payouts/:id/complete|cancel` (CEO) — manual credits/debits; `GET /payouts` (CEO all; DIRECTOR/TEACHER own). The one-time registration bonus is an auto-completed `INITIAL_BONUS` payout.

## Withdrawals

A director/teacher whose pending balance reaches the CEO-set limit (or a multiple of it) can request that multiple.

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /withdrawals/eligibility` | TEACHER, DIRECTOR | `{ pendingUzs, limitUzs, availableUzs, withdrawableUzs, neededUzs }` |
| `POST /withdrawals` | TEACHER, DIRECTOR | amount is computed server-side; one `PENDING` request per user (`409`); serialized per user |
| `GET /withdrawals` | CEO (all) / own | includes `verifyComment`, `giveComment`, `rejectComment` |
| `PATCH /withdrawals/:id/verify` | CEO | `PENDING → VERIFIED`, optional `{ comment }`; amount leaves the balance now |
| `PATCH /withdrawals/:id/give` | CEO | `VERIFIED → GIVEN` (cash handed over), optional `{ comment }` |
| `PATCH /withdrawals/:id/reject` | CEO | `PENDING → REJECTED`, `{ comment }` **required**; amount becomes withdrawable again |

## Analytics & audit

- `GET /analytics/ceo-summary?startDate&endDate` (CEO), `GET /analytics/director-summary` (DIRECTOR), `GET /analytics/teacher-summary` (TEACHER).
- `GET /audit-logs?limit=&entityType=&entityId=` — **CEO only**.

## Health

`GET /health` → `{ "status": "ok" }`.
