# DB Schema — Referral Tracking Platform

Database: PostgreSQL (Drizzle ORM)
All monetary fields are stored as integer UZS so'm amounts.

## Enums

| Enum | Values |
|---|---|
| `call_status` | `WAITING`, `ACCEPTED`, `REJECTED` |
| `study_status` | `STUDYING`, `STOPPED` |
| `commission_type` | `SIGNUP_BONUS`, `MONTHLY_COMMISSION` |
| `commission_status` | `PENDING`, `READY_TO_PAY`, `PAID` |

## Tables

### `roles`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| name | text UNIQUE | SUPER_ADMIN, MANAGER, ADMIN, DIRECTOR, TEACHER |

### `schools`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| school_number | text UNIQUE | Bizning maxsus kod (masalan, "S23") |
| name | text | To'liq nomi |
| short_name | text NULL | Qisqa nomi |
| address | text | Manzil |
| phone | text | Maktab telefon raqami |
| is_active | boolean | default: true |
| meta | jsonb NULL | Tuman, toifa va boshqalar |
| created_at, updated_at | timestamptz | |

### `users`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| full_name | text | F.I.SH |
| phone | text UNIQUE | **Asosiy login identifikatori** |
| password_hash | text | bcrypt |
| role_id | integer FK → roles.id | |
| school_id | integer FK → schools.id NULL | Direktor va o'qituvchilar uchun |
| manager_id | integer NULL | Adminlar uchun |
| director_id | integer NULL | O'qituvchilar uchun |
| is_active | boolean | default: true |
| email | text NULL | Ixtiyoriy |
| meta | jsonb NULL | Qo'shimcha ma'lumotlar |
| created_at, updated_at | timestamptz | |

### `students`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| full_name | text | O'quvchi F.I.SH |
| phone | text | Asosiy telefon raqam |
| secondary_phone | text NULL | Ota-ona yoki qo'shimcha raqam |
| school_id | integer FK → schools.id NULL | |
| director_id | integer FK → users.id NULL | |
| teacher_id | integer FK → users.id NULL | |
| call_status | call_status | default: WAITING |
| study_status | study_status | default: STUDYING |
| meta | jsonb NULL | sinf, qiziqqan kurs, ota-ona ismi |
| created_at, updated_at | timestamptz | |

### `monthly_payments`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| student_id | integer FK → students.id | |
| amount_uzs | integer | UZS (so'm) |
| paid_for_month | text | YYYY-MM formati |
| paid_at | timestamptz | default: now() |
| payment_method | text NULL | CASH, CARD, TRANSFER |
| created_by_user_id | integer FK → users.id | To'lovni kiritgan admin/foydalanuvchi |
| notes | text NULL | Izoh |
| meta | jsonb NULL | |
| created_at | timestamptz | |

### `commission_rules`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| teacher_signup_bonus_uzs | integer | O'qituvchi ro'yxat bonusi |
| director_signup_bonus_uzs | integer | Direktor ro'yxat bonusi |
| teacher_monthly_percent | integer | Basis points (1000 = 10%) |
| director_monthly_percent | integer | Basis points (500 = 5%) |
| is_active | boolean | default: true |
| valid_from | timestamptz NULL | Amal qilish muddati |
| created_at, updated_at | timestamptz | |

### `commissions`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| user_id | integer FK → users.id | O'qituvchi yoki direktor |
| student_id | integer FK → students.id | |
| monthly_payment_id | integer FK → monthly_payments.id NULL | |
| type | commission_type | SIGNUP_BONUS yoki MONTHLY_COMMISSION |
| amount_uzs | integer | UZS so'm |
| status | commission_status | PENDING, READY_TO_PAY, PAID |
| paid_at | timestamptz NULL | To'langan vaqt |
| created_at, updated_at | timestamptz | |

### `audit_logs`
| Ustun | Turi | Izoh |
|---|---|---|
| id | bigserial PK | |
| actor_user_id | integer FK → users.id NULL | |
| action | text | Harakat turi |
| entity_type | text | school, user, student, payment, commission |
| entity_id | integer NULL | Ob'ekt ID si |
| description | text | Inson tushunadigan tavsif |
| details | jsonb NULL | Tafsilotlar |
| created_at | timestamptz | default: now() |
