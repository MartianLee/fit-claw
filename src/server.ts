import { Hono } from 'hono'

export const app = new Hono()

app.get('/healthz', (c) => c.json({ ok: true }))

if (import.meta.main) {
  Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    fetch: app.fetch,
  })
}
