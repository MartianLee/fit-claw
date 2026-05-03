import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from '../../src/auth/bearer'
import { hashToken } from '../../src/auth/tokens'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'

async function setup() {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  const token = 'tok-test-aaaaaaaaaaaaaaaa'
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES(1, ?, ?)', [
    await hashToken(token),
    'test',
  ])

  const app = new Hono()
  app.use('*', bearerAuth({ db }))
  app.get('/me', (c) => c.json({ user_id: c.get('userId') }))

  return { app, token }
}

describe('bearerAuth', () => {
  it('rejects missing token', async () => {
    const { app } = await setup()

    const response = await app.request('/me')

    expect(response.status).toBe(401)
  })

  it('rejects bad token', async () => {
    const { app } = await setup()

    const response = await app.request('/me', { headers: { Authorization: 'Bearer wrong' } })

    expect(response.status).toBe(401)
  })

  it('accepts good token and sets userId', async () => {
    const { app, token } = await setup()

    const response = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user_id: 1 })
  })

  it('accepts token from query string fallback', async () => {
    const { app, token } = await setup()

    const response = await app.request(`/me?t=${token}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user_id: 1 })
  })
})
