import { describe, expect, it } from 'bun:test'
import { epley1Rm, oneRmDailySeries } from '../../src/domain/stats'
import { createWorkoutEntry } from '../../src/domain/workouts'
import { makeTestDb } from '../helpers/db'

describe('epley1Rm', () => {
  it('returns estimated one rep max', () => {
    expect(epley1Rm(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 4)
  })

  it('grows with reps', () => {
    expect(epley1Rm(80, 5)).toBeGreaterThan(epley1Rm(80, 3))
  })

  it('returns 0 for invalid input', () => {
    expect(epley1Rm(0, 5)).toBe(0)
    expect(epley1Rm(80, 0)).toBe(0)
  })
})

describe('oneRmDailySeries', () => {
  it('takes daily max across sets', () => {
    const db = makeTestDb()
    const exerciseId = Number(
      db.run(
        'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
      ).lastInsertRowid,
    )
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [
        { weight_kg: 80, reps: 5 },
        { weight_kg: 80, reps: 6 },
      ],
      started_at: '2026-05-01T09:00:00Z',
    })
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      sets: [{ weight_kg: 82, reps: 3 }],
      started_at: '2026-05-03T09:00:00Z',
    })

    const series = oneRmDailySeries(db, { user_id: 1, exercise_id: exerciseId })

    expect(series.length).toBe(2)
    expect(series[0]?.date).toBe('2026-05-01')
    expect(series[0]?.est_1rm).toBeCloseTo(epley1Rm(80, 6), 4)
    expect(series[1]?.date).toBe('2026-05-03')
    expect(series[1]?.est_1rm).toBeCloseTo(epley1Rm(82, 3), 4)
  })
})
