# SPARK Project Documentation

Generated on: 2026-03-27

## 1. Executive Summary

SPARK (Scalable Production-Grade Analytics for Academic Records and Knowledge) is an education analytics platform that combines:

- A FastAPI backend for authentication, analytics, and role-based dashboards.
- A React frontend (Vite) for student, staff, and admin workflows.
- A PostgreSQL data layer managed through SQLAlchemy async sessions and Alembic migrations.
- A data-ingestion pipeline that scrapes and normalizes academic records.

The system is optimized for academic insight generation, including student risk analysis, placement readiness indicators, and operational dashboards for administrators and faculty.

## 2. Repository Layout

```text
.
|-- backend/                 FastAPI app, models, services, scripts, tests
|-- frontend/                React app (Vite), pages, components, stores
|-- pipeline/                Data extraction/scraping scripts and input assets
|-- data/                    JSON academic snapshots per student
|-- docker-compose.yml       Local multi-service stack
|-- README.md                High-level overview
|-- requirements.txt         Top-level Python dependencies
|-- script.py                Compatibility launcher for pipeline script
|-- docs/                    Project documentation artifacts
```

## 3. System Architecture

### 3.1 Runtime Components

1. Frontend SPA
- React 19 application served by Vite in development.
- Uses React Router, Zustand, and TanStack Query.
- Supports service worker registration for PWA behavior.

2. Backend API
- FastAPI app with versioned routes under /api/v1.
- JWT-based authentication with refresh-token rotation.
- SlowAPI middleware for endpoint rate limiting.
- Optional Sentry integration for tracing and error monitoring.

3. Database
- PostgreSQL with SQLAlchemy async engine and connection pooling.
- Alembic migration support present in backend/alembic.

4. Data Pipeline
- Python scraper in pipeline/script.py acquires student and attendance datasets.
- Outputs data files and can sync records to backend endpoints.

### 3.2 Request Flow (Typical)

1. User logs in from frontend.
2. Backend validates credentials and returns access + refresh tokens.
3. Frontend stores tokens in persisted Zustand store.
4. API client attaches access token to subsequent requests.
5. On access-token expiry, frontend attempts refresh token exchange and retries original request.

## 4. Technology Stack

### 4.1 Backend

- Python 3.11+ (container), FastAPI, Uvicorn
- SQLAlchemy async, asyncpg, psycopg2-binary
- Pydantic + pydantic-settings
- Security: python-jose, passlib, JWT refresh rotation
- Rate limiting: slowapi
- Migrations: Alembic
- Monitoring: sentry-sdk

### 4.2 Frontend

- React 19 + React DOM 19
- Vite 7
- Routing: react-router-dom
- State: zustand
- Data fetching: @tanstack/react-query
- Charts: recharts
- Telemetry: @sentry/react
- Styling toolchain: tailwindcss, postcss, autoprefixer

### 4.3 Data and Utility

- reportlab (PDF generation capability)
- openpyxl (Excel export support)
- requests + beautifulsoup4 style scraping pattern in pipeline script

## 5. Backend Design

### 5.1 Application Entry

The backend entrypoint is app.main:

- Configures FastAPI metadata and operation-id generation.
- Initializes Sentry when SENTRY_DSN is present.
- Registers SlowAPI + CORS middleware.
- Includes auth, student, admin, and staff routers.
- Exposes health endpoint and legacy redirect compatibility routes.

### 5.2 Configuration Model

Settings are loaded from environment variables (and .env file) via pydantic-settings:

- DATABASE_URL
- SECRET_KEY
- ALGORITHM
- ACCESS_TOKEN_EXPIRE_MINUTES
- REFRESH_TOKEN_EXPIRE_DAYS
- DB_POOL_SIZE
- DB_MAX_OVERFLOW
- CORS_ORIGINS
- SENTRY_DSN
- SENTRY_ENV

DATABASE_URL is normalized to use postgresql+asyncpg when needed.

### 5.3 Security Model

- Access token: short-lived JWT (minutes).
- Refresh token: long-lived JWT (days) with JTI storage/revocation.
- Token rotation implemented on refresh.
- Logout revokes refresh token.
- Role checks enforce admin/staff route access.

### 5.4 API Surface

Current OpenAPI snapshot (backend/v3_openapi.json) reports 22 endpoints.

Main route groups:

- Authentication
  - POST /api/v1/auth/login
  - POST /api/v1/auth/refresh
  - POST /api/v1/auth/logout
  - GET /api/v1/auth/me
  - POST /api/v1/auth/me/password

- Students
  - GET /api/v1/students/performance/{roll_no}
  - GET /api/v1/students/analytics/{roll_no}
  - GET /api/v1/students/command-center/{roll_no}
  - GET /api/v1/students/attendance/{roll_no}
  - GET /api/v1/students/timetable

