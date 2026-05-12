import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from '../../src/auth/bearer'
import { hashToken } from '../../src/auth/tokens'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'
import { createWorkoutEntry } from '../../src/domain/workouts'
import { webApiRoutes } from '../../src/web/api'

async function setup() {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  const token = 'tok-test-aaaaaaaaaaaaaaaa'
  db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES(1, ?, ?)', [
    await hashToken(token),
    'test',
  ])
  const app = new Hono()
  app.use('/api/*', bearerAuth({ db }))
  app.route('/', webApiRoutes(db))
  return { app, db, token }
}

describe('webApiRoutes', () => {
  it('GET /api/summary returns nulls when no data', async () => {
    const { app, token } = await setup()

    const response = await app.request('/api/summary', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      weight_kg: null,
      smm_kg: null,
      pbf_pct: null,
      sessions_last_7d: 0,
    })
  })

  it('GET /api/calendar doubles each_side set volume', async () => {
    const { app, db, token } = await setup()
    const exerciseId = Number(
      db.run(
        'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("dumbbell row", "back", "dumbbell")',
      ).lastInsertRowid,
    )
    createWorkoutEntry(db, {
      user_id: 1,
      exercise_id: exerciseId,
      started_at: new Date().toISOString(),
      sets: [{ weight_kg: 24, reps: 10, side_mode: 'each_side' }],
    })

    const response = await app.request('/api/calendar?weeks=1', {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const rows = (await response.json()) as { volume: number }[]
    expect(rows[0]?.volume).toBe(480)
  })
})
