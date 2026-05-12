import { loadConfig } from '../config'
import { getDb } from '../db/client'
import { evaluateAlarmRules } from '../domain/alarms'

const cfg = loadConfig()
const db = getDb(cfg.databasePath)
const result = await evaluateAlarmRules(db, {
  user_id: cfg.defaultUserId,
  config: { agent: cfg.agent, telegram: cfg.telegram },
})

console.log(JSON.stringify({ ok: true, fired: result.fired.length }, null, 2))
