import { readFileSync } from 'node:fs'
import { loadConfig } from '../src/config'
import { getDb } from '../src/db/client'
import { externalExercisesFromJson, upsertExternalExercises } from '../src/domain/exerciseCatalog'

const file = process.argv[2]
if (!file) {
  console.error('usage: bun run scripts/import-external-exercises.ts <exercises.json>')
  process.exit(1)
}

const cfg = loadConfig()
const db = getDb(cfg.databasePath)
const json = JSON.parse(readFileSync(file, 'utf8'))
const inputs = externalExercisesFromJson(json)
const result = upsertExternalExercises(db, inputs)

console.log(
  `external exercises parsed: ${inputs.length}, inserted: ${result.exercises_inserted}, aliases inserted: ${result.aliases_inserted}`,
)
