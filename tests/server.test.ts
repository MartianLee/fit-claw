import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { SESSION_COOKIE } from '../src/auth/bearer'
import { hashToken } from '../src/auth/tokens'
import { loadMigrationsFromDir, runMigrations } from '../src/db/migrate'
import { app, createApp } from '../src/server'

async function setupAuthedApp() {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  const token = 'tok-test-aaaaaaaaaaaaaaaa'
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES(1, ?, ?)', [
    await hashToken(token),
    'test',
  ])

  return { app: createApp(db), token }
}

describe('GET /healthz', () => {
  it('returns ok true', async () => {
    const response = await app.fetch(new Request('http://localhost/healthz'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('dashboard auth', () => {
  it('turns query token into a session cookie and redirects to a clean URL', async () => {
    const { app, token } = await setupAuthedApp()

    const response = await app.request(`/?t=${token}`)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/')
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`)
  })

  it('renders dashboard and API responses with the session cookie', async () => {
    const { app, token } = await setupAuthedApp()
    const cookie = `${SESSION_COOKIE}=${token}`

    const dashboard = await app.request('/', { headers: { cookie } })
    const summary = await app.request('/api/summary', { headers: { cookie } })

    expect(dashboard.status).toBe(200)
    expect(await dashboard.text()).toContain('fit<em>·</em>claw')
    expect(summary.status).toBe(200)
    expect(await summary.json()).toEqual({
      weight_kg: null,
      smm_kg: null,
      pbf_pct: null,
      sessions_last_7d: 0,
    })
  })
})
