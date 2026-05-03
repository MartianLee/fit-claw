import { Database } from 'bun:sqlite'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../config'

const cfg = loadConfig()
const dir = './data/backups'
mkdirSync(dir, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const out = join(dir, `fit-claw-${stamp}.db`)

if (!existsSync(cfg.databasePath)) {
  console.error('db missing')
  process.exit(1)
}

const src = new Database(cfg.databasePath, { readonly: true })
src.run(`VACUUM INTO '${out}'`)
src.close()

const gz = `${out}.gz`
const gzip = spawnSync('gzip', [out])
if (gzip.status !== 0) {
  console.error('gzip failed')
  process.exit(1)
}

if (cfg.backup.rcloneRemote) {
  const copy = spawnSync('rclone', ['copy', gz, cfg.backup.rcloneRemote, '--quiet'])
  if (copy.status !== 0) {
    console.error('rclone failed')
    process.exit(1)
  }

  const prune = spawnSync('rclone', [
    'delete',
    cfg.backup.rcloneRemote,
    '--min-age',
    `${cfg.backup.retentionDays}d`,
    '--quiet',
  ])
  if (prune.status !== 0) console.error('retention prune failed (non-fatal)')
}

console.log(`backup ok: ${gz}`)
