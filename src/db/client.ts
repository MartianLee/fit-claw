import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadMigrationsFromDir, runMigrations } from './migrate'

let dbInstance: Database | null = null

export function getDb(path: string): Database {
  if (dbInstance) return dbInstance

  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  const files = loadMigrationsFromDir(join(import.meta.dir, 'migrations'))
  runMigrations(db, files)

  dbInstance = db
  return db
}
