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
  const exerciseId = Number(
    db.run(
      'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
    ).lastInsertRowid,
  )

  const app = new Hono()
  app.use('/tools/*', bearerAuth({ db }))
  mountTools(app, { db })

  return { app, token, exerciseId }
}

describe('tools/alarms', () => {
  it('creates and lists alarm rules', async () => {
    const { app, token, exerciseId } = await setup()

    const created = await app.request('/tools/create_alarm_rule', {
      method: 'POST',
      body: JSON.stringify({
        scope: 'exercise',
        exercise_id: exerciseId,
        threshold_type: '1rm_below',
        threshold_value: 95,
      }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })
    const listed = await app.request('/tools/list_alarm_rules', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(created.status).toBe(200)
    expect(listed.status).toBe(200)
    const createdJson = await created.json()
    const listedJson = await listed.json()
    expect(createdJson.enabled).toBe(1)
    expect(listedJson.rules.length).toBe(1)
    expect(listedJson.rules[0].id).toBe(createdJson.id)
  })

  it('disables an alarm rule', async () => {
    const { app, token, exerciseId } = await setup()
    const created = await (
      await app.request('/tools/create_alarm_rule', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'exercise',
          exercise_id: exerciseId,
          threshold_type: 'days_inactive_above',
          threshold_value: 5,
        }),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      })
    ).json()

    const disabled = await app.request('/tools/disable_alarm_rule', {
      method: 'POST',
      body: JSON.stringify({ id: created.id }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })

    expect(disabled.status).toBe(200)
    const json = await disabled.json()
    expect(json.enabled).toBe(0)
  })
})
