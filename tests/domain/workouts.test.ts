import { describe, expect, it } from 'bun:test'
import { createWorkoutEntry } from '../../src/domain/workouts'
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
})
