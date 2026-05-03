import { hashToken } from '../src/auth/tokens'
import { loadConfig } from '../src/config'
import { getDb } from '../src/db/client'

const cfg = loadConfig()
const db = getDb(cfg.databasePath)
const label = process.argv[2] ?? 'agent'

const user = db.query('SELECT id FROM users WHERE id = ?').get(cfg.defaultUserId)
if (!user) {
  console.error(
    `user ${cfg.defaultUserId} does not exist; run migrations and seed users first (e.g. INSERT INTO users(id, name) VALUES(${cfg.defaultUserId}, 'me'))`,
  )
  process.exit(1)
}

const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
const tokenHash = await hashToken(token)

db.run('INSERT INTO api_tokens(user_id, token_hash, label) VALUES (?, ?, ?)', [
  cfg.defaultUserId,
  tokenHash,
  label,
])

console.log(token)
