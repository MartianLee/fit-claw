import type { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type MigrationFile = { name: string; sql: string }

export function loadMigrationsFromDir(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

export function runMigrations(db: Database, files: MigrationFile[]) {
  db.exec(`CREATE TABLE IF NOT EXISTS applied_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`)

  const applied = new Set(
    (db.query('SELECT name FROM applied_migrations').all() as { name: string }[]).map(
      (row) => row.name,
    ),
  )

  for (const file of files) {
    if (applied.has(file.name)) continue

    db.transaction(() => {
      db.exec(file.sql)
      db.run('INSERT INTO applied_migrations(name) VALUES (?)', [file.name])
    })()
  }
}
