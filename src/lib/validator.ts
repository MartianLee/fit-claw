import { zValidator as base } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodSchema } from 'zod'

export function zv<T extends keyof ValidationTargets, S extends ZodSchema>(target: T, schema: S) {
  return base(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || target}: ${issue.message}`)
        .join('; ')
      return c.json({ error: { code: 'invalid_input', message } }, 400)
    }
  })
}
