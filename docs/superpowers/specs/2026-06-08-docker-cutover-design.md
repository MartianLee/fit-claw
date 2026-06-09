# fit-claw Docker/OrbStack Cutover + DB Merge — Design

- **Date:** 2026-06-08
- **Status:** Approved (brainstorming) — merge + port 8473
- **Builds on:** `deploy/cutover-to-docker.md` (A안 runbook)

## Problem

The mini runs fit-claw twice: a launchd `com.fitclaw.api` (`bun src/server.ts`,
now on `:8473`) and an OrbStack Docker container `fit-claw-fit-claw-1`
(`fit-claw:local`, `:49201`, **unhealthy**). Goal: make the **Docker/OrbStack
container the single canonical instance** on `:8473`.

Two findings from inspection:

1. **Container unhealthy = stale image.** Its healthcheck shells out to `curl`,
   absent in the `oven/bun` image (`exec: "curl": not found`, 267 failures). The
   *current* Dockerfile already uses a `bun -e` healthcheck, so a **rebuild fixes
   it**.
2. **The two DBs have diverged** (not a clean stale/live split):

   | | sessions | last activity | exercises | aliases | tokens |
   |---|---|---|---|---|---|
   | volume (docker) | 10 (all 2026-05-09 / 05-18, sparse) | 2026-05-18 | 7 | 0 | 2 |
   | host (launchd 8473) | 4 (through 2026-06-01, richer) | 2026-06-01 | 46 | 187 | 2 (incl. openclaw) |

   Both at schema `0003`. Only **2** of the volume's 7 exercises match host by
   name. Host is the richer/current side (catalog + recent + openclaw token);
   volume has 10 older sparse sessions not present in host.

## Decision

- **Merge** the volume's workout history into the host DB (host as base), so no
  data is lost. (User chose merge over host-only.)
- **Canonical port: 8473** (app default; the installed openclaw skill already
  points here).
- Docker container is the single instance; launchd is retired (archived,
  reversible).

## Merge design (`deploy/merge-db.sh`)

Non-destructive: `merge-db.sh BASE OTHER OUT` copies BASE→OUT, then imports
OTHER's workout history into OUT. Inputs untouched.

- **exercises:** insert OTHER exercises whose `canonical_name` has no host match,
  with `id + 100000`; matched ones map to the existing host id (built in a temp
  `ex_map`).
- **workout_sessions / workout_entries / workout_sets:** insert all OTHER rows
  with ids (and FK ids) offset by `+100000` to avoid PK collisions; entry
  `exercise_id` remapped via `ex_map` (`COALESCE(host_id, vol_id+100000)`).
- Tables that are empty on one side (aliases/body/checkins/alarms/predictions)
  need no merge.
- **api_tokens:** keep host's (preserves the openclaw token); volume tokens are
  **not** merged (still present in the archived volume backup).
- End with `PRAGMA foreign_key_check` — must be empty.

Expected OUT: sessions 14, entries 26, sets 84, exercises 51.

## Cutover steps

1. Rebuild image from current Dockerfile; update Dockerfile `ENV PORT`/`EXPOSE`
   `3000 → 8473` for consistency (compose still passes `PORT`).
2. Produce the merged DB **on copies first** and verify counts + FK check.
3. Stop + disable launchd `com.fitclaw.api`; archive plist to
   `~/fitclaw-cutover-backup/` (rollback).
4. Stop container; back up its current volume DB; copy the merged DB into the
   volume (WAL-safe — clear stale `-wal`/`-shm`); recreate on `:8473` via compose.
5. Verify: only `:8473` listening (nothing on `:3000`/`:49201`), container
   `healthy`, openclaw token authenticates (token rode along in the merged DB),
   merged data visible (14 sessions).

## Out of scope (follow-up)

- Repoint backup job `com.fitclaw.backup` (currently backs up the host file) to
  the container/volume.
- Removing the duplicate `docker-compose.yml` PORT drift / `.openclaw` stale DB
  copies.

## Safety / rollback

- Merge runs on copies; live volume DB backed up before replacement.
- launchd plist archived; `launchctl enable`/`bootstrap` restores it.
- Everything destructive archived under `~/fitclaw-cutover-backup/`.

## Constraints

- Commits authored ≥ 18:00 today; do **not** push to origin yet.
