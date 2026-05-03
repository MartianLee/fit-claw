import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'

describe('schema 0001', () => {
  it('creates all tables', () => {
    const db = new Database(':memory:')

    runMigrations(db, loadMigrationsFromDir('src/db/migrations'))

    const tables = (
      db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((table) => table.name)

    for (const table of [
      'users',
      'api_tokens',
      'exercises',
      'exercise_aliases',
      'workout_sessions',
      'workout_entries',
      'workout_sets',
      'body_measurements',
      'daily_checkins',
      'prediction_models',
      'alarm_rules',
      'notifications_log',
    ]) {
      expect(tables).toContain(table)
    }
  })
})
