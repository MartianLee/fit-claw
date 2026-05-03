import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { SESSION_COOKIE, bearerAuth } from './auth/bearer'
import { loadConfig } from './config'
import { getDb } from './db/client'
import { errorJson } from './lib/http'
import { mountTools } from './tools'
import { webApiRoutes } from './web/api'
import { renderDashboard } from './web/dashboard'

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30

export function createApp(db?: Database) {
  const app = new Hono()

  app.get('/healthz', (c) => c.json({ ok: true }))
  app.onError((err, c) => errorJson(c, err))

  if (db) {
    app.use('/tools/*', bearerAuth({ db }))
    app.use('/import/*', bearerAuth({ db }))
    app.use('/api/*', bearerAuth({ db }))
    mountTools(app, { db })
    app.route('/', webApiRoutes(db))

    app.get('/static/*', async (c) => {
      const path = c.req.path.slice('/static/'.length)
      if (path.includes('..') || path.startsWith('/')) return c.notFound()
      const file = Bun.file(`src/web/static/${path}`)
      if (!(await file.exists())) return c.notFound()
      return new Response(file)
    })

    app.get('/', bearerAuth({ db, allowQueryToken: true }), (c) => {
      if (c.req.query('t')) {
        setCookie(c, SESSION_COOKIE, c.get('sessionToken'), {
          httpOnly: true,
          sameSite: 'Strict',
          path: '/',
          maxAge: SESSION_MAX_AGE_SEC,
        })
        return c.redirect('/', 303)
      }
      return c.html(renderDashboard(db, c.get('userId')).toString())
    })
  }

  return app
}

export const app = createApp()

if (import.meta.main) {
  const cfg = loadConfig()
  const db = getDb(cfg.databasePath)

  Bun.serve({
    port: cfg.port,
    fetch: createApp(db).fetch,
  })
}
