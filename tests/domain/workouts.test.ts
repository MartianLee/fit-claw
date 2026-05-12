import { describe, expect, it } from 'bun:test'
import {
  createWorkoutEntry,
  deleteSet,
  queryWorkouts,
  recentWorkouts,
  updateSet,
} from '../../src/domain/workouts'
import { makeTestDb } from '../helpers/db'

function seedBench(db: ReturnType<typeof makeTestDb>) {
  return Number(
    db.run(
      'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
    ).lastInsertRowid,
  )
}

describe('createWorkoutEntry', () => {
  it('creates session+entry+sets atomically', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)

    const result = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [
        { weight_kg: 80, reps: 5 },
        { weight_kg: 80, reps: 5 },
        { weight_kg: 75, reps: 8 },
      ],
      started_at: '2026-05-01T10:00:00Z',
    })

    expect(result.session.id).toBeGreaterThan(0)
    expect(result.entry.id).toBeGreaterThan(0)
    expect(result.sets.length).toBe(3)
    expect(result.sets[0]?.set_number).toBe(1)
  })

  it('joins to existing session_id when given', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)

    const first = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
      started_at: '2026-05-01T10:00:00Z',
    })
    const second = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 60, reps: 10 }],
      session_id: first.session.id,
    })

    expect(second.session.id).toBe(first.session.id)
  })

  it('handles casual single-set input', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)

    const result = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
    })

    expect(result.sets.length).toBe(1)
  })

  it('stores unilateral set metadata', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)

    const result = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [
        { weight_kg: 24, reps: 10, side_mode: 'each_side' },
        { weight_kg: 22, reps: 10, side_mode: 'single_side', side: 'right' },
      ],
    })

    expect(result.sets[0]?.side_mode).toBe('each_side')
    expect(result.sets[0]?.side).toBeNull()
    expect(result.sets[1]?.side_mode).toBe('single_side')
    expect(result.sets[1]?.side).toBe('right')
  })

  it('queryWorkouts filters by date range and exercise', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
      started_at: '2026-04-15T10:00:00Z',
    })
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 82, reps: 5 }],
      started_at: '2026-05-01T10:00:00Z',
    })

    const out = queryWorkouts(db, {
      user_id: 1,
      date_from: '2026-04-20',
      exercise_id: exerciseId,
    })

    expect(out.length).toBe(1)
    expect(out[0]?.entries[0]?.sets[0]?.weight_kg).toBe(82)
  })

  it('recentWorkouts returns last N days', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)
    const today = new Date().toISOString()
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
      started_at: today,
    })

    expect(recentWorkouts(db, { user_id: 1, days: 7 }).length).toBe(1)
  })

  it('updateSet patches fields', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)
    const result = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
    })

    const updated = updateSet(db, result.sets[0]!.id, { weight_kg: 82, rpe: 8 })

    expect(updated.weight_kg).toBe(82)
    expect(updated.rpe).toBe(8)
  })

  it('deleteSet removes', () => {
    const db = makeTestDb()
    const exerciseId = seedBench(db)
    const result = createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 80, reps: 5 }],
    })

    deleteSet(db, result.sets[0]!.id)

    expect(db.query('SELECT COUNT(*) AS n FROM workout_sets').get()).toEqual({ n: 0 })
  })
})
