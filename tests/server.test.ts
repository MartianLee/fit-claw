import { describe, expect, it } from 'bun:test'
import { app } from '../src/server'

describe('GET /healthz', () => {
  it('returns ok true', async () => {
    const response = await app.fetch(new Request('http://localhost/healthz'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
