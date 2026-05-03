import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from '../../src/auth/bearer'
import { hashToken } from '../../src/auth/tokens'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'
import { mountTools } from '../../src/tools'

async function setup() {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  const token = 'tok-test-aaaaaaaaaaaaaaaa'
  db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES(1, ?, ?)', [
    await hashToken(token),
    'test',
  ])
  db.run('INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")')

  const app = new Hono()
  app.use('/tools/*', bearerAuth({ db }))
  mountTools(app, { db })

  return { app, token }
}

describe('tools/workouts', () => {
  it('rejects without bearer', async () => {
    const { app } = await setup()

    const response = await app.request('/tools/find_or_propose_exercise', {
      method: 'POST',
      body: JSON.stringify({ query: 'bench' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(401)
  })

  it('find_or_propose_exercise returns matched exercise', async () => {
    const { app, token } = await setup()

    const response = await app.request('/tools/find_or_propose_exercise', {
      method: 'POST',
      body: JSON.stringify({ query: 'Bench Press' }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.matched.canonical_name).toBe('bench press')
  })

  it('create_workout_entry roundtrips', async () => {
    const { app, token } = await setup()
    const find = await (
      await app.request('/tools/find_or_propose_exercise', {
        method: 'POST',
        body: JSON.stringify({ query: 'bench press' }),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      })
    ).json()

    const response = await app.request('/tools/create_workout_entry', {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: find.matched.id,
        sets: [{ weight_kg: 80, reps: 5 }],
      }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.sets.length).toBe(1)
  })
})
