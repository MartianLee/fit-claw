import type { Database } from 'bun:sqlite'

export type Exercise = {
  id: number
  canonical_name: string
  body_part: string
  equipment: string
  is_bodyweight: number
  default_side_mode: 'none' | 'each_side'
  source: 'seed' | 'external' | 'auto_created' | 'manual'
  needs_review: number
}

export type FindResult =
  | { matched: Exercise; proposed?: undefined }
  | {
      matched?: undefined
      proposed: { canonical_name: string; body_part: string; equipment: string }
    }

export function findOrProposeExercise(db: Database, query: string): FindResult {
  const trimmed = query.trim()
  const direct = db
    .query('SELECT * FROM exercises WHERE canonical_name = ? COLLATE NOCASE')
    .get(trimmed) as Exercise | null

  if (direct) return { matched: direct }

  const aliasHit = db
    .query(
      'SELECT e.* FROM exercise_aliases a JOIN exercises e ON e.id = a.exercise_id WHERE a.alias = ? COLLATE NOCASE',
    )
    .get(trimmed) as Exercise | null

  if (aliasHit) return { matched: aliasHit }

  return {
    proposed: {
      canonical_name: trimmed.toLowerCase(),
      body_part: 'unknown',
      equipment: 'unknown',
    },
  }
}

export function normalizeExerciseName(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function inferDefaultSideMode(name: string): 'none' | 'each_side' {
  const normalized = normalizeExerciseName(name)
  const unilateralPatterns = [
    /\bsingle[- ]arm\b/,
    /\bone[- ]arm\b/,
    /\bsingle[- ]leg\b/,
    /\bone[- ]leg\b/,
    /\bunilateral\b/,
    /\bdumbbell row\b/,
    /\blunge\b/,
    /\bsplit squat\b/,
    /\bbulgarian\b/,
  ]
  return unilateralPatterns.some((pattern) => pattern.test(normalized)) ? 'each_side' : 'none'
}

export function findExercise(db: Database, query: string): Exercise | null {
  const trimmed = query.trim()
  const direct = db
    .query('SELECT * FROM exercises WHERE canonical_name = ? COLLATE NOCASE')
    .get(trimmed) as Exercise | null

  if (direct) return direct

  return db
    .query(
      'SELECT e.* FROM exercise_aliases a JOIN exercises e ON e.id = a.exercise_id WHERE a.alias = ? COLLATE NOCASE',
    )
    .get(trimmed) as Exercise | null
}

export function createAutoExercise(db: Database, query: string): Exercise {
  const canonicalName = normalizeExerciseName(query)
  const result = db.run(
    `INSERT INTO exercises(canonical_name, body_part, equipment, default_side_mode, source, needs_review)
     VALUES (?, 'unknown', 'unknown', ?, 'auto_created', 1)`,
    [canonicalName, inferDefaultSideMode(canonicalName)],
  )
  return db.query('SELECT * FROM exercises WHERE id = ?').get(Number(result.lastInsertRowid)) as Exercise
}

export function confirmNewExercise(
  db: Database,
  input: {
    canonical_name: string
    body_part: string
    equipment: string
    is_bodyweight?: boolean
    default_side_mode?: 'none' | 'each_side'
    source?: 'seed' | 'external' | 'auto_created' | 'manual'
    needs_review?: boolean
    aliases?: string[]
  },
): Exercise {
  return db.transaction(() => {
    const result = db.run(
      `INSERT INTO exercises(canonical_name, body_part, equipment, is_bodyweight, default_side_mode, source, needs_review)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.canonical_name,
        input.body_part,
        input.equipment,
        input.is_bodyweight ? 1 : 0,
        input.default_side_mode ?? 'none',
        input.source ?? 'manual',
        input.needs_review ? 1 : 0,
      ],
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
