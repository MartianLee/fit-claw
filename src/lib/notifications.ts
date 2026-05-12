import type { Config } from '../config'

export type FetchLike = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type NotificationDeliveryResult = {
  channel: 'agent_webhook' | 'telegram' | 'log_only'
  generated_by: 'agent' | 'fallback'
}

async function postJson(
  fetcher: FetchLike,
  url: string,
  body: unknown,
  timeoutMs?: number,
): Promise<boolean> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })
  return response.ok
}

export async function deliverNotification(input: {
  config: Pick<Config, 'agent' | 'telegram'>
  body: string
  kind: string
  fetcher?: FetchLike
}): Promise<NotificationDeliveryResult> {
  const fetcher = input.fetcher ?? fetch

  if (input.config.agent.webhookUrl) {
    try {
      const ok = await postJson(
        fetcher,
        input.config.agent.webhookUrl,
        { kind: input.kind, body: input.body },
        input.config.agent.timeoutMs,
      )
      if (ok) return { channel: 'agent_webhook', generated_by: 'agent' }
    } catch {
      // Telegram fallback below preserves alert delivery when the agent endpoint is unavailable.
    }
  }

  if (input.config.telegram.token && input.config.telegram.chatId) {
    try {
      const ok = await postJson(fetcher, `https://api.telegram.org/bot${input.config.telegram.token}/sendMessage`, {
        chat_id: input.config.telegram.chatId,
        text: input.body,
      })
      if (ok) return { channel: 'telegram', generated_by: 'fallback' }
    } catch {
      return { channel: 'log_only', generated_by: 'fallback' }
    }
  }

  return { channel: 'log_only', generated_by: 'fallback' }
}
