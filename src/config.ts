import { z } from 'zod'

const Schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_PATH: z.string().default('./data/fit-claw.db'),
  DEFAULT_USER_ID: z.coerce.number().default(1),
  API_BEARER_TOKEN: z.string().min(1),
  LLM_PROVIDER: z.string().default('gemini'),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_MODEL_VISION: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  AGENT_WEBHOOK_URL: z.string().url().optional(),
  AGENT_WEBHOOK_TIMEOUT_MS: z.coerce.number().default(5000),
  BACKUP_RCLONE_REMOTE: z.string().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
})

export type Config = {
  port: number
  databasePath: string
  defaultUserId: number
  apiBearerToken: string
  llm: {
    provider: string
    baseUrl?: string
    apiKey?: string
    model?: string
    modelVision?: string
  }
  telegram: { token?: string; chatId?: string }
  agent: { webhookUrl?: string; timeoutMs: number }
  backup: { rcloneRemote?: string; retentionDays: number }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Schema.parse(env)

  return {
    port: parsed.PORT,
    databasePath: parsed.DATABASE_PATH,
    defaultUserId: parsed.DEFAULT_USER_ID,
    apiBearerToken: parsed.API_BEARER_TOKEN,
    llm: {
      provider: parsed.LLM_PROVIDER,
      baseUrl: parsed.LLM_BASE_URL,
      apiKey: parsed.LLM_API_KEY,
      model: parsed.LLM_MODEL,
      modelVision: parsed.LLM_MODEL_VISION,
    },
    telegram: {
      token: parsed.TELEGRAM_BOT_TOKEN,
      chatId: parsed.TELEGRAM_CHAT_ID,
    },
    agent: {
      webhookUrl: parsed.AGENT_WEBHOOK_URL,
      timeoutMs: parsed.AGENT_WEBHOOK_TIMEOUT_MS,
    },
    backup: {
      rcloneRemote: parsed.BACKUP_RCLONE_REMOTE,
      retentionDays: parsed.BACKUP_RETENTION_DAYS,
    },
  }
}
