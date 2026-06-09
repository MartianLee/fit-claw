# fit-claw × OpenClaw

This directory is fit-claw's **own [OpenClaw](https://openclaw.ai) skill** plus a
one-command installer. It lets an OpenClaw agent call fit-claw's API as
first-class tools (log workouts, track body composition, query, predict, alarm).

```
openclaw/
  fit-claw/SKILL.md   # the skill package (tool surface + usage), installed into OpenClaw
  install.sh          # apply it to a local OpenClaw gateway
  README.md           # this file
```

## Why this exists

fit-claw is an agent-first backend, but OpenClaw needs a **skill** to know fit-claw's
tools, base URL, and auth token. Without it the agent has no way to reach the API.
This skill is the contract; the installer wires it up.

## Prerequisites

- OpenClaw installed on the host, with the gateway running (`openclaw skills --help` works).
- fit-claw running and reachable (default `http://127.0.0.1:8473`; `GET /healthz` → `{"ok":true}`).
- `bun`, `jq`, `curl` on PATH (used to issue the token and patch config).

## Install

From anywhere inside the repo, on the OpenClaw host:

```bash
bash openclaw/install.sh
```

What it does (idempotent, re-runnable):

1. Reuses an existing fit-claw token from `~/.openclaw/openclaw.json`, or issues a
   fresh one via `scripts/new-token.ts` if none is configured.
2. `openclaw skills install ./openclaw/fit-claw`.
3. Backs up `openclaw.json`, then sets `skills.entries.fit-claw` to
   `enabled: true` with `env.FIT_CLAW_API_URL` + `env.FIT_CLAW_API_KEY`.
4. Restarts the gateway (`ai.openclaw.gateway`).
5. Verifies fit-claw `/healthz` and `openclaw skills check`.

### Targeting a different instance / token

```bash
FIT_CLAW_API_URL=http://127.0.0.1:49201 bash openclaw/install.sh   # e.g. the Docker instance
```

A token is valid only in the DB of the instance it was issued against. The
default (8473) is the launchd `com.fitclaw.api` instance, which shares this
repo's `./data/fit-claw.db`.

## Secrets

The bearer token is **never committed**. `SKILL.md` and `install.sh` reference only
the env vars; the real value lives only in `~/.openclaw/openclaw.json` on the host.

## Updating the skill

Edit `openclaw/fit-claw/SKILL.md`, then re-run `bash openclaw/install.sh` (the token
is reused, so this just refreshes the skill and restarts the gateway).
