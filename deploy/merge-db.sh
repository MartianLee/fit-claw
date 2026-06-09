#!/usr/bin/env bash
#
# Merge workout history from OTHER fit-claw DB into a copy of BASE (BASE wins).
#
#   merge-db.sh BASE.db OTHER.db OUT.db
#
# Non-destructive: writes OUT.db only; BASE and OTHER are never modified.
# Both DBs must be at the same schema version. Imports exercises (de-duped by
# canonical_name) + workout_sessions/entries/sets from OTHER, offsetting ids by
# +100000 to avoid PK collisions. Does NOT merge api_tokens (BASE's are kept).
# Ends with PRAGMA foreign_key_check (must print nothing).

set -euo pipefail

BASE="${1:?usage: merge-db.sh BASE.db OTHER.db OUT.db}"
OTHER="${2:?usage: merge-db.sh BASE.db OTHER.db OUT.db}"
OUT="${3:?usage: merge-db.sh BASE.db OTHER.db OUT.db}"

[ -f "$BASE" ]  || { echo "BASE not found: $BASE" >&2;  exit 1; }
[ -f "$OTHER" ] || { echo "OTHER not found: $OTHER" >&2; exit 1; }

cp "$BASE" "$OUT"

sqlite3 "$OUT" <<SQL
ATTACH '$OTHER' AS vol;
PRAGMA foreign_keys=OFF;
BEGIN;

-- map each OTHER exercise to a host id (by name) or NULL if new
CREATE TEMP TABLE ex_map AS
  SELECT v.id AS vol_id, h.id AS host_id
  FROM vol.exercises v
  LEFT JOIN main.exercises h
    ON lower(h.canonical_name) = lower(v.canonical_name);

-- new exercises (no host match) -> id + 100000
INSERT INTO main.exercises
  (id, canonical_name, body_part, equipment, is_bodyweight, notes, created_at, default_side_mode, source, needs_review)
SELECT v.id + 100000, v.canonical_name, v.body_part, v.equipment, v.is_bodyweight,
       v.notes, v.created_at, v.default_side_mode, v.source, v.needs_review
FROM vol.exercises v
JOIN ex_map m ON m.vol_id = v.id
WHERE m.host_id IS NULL;

-- sessions (offset ids)
INSERT INTO main.workout_sessions (id, user_id, started_at, ended_at, notes)
SELECT id + 100000, user_id, started_at, ended_at, notes
FROM vol.workout_sessions;

-- entries (offset id + session_id; remap exercise_id)
INSERT INTO main.workout_entries (id, session_id, exercise_id, sequence)
SELECT e.id + 100000,
       e.session_id + 100000,
       COALESCE(m.host_id, e.exercise_id + 100000),
       e.sequence
FROM vol.workout_entries e
JOIN ex_map m ON m.vol_id = e.exercise_id;

-- sets (offset id + entry_id)
INSERT INTO main.workout_sets
  (id, entry_id, set_number, weight_kg, reps, rpe, rir, rest_sec, tempo, notes, side_mode, side)
SELECT id + 100000, entry_id + 100000, set_number, weight_kg, reps, rpe, rir,
       rest_sec, tempo, notes, side_mode, side
FROM vol.workout_sets;

COMMIT;
PRAGMA foreign_keys=ON;

.print '--- foreign_key_check (must be empty) ---'
PRAGMA foreign_key_check;
.print '--- merged counts ---'
SELECT 'sessions', count(*) FROM workout_sessions
UNION ALL SELECT 'entries', count(*) FROM workout_entries
UNION ALL SELECT 'sets', count(*) FROM workout_sets
UNION ALL SELECT 'exercises', count(*) FROM exercises;
SQL

echo "merged -> $OUT"
