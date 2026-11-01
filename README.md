# Rokad Attendance & Time Platform - Backend

The complete, production-quality backend for the **Rokad Attendance & Time Platform**: an internal system for a studio where team members declare daily attendance, log timed work (25-minute focus timer) against assigned projects, and administrators review attendance and analyze logged time.

---

## Tech Stack & Architecture

- **Runtime**: Node.js `>= 22.13.0` (ESM, Native type stripping via `--experimental-strip-types`)
- **Framework**: Express 5
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg` driver adapter)
- **Cache & Distributed Locking**: Redis 7 (`node-redis` v4)
- **Security & Utilities**: `helmet`, `cors`, `jsonwebtoken`, `express-validator`, `vanta-api`, `node-cron`
- **Documentation & Testing UI**: OpenAPI 3.0.3 with `swagger-ui-express` (Interactive UI at `/api-docs`)
- **Testing**: Built-in `node:test` and `node:assert` (zero external test dependencies)

---

## Interactive Swagger & API Documentation

The platform comes with a complete, production-ready **OpenAPI 3.0.3** specification and interactive **Swagger UI**:

- **Interactive Swagger UI**: `http://localhost:5000/api-docs` (or `/docs`)
- **Raw OpenAPI JSON Spec**: `http://localhost:5000/api-docs.json` (or locally at [docs/swagger.json](docs/swagger.json))
- **Static API Documentation**: [docs/API.md](docs/API.md)

### Using Swagger UI Authentication:
1. Call `POST /api/auth/login` in the **Auth** section with code `super_admin_2026`.
2. Copy the resulting `data.token`.
3. Click the green **Authorize** button at the top right of the Swagger UI and paste your JWT token.
4. All protected endpoints (`/api/users`, `/api/projects`, `/api/attendance`, `/api/work-sessions`) are now unlocked and ready to test!

---

## Directory Structure

```text
./
├─ prisma/
│  ├─ schema.prisma             # Strict Prisma schema with DB check constraint
│  ├─ migrations/               # Applied migration SQL files
│  └─ seed.js                   # Idempotent super admin seed script
├─ config/
│  ├─ env.js                    # Fail-fast environment validation
│  ├─ prisma.js                 # Prisma Client with PrismaPg adapter
│  └─ redis.js                  # Redis client with fail-open SCAN deletion
├─ Middlewares/
│  ├─ isLogin.js                # JWT verification + Redis auth cache + DB fallback
│  ├─ allowedRoles.js           # Role-based access control (RBAC)
│  └─ rateLimit.js              # Redis login & work-session rate limiting (fail-open)
├─ Modules/
│  ├─ Auth/                     # Login, profile (/api/auth)
│  ├─ Users/                    # CRUD, minimal search (/api/users)
│  ├─ Project/                  # Project CRUD, member sync, mine cache (/api/projects)
│  ├─ Attendance/               # State machine, admin review, rejection cascade (/api/attendance)
│  └─ WorkSession/              # Lock-protected logging, list, summary (/api/work-sessions)
├─ Jobs/
│  ├─ dailyClose.js             # Pure, idempotent daily close (absence fill & auto-approve)
│  └─ index.js                  # node-cron scheduler with Redis lock & boot catch-up
├─ Utils/
│  ├─ date.js                   # Pure Intl timezone-aware calendar date calculations
│  ├─ pagination.js             # Standardized pagination parser and metadata formatter
│  ├─ cache.js                  # Safe fail-open Redis helpers
│  └─ prismaErrors.js           # Centralized Prisma error mapper (P2002, P2025, P2003)
├─ tests/
│  ├─ date.test.js              # Timezone boundary and calendar arithmetic tests
│  ├─ dailyClose.test.js        # Absence fill, auto-approve window, and idempotency tests
│  ├─ attendanceState.test.js   # State machine guards and rejection cascade tests
│  └─ workSessionRules.test.js  # Timer duration limits, row-lock, and CHECK constraints
├─ docs/
│  ├─ API.md                    # Complete endpoint contract for frontend integration
│  ├─ swagger.js                # Modular OpenAPI 3.0.3 specification & UI styling
│  └─ swagger.json              # Full static OpenAPI 3.0.3 specification file
├─ scripts/
│  ├─ smoke.js                  # End-to-end multi-role lifecycle smoke runner
│  └─ smoke.sh                  # Bash smoke script
├─ app.js                       # Express app configuration & middleware pipeline
├─ server.js                    # Server startup, cron registration, and graceful shutdown
├─ docker-compose.yml           # PostgreSQL 16 & Redis 7 configuration
├─ Dockerfile                   # Production container definition
└─ README.md
```

---

## Prerequisites

1. **Node.js**: Version `>= 22.13.0` installed.
2. **Docker & Docker Compose**: Installed and running.

---

## Quick Start & Setup

