import type { Database } from 'bun:sqlite'
import { createAutoExercise, findExercise, type Exercise } from './exercises'

export type SetInput = {
  weight_kg: number
  reps: number
  side_mode?: 'none' | 'each_side' | 'single_side'
  side?: 'left' | 'right'
  rpe?: number
  rir?: number
  rest_sec?: number
  tempo?: string
  notes?: string
}

export type CreateEntryInput = {
  user_id: number
  exercise_id: number
  sets: SetInput[]
  session_id?: number
  started_at?: string
  ended_at?: string
  notes?: string
}

export type WorkoutSession = {
  id: number
  user_id: number
  started_at: string
  ended_at: string | null
  notes: string | null
}

export type WorkoutEntry = {
  id: number
  session_id: number
  exercise_id: number
  sequence: number
}

export type WorkoutSet = {
  id: number
  entry_id: number
  set_number: number
  weight_kg: number
  reps: number
  side_mode: 'none' | 'each_side' | 'single_side'
  side: 'left' | 'right' | null
  rpe: number | null
  rir: number | null
  rest_sec: number | null
  tempo: string | null
  notes: string | null
}

export function createWorkoutEntry(db: Database, input: CreateEntryInput) {
  return db.transaction(() => {
    let session: WorkoutSession

    if (input.session_id) {
      const existing = db
        .query('SELECT * FROM workout_sessions WHERE id = ?')
        .get(input.session_id) as WorkoutSession | null
      if (!existing) throw new Error('session not found')
      session = existing
    } else {
      const startedAt = input.started_at ?? new Date().toISOString()
      const result = db.run(
        'INSERT INTO workout_sessions(user_id, started_at, ended_at, notes) VALUES (?, ?, ?, ?)',
        [input.user_id, startedAt, input.ended_at ?? null, input.notes ?? null],
      )
      session = db
        .query('SELECT * FROM workout_sessions WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as WorkoutSession
    }

    const sequence = (
      db
        .query('SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM workout_entries WHERE session_id = ?')
        .get(session.id) as { n: number }
    ).n
    const entryResult = db.run(
      'INSERT INTO workout_entries(session_id, exercise_id, sequence) VALUES (?, ?, ?)',
      [session.id, input.exercise_id, sequence],
    )
    const entryId = Number(entryResult.lastInsertRowid)

    const sets: WorkoutSet[] = []
    let setNumber = 1
    for (const set of input.sets) {
      const setResult = db.run(
        'INSERT INTO workout_sets(entry_id, set_number, weight_kg, reps, side_mode, side, rpe, rir, rest_sec, tempo, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          entryId,
          setNumber++,
          set.weight_kg,
          set.reps,
          set.side_mode ?? 'none',
          set.side ?? null,
          set.rpe ?? null,
          set.rir ?? null,
          set.rest_sec ?? null,
          set.tempo ?? null,
          set.notes ?? null,
        ],
      )
      sets.push(
        db.query('SELECT * FROM workout_sets WHERE id = ?').get(Number(setResult.lastInsertRowid)) as WorkoutSet,
      )
    }

    const entry = db.query('SELECT * FROM workout_entries WHERE id = ?').get(entryId) as WorkoutEntry
    return { session, entry, sets }
  })()
}

export type LogWorkoutInput = {
  user_id: number
  exercise: string
  sets: SetInput[]
  session_id?: number
  started_at?: string
  ended_at?: string
  notes?: string
}

export type LogWorkoutResult = ReturnType<typeof createWorkoutEntry> & {
  status: 'logged'
  exercise_created: boolean
  needs_review: boolean
  applied_defaults: { side_mode: 'none' | 'each_side' }
  created_exercise?: Exercise
}

function validateSetInput(set: SetInput): void {
  if (set.weight_kg < 0) throw new Error('weight_kg must be nonnegative')
  if (set.reps < 0) throw new Error('reps must be nonnegative')
  if (set.side_mode === 'single_side' && !set.side) {
    throw new Error('side is required when side_mode is single_side')
  }
  if (set.side_mode !== 'single_side' && set.side) {
    throw new Error('side is only allowed when side_mode is single_side')
  }
}

