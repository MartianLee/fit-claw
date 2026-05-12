import { describe, expect, it } from 'bun:test'
import {
  fitPredictionModel,
  predictPerformance,
  predictSeries,
} from '../../src/domain/predictions'
import { createWorkoutEntry } from '../../src/domain/workouts'
import { makeTestDb } from '../helpers/db'

function createExercise(db: ReturnType<typeof makeTestDb>, name: string, bodyPart = 'chest') {
  return Number(
    db.run('INSERT INTO exercises(canonical_name, body_part, equipment) VALUES(?, ?, ?)', [
      name,
      bodyPart,
      'barbell',
    ]).lastInsertRowid,
  )
}

function logSingleSet(
  db: ReturnType<typeof makeTestDb>,
  exerciseId: number,
  date: string,
  weight_kg: number,
  reps = 1,
) {
  createWorkoutEntry(db, {
    user_id: 1,
    exercise_id: exerciseId,
    started_at: `${date}T09:00:00Z`,
    sets: [{ weight_kg, reps }],
  })
}

describe('fitPredictionModel', () => {
  it('fits a positive weekly slope and upserts prediction_models cache', () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db, 'bench press')
    logSingleSet(db, exerciseId, '2026-04-01', 90, 5)
    logSingleSet(db, exerciseId, '2026-04-08', 96, 5)
    logSingleSet(db, exerciseId, '2026-04-15', 102, 5)

    const model = fitPredictionModel(db, {
      user_id: 1,
      exercise_id: exerciseId,
      now: new Date('2026-04-15T12:00:00Z'),
    })

    expect(model.slope_per_week).toBeGreaterThan(6)
    expect(model.sample_size).toBe(3)
    expect(model.last_workout_at).toBe('2026-04-15T09:00:00Z')

    const cached = db
      .query('SELECT * FROM prediction_models WHERE user_id = ? AND exercise_id = ?')
      .get(1, exerciseId) as { slope_per_week: number; sample_size: number } | null
    expect(cached?.sample_size).toBe(3)
    expect(cached?.slope_per_week).toBeCloseTo(model.slope_per_week, 4)
  })

  it('uses large-muscle and small-muscle tau fallbacks with insufficient rest samples', () => {
    const db = makeTestDb()
    const chestId = createExercise(db, 'incline press', 'chest')
    const armId = createExercise(db, 'barbell curl', 'arms')
    logSingleSet(db, chestId, '2026-05-01', 80, 5)
    logSingleSet(db, armId, '2026-05-01', 30, 8)

    const chestModel = fitPredictionModel(db, {
      user_id: 1,
      exercise_id: chestId,
      now: new Date('2026-05-02T00:00:00Z'),
    })
    const armModel = fitPredictionModel(db, {
      user_id: 1,
      exercise_id: armId,
      now: new Date('2026-05-02T00:00:00Z'),
    })

    expect(chestModel.personal_tau_days).toBe(21)
    expect(armModel.personal_tau_days).toBe(14)
  })

  it('learns personal tau from at least three rest-return drops', () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db, 'deadlift', 'back')
    logSingleSet(db, exerciseId, '2026-01-01', 100)
    logSingleSet(db, exerciseId, '2026-01-10', 90)
    logSingleSet(db, exerciseId, '2026-01-20', 80)
    logSingleSet(db, exerciseId, '2026-02-01', 70)

    const model = fitPredictionModel(db, {
      user_id: 1,
      exercise_id: exerciseId,
      now: new Date('2026-02-02T00:00:00Z'),
    })

    expect(model.personal_tau_days).toBeGreaterThan(50)
    expect(model.personal_tau_days).toBeLessThan(150)
    expect(model.personal_tau_days).not.toBe(21)
  })
})

describe('predictPerformance', () => {
  it('projects trend through the target date and reports model basis', () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db, 'pause bench press')
    logSingleSet(db, exerciseId, '2026-04-01', 90, 5)
    logSingleSet(db, exerciseId, '2026-04-08', 96, 5)
    logSingleSet(db, exerciseId, '2026-04-15', 102, 5)

    const prediction = predictPerformance(db, {
      user_id: 1,
      exercise_id: exerciseId,
      target_date: '2026-04-22',
      now: new Date('2026-04-15T12:00:00Z'),
    })

    expect(prediction.exercise_id).toBe(exerciseId)
    expect(prediction.target_date).toBe('2026-04-22')
    expect(prediction.predicted_1rm_kg).toBeGreaterThan(prediction.basis.last_est_1rm_kg ?? 0)
    expect(prediction.confidence).toBeGreaterThan(0)
    expect(prediction.basis.slope_per_week).toBeGreaterThan(6)
    expect(prediction.basis.personal_tau_days).toBe(21)
  })
})

describe('predictSeries', () => {
  it('returns daily predictions through until_date', () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db, 'front squat', 'leg')
    logSingleSet(db, exerciseId, '2026-05-01', 100, 5)
    logSingleSet(db, exerciseId, '2026-05-08', 105, 5)

    const series = predictSeries(db, {
      user_id: 1,
      exercise_id: exerciseId,
      until_date: '2026-05-10',
      now: new Date('2026-05-08T12:00:00Z'),
    })

    expect(series.exercise_id).toBe(exerciseId)
    expect(series.points.map((point) => point.date)).toEqual([
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ])
    expect(series.points[2]?.predicted_1rm_kg).toBeGreaterThan(series.points[0]?.predicted_1rm_kg ?? 0)
  })
})
