import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from '../../src/auth/bearer'
import { hashToken } from '../../src/auth/tokens'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'
import { webApiRoutes } from '../../src/web/api'

describe('webApiRoutes', () => {
  it('GET /api/summary returns nulls when no data', async () => {
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
})
