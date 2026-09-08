# Skill: Frontend Dashboards for Referral Platform

## Objective
Build React + Tailwind dashboards for each role to visualize and manage
the referral data.

## Rules of Engagement
- Use React + TypeScript + Vite in `frontend/`.
- Use React Query for data fetching.
- Use reusable table and form components.

## Instructions
1. Implement authentication UI:
   - Login page that sends credentials to `/auth/login` and stores JWT.

2. Implement role-based routing:
   - After login, redirect by role:
     - SuperAdmin -> `/superadmin`
     - Manager -> `/manager`
     - Admin -> `/admin`
     - Director -> `/director`
     - Teacher -> `/teacher`

3. For SuperAdmin:
   - Page to edit commission rules (signup bonuses, monthly percentages).
   - Overview cards: total leads, students studying, total commissions.

4. For Manager/Admins:
   - Student list with filters (call_status, study_status, director/teacher).
   - Forms to update call_status and add monthly payments.
   - View of audit logs related to students (latest N events).

5. For Directors:
   - List of Teachers in their school.
   - Per-teacher stats: number of leads, number of students studying, total monthly payments.

6. For Teachers:
   - List of their students.
   - Simple stats: studying vs stopped, total paid months per student.

7. Use Tailwind for layout and keep components small and focused.

8. Document frontend routes and components in `docs/frontend.md`.
