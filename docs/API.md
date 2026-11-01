# Rokad Attendance & Time Platform - API Documentation

Base URL: `/api` (or `/` for `/health`)

All authenticated endpoints require an `Authorization` header:
```http
Authorization: Bearer <jwt_token>
```

Standard Response Envelopes:
- **Success**: `{ "success": true, "message": "...", "data": ..., "meta": ... }`
- **Error**: `{ "success": false, "message": "...", "errors": [...] }`

---

## 1. System Health

### `GET /health`
- **Access**: Public
- **Description**: Verifies database connection (`SELECT 1`) and Redis availability (`PING`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "System is healthy",
  "data": {
    "database": "connected",
    "redis": "connected"
  }
}
```
- **Response `503 Service Unavailable`** (if degraded):
```json
{
  "success": false,
  "message": "System is degraded or unhealthy",
  "data": {
    "database": "disconnected",
    "redis": "disconnected"
  }
}
```

---

## 2. Authentication (`/api/auth`)

### `POST /api/auth/login`
- **Access**: Public (Rate limited: 10 failed attempts / 15 min per IP)
- **Description**: Authenticate with a plain text user code credential.
- **Request Body**:
```json
{
  "code": "super_admin_2026"
}
```
- **Validation**:
  - `code`: required, string, trimmed, 6–64 chars, regex `[A-Za-z0-9_-]`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 1,
      "name": "Studio Super Admin",
      "role": "SUPER_ADMIN"
    }
  }
}
```
*(Note: `code` is NEVER returned to normal users or in error messages).*
- **Error Responses**:
  - `401 Unauthorized`: `{ "success": false, "message": "Invalid credentials" }` (identical message for unknown code or inactive user).
  - `429 Too Many Requests`: `{ "success": false, "message": "Too many failed login attempts. Please try again in 15 minutes." }`

### `GET /api/auth/me`
- **Access**: `USER`, `ADMIN`, `SUPER_ADMIN`
- **Description**: Retrieve current user profile from token context.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "User profile fetched successfully",
  "data": {
    "id": 1,
    "name": "Studio Super Admin",
    "role": "SUPER_ADMIN"
  }
}
```

---

## 3. Users Management (`/api/users`)

### `GET /api/users/search`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Fast search for active users to populate project member selection dropdowns.
- **Query Params**:
  - `q`: string (optional, partial match on name)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Users searched successfully",
  "data": [
    {
      "id": 2,
      "name": "Ali Rezaei",
      "role": "USER"
    }
  ]
}
```
*(Note: credential `code` is NEVER included in search responses).*

### `GET /api/users`
- **Access**: `SUPER_ADMIN`
- **Description**: Paginated list of users with search and filtering.
- **Query Params**:
  - `page`: integer (default 1)
  - `limit`: integer (default 20, max 100)
  - `role`: string (`USER`, `ADMIN`, `SUPER_ADMIN`)
  - `isActive`: boolean (`true`, `false`)
  - `search`: string (matches name or code)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": 2,
      "code": "ali_rezaei_01",
      "name": "Ali Rezaei",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-11-01T15:00:00.000Z",
      "updatedAt": "2026-11-01T15:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `POST /api/users`
- **Access**: `SUPER_ADMIN`
- **Description**: Create a new studio user.
- **Request Body**:
```json
{
  "code": "sara_karimi_01",
  "name": "Sara Karimi",
  "role": "USER"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 3,
    "code": "sara_karimi_01",
    "name": "Sara Karimi",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-11-01T15:00:00.000Z",
    "updatedAt": "2026-11-01T15:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `409 Conflict`: `{ "success": false, "message": "A record with this code already exists" }`

### `GET /api/users/:id`
- **Access**: `SUPER_ADMIN`
- **Response `200 OK`**: Single user record.

### `PATCH /api/users/:id`
- **Access**: `SUPER_ADMIN`
- **Description**: Update user attributes (name, role, isActive, code). Auth cache is immediately invalidated.
- **Guards**:
  - A SuperAdmin cannot demote themselves (`409 Conflict`).
  - A SuperAdmin cannot deactivate themselves (`409 Conflict`).
  - The last active SuperAdmin cannot be demoted or deactivated (`409 Conflict`).
- **Response `200 OK`**: Updated user object.

### `DELETE /api/users/:id`
- **Access**: `SUPER_ADMIN`
- **Guards**:
  - A SuperAdmin cannot delete themselves (`409 Conflict`).
  - The last active SuperAdmin cannot be deleted (`409 Conflict`).
- **Response `200 OK`**: `{ "success": true, "message": "User deleted successfully", "data": null }`.

---

## 4. Projects (`/api/projects`)

### `GET /api/projects/mine`
- **Access**: Any logged-in user (`USER`, `ADMIN`, `SUPER_ADMIN`)
- **Description**: Fetch active projects assigned to current user. Cached in Redis (`user:{id}:projects`, TTL 1h) and automatically invalidated upon membership or project changes.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Projects fetched successfully",
  "data": [
    {
      "id": 10,
      "name": "Animation Sequence A",
      "description": "3D layout and camera blocking",
      "createdAt": "2026-11-01T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/projects`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Paginated list of projects including member counts.
