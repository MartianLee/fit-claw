import { describe, expect, it } from 'bun:test'
import { hashToken, verifyToken } from '../../src/auth/tokens'

describe('hashToken', () => {
  it('produces stable hash and verifies', async () => {
    const hash = await hashToken('abc')

    expect(hash).not.toBe('abc')
    expect(await verifyToken('abc', hash)).toBe(true)
    expect(await verifyToken('abd', hash)).toBe(false)
  })
})