export function logWorkout(db: Database, input: LogWorkoutInput): LogWorkoutResult {
  if (input.sets.length === 0) throw new Error('sets must not be empty')

  let exercise = findExercise(db, input.exercise)
  const exercise_created = !exercise
  if (!exercise) exercise = createAutoExercise(db, input.exercise)

  const defaultSideMode = exercise.default_side_mode ?? 'none'
  const sets = input.sets.map((set) => {
    const side_mode = set.side_mode ?? defaultSideMode
    validateSetInput({ ...set, side_mode })
    const normalized: SetInput = {
      ...set,
      side_mode,
      side: side_mode === 'single_side' ? set.side : undefined,
    }
    return normalized
  })

  const created = createWorkoutEntry(db, {
    user_id: input.user_id,
    exercise_id: exercise.id,
    sets,
    session_id: input.session_id,
    started_at: input.started_at,
    ended_at: input.ended_at,
    notes: input.notes,
  })

  return {
    status: 'logged',
    exercise_created,
    needs_review: exercise.needs_review === 1,
    applied_defaults: { side_mode: defaultSideMode },
    created_exercise: exercise_created ? exercise : undefined,
    ...created,
  }
}

export type QueryWorkoutsInput = {
  user_id: number
  date_from?: string
  date_to?: string
  exercise_id?: number
}

export type WorkoutGroup = {
  session: WorkoutSession
  entries: { entry: WorkoutEntry; sets: WorkoutSet[] }[]
}

export function queryWorkouts(db: Database, query: QueryWorkoutsInput): WorkoutGroup[] {
  const sessions = db
    .query(
      `SELECT * FROM workout_sessions
       WHERE user_id = ?
         AND (? IS NULL OR started_at >= ?)
         AND (? IS NULL OR started_at <= ?)
       ORDER BY started_at DESC`,
    )
    .all(
      query.user_id,
      query.date_from ?? null,
      query.date_from ?? null,
      query.date_to ?? null,
      query.date_to ?? null,
    ) as WorkoutSession[]

  const groups: WorkoutGroup[] = []
  for (const session of sessions) {
    const entries = query.exercise_id
      ? (db
          .query('SELECT * FROM workout_entries WHERE session_id = ? AND exercise_id = ? ORDER BY sequence')
          .all(session.id, query.exercise_id) as WorkoutEntry[])
      : (db
          .query('SELECT * FROM workout_entries WHERE session_id = ? ORDER BY sequence')
          .all(session.id) as WorkoutEntry[])

    if (query.exercise_id && entries.length === 0) continue

    groups.push({
      session,
      entries: entries.map((entry) => ({
        entry,
        sets: db
          .query('SELECT * FROM workout_sets WHERE entry_id = ? ORDER BY set_number')
          .all(entry.id) as WorkoutSet[],
      })),
    })
  }

  return groups
}

export function recentWorkouts(db: Database, query: { user_id: number; days?: number }) {
  const days = query.days ?? 7
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  return queryWorkouts(db, { user_id: query.user_id, date_from: cutoff })
}

export function updateSet(db: Database, id: number, patch: Partial<SetInput>): WorkoutSet {
  const fields = ['weight_kg', 'reps', 'side_mode', 'side', 'rpe', 'rir', 'rest_sec', 'tempo', 'notes'] as const
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (patch[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(patch[field])
    }
  }

  if (updates.length > 0) {
    values.push(id)
    db.run(`UPDATE workout_sets SET ${updates.join(', ')} WHERE id = ?`, values)
  }

  return db.query('SELECT * FROM workout_sets WHERE id = ?').get(id) as WorkoutSet
}

export function deleteSet(db: Database, id: number): void {
  db.run('DELETE FROM workout_sets WHERE id = ?', [id])
}
