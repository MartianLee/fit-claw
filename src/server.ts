import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { bearerAuth } from './auth/bearer'
import { loadConfig } from './config'
import { getDb } from './db/client'
import { errorJson } from './lib/http'
import { mountTools } from './tools'
import { webApiRoutes } from './web/api'

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
