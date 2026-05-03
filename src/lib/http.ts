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

export function scrubToken(input: string): string {
  return input.replace(/([?&])t=[^&\s]+/g, '$1t=REDACTED')
}

export function errorJson(c: Context, err: unknown) {
  if (err instanceof HttpError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as any)
  }

  const detail = err instanceof Error ? err.stack ?? err.message : String(err)
  console.error(scrubToken(detail))
  return c.json({ error: { code: 'internal', message: 'internal error' } }, 500)
}