- Admin (selected)
  - GET /api/v1/admin/overview
  - GET /api/v1/admin/command-center
  - GET /api/v1/admin/student-360/{roll_no}
  - GET /api/v1/admin/bottlenecks
  - GET /api/v1/admin/subject-catalog
  - GET /api/v1/admin/impact-matrix
  - GET /api/v1/admin/placement-readiness
  - GET /api/v1/admin/risk/registry
  - GET /api/v1/admin/students
  - GET /api/v1/admin/students/paginated
  - GET /api/v1/admin/spotlight-search
  - GET /api/v1/admin/student-record/{roll_no}
  - POST /api/v1/admin/assign-sections

- Staff (from code)
  - GET /api/v1/staff/schedule
  - GET /api/v1/staff/me
  - GET /api/v1/staff/subjects/{subject_id}/students
  - PATCH /api/v1/staff/marks
  - POST /api/v1/staff/attendance

Note: backend/v3_openapi.json contains /api paths from an earlier snapshot. Runtime routing in app.main mounts routers under /api/v1.

## 6. Frontend Design

### 6.1 Routing and Access Control

Routes are defined in App.jsx:

- /login
- /dashboard (student)
- /admin
- /staff

ProtectedRoute enforces role-specific access.

### 6.2 API Client Behavior

Axios client:

- Uses VITE_API_URL when provided.
- Falls back to a hosted backend URL.
- Adds Authorization: Bearer token header from Zustand store.
- Automatically attempts token refresh on 401 responses.

### 6.3 State and UX

- Persistent auth state via zustand/persist.
- Theme state via theme store.
- Query caching via TanStack Query.
- Service worker registration for production/offline support.

## 7. Data Pipeline

The pipeline script performs:

- CSV-based student seed loading.
- Parent portal scraping and parsing.
- Attendance and profile extraction.
- JSON export into data/.
- Optional backend synchronization using BACKEND_URL and BACKEND_TOKEN.

Input assets include:

- pipeline/2025-2027.csv
- pipeline/subject_credits.json

## 8. Local Development

### 8.1 Prerequisites

- Python virtual environment (already present as .venv)
- Node.js 20+
- PostgreSQL (local) or containerized PostgreSQL

### 8.2 Backend (Direct Run)

1. Copy backend/.env.example to backend/.env and configure values.
2. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run API from backend folder:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 8.3 Frontend

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start development server:

```bash
npm run dev
```

### 8.4 Docker Compose

At repository root:

```bash
docker-compose up --build
```

Default mapped ports:

- Frontend: 80
- Backend: 8000
- PostgreSQL: 5432

## 9. Testing and Quality

### 9.1 Backend Tests

- Pytest configuration in backend/pytest.ini
- Test suites under backend/tests and standalone test_*.py scripts

Run from backend folder:

```bash
pytest -q
```

### 9.2 Frontend Tests

Run from frontend folder:

```bash
npm run test:run
```

Playwright config exists for end-to-end style workflows.

## 10. Operations and Deployment

### 10.1 Containers

- backend/Dockerfile: Python slim image, non-root runtime user, uvicorn launch.
- frontend/Dockerfile: Node build stage + Nginx serving dist output.

### 10.2 Environment and Secrets

Manage these securely in deployment environments:

- DATABASE_URL
- SECRET_KEY
- CORS_ORIGINS
- SENTRY_DSN
- BACKEND_TOKEN (pipeline sync mode)

### 10.3 Monitoring

- Backend Sentry integration is conditional on SENTRY_DSN.
- Frontend Sentry initialized via VITE_SENTRY_DSN.

## 11. Utility Scripts and Maintenance

Root and backend include operational scripts for:

- data checks and reconciliation
- schema validation
- migration fixes
- seeding and staff assignment
- snapshot import/restore/reset flows

Examples include:

- backend/seed_db.py
- backend/restore_database.py
- backend/verify_db_schema.py
- backend/check_*.py helpers

## 12. Known Documentation Notes

1. Route Prefix Evolution
- Runtime backend uses /api/v1 prefixes.
- OpenAPI snapshot file currently includes /api prefixes in parts.

2. Configuration Coupling
- DATABASE_URL is mandatory at startup; application fails fast when absent.

3. Frontend Fallback URL
- API client has a hardcoded hosted fallback base URL when VITE_API_URL is missing.

## 13. Recommended Next Improvements

1. Regenerate and version OpenAPI directly from running app with /api/v1 canonical paths.
2. Add architecture diagrams as committed assets (PNG/SVG) in docs/.
3. Add a docs CI job that validates endpoint list and environment variable documentation.
4. Add backend/frontend Makefile tasks for repeatable local workflows.
