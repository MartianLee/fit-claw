# Cutover: make Docker the single canonical fit-claw instance (A안)

## Why this exists

On the mini, three things were all binding `:3000`:

1. **launchd** `com.fitclaw.api` — host `bun src/server.ts` (the documented deploy, see `README.md`)
2. **docker compose** `fit-claw` — `ports: "3000:3000"`, `restart: unless-stopped`
3. the **openclaw** workspace copy at `~/.openclaw/workspace/fit-claw` — yet another `bun src/server.ts`

Whoever loses the race dies with `EADDRINUSE` (44× in the exported `api.err.log`), so the
agent's API writes intermittently fail. Worse, Docker writes to an **isolated named volume**
(`fit-claw-data:/app/data`), so live writes and the host `data/fit-claw.db` diverge — the
host export was frozen at `2026-05-22` while the live (Docker) DB kept moving.

**Decision: Docker is the one canonical instance.** Disable the others, unify the DB into the
volume, repoint the backup job.

> Fastest path: on the mini run `sudo tailscale up --ssh`, then Claude can `ssh mini@mini-macmini`
> and drive steps 1–6 live. Otherwise follow them by hand below.

> **Port note:** the app default is now **8473** (changed from 3000). A freshly pulled/rebuilt
> Docker instance listens on 8473; legacy launchd/openclaw instances may still be on 3000 until
> stopped. `inspect-instances.sh` checks both ports.

## 1. Inspect first (READ-ONLY — never skip)

```bash
cd ~/workspace/fit-claw   # or wherever the canonical checkout is
git pull
bash deploy/inspect-instances.sh
```

Read the VERDICT block. The DB with the most recent `last_session` is **canonical**.
Expected: the docker-volume DB is canonical and the host file is stale — but **verify, don't assume**.
Keep the snapshot paths it prints; they are WAL-consistent copies.

## 2. Stop & disable the launchd API service

```bash
launchctl bootout gui/$(id -u)/com.fitclaw.api 2>/dev/null
launchctl disable gui/$(id -u)/com.fitclaw.api
mkdir -p ~/fitclaw-cutover-backup
mv ~/Library/LaunchAgents/com.fitclaw.api.plist ~/fitclaw-cutover-backup/ 2>/dev/null
lsof -nP -iTCP:8473 -sTCP:LISTEN   # new default: should show ONLY the docker container
lsof -nP -iTCP:3000 -sTCP:LISTEN   # legacy port: should now be empty
```

## 3. Stop the openclaw copy from self-spawning

The openclaw workspace must **not** run its own `bun src/server.ts`. Point the agent at the
already-running container instead:

- Ensure openclaw calls `http://127.0.0.1:8473` with a valid `Authorization: Bearer <token>`.
- Make sure no openclaw task/cron does `bun run`/`bun src/server.ts` for fit-claw.
- (The ZodError in the logs was this copy missing `API_BEARER_TOKEN`; it should talk to the
  container's API, not boot its own server, so it no longer needs the full `.env`.)

## 4. Unify the DB into the Docker volume

Only if step 1 showed the canonical data is **not already** in the volume. Use the WAL-safe
snapshot from step 1 (`sqlite3 ... .backup`), never a raw `cp` of a live `.db`.

```bash
CANON=/tmp/fitclaw-inspect.XXXX/<the-canonical-snapshot>.db   # from step 1 output
COMPOSE=~/workspace/fit-claw/docker-compose.yml

# snapshot the current volume DB before overwriting (safety)
docker compose -f "$COMPOSE" cp fit-claw:/app/data/fit-claw.db ~/fitclaw-cutover-backup/volume-before.db

docker compose -f "$COMPOSE" stop fit-claw
docker compose -f "$COMPOSE" cp "$CANON" fit-claw:/app/data/fit-claw.db
# clear stale WAL/SHM sidecars so they don't shadow the restored DB
docker compose -f "$COMPOSE" run --rm --no-deps fit-claw sh -c \
  'rm -f /app/data/fit-claw.db-wal /app/data/fit-claw.db-shm' 2>/dev/null || true
docker compose -f "$COMPOSE" start fit-claw
```

If the volume was already canonical, skip this — just make sure the stale host checkout's DB
is archived so nobody points at it again:
`mv ~/workspace/fit-claw/data/fit-claw.db ~/fitclaw-cutover-backup/host-stale.db`.

## 5. Repoint the backup job

`com.fitclaw.backup` runs `bun src/jobs/backup.ts` against the **host** `data/` dir — under A안
that's the stale file. Pick one:

- **Run backup inside the container** (preferred): a cron/launchd that does
  `docker compose -f <compose> exec -T fit-claw bun src/jobs/backup.ts`, or
- mount/point the job at a host path that is the volume (e.g. `docker compose cp` the volume DB
  out to a backup dir on schedule).

Until fixed, the daily 3am backup is backing up the wrong DB — treat as follow-up if not done now.

## 6. Verify

```bash
curl -s http://127.0.0.1:8473/healthz                       # {"ok":true}
TOKEN=<agent bearer from the container .env>
# write something cheap, then read it back from the SAME instance:
curl -s -X POST http://127.0.0.1:8473/tools/... -H "Authorization: Bearer $TOKEN" -d '...'
# confirm it landed in the volume DB:
docker compose -f "$COMPOSE" cp fit-claw:/app/data/fit-claw.db /tmp/after.db
sqlite3 /tmp/after.db "SELECT count(*),max(started_at) FROM workout_sessions;"
```

Success = only one listener on `:8473` (and nothing on legacy `:3000`), `api.err.log` stops growing with EADDRINUSE, and the
test write is visible in the volume DB the agent reads.

## Rollback

Everything destructive was archived to `~/fitclaw-cutover-backup/`:
re-`mv` the plist back + `launchctl enable`/`bootstrap` to restore launchd; restore
`volume-before.db` into the container to undo a bad migration.
