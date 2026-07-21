# SIWES Supervisor Allocation System — PRD

## Original problem statement
Design and Implementation of a Web-Based SIWES Supervisor Allocation System with
GPS Visit Verification and Digital Logbook. Final-year Computer Science project
scope: Student registration, supervisor allocation (auto + manual), GPS-based
visit verification (100–150 m radius), digital logbook, reports, dashboards.

## Personas
- **Student** — Registers company, submits daily logbook, views assigned supervisor & visits.
- **Supervisor** — Views assigned students, schedules physical visits, verifies GPS location, approves/rejects logbook entries.
- **Coordinator** — Approves companies, allocates supervisors, manages departments/faculties, views reports.
- **Admin** — Full system oversight, user management, analytics.

## Core requirements (static)
1. JWT-based multi-role authentication (httpOnly cookies).
2. Company registration with lat/lng + coordinator approval.
3. Digital logbook (create, edit-while-pending, approve, reject, comment, image URL).
4. Automatic supervisor allocation (workload-balanced, department-aware) + manual override.
5. GPS visit verification within configurable radius (default 150 m, Haversine formula).
6. Role-scoped dashboards with logbook activity chart (Recharts).
7. Notifications on: company approval, supervisor assignment, logbook review, visit verification.
8. CSV report export for coordinators.

## Implemented (v1.0 — 2026-02)
- Backend `/api` router with all endpoints (auth, users, departments, sessions, companies, logbooks, visits, GPS logs, allocations, notifications, dashboard, reports).
- Frontend: Landing page (bento hero), Login (with demo buttons), Register, role-based sidebar dashboard.
- Interactive Leaflet map: pick company coordinates, "use my location", verify supervisor GPS.
- Light/Dark theme toggle with localStorage persistence.
- Seeded demo users, department list, allocation, approved company.
- 22/22 backend pytest suite passing; frontend E2E validated across 4 roles.

## Prioritized backlog
### P0 — production hardening
- Explicit CORS allow-list + rate limiting on `/api/auth/login`.
- Password reset via email (Resend integration).

### P1 — features
- File/image uploads via object storage (currently image URL only).
- PDF report export (in addition to CSV).
- Email notifications (Resend).
- QR code for student verification.

### P2 — nice-to-have
- Real-time WebSocket notifications.
- Attendance tracker (day check-in/out).
- Supervisor rating/assessment form UI (backend field exists).
- Faculty CRUD (backend uses free-form string for now).

## Test credentials
See `/app/memory/test_credentials.md`.
