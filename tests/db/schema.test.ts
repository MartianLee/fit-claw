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

  it('adds v1.5-prep exercise and unilateral set metadata columns', () => {
    const db = new Database(':memory:')

    runMigrations(db, loadMigrationsFromDir('src/db/migrations'))

    const exerciseColumns = (
      db.query('PRAGMA table_info(exercises)').all() as { name: string }[]
    ).map((column) => column.name)
    const setColumns = (
      db.query('PRAGMA table_info(workout_sets)').all() as { name: string }[]
    ).map((column) => column.name)

    expect(exerciseColumns).toContain('default_side_mode')
    expect(exerciseColumns).toContain('source')
    expect(exerciseColumns).toContain('needs_review')
    expect(setColumns).toContain('side_mode')
    expect(setColumns).toContain('side')
  })
})