### 1. Clone & Enter Directory
```bash
cd Project
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d
```
*Note: Postgres is exposed on host port `54320` and Redis on port `6379`.*

### 4. Install Dependencies
```bash
npm install
```

### 5. Apply Database Migrations
```bash
npx prisma migrate deploy
```

### 6. Run Idempotent Seed
```bash
npm run db:seed
```
This creates or updates the initial `SUPER_ADMIN` user based on `SEED_SUPERADMIN_CODE` and `SEED_SUPERADMIN_NAME` in `.env`. Running it multiple times is safe and never creates duplicates.

### 7. Run Server
- Development:
  ```bash
  npm run dev
  ```
- Production:
  ```bash
  npm start
  ```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm start` | `node --experimental-strip-types server.js` | Starts server with native type stripping |
| `npm run dev` | `nodemon --watch . --ext js,json server.js` | Starts dev server with auto-restart |
| `npm test` | `node --experimental-strip-types --test tests/**/*.test.js` | Executes the full test suite |
| `npm run db:deploy`| `npx prisma migrate deploy` | Applies pending database migrations |
| `npm run db:seed` | `node --experimental-strip-types prisma/seed.js` | Executes the idempotent database seed |
| `npm run smoke` | `node --experimental-strip-types scripts/smoke.js` | Runs end-to-end integration smoke test |

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port for the Express application |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `APP_TIMEZONE` | `Asia/Tehran` | Timezone governing calendar dates and midnight calculations |
| `DATABASE_URL` | `postgresql://rokad_user:rokad_password@localhost:54320/rokad_attendance_db` | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JWT_SECRET` | Required (>= 32 chars in production) | Secret key for JWT signing and verification |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `SESSION_MAX_SECONDS` | `1500` | Maximum duration allowed for a single focus session (25 min = 1500s) |
| `MIDNIGHT_GRACE_MINUTES` | `30` | Minutes after 00:00 allowed to log work against yesterday's attendance |
| `ATTENDANCE_CATCHUP_DAYS` | `7` | Past calendar day window scanned by the daily close job to fill absences |
| `SEED_SUPERADMIN_CODE` | `super_admin_2026` | Initial credential code for the Super Admin |
| `SEED_SUPERADMIN_NAME` | `Studio Super Admin` | Initial display name for the Super Admin |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins (comma-separated or `*`) |
| `TRUST_PROXY` | `false` | Enable Express proxy trust when behind a reverse proxy |

---

## Architectural & Design Decisions

### 1. Postgres Port Mapping (`54320:5432`)
On Windows environments hosting Hyper-V / WSL2, dynamic port exclusion ranges frequently reserve ports `5355–5554` (preventing local binding on port 5432). To guarantee smooth out-of-the-box local execution, PostgreSQL is exposed on host port `54320` while preserving container-internal port `5432`.

### 2. Timezone Normalization with UTC Midnight Dates
To guarantee complete determinism across servers, databases, and client machines, attendance `date` fields (`@db.Date`) are parsed and constructed as UTC midnight `Date` objects (`Date.UTC(year, monthIndex, day, 0, 0, 0)`). This prevents accidental one-day timezone shifts when converting between PostgreSQL `DATE` types and JavaScript `Date` instances.

### 3. Non-Blocking Redis Pattern Deletion via `SCAN`
The style reference previously used the blocking `KEYS` command. To prevent latency spikes in production Redis instances, `deleteKeysByPattern` implements asynchronous cursor iteration with `SCAN` and batch `DEL`.

### 4. Fail-Open Cache & Rate Limiting Strategy
Redis is employed strictly for caching (user project lists, authentication lookups) and rate limiting. All Redis helper functions catch errors safely so that a Redis outage degrades response performance but never causes application crashes or 500 errors.

### 5. Concurrency Race Protection via Pessimistic Row Locking
To eliminate the race condition where an admin rejects an attendance record while a user simultaneously logs a work session, `logWorkSession` runs within a Prisma transaction that acquires a row-level lock (`SELECT ... FOR UPDATE` via raw SQL) on the Attendance record before inserting the session. If the record is rejected, the transaction fails immediately, preventing orphan sessions.

### 6. User Code Credential Privacy
As per the product owner's explicit requirements, user `code` is a plain-text login credential. To safeguard this credential, `code` is never returned in authentication responses, minimal user search queries, work session summaries, error messages, or application logs. Only authorized Super Admin user management endpoints (`GET /api/users`, `GET /api/users/:id`, `POST /api/users`) can access user codes.

### 7. Zero N+1 Queries on Review Lists & Summaries
Both `GET /api/attendance/admin` and `GET /api/work-sessions/summary` execute single grouped queries (`groupBy` / `aggregate`) at the database level rather than iterating in application memory, providing $O(1)$ query overhead regardless of page size.
