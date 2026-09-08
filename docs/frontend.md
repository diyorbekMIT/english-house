# Frontend — Referral Tracking Platform

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS (dark theme, brand color `#4f7cff`)
- TanStack React Query v5
- React Router v7
- Axios

## Routes

| Path | Role | Component |
|---|---|---|
| `/login` | Public | `Login` |
| `/superadmin/*` | SUPER_ADMIN | `SuperAdminDashboard` |
| `/manager/*` | MANAGER | `AdminDashboard` |
| `/admin/*` | ADMIN | `AdminDashboard` |
| `/director/*` | DIRECTOR | `DirectorDashboard` |
| `/teacher/*` | TEACHER | `TeacherDashboard` |

## Components

| Component | Purpose |
|---|---|
| `Layout` | Sidebar + main content wrapper |
| `Sidebar` | Role-based navigation |
| `StatusBadge` | Colored badge for call/study/commission status |

## Dashboard Features

### SuperAdmin (`/superadmin`)
- Overview: stat cards (leads, studying, pending commissions)
- Commission rules editor
- Audit log viewer

### Manager/Admin (`/manager`, `/admin`)
- Student table with call/study status filters
- Inline call-status dropdown (auto-saves)
- Monthly payment modal
- Audit log viewer

### Director (`/director`)
- Teacher list with per-teacher stats
- Student list (scoped to director's students)
- Commission history

### Teacher (`/teacher`)
- Own student list with stat cards
- Commission history

## Dev commands
```bash
cd frontend && npm run dev   # http://localhost:5173
```
