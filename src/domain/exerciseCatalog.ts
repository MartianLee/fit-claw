import type { Database } from 'bun:sqlite'
import { inferDefaultSideMode, normalizeExerciseName } from './exercises'

export type ExternalExerciseInput = {
  name: string
  body_part?: string
  equipment?: string
  aliases?: string[]
}

export function upsertExternalExercises(db: Database, inputs: ExternalExerciseInput[]) {
  const findExercise = db.prepare('SELECT id FROM exercises WHERE canonical_name = ? COLLATE NOCASE')
  const insertExercise = db.prepare(
    `INSERT INTO exercises(canonical_name, body_part, equipment, default_side_mode, source, needs_review)
     VALUES (?, ?, ?, ?, 'external', 0)`,
  )
  const findAlias = db.prepare('SELECT id FROM exercise_aliases WHERE alias = ?')
  const insertAlias = db.prepare(
    'INSERT INTO exercise_aliases(exercise_id, alias) VALUES (?, ?) ON CONFLICT DO NOTHING',
  )

  let exercises_inserted = 0
  let aliases_inserted = 0

  return db.transaction(() => {
    for (const input of inputs) {
      const canonicalName = normalizeExerciseName(input.name)
      if (!canonicalName) continue

      let exercise = findExercise.get(canonicalName) as { id: number } | null
      if (!exercise) {
        const result = insertExercise.run(
          canonicalName,
          normalizeExerciseName(input.body_part ?? 'unknown'),
          normalizeExerciseName(input.equipment ?? 'unknown'),
          inferDefaultSideMode(canonicalName),
        )
        exercise = { id: Number(result.lastInsertRowid) }
        exercises_inserted++
      }

      for (const alias of input.aliases ?? []) {
        const normalizedAlias = normalizeExerciseName(alias)
        if (!normalizedAlias || normalizedAlias === canonicalName) continue
        if (!findAlias.get(normalizedAlias)) {
          insertAlias.run(exercise.id, normalizedAlias)
          aliases_inserted++
        }
      }
    }

    return { exercises_inserted, aliases_inserted }
  })()
}

export function externalExercisesFromJson(value: unknown): ExternalExerciseInput[] {
  if (!Array.isArray(value)) throw new Error('expected top-level JSON array')

  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as Record<string, unknown>
    const name = firstString(record.name, record.title, record.canonical_name, record.exercise)
    if (!name) return []

    return [
      {
        name,
        body_part: firstString(
          record.body_part,
          record.bodyPart,
          record.category,
          firstArrayString(record.primaryMuscles),
          firstArrayString(record.muscles),
        ),
        equipment: firstString(record.equipment, firstArrayString(record.equipments)),
        aliases: collectStrings(record.aliases, record.alternative_names, record.alternativeNames),
      },
    ]
  })
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function firstArrayString(value: unknown): string | undefined {
  return Array.isArray(value) ? firstString(...value) : undefined
}

function collectStrings(...values: unknown[]): string[] {
  const out = new Set<string>()
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) out.add(value)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) out.add(item)
      }
    }
  }
  return Array.from(out)
}
