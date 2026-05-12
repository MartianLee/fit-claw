import { describe, expect, it } from 'bun:test'
import { upsertExternalExercises } from '../../src/domain/exerciseCatalog'
import { makeTestDb } from '../helpers/db'

describe('upsertExternalExercises', () => {
  it('imports external exercises and avoids duplicate canonical names', () => {
    const db = makeTestDb()
    const existingId = Number(
      db.run(
        'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
      ).lastInsertRowid,
    )

    const result = upsertExternalExercises(db, [
      {
        name: 'Bench Press',
        body_part: 'chest',
        equipment: 'barbell',
        aliases: ['barbell bench press'],
      },
      {
        name: 'Single Arm Cable Row',
        body_part: 'back',
        equipment: 'cable',
        aliases: ['one arm cable row'],
      },
    ])

    const exercises = db.query('SELECT * FROM exercises ORDER BY canonical_name').all() as {
      id: number
      canonical_name: string
      source: string
      default_side_mode: string
    }[]
    const alias = db
      .query('SELECT exercise_id FROM exercise_aliases WHERE alias = ?')
      .get('barbell bench press') as { exercise_id: number }
    const singleArm = exercises.find((exercise) => exercise.canonical_name === 'single arm cable row')

    expect(result.exercises_inserted).toBe(1)
    expect(result.aliases_inserted).toBe(2)
    expect(exercises.filter((exercise) => exercise.canonical_name === 'bench press').length).toBe(1)
    expect(alias.exercise_id).toBe(existingId)
    expect(singleArm?.source).toBe('external')
    expect(singleArm?.default_side_mode).toBe('each_side')
  })
})
