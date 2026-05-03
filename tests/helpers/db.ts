import { Database } from 'bun:sqlite'
import { loadMigrationsFromDir, runMigrations } from '../../src/db/migrate'

export function makeTestDb(): Database {
  const db = new Database(':memory:')
  runMigrations(db, loadMigrationsFromDir('src/db/migrations'))
  db.run('INSERT INTO users(id, name) VALUES(1, "o") ON CONFLICT DO NOTHING')
  return db
}
