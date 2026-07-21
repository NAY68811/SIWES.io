# SIWES Supervisor Allocation System

A modern web platform that automates the entire SIWES workflow — from company
registration and supervisor allocation to GPS-verified visits and daily digital
logbooks.

## Stack
- **Backend** — FastAPI, MongoDB (Motor), PyJWT, bcrypt
- **Frontend** — React 19, TailwindCSS, shadcn/ui, sonner, recharts, react-leaflet
- **Auth** — JWT in httpOnly cookies (SameSite=None, Secure)

## Demo credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@siwes.edu | Admin@1234 |
| Coordinator | coordinator@siwes.edu | Password@123 |
| Supervisor | supervisor@siwes.edu | Password@123 |
| Student | student@siwes.edu | Password@123 |

## Local development (VS Code)

### Backend
```bash
cd backend
pip install -r requirements.txt
# create .env from the template (see backend/.env)
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

Set `REACT_APP_BACKEND_URL` in `frontend/.env` to your backend URL.

## Backend env vars
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — Mongo database name
- `JWT_SECRET` — 64-char hex secret
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — seeded admin credentials
- `GPS_RADIUS_METERS` — verification radius (default 150)

## Key endpoints
- `POST /api/auth/{login,register,logout}` · `GET /api/auth/me`
- `GET/POST /api/companies` · `PATCH /api/companies/{id}/status`
- `GET/POST/PUT /api/logbooks` · `PATCH /api/logbooks/{id}/review`
- `POST /api/visits/schedule` · `POST /api/visits/{id}/verify`
- `POST /api/allocations/{auto,manual}` · `GET /api/allocations`
- `GET /api/dashboard/{stats,chart}` · `GET /api/reports/summary`

## GPS verification
When the supervisor clicks **Start visit & verify**, the browser requests
`navigator.geolocation`. The server computes the Haversine distance between the
supervisor's coordinates and the student's approved company coordinates. If it
is within `GPS_RADIUS_METERS`, the visit is stamped **verified**.
