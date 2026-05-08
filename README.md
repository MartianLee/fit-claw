# fit-claw

English | [한국어](./docs/i18n/README.ko.md)

fit-claw is a small, self-hosted fitness logging backend built for agent-first workflows. It is not trying to be a full workout app. The intended interface is a Telegram, Slack, or local agent that turns natural language into structured tool calls, while this service stays focused on storage, validation, stats, dashboards, and backups.

The current v1 tracks weight training sessions, body measurements, estimated 1RM trends, recent activity, and dashboard aggregates. It runs comfortably on a Mac mini with Bun, Hono, and a single SQLite database.

## Why This Exists

- Agent-first input: agents call `/tools/*` endpoints with JSON, so the human can log workouts through chat instead of forms.
- Deterministic backend: no LLM logic is needed for core data correctness; the backend handles CRUD, validation, stats, auth, and migrations.
- Simple self-hosting: Docker Compose is the easiest path; Bun + SQLite + launchd remains available for Mac mini installs.
- Personal data ownership: the default deployment path is a private Mac mini, reachable through Tailscale and optionally Cloudflare Tunnel for future import webhooks.
- Read-only dashboard: the web UI is for quick review, not data entry, so input stays consistent through the agent.

## Stack

- Runtime: Bun
- HTTP: Hono
- DB: `bun:sqlite`
- Validation: Zod + `@hono/zod-validator`
- Web: Hono JSX SSR, htmx, Chart.js
- Auth: bearer tokens stored as SHA-256 hashes
- Ops: Docker Compose, launchd, `VACUUM INTO` backups, optional rclone

## Quick Start

### Docker Compose

This is the recommended path for self-hosting from a fresh clone.

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```bash
API_BEARER_TOKEN=replace-with-a-long-random-bootstrap-token
PORT=3000
```

Build and start the service:

```bash
docker compose up -d --build
```

The Compose setup stores SQLite data in the named volume `fit-claw-data` at `/app/data/fit-claw.db` inside the container.

Create a dashboard or agent token:

```bash
docker compose run --rm fit-claw bun run scripts/new-token.ts dashboard
```

Seed the exercise catalog:

```bash
docker compose run --rm fit-claw bun run scripts/seed-exercises.ts
```

Smoke checks:

```bash
curl http://localhost:3000/healthz
curl -X POST http://localhost:3000/tools/find_or_propose_exercise \
  -H "authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"query":"bench press"}'
```

Open the dashboard:

```text
http://localhost:3000/?t=<token>
```

The first dashboard visit with `?t=` sets an `HttpOnly` session cookie and redirects to `/`, so the token is not kept in the browser URL.

Useful Docker commands:

```bash
docker compose logs -f fit-claw
docker compose restart fit-claw
docker compose down
```

### Local Bun

```bash
bun install
cp .env.example .env
```

Edit `.env` and set at least:

```bash
API_BEARER_TOKEN=replace-with-a-long-random-bootstrap-token
DATABASE_PATH=./data/fit-claw.db
PORT=3000
```

Initialize the database and create an agent token:

```bash
bun run scripts/new-token.ts agent
```

The command prints the plaintext bearer token once. Give that token to the agent as the value it should send in:

```http
Authorization: Bearer <token>
```

Seed the exercise catalog:

```bash
bun run scripts/seed-exercises.ts
```

Start the server:

```bash
bun run dev
```

Smoke checks:

```bash
curl http://localhost:3000/healthz
curl -X POST http://localhost:3000/tools/find_or_propose_exercise \
  -H "authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"query":"bench press"}'
```

Open the dashboard inside your private network:

```text
http://localhost:3000/?t=<token>
```

The first dashboard visit with `?t=` sets an `HttpOnly` session cookie and redirects to `/`.

## Agent Integration

Agents should treat fit-claw as a structured tool backend. Natural language parsing belongs in the agent; fit-claw expects validated JSON.

Core tool endpoints:

- `POST /tools/find_or_propose_exercise`
- `POST /tools/confirm_new_exercise`
- `POST /tools/create_workout_entry`
- `POST /tools/query_workouts`
- `POST /tools/recent_workouts`
- `POST /tools/update_set`
- `POST /tools/delete_set`
- `POST /tools/set_workout_detail_mode`
- `POST /tools/log_body_measurement`
- `POST /tools/query_body`

Example workout log:

```bash
curl -X POST http://localhost:3000/tools/create_workout_entry \
  -H "authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{
    "exercise_id": 1,
    "sets": [
      { "weight_kg": 80, "reps": 5 },
      { "weight_kg": 80, "reps": 5 },
      { "weight_kg": 75, "reps": 8 }
    ]
  }'
```

Example body measurement:

```bash
curl -X POST http://localhost:3000/tools/log_body_measurement \
  -H "authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"weight_kg":72.5,"source":"manual"}'
```

## Data Model

v1 uses a compact schema:

- `users`, `api_tokens`
- `exercises`, `exercise_aliases`
- `workout_sessions`, `workout_entries`, `workout_sets`
- `body_measurements`
- v1.5+ preparation tables: `daily_checkins`, `prediction_models`, `alarm_rules`, `notifications_log`

Migrations are SQL files in `src/db/migrations/` and are applied through `applied_migrations`.

## Dashboard APIs

The SSR dashboard consumes these bearer-protected JSON endpoints:

- `GET /api/summary`
- `GET /api/body-series?days=180`
- `GET /api/onerm-series?exercise_id=<id>&days=180`
- `GET /api/calendar?weeks=12`
- `GET /api/recent-activity`

In production, put the dashboard and `/api/*` behind Tailscale or an equivalent private network boundary.

## Backup

Run a local SQLite backup:

```bash
bun run src/jobs/backup.ts
```

The job writes `data/backups/fit-claw-*.db.gz`. If `BACKUP_RCLONE_REMOTE` is set, it also copies the backup to that remote and prunes files older than `BACKUP_RETENTION_DAYS`.

## Deploy

Deployment docs live in `deploy/`:

- `deploy/README.md`: launchd setup for the API and backup job
- `deploy/cloudflared.md`: Cloudflare Tunnel for future `/import/*` public ingress
- `deploy/tailscale.md`: private dashboard and SSH access
- `deploy/com.fitclaw.api.plist`
- `deploy/com.fitclaw.backup.plist`

## Development

```bash
bun test
bunx tsc --noEmit
```

The test suite uses in-memory SQLite databases and should not require a local `.env`.
