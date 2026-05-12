# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
bun install
bun test
bunx tsc --noEmit
bun run dev          # local server at PORT (default 3000)
```

Bun is required (`~/.bun/bin/bun`). Tests use in-memory SQLite via `tests/helpers/db.ts::makeTestDb()`.

## Architecture Overview

Self-hosted, single-user fitness backend optimized for agent-first input. Bun + Hono + `bun:sqlite`, Hono JSX SSR dashboard, bearer auth with SHA-256 hashed tokens + `fc_session` HttpOnly cookie. Layout: `src/{auth,db,domain,lib,tools,web,jobs}`, migrations in `src/db/migrations/`, deploy artifacts in `deploy/`.

## Conventions & Patterns

- **Validation**: always go through `zv()` in `src/lib/validator.ts` (never raw `zValidator`) so 400 responses keep the unified `{error:{code:"invalid_input",message}}` shape.
- **Errors**: `throw new HttpError(status, code, message)` from `src/lib/http.ts`; `app.onError(errorJson)` converts to JSON.
- **Auth context**: routes read `c.get('userId')` set by `bearerAuth` middleware. `/tools/*`, `/api/*`, `/import/*` reject `?t=` query tokens; only `/` accepts them and rotates to cookie.
- **Tool routes**: mirror existing files in `src/tools/`. Mount via `mountTools()` in `src/tools/index.ts`.
- **Backend absorbs agent imprecision**: when a tool API has subtle semantics (patch vs append, idempotency, length caps), prefer encoding the safety net in the backend over expecting agents to read docs carefully. Example: `daily_checkins.notes` is append-with-dedupe rather than patch, so retried or naive calls do the right thing.
- **End-to-end agent smoke before significant commits**: for changes that touch the agent surface (`/tools/*`, README install flow, seed data, validation), run a live `bun run src/server.ts` + `curl` round-trip simulating the README's quick-start before committing. Catches issues like raw Zod errors leaking or missing exercise aliases that unit tests do not surface.
