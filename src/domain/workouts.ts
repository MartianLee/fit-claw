import type { Database } from 'bun:sqlite'

export type SetInput = {
  weight_kg: number
  reps: number
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
        'INSERT INTO workout_sets(entry_id, set_number, weight_kg, reps, rpe, rir, rest_sec, tempo, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          entryId,
          setNumber++,
          set.weight_kg,
          set.reps,
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
