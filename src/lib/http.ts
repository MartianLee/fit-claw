import type { Context } from 'hono'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function errorJson(c: Context, err: unknown) {
  if (err instanceof HttpError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as any)
  }

  console.error(err)
  return c.json({ error: { code: 'internal', message: 'internal error' } }, 500)
}
