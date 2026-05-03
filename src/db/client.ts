import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { loadMigrationsFromDir, runMigrations } from './migrate'

const instances = new Map<string, Database>()

export function getDb(path: string): Database {
  const key = resolve(path)
  const cached = instances.get(key)
  if (cached) return cached

  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  const files = loadMigrationsFromDir(join(import.meta.dir, 'migrations'))
  runMigrations(db, files)

  instances.set(key, db)
  return db
}
