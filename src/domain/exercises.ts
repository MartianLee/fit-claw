import type { Database } from 'bun:sqlite'

export type Exercise = {
  id: number
  canonical_name: string
  body_part: string
  equipment: string
  is_bodyweight: number
}

export type FindResult =
  | { matched: Exercise; proposed?: undefined }
  | {
      matched?: undefined
      proposed: { canonical_name: string; body_part: string; equipment: string }
    }

export function findOrProposeExercise(db: Database, query: string): FindResult {
  const canonicalName = query.trim().toLowerCase()
  const direct = db
    .query('SELECT * FROM exercises WHERE LOWER(canonical_name) = ?')
    .get(canonicalName) as Exercise | null

  if (direct) return { matched: direct }

  const aliasHit = db
    .query(
      'SELECT e.* FROM exercise_aliases a JOIN exercises e ON e.id = a.exercise_id WHERE a.alias = ? COLLATE NOCASE',
    )
    .get(query.trim()) as Exercise | null

  if (aliasHit) return { matched: aliasHit }

  return {
    proposed: {
      canonical_name: canonicalName,
      body_part: 'unknown',
      equipment: 'unknown',
    },
  }
}

export function confirmNewExercise(
  db: Database,
  input: {
    canonical_name: string
    body_part: string
    equipment: string
    is_bodyweight?: boolean
    aliases?: string[]
  },
): Exercise {
  return db.transaction(() => {
    const result = db.run(
      'INSERT INTO exercises(canonical_name, body_part, equipment, is_bodyweight) VALUES (?, ?, ?, ?)',
      [input.canonical_name, input.body_part, input.equipment, input.is_bodyweight ? 1 : 0],
    )
    const id = Number(result.lastInsertRowid)

    for (const alias of input.aliases ?? []) {
      db.run('INSERT INTO exercise_aliases(exercise_id, alias) VALUES (?, ?) ON CONFLICT DO NOTHING', [
        id,
        alias,
      ])
    }

    return db.query('SELECT * FROM exercises WHERE id = ?').get(id) as Exercise
  })()
}