- **Query Params**: `page`, `limit`, `search`, `isActive`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Projects fetched successfully",
  "data": [
    {
      "id": 10,
      "name": "Animation Sequence A",
      "description": "3D layout",
      "isActive": true,
      "createdById": 1,
      "memberCount": 4,
      "createdAt": "2026-11-01T12:00:00.000Z",
      "updatedAt": "2026-11-01T12:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/projects/:id`
- **Access**: `SUPER_ADMIN`
- **Description**: Detailed project view with assigned member list.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Project fetched successfully",
  "data": {
    "id": 10,
    "name": "Animation Sequence A",
    "description": "3D layout",
    "isActive": true,
    "createdById": 1,
    "createdAt": "2026-11-01T12:00:00.000Z",
    "updatedAt": "2026-11-01T12:00:00.000Z",
    "members": [
      { "id": 2, "name": "Ali Rezaei" },
      { "id": 3, "name": "Sara Karimi" }
    ]
  }
}
```

### `POST /api/projects`
- **Access**: `SUPER_ADMIN`
- **Description**: Create project and optionally assign members in a single atomic transaction.
- **Request Body**:
```json
{
  "name": "Animation Sequence A",
  "description": "3D character animation",
  "memberIds": [2, 3]
}
```
- **Error Responses**:
  - `400 Bad Request`: If any `memberIds` do not exist or are inactive (names invalid IDs).

### `PATCH /api/projects/:id`
- **Access**: `SUPER_ADMIN`
- **Request Body**: `{ "name": "...", "description": "...", "isActive": true }`

### `PUT /api/projects/:id/members`
- **Access**: `SUPER_ADMIN`
- **Description**: Replace-all sync for project members. Computes diff and applies addition/removal in one transaction. Invalidates affected users' project caches.
- **Request Body**:
```json
{
  "userIds": [2, 4]
}
```

### `DELETE /api/projects/:id`
- **Access**: `SUPER_ADMIN`
- **Description**: Safe deletion of a project.
- **Guards**:
  - If project has logged WorkSessions, returns `409 Conflict`:
    `{ "success": false, "message": "Cannot delete project with existing work sessions. Deactivate the project instead." }`

---

## 5. Attendance (`/api/attendance`)

### `GET /api/attendance/today`
- **Access**: Any logged-in user
- **Description**: Checks whether current user declared attendance today (in `APP_TIMEZONE`).
- **Response `200 OK` (No record yet - frontend shows Present/Absent buttons)**:
```json
{
  "success": true,
  "message": "No attendance recorded for today",
  "data": null
}
```
- **Response `200 OK` (Declared)**:
```json
{
  "success": true,
  "message": "Today's attendance fetched successfully",
  "data": {
    "id": 42,
    "userId": 2,
    "date": "2026-11-01",
    "status": "PRESENT",
    "effectiveStatus": "PRESENT",
    "approval": "PENDING",
    "source": "USER",
    "decidedById": null,
    "decidedAt": null,
    "sessionsCount": 2,
    "totalSeconds": 1500
  }
}
```

### `POST /api/attendance/today`
- **Access**: Any logged-in user
- **Description**: Declare daily attendance once per calendar day (in `APP_TIMEZONE`).
- **Request Body**:
```json
{
  "status": "PRESENT"
}
```
- **State Machine Rules**:
  - `status = "PRESENT"` -> `approval = "PENDING"`, `source = "USER"`.
  - `status = "ABSENT"` -> `approval = "APPROVED"`, `source = "USER"` (no review needed).
  - Attempting to declare twice on the same day returns `409 Conflict`.

### `GET /api/attendance/me`
- **Access**: Any logged-in user
- **Description**: Paginated personal attendance history with aggregates.
- **Query Params**: `page`, `limit`, `dateFrom`, `dateTo`.

### `GET /api/attendance/admin`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Paginated attendance review list. Aggregates sessions (`sessionsCount` and `totalSeconds`) using a single grouped query (zero N+1 queries).
- **Query Params**:
  - `page`, `limit`
  - `userId`: integer
  - `status`: `PRESENT`, `ABSENT`
  - `approval`: `PENDING`, `APPROVED`, `REJECTED`
  - `source`: `USER`, `ADMIN`, `SYSTEM`
  - `date`, `dateFrom`, `dateTo`: `YYYY-MM-DD`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Admin attendance fetched successfully",
  "data": [
    {
      "id": 42,
      "date": "2026-11-01",
      "user": { "id": 2, "name": "Ali Rezaei", "role": "USER" },
      "status": "PRESENT",
      "effectiveStatus": "PRESENT",
      "approval": "PENDING",
      "source": "USER",
      "decidedBy": null,
      "decidedAt": null,
      "sessionsCount": 2,
      "totalSeconds": 1500
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `PATCH /api/attendance/admin/:id/decision`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Review attendance record.
- **Request Body**:
```json
{
  "decision": "APPROVED"
}
```
- **State Machine & Security Rules**:
  - Only `status = PRESENT` records can be reviewed (deciding on ABSENT returns `409 Conflict`).
  - Allowed transitions: `PENDING -> APPROVED`, `PENDING -> REJECTED`, `APPROVED -> REJECTED`.
  - `REJECTED` is final (reviewing a REJECTED record returns `409 Conflict`).
  - Nobody may review their own attendance (`403 Forbidden`).
  - ADMIN cannot review a SUPER_ADMIN's attendance (`403 Forbidden`).
  - **Rejection Transaction**: When `decision = "REJECTED"`, attendance is updated AND all linked WorkSessions are deleted atomically in one `$transaction`. `effectiveStatus` becomes `ABSENT`.

---

## 6. Work Sessions (`/api/work-sessions`)

### `POST /api/work-sessions`
- **Access**: Any logged-in user (Per-user rate limited)
- **Description**: Log a completed focus timer run against an assigned project.
- **Request Body**:
```json
{
  "projectId": 10,
  "durationSeconds": 825
}
```
- **Validation & Rules**:
  - `durationSeconds`: integer between `1` and `SESSION_MAX_SECONDS` (default 1500). Floats, negatives, strings are rejected (`400 Bad Request`).
  - Project must exist, be `isActive`, and user must be assigned to it (`ProjectMember`).
  - Server resolves the attendance row itself:
    - User must have an attendance row for today (`APP_TIMEZONE`) with `status = PRESENT` and `approval != REJECTED`.
    - **Midnight Grace**: If no qualifying record exists for today AND current time is within `MIDNIGHT_GRACE_MINUTES` (default 30) after 00:00, falls back to yesterday's qualifying record.
  - **Concurrency Race Protection**: Check-and-insert runs inside a transaction with a pessimistic row lock (`SELECT ... FOR UPDATE` via raw SQL) on the Attendance row, preventing concurrent admin rejections from leaving orphaned sessions.
  - Multiple sessions per user/project/day are permitted and stored independently.

### `GET /api/work-sessions/me`
- **Access**: Any logged-in user
- **Description**: Fetch personal work sessions (defaults to today in `APP_TIMEZONE`).
- **Query Params**: `date` or `dateFrom`/`dateTo`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Own work sessions fetched successfully",
  "data": {
    "totalSeconds": 1575,
    "sessions": [
      {
        "id": 101,
        "projectId": 10,
        "projectName": "Animation Sequence A",
        "durationSeconds": 825,
        "attendanceDate": "2026-11-01",
        "createdAt": "2026-11-01T16:30:00.000Z"
      },
      {
        "id": 100,
        "projectId": 10,
        "projectName": "Animation Sequence A",
        "durationSeconds": 750,
        "attendanceDate": "2026-11-01",
        "createdAt": "2026-11-01T16:00:00.000Z"
      }
    ]
  }
}
```

### `GET /api/work-sessions`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Paginated list of all work sessions with filters and sum total.
- **Query Params**: `page`, `limit`, `userId`, `projectId`, `date`, `dateFrom`, `dateTo`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Work sessions fetched successfully",
  "data": {
    "totalSeconds": 1575,
    "sessions": [
      {
        "id": 101,
        "user": { "id": 2, "name": "Ali Rezaei", "role": "USER" },
        "project": { "id": 10, "name": "Animation Sequence A" },
        "durationSeconds": 825,
        "attendanceDate": "2026-11-01",
        "createdAt": "2026-11-01T16:30:00.000Z"
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/work-sessions/summary`
- **Access**: `ADMIN`, `SUPER_ADMIN`
- **Description**: Grouped summary aggregations performed directly via DB `groupBy`.
- **Query Params**:
  - `groupBy`: `user` | `project` | `user_project` (default `user_project`)
  - `userId`, `projectId`, `date`, `dateFrom`, `dateTo`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Work sessions summary fetched successfully",
  "data": [
    {
      "totalSeconds": 1575,
      "sessionsCount": 2,
      "user": { "id": 2, "name": "Ali Rezaei" },
      "project": { "id": 10, "name": "Animation Sequence A" }
    }
  ]
}
```

---

## 7. Daily Close Job (Background)

- **Schedule**: Daily at `00:05` in `APP_TIMEZONE` (`node-cron`).
- **Distributed Lock**: Redis key `cron:lock:dailyClose` (`SET NX EX 600`) ensures single execution across multi-instance deployments.
- **Actions**:
  1. **Absence Fill**: Scans dates `[T - ATTENDANCE_CATCHUP_DAYS, T - 1]`. For any active user created on or before date `D` without an attendance record, inserts `status=ABSENT, approval=APPROVED, source=SYSTEM`.
  2. **Auto-Approve**: Any `status=PRESENT, approval=PENDING` attendance with `date <= T - 2` is updated to `approval=APPROVED, source=SYSTEM`.
  3. **Boot Catch-up**: Invoked non-blocking upon server startup to backfill missed records after server maintenance.
