import { describe, expect, it } from 'bun:test'
import {
  createAlarmRule,
  disableAlarmRule,
  evaluateAlarmRules,
  listAlarmRules,
} from '../../src/domain/alarms'
import { createWorkoutEntry } from '../../src/domain/workouts'
import { logBodyMeasurement } from '../../src/domain/body'
import type { FetchLike } from '../../src/lib/notifications'
import { makeTestDb } from '../helpers/db'

function createExercise(db: ReturnType<typeof makeTestDb>, name = 'bench press') {
  return Number(
    db.run('INSERT INTO exercises(canonical_name, body_part, equipment) VALUES(?, ?, ?)', [
      name,
      'chest',
      'barbell',
    ]).lastInsertRowid,
  )
}

function logWorkout(db: ReturnType<typeof makeTestDb>, exerciseId: number, startedAt: string) {
  createWorkoutEntry(db, {
    user_id: 1,
    exercise_id: exerciseId,
    started_at: startedAt,
    sets: [{ weight_kg: 80, reps: 5 }],
  })
}

describe('alarm rule CRUD', () => {
  it('requires exercise_id for exercise scoped 1rm rules', () => {
    const db = makeTestDb()

    expect(() =>
      createAlarmRule(db, {
        user_id: 1,
        scope: 'exercise',
        threshold_type: '1rm_below',
        threshold_value: 100,
      }),
    ).toThrow('exercise_id is required')
  })

  it('creates, lists, and disables alarm rules', () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db)

    const rule = createAlarmRule(db, {
      user_id: 1,
      scope: 'exercise',
      exercise_id: exerciseId,
      threshold_type: '1rm_below',
      threshold_value: 100,
    })
    const disabled = disableAlarmRule(db, { user_id: 1, id: rule.id })

    expect(rule.enabled).toBe(1)
    expect(listAlarmRules(db, { user_id: 1 }).length).toBe(1)
    expect(disabled.enabled).toBe(0)
  })
})

describe('evaluateAlarmRules', () => {
  it('fires inactive rules once per calendar date and writes notifications_log', async () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db)
    logWorkout(db, exerciseId, '2026-05-01T09:00:00Z')
    createAlarmRule(db, {
      user_id: 1,
      scope: 'exercise',
      exercise_id: exerciseId,
      threshold_type: 'days_inactive_above',
      threshold_value: 7,
    })

    const first = await evaluateAlarmRules(db, {
      user_id: 1,
      now: new Date('2026-05-10T08:00:00Z'),
      config: { agent: { timeoutMs: 50 }, telegram: {} },
    })
    const second = await evaluateAlarmRules(db, {
      user_id: 1,
      now: new Date('2026-05-10T20:00:00Z'),
      config: { agent: { timeoutMs: 50 }, telegram: {} },
    })

    const logs = db.query('SELECT * FROM notifications_log').all() as {
      channel: string
      generated_by: string
    }[]
    expect(first.fired.length).toBe(1)
    expect(first.fired[0]?.channel).toBe('log_only')
    expect(second.fired.length).toBe(0)
    expect(logs.length).toBe(1)
    expect(logs[0]?.generated_by).toBe('fallback')
  })

  it('attempts agent webhook before Telegram fallback', async () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db, 'squat')
    logWorkout(db, exerciseId, '2026-05-01T09:00:00Z')
    createAlarmRule(db, {
      user_id: 1,
      scope: 'exercise',
      exercise_id: exerciseId,
      threshold_type: 'days_inactive_above',
      threshold_value: 7,
    })
    const calls: string[] = []
    const fetcher: FetchLike = async (url) => {
      calls.push(String(url))
      return new Response('{}', { status: calls.length === 1 ? 500 : 200 })
    }

    const result = await evaluateAlarmRules(db, {
      user_id: 1,
      now: new Date('2026-05-10T08:00:00Z'),
      config: {
        agent: { webhookUrl: 'https://agent.example/hook', timeoutMs: 50 },
        telegram: { token: 'telegram-token', chatId: 'chat-id' },
      },
      fetcher,
    })

    const log = db.query('SELECT * FROM notifications_log').get() as {
      channel: string
      generated_by: string
    }
    expect(result.fired[0]?.channel).toBe('telegram')
    expect(calls[0]).toBe('https://agent.example/hook')
    expect(calls[1]).toContain('https://api.telegram.org/bottelegram-token/sendMessage')
    expect(log.channel).toBe('telegram')
    expect(log.generated_by).toBe('fallback')
  })

  it('fires 1rm_below against today predicted 1RM', async () => {
    const db = makeTestDb()
    const exerciseId = createExercise(db)
    logWorkout(db, exerciseId, '2026-05-09T09:00:00Z')
    createAlarmRule(db, {
      user_id: 1,
      scope: 'exercise',
      exercise_id: exerciseId,
      threshold_type: '1rm_below',
      threshold_value: 120,
    })

    const result = await evaluateAlarmRules(db, {
      user_id: 1,
      now: new Date('2026-05-10T08:00:00Z'),
      config: { agent: { timeoutMs: 50 }, telegram: {} },
    })

    expect(result.fired.length).toBe(1)
    expect(result.fired[0]?.body).toContain('1rm_below')
  })

  it('fires body composition rules from latest body measurements', async () => {
    const db = makeTestDb()
    logBodyMeasurement(db, {
      user_id: 1,
      measured_at: '2026-05-10T07:00:00Z',
      weight_kg: 82,
      smm_kg: 31,
    })
    createAlarmRule(db, {
      user_id: 1,
      scope: 'global',
      threshold_type: 'weight_above',
      threshold_value: 80,
    })

    const result = await evaluateAlarmRules(db, {
      user_id: 1,
      now: new Date('2026-05-10T08:00:00Z'),
      config: { agent: { timeoutMs: 50 }, telegram: {} },
    })

    expect(result.fired.length).toBe(1)
    expect(result.fired[0]?.body).toContain('weight_above')
  })
})
