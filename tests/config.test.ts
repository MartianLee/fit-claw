import { describe, expect, it } from 'bun:test'
import { loadConfig } from '../src/config'

describe('loadConfig', () => {
  it('throws when API_BEARER_TOKEN missing', () => {
    expect(() => loadConfig({ DATABASE_PATH: 'x', PORT: '3000' } as any)).toThrow(/API_BEARER_TOKEN/)
  })

  it('returns parsed config', () => {
    const cfg = loadConfig({
      PORT: '3001',
      DATABASE_PATH: './x.db',
      API_BEARER_TOKEN: 'tok',
      DEFAULT_USER_ID: '1',
      AGENT_WEBHOOK_TIMEOUT_MS: '5000',
    } as any)

    expect(cfg.port).toBe(3001)
    expect(cfg.databasePath).toBe('./x.db')
    expect(cfg.apiBearerToken).toBe('tok')
  })
})
