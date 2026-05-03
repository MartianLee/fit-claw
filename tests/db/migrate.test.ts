import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { runMigrations } from '../../src/db/migrate'

describe('runMigrations', () => {
  it('applies SQL files in order and skips already-applied', () => {
    const db = new Database(':memory:')
    const files = [
      { name: '0001_a.sql', sql: 'CREATE TABLE a(id INTEGER);' },
      { name: '0002_b.sql', sql: 'CREATE TABLE b(id INTEGER);' },
    ]

    runMigrations(db, files)

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    expect(tables.map((table) => table.name)).toContain('a')
    expect(tables.map((table) => table.name)).toContain('b')
    expect(tables.map((table) => table.name)).toContain('applied_migrations')

    runMigrations(db, files)

    const applied = db.query('SELECT COUNT(*) as n FROM applied_migrations').get() as { n: number }
    expect(applied.n).toBe(2)
  })
})
