import { loadConfig } from '../config'
import { getDb } from '../db/client'
import { refitPredictionModels } from '../domain/predictions'

const cfg = loadConfig()
const db = getDb(cfg.databasePath)
const models = refitPredictionModels(db, { user_id: cfg.defaultUserId })

console.log(JSON.stringify({ ok: true, count: models.length }, null, 2))
