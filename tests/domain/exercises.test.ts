import { describe, expect, it } from 'bun:test'
import { confirmNewExercise, findOrProposeExercise } from '../../src/domain/exercises'
import { makeTestDb } from '../helpers/db'

function seedBench(db: ReturnType<typeof makeTestDb>) {
  const id = db.run(
    'INSERT INTO exercises(canonical_name, body_part, equipment) VALUES("bench press", "chest", "barbell")',
  ).lastInsertRowid as number
  db.run('INSERT INTO exercise_aliases(exercise_id, alias) VALUES (?, ?)', [id, '벤치'])
  return id
}

describe('findOrProposeExercise', () => {
  it('matches by canonical name (case-insensitive)', () => {
    const db = makeTestDb()
    const id = seedBench(db)

    const result = findOrProposeExercise(db, 'Bench Press')

    expect(result.matched?.id).toBe(id)
  })

  it('matches by alias', () => {
    const db = makeTestDb()
    const id = seedBench(db)

    const result = findOrProposeExercise(db, '벤치')

    expect(result.matched?.id).toBe(id)
  })

  it('returns proposed when not found', () => {
    const db = makeTestDb()

    const result = findOrProposeExercise(db, 'snatch grip deadlift')

    expect(result.matched).toBeUndefined()
    expect(result.proposed?.canonical_name).toBe('snatch grip deadlift')
  })
})

describe('confirmNewExercise', () => {
  it('inserts exercise + aliases atomically', () => {
    const db = makeTestDb()

    const exercise = confirmNewExercise(db, {
      canonical_name: 'zercher squat',
      body_part: 'leg',
      equipment: 'barbell',
      aliases: ['zercher', '저처'],
    })

    const aliases = db
      .query('SELECT alias FROM exercise_aliases WHERE exercise_id = ?')
      .all(exercise.id) as { alias: string }[]
    expect(aliases.map((alias) => alias.alias).sort()).toEqual(['저처', 'zercher'].sort())
  })

  it('rejects duplicate canonical name', () => {
    const db = makeTestDb()
    seedBench(db)

    expect(() =>
      confirmNewExercise(db, {
        canonical_name: 'bench press',
        body_part: 'chest',
        equipment: 'barbell',
      }),
    ).toThrow()
  })
})
