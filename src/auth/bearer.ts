import type { Database } from 'bun:sqlite'
import type { Context, MiddlewareHandler } from 'hono'
import { hashToken } from './tokens'

export type BearerOpts = { db: Database }

declare module 'hono' {
  interface ContextVariableMap {
    userId: number
  }
}

export function bearerAuth(opts: BearerOpts): MiddlewareHandler {
  return async (c: Context, next) => {
    const auth = c.req.header('authorization') ?? ''
    const match = /^Bearer\s+(.+)$/i.exec(auth)

    if (!match) {
      return c.json({ error: { code: 'unauthorized', message: 'missing bearer' } }, 401)
    }

    const tokenHash = await hashToken(match[1])
    const row = opts.db
      .query('SELECT user_id FROM api_tokens WHERE token_hash = ?')
      .get(tokenHash) as { user_id: number } | null

    if (!row) {
      return c.json({ error: { code: 'unauthorized', message: 'invalid token' } }, 401)
    }

    opts.db.run(
      "UPDATE api_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?",
      [tokenHash],
    )
    c.set('userId', row.user_id)
    await next()
  }
}
