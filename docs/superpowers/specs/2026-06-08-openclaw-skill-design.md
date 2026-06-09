# fit-claw OpenClaw Skill — Design

- **Date:** 2026-06-08
- **Status:** Approved (brainstorming)
- **Author:** MartianLee (with Claude)

## Problem

`fit-claw` is an agent-first fitness backend (Bun + Hono, bearer-auth API). The
[OpenClaw](https://openclaw.ai) agent gateway running on the same host (`mini`)
has **no skill for fit-claw**, so the agent has no defined tool surface, base
URL, or token for calling the API. Every attempt to use fit-claw from OpenClaw
fails ("can't obtain a token / API fails"), because the wiring simply does not
exist. By contrast the unrelated `more-munch` project *does* have an OpenClaw
skill and works.

The fit-claw API itself is healthy: tokens are issued out-of-band via
`scripts/new-token.ts` (SHA-256 hash stored in `api_tokens`), and the agent must
send `Authorization: Bearer <token>`.

## Goal

The fit-claw repository should **own and version its own OpenClaw skill**, and
ship a one-command installer that applies it to an OpenClaw host. After install,
the OpenClaw agent can call fit-claw's tools reliably.

## Approach

A repo-owned skill package plus an install script (chosen over "git-only
install" and "manual runbook" because it is repeatable and keeps the token/URL
wiring automated).

### Repo layout (new, top-level `openclaw/`)

```
openclaw/
  fit-claw/
    SKILL.md            # the installable skill package (name: fit-claw)
  install.sh            # one-command apply: token → skills install → env → restart → verify
  README.md             # prerequisites + usage
docs/superpowers/specs/2026-06-08-openclaw-skill-design.md   # this doc
```

Top-level `openclaw/` (not `deploy/openclaw/`) signals that the skill is a
first-class, owned integration contract — not merely a host-ops detail.

### `openclaw/fit-claw/SKILL.md`

Mirrors the `more-munch` skill convention:

- **Frontmatter**
  - `name: fit-claw`
  - `description: …` (agent-first fitness logging & query)
  - `metadata.openclaw.requires.bins: [curl]`
  - `metadata.openclaw.requires.env: [FIT_CLAW_API_URL, FIT_CLAW_API_KEY]`
  - `metadata.openclaw.primaryEnv: FIT_CLAW_API_KEY`
- **Auth contract:** every call uses base `$FIT_CLAW_API_URL` and header
  `Authorization: Bearer $FIT_CLAW_API_KEY`.
- **Tools** (the existing `/tools/*` POST endpoints, which are purpose-built as
  agent tools):
  - Workouts: `log_workout`, `query_workouts`, `recent_workouts`,
    `create_workout_entry`, `update_set`, `delete_set`, `set_workout_detail_mode`
  - Body: `log_body_measurement`, `query_body`
  - Exercises: `find_or_propose_exercise`, `confirm_new_exercise`
  - Predictions: `predict_performance`, `predict_series`, `refit_prediction_models`
  - Alarms: `create_alarm_rule`, `list_alarm_rules`, `disable_alarm_rule`
  - Read context: `GET /api/summary` (today/this-week snapshot)
- **Usage guidance:** brief agent instructions (confirm exercise before logging,
  prefer recent_workouts/query for context, keep replies concise).

### `openclaw/install.sh`

Run on the OpenClaw host (`mini`), inside the repo. Steps:

1. **Token (idempotent):** if `skills.entries.fit-claw.env.FIT_CLAW_API_KEY`
   already exists in `~/.openclaw/openclaw.json`, reuse it. Otherwise issue once
   via `bun run scripts/new-token.ts openclaw` and capture stdout.
2. **Install skill:** `openclaw skills install ./openclaw/fit-claw`.
3. **Configure env:** back up `openclaw.json`, then `jq`-patch
   `skills.entries.fit-claw` to `enabled: true` with
   `env.FIT_CLAW_API_URL` (default `http://127.0.0.1:8473`, overridable via
   `FIT_CLAW_API_URL` env) and `env.FIT_CLAW_API_KEY`.
4. **Restart gateway:** `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway`.
5. **Verify:** `openclaw skills check` shows fit-claw ready; `curl $URL/healthz`
   returns `{"ok":true}`.

Flags/behavior: `set -euo pipefail`, timestamped backup of `openclaw.json`,
clear messages, safe to re-run.

## Secrets

The bearer token is **never committed**. `SKILL.md` and `install.sh` reference
only the env vars; the actual token value lives solely in
`~/.openclaw/openclaw.json` on the host.

## Target instance

`install.sh` defaults `FIT_CLAW_API_URL` to `http://127.0.0.1:8473` (the launchd
`com.fitclaw.api` instance). The token is issued into that instance's DB
(`./data/fit-claw.db`).

> **Out of scope (separate issue):** the host currently also runs a Docker
> (OrbStack) fit-claw container on `:49201` (marked unhealthy) from a half-done
> "cutover to docker" migration. Picking the canonical instance and retiring the
> duplicate is tracked separately; this skill only needs a configurable URL.

## Verification

- `openclaw skills list` includes `fit-claw`; `openclaw skills check` → ready.
- A tool call (e.g. `recent_workouts`) through the agent returns data instead of
  401.
- Re-running `install.sh` does not create duplicate tokens.

## Constraints

- Commits authored with timestamp ≥ 18:00 (today).
- Do **not** push to `origin` until explicitly approved.
