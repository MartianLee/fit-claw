import { describe, expect, it } from 'bun:test'
import { hashToken } from '../../src/auth/tokens'

describe('hashToken', () => {
  it('produces stable, distinct hash', async () => {
    const a = await hashToken('abc')
    const b = await hashToken('abc')
    const c = await hashToken('abd')

    expect(a).toHaveLength(64)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe('abc')
  })
})
