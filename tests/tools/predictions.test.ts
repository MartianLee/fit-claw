import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from '../../src/auth/bearer'
import { hashToken } from '../../src/auth/tokens'
import { createWorkoutEntry } from '../../src/domain/workouts'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'
import { mountTools } from '../../src/tools'

const DAY_MS = 86_400_000

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

async function setup() {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  const token = 'tok-test-aaaaaaaaaaaaaaaa'
  db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES(1, ?, ?)', [
    await hashToken(token),
    'test',
  ])
  const exerciseId = Number(
    db.run(
      'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
    ).lastInsertRowid,
  )
  const today = new Date()
  const lastWeek = addDays(today, -7)
  createWorkoutEntry(db, {
    user_id: 1,
    exercise_id: exerciseId,
    started_at: `${dateKey(addDays(today, -14))}T09:00:00Z`,
    sets: [{ weight_kg: 90, reps: 5 }],
  })
  createWorkoutEntry(db, {
    user_id: 1,
    exercise_id: exerciseId,
    started_at: `${dateKey(lastWeek)}T09:00:00Z`,
    sets: [{ weight_kg: 96, reps: 5 }],
  })

  const app = new Hono()
  app.use('/tools/*', bearerAuth({ db }))
  mountTools(app, { db })

  return { app, token, exerciseId, targetDate: dateKey(addDays(today, 2)) }
}

describe('tools/predictions', () => {
  it('predict_performance returns a predicted 1RM and basis', async () => {
    const { app, token, exerciseId, targetDate } = await setup()

    const response = await app.request('/tools/predict_performance', {
      method: 'POST',
      body: JSON.stringify({ exercise_id: exerciseId, target_date: targetDate }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.exercise_id).toBe(exerciseId)
    expect(json.predicted_1rm_kg).toBeGreaterThan(0)
    expect(json.basis.slope_per_week).toBeGreaterThan(0)
  })

  it('predict_series returns daily prediction points', async () => {
    const { app, token, exerciseId, targetDate } = await setup()

    const response = await app.request('/tools/predict_series', {
      method: 'POST',
      body: JSON.stringify({ exercise_id: exerciseId, until_date: targetDate }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.exercise_id).toBe(exerciseId)
    expect(json.points.length).toBeGreaterThan(0)
    expect(json.points.at(-1).date).toBe(targetDate)
  })

  it('refit_prediction_models returns model count', async () => {
    const { app, token } = await setup()

    const response = await app.request('/tools/refit_prediction_models', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.count).toBe(1)
    expect(json.models[0].sample_size).toBe(2)
  })
})
