# v1.5 Prep Agent Workout Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement agent-friendly workout logging with unilateral set metadata, automatic exercise creation, and an expanded exercise catalog path.

**Architecture:** Add forward-only schema migration `0003` for exercise metadata and set side metadata. Extend the workout domain to persist `side_mode`/`side`, add `logWorkout` as a wrapper around exercise matching/creation plus `createWorkoutEntry`, and expose it as `POST /tools/log_workout`. Keep existing tools compatible.

**Tech Stack:** Bun, Hono, bun:sqlite, Zod, SQL migrations, `bun test`.

---

### Task 1: Schema And Domain Side Metadata

**Files:**
- Create: `src/db/migrations/0003_unilateral_logging.sql`
- Modify: `src/domain/workouts.ts`
- Test: `tests/db/schema.test.ts`, `tests/domain/workouts.test.ts`

- [ ] Write failing tests for new exercise and set columns.
- [ ] Run targeted tests and verify they fail because columns are missing.
- [ ] Add migration columns and update `WorkoutSet`/`SetInput`.
- [ ] Run targeted tests and verify they pass.

### Task 2: `logWorkout` Domain Wrapper

**Files:**
- Modify: `src/domain/exercises.ts`, `src/domain/workouts.ts`
- Test: `tests/domain/workouts.test.ts`, `tests/domain/exercises.test.ts`

- [ ] Write failing tests for alias logging, auto-created exercise logging, default `each_side`, and invalid side combinations.
- [ ] Run targeted tests and verify they fail because `logWorkout` and metadata are missing.
- [ ] Implement `findExercise`, `createAutoExercise`, side defaulting/validation, and `logWorkout`.
- [ ] Run targeted tests and verify they pass.

### Task 3: HTTP Tool

**Files:**
- Modify: `src/tools/workouts.ts`
- Test: `tests/tools/workouts.test.ts`

- [ ] Write failing integration tests for `POST /tools/log_workout`.
- [ ] Run targeted tests and verify they fail because the route is missing.
- [ ] Add Zod schema and route handler.
- [ ] Run targeted tests and verify they pass.

### Task 4: Catalog Expansion And Import Path

**Files:**
- Modify: `scripts/seed-exercises.ts`
- Create: `scripts/import-external-exercises.ts`
- Create: `docs/exercise-sources.md`
- Test: `tests/domain/exercises.test.ts`

- [ ] Write failing tests for unilateral heuristic and source metadata.
- [ ] Run targeted tests and verify they fail because helpers are missing.
- [ ] Add catalog metadata helpers and expand curated seed aliases/exercises.
- [ ] Add external JSON import script for permissive datasets.
- [ ] Add attribution/source documentation.
- [ ] Run targeted tests and verify they pass.

### Task 5: Docs And Full Verification

**Files:**
- Modify: `README.md`

- [ ] Document that agents should prefer `log_workout`.
- [ ] Run `bun test`.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `git diff --check`.
- [ ] Commit and push.
