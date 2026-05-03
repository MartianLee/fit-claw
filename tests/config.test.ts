import { describe, expect, it } from 'bun:test'
import { loadConfig } from '../src/config'

const token = 'tok-test-1234567890'

describe('loadConfig', () => {
  it('throws when API_BEARER_TOKEN missing', () => {
    expect(() => loadConfig({ DATABASE_PATH: 'x', PORT: '3000' } as any)).toThrow(/API_BEARER_TOKEN/)
  })

  it('returns parsed config', () => {
    const cfg = loadConfig({
      PORT: '3001',
      DATABASE_PATH: './x.db',
      API_BEARER_TOKEN: token,
      DEFAULT_USER_ID: '1',
      AGENT_WEBHOOK_TIMEOUT_MS: '5000',
    } as any)

    expect(cfg.port).toBe(3001)
    expect(cfg.databasePath).toBe('./x.db')
    expect(cfg.apiBearerToken).toBe(token)
  })

  it('treats empty optional env vars as unset', () => {
    const cfg = loadConfig({
      API_BEARER_TOKEN: token,
      LLM_BASE_URL: '',
      AGENT_WEBHOOK_URL: '',
      BACKUP_RCLONE_REMOTE: '',
    } as any)

    expect(cfg.llm.baseUrl).toBeUndefined()
    expect(cfg.agent.webhookUrl).toBeUndefined()
    expect(cfg.backup.rcloneRemote).toBeUndefined()
  })
})
