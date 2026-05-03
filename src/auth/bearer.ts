import type { Database } from 'bun:sqlite'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { hashToken } from './tokens'

export const SESSION_COOKIE = 'fc_session'
const LAST_USED_DEBOUNCE_MS = 60_000

const lastUsedAt = new Map<string, number>()

export type BearerOpts = { db: Database; allowQueryToken?: boolean }

declare module 'hono' {
  interface ContextVariableMap {
    userId: number
    sessionToken: string
  }
}

function extractToken(c: Context, allowQueryToken: boolean): string | undefined {
  const header = c.req.header('authorization') ?? ''
  const headerMatch = /^Bearer\s+(.+)$/i.exec(header)
  if (headerMatch) return headerMatch[1]

  const cookie = getCookie(c, SESSION_COOKIE)
  if (cookie) return cookie

  if (allowQueryToken) {
    const q = c.req.query('t')
    if (q) return q
  }
  return undefined
}

export function bearerAuth(opts: BearerOpts): MiddlewareHandler {
  const allowQueryToken = opts.allowQueryToken ?? false
  return async (c, next) => {
    const token = extractToken(c, allowQueryToken)
    if (!token) {
      return c.json({ error: { code: 'unauthorized', message: 'missing bearer' } }, 401)
    }

    const tokenHash = await hashToken(token)
    const row = opts.db
      .query('SELECT user_id FROM api_tokens WHERE token_hash = ?')
      .get(tokenHash) as { user_id: number } | null

    if (!row) {
      return c.json({ error: { code: 'unauthorized', message: 'invalid token' } }, 401)
    }

    const now = Date.now()
    const last = lastUsedAt.get(tokenHash) ?? 0
    if (now - last > LAST_USED_DEBOUNCE_MS) {
      opts.db.run(
        "UPDATE api_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?",
        [tokenHash],
      )
      lastUsedAt.set(tokenHash, now)
    }

    c.set('userId', row.user_id)
    c.set('sessionToken', token)
    await next()
  }
}
