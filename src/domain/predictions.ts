import type { Database } from 'bun:sqlite'
import { oneRmDailySeries } from './stats'

const DAY_MS = 86_400_000
const FIT_WINDOW_DAYS = 84
const REST_GRACE_DAYS = 7

type ExerciseRow = {
  id: number
  body_part: string
}

type WorkoutSummary = {
  last_workout_at: string | null
}

export type PredictionModel = {
  user_id: number
  exercise_id: number
  slope_per_week: number
  personal_tau_days: number
  sample_size: number
  confidence: number
  fitted_at: string
  last_workout_at: string | null
  last_est_1rm_kg: number | null
}

export type PredictPerformanceResult = {
  exercise_id: number
  target_date: string
  predicted_1rm_kg: number
  confidence: number
  basis: {
    slope_per_week: number
    personal_tau_days: number
    sample_size: number
    last_workout_at: string | null
    last_est_1rm_kg: number | null
  }
}

export type PredictSeriesResult = {
  exercise_id: number
  points: { date: string; predicted_1rm_kg: number }[]
  basis: {
    slope_per_week: number
    personal_tau_days: number
    sample_size: number
    last_workout_at: string | null
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDateKey(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function diffDays(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function getExercise(db: Database, exerciseId: number): ExerciseRow {
  const row = db.query('SELECT id, body_part FROM exercises WHERE id = ?').get(exerciseId) as ExerciseRow | null
  if (!row) throw new Error('exercise not found')
  return row
}

function fallbackTauDays(bodyPart: string): number {
  const normalized = bodyPart.toLowerCase().replace(/[_-]/g, ' ')
  const largeGroups = new Set(['leg', 'legs', 'back', 'chest', 'full body', 'full'])
  return largeGroups.has(normalized) ? 21 : 14
}

function linearSlopePerWeek(points: { date: string; est_1rm: number }[]): number {
  if (points.length < 2) return 0

  const start = parseDateKey(points[0]!.date)
  const xs = points.map((point) => diffDays(start, parseDateKey(point.date)) / 7)
  const ys = points.map((point) => point.est_1rm)
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < points.length; i++) {
    const xDelta = xs[i]! - xMean
    numerator += xDelta * (ys[i]! - yMean)
    denominator += xDelta * xDelta
  }

  return denominator === 0 ? 0 : numerator / denominator
}

function estimateTauDays(
  points: { date: string; est_1rm: number }[],
  fallback: number,
): number {
  const candidates: number[] = []

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!
    const current = points[i]!
    const gapDays = diffDays(parseDateKey(previous.date), parseDateKey(current.date))
    if (gapDays < REST_GRACE_DAYS) continue
    if (previous.est_1rm <= 0 || current.est_1rm <= 0 || current.est_1rm >= previous.est_1rm) continue

    const ratio = current.est_1rm / previous.est_1rm
    const tau = gapDays / -Math.log(ratio)
    if (Number.isFinite(tau) && tau > 0) candidates.push(tau)
  }

  if (candidates.length < 3) return fallback
  return candidates.reduce((sum, value) => sum + value, 0) / candidates.length
}

function confidence(sampleSize: number, hasLearnedTau: boolean): number {
  if (sampleSize === 0) return 0
  const sampleComponent = Math.min(0.65, sampleSize * 0.08)
  const tauComponent = hasLearnedTau ? 0.2 : 0.05
  return Math.min(0.95, 0.2 + sampleComponent + tauComponent)
}

function lastWorkoutAt(db: Database, input: { user_id: number; exercise_id: number }): string | null {
  const row = db
    .query(
      `SELECT MAX(s.started_at) AS last_workout_at
       FROM workout_sessions s
       JOIN workout_entries e ON e.session_id = s.id
       WHERE s.user_id = ? AND e.exercise_id = ?`,
    )
    .get(input.user_id, input.exercise_id) as WorkoutSummary | null
  return row?.last_workout_at ?? null
}

function predictFromModel(model: PredictionModel, targetDate: string): number {
  if (model.last_est_1rm_kg === null || model.last_workout_at === null) return 0

  const lastDate = parseDateKey(model.last_workout_at)
  const target = parseDateKey(targetDate)
  const daysAhead = diffDays(lastDate, target)
  const trend = Math.max(0, model.last_est_1rm_kg + model.slope_per_week * (daysAhead / 7))
  const decayDays = Math.max(0, daysAhead - REST_GRACE_DAYS)
  const decayFactor = Math.exp(-decayDays / model.personal_tau_days)
  return round1(trend * decayFactor)
}

export function fitPredictionModel(
  db: Database,
  input: { user_id: number; exercise_id: number; now?: Date },
): PredictionModel {
  const now = input.now ?? new Date()
  const exercise = getExercise(db, input.exercise_id)
  const date_from = dateKey(addDays(now, -FIT_WINDOW_DAYS))
  const date_to = `${dateKey(now)}T23:59:59.999Z`
  const points = oneRmDailySeries(db, {
    user_id: input.user_id,
    exercise_id: input.exercise_id,
    date_from,
    date_to,
  })
  const slope = linearSlopePerWeek(points)
  const fallbackTau = fallbackTauDays(exercise.body_part)
  const tau = estimateTauDays(points, fallbackTau)
  const learnedTau = tau !== fallbackTau
  const fittedAt = now.toISOString()
  const lastPoint = points.at(-1)
  const model: PredictionModel = {
    user_id: input.user_id,
    exercise_id: input.exercise_id,
    slope_per_week: slope,
    personal_tau_days: tau,
    sample_size: points.length,
    confidence: confidence(points.length, learnedTau),
    fitted_at: fittedAt,
    last_workout_at: lastWorkoutAt(db, input),
    last_est_1rm_kg: lastPoint?.est_1rm ?? null,
  }

  db.run(
    `INSERT INTO prediction_models(
       user_id, exercise_id, slope_per_week, personal_tau_days, sample_size, confidence, fitted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, exercise_id) DO UPDATE SET
       slope_per_week = excluded.slope_per_week,
       personal_tau_days = excluded.personal_tau_days,
       sample_size = excluded.sample_size,
       confidence = excluded.confidence,
       fitted_at = excluded.fitted_at`,
    [
      model.user_id,
      model.exercise_id,
      model.slope_per_week,
      model.personal_tau_days,
      model.sample_size,
      model.confidence,
      model.fitted_at,
    ],
  )

  return model
}

export function predictPerformance(
  db: Database,
  input: { user_id: number; exercise_id: number; target_date: string; now?: Date },
): PredictPerformanceResult {
  const model = fitPredictionModel(db, input)
  return {
    exercise_id: input.exercise_id,
    target_date: input.target_date.slice(0, 10),
    predicted_1rm_kg: predictFromModel(model, input.target_date),
    confidence: model.confidence,
    basis: {
      slope_per_week: model.slope_per_week,
      personal_tau_days: model.personal_tau_days,
      sample_size: model.sample_size,
      last_workout_at: model.last_workout_at,
      last_est_1rm_kg: model.last_est_1rm_kg,
    },
  }
}

export function predictSeries(
  db: Database,
  input: { user_id: number; exercise_id: number; until_date: string; now?: Date },
): PredictSeriesResult {
  const now = input.now ?? new Date()
  const model = fitPredictionModel(db, { ...input, now })
  const start = parseDateKey(dateKey(now))
  const until = parseDateKey(input.until_date)
  const points: { date: string; predicted_1rm_kg: number }[] = []

  for (let cursor = start; cursor.getTime() <= until.getTime(); cursor = addDays(cursor, 1)) {
    const date = dateKey(cursor)
    points.push({ date, predicted_1rm_kg: predictFromModel(model, date) })
  }

  return {
    exercise_id: input.exercise_id,
    points,
    basis: {
      slope_per_week: model.slope_per_week,
      personal_tau_days: model.personal_tau_days,
      sample_size: model.sample_size,
      last_workout_at: model.last_workout_at,
    },
  }
}

export function refitPredictionModels(
  db: Database,
  input: { user_id?: number; now?: Date } = {},
): PredictionModel[] {
  const rows = db
    .query(
      `SELECT DISTINCT s.user_id AS user_id, e.exercise_id AS exercise_id
       FROM workout_sessions s
       JOIN workout_entries e ON e.session_id = s.id
       WHERE (? IS NULL OR s.user_id = ?)
       ORDER BY s.user_id, e.exercise_id`,
    )
    .all(input.user_id ?? null, input.user_id ?? null) as { user_id: number; exercise_id: number }[]

  return rows.map((row) =>
    fitPredictionModel(db, {
      user_id: row.user_id,
      exercise_id: row.exercise_id,
      now: input.now,
    }),
  )
}
