import type { Database } from 'bun:sqlite'
import type { Config } from '../config'
import { predictPerformance } from './predictions'
import { deliverNotification, type FetchLike } from '../lib/notifications'

const DAY_MS = 86_400_000

export type AlarmScope = 'exercise' | 'global'
export type ThresholdType =
  | '1rm_below'
  | 'days_inactive_above'
  | 'smm_below'
  | 'weight_above'
  | 'weight_below'

export type AlarmRule = {
  id: number
  user_id: number
  scope: AlarmScope
  exercise_id: number | null
  threshold_type: ThresholdType
  threshold_value: number
  enabled: 0 | 1
  last_fired_at: string | null
}

export type CreateAlarmRuleInput = {
  user_id: number
  scope: AlarmScope
  exercise_id?: number
  threshold_type: ThresholdType
  threshold_value: number
}

export type FiredAlarm = {
  rule: AlarmRule
  channel: 'agent_webhook' | 'telegram' | 'log_only'
  generated_by: 'agent' | 'fallback'
  body: string
  current_value: number | null
}

export type EvaluateAlarmRulesResult = {
  fired: FiredAlarm[]
}

export type EvaluateAlarmRulesInput = {
  user_id: number
  now?: Date
  config?: Pick<Config, 'agent' | 'telegram'>
  fetcher?: FetchLike
}

type LatestWorkoutRow = {
  last_workout_at: string | null
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string): Date {
  return new Date(value)
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS)
}

function validateRule(input: CreateAlarmRuleInput): void {
  if (input.threshold_value < 0) throw new Error('threshold_value must be nonnegative')
  if (input.scope === 'exercise' && !input.exercise_id) {
    throw new Error('exercise_id is required for exercise scope')
  }
  if (input.scope === 'global' && input.exercise_id !== undefined) {
    throw new Error('exercise_id is only allowed for exercise scope')
  }
  if (input.threshold_type === '1rm_below' && !input.exercise_id) {
    throw new Error('exercise_id is required for 1rm_below')
  }
}

function defaultConfig(): Pick<Config, 'agent' | 'telegram'> {
  return { agent: { timeoutMs: 5000 }, telegram: {} }
}

function getAlarmRule(db: Database, input: { user_id: number; id: number }): AlarmRule {
  const rule = db
    .query('SELECT * FROM alarm_rules WHERE user_id = ? AND id = ?')
    .get(input.user_id, input.id) as AlarmRule | null
  if (!rule) throw new Error('alarm rule not found')
  return rule
}

function latestWorkoutAt(
  db: Database,
  input: { user_id: number; exercise_id?: number | null },
): string | null {
  const row = db
    .query(
      `SELECT MAX(s.started_at) AS last_workout_at
       FROM workout_sessions s
       LEFT JOIN workout_entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND (? IS NULL OR e.exercise_id = ?)`,
    )
    .get(input.user_id, input.exercise_id ?? null, input.exercise_id ?? null) as LatestWorkoutRow | null
  return row?.last_workout_at ?? null
}

function latestBodyValue(
  db: Database,
  input: { user_id: number; field: 'weight_kg' | 'smm_kg' },
): number | null {
  const row = db
    .query(
      `SELECT ${input.field} AS value
       FROM body_measurements
       WHERE user_id = ? AND ${input.field} IS NOT NULL
       ORDER BY measured_at DESC
       LIMIT 1`,
    )
    .get(input.user_id) as { value: number | null } | null
  return row?.value ?? null
}

function thresholdBody(rule: AlarmRule, currentValue: number | null): string {
  const current = currentValue === null ? 'unknown' : currentValue.toFixed(1)
  return `fit-claw alarm ${rule.threshold_type}: current=${current}, threshold=${rule.threshold_value}`
}

function evaluateRule(
  db: Database,
  rule: AlarmRule,
  now: Date,
): { body: string; current_value: number | null } | null {
  const today = dateKey(now)

  if (rule.threshold_type === '1rm_below') {
    if (!rule.exercise_id) return null
    const prediction = predictPerformance(db, {
      user_id: rule.user_id,
      exercise_id: rule.exercise_id,
      target_date: today,
      now,
    })
    const current = prediction.predicted_1rm_kg
    if (current > 0 && current < rule.threshold_value) {
      return { body: thresholdBody(rule, current), current_value: current }
    }
    return null
  }

  if (rule.threshold_type === 'days_inactive_above') {
    const last = latestWorkoutAt(db, { user_id: rule.user_id, exercise_id: rule.exercise_id })
    const current = last ? daysBetween(parseDate(last), now) : Number.POSITIVE_INFINITY
    if (current > rule.threshold_value) {
      const valueText = Number.isFinite(current) ? current.toFixed(1) : 'no_history'
      return {
        body: `fit-claw alarm days_inactive_above: current=${valueText}, threshold=${rule.threshold_value}`,
        current_value: Number.isFinite(current) ? current : null,
      }
    }
    return null
  }

  if (rule.threshold_type === 'smm_below') {
    const current = latestBodyValue(db, { user_id: rule.user_id, field: 'smm_kg' })
    if (current !== null && current < rule.threshold_value) {
      return { body: thresholdBody(rule, current), current_value: current }
    }
    return null
  }

  if (rule.threshold_type === 'weight_above') {
    const current = latestBodyValue(db, { user_id: rule.user_id, field: 'weight_kg' })
    if (current !== null && current > rule.threshold_value) {
      return { body: thresholdBody(rule, current), current_value: current }
    }
    return null
  }

  if (rule.threshold_type === 'weight_below') {
    const current = latestBodyValue(db, { user_id: rule.user_id, field: 'weight_kg' })
    if (current !== null && current < rule.threshold_value) {
      return { body: thresholdBody(rule, current), current_value: current }
    }
  }

  return null
}

export function createAlarmRule(db: Database, input: CreateAlarmRuleInput): AlarmRule {
  validateRule(input)
  const result = db.run(
    `INSERT INTO alarm_rules(user_id, scope, exercise_id, threshold_type, threshold_value)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.user_id,
      input.scope,
      input.exercise_id ?? null,
      input.threshold_type,
      input.threshold_value,
    ],
  )
  return db.query('SELECT * FROM alarm_rules WHERE id = ?').get(Number(result.lastInsertRowid)) as AlarmRule
}

export function listAlarmRules(db: Database, input: { user_id: number }): AlarmRule[] {
  return db
    .query('SELECT * FROM alarm_rules WHERE user_id = ? ORDER BY id')
    .all(input.user_id) as AlarmRule[]
}

export function disableAlarmRule(db: Database, input: { user_id: number; id: number }): AlarmRule {
  db.run('UPDATE alarm_rules SET enabled = 0 WHERE user_id = ? AND id = ?', [input.user_id, input.id])
  return getAlarmRule(db, input)
}

export async function evaluateAlarmRules(
  db: Database,
  input: EvaluateAlarmRulesInput,
): Promise<EvaluateAlarmRulesResult> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const today = dateKey(now)
  const config = input.config ?? defaultConfig()
  const rules = db
    .query('SELECT * FROM alarm_rules WHERE user_id = ? AND enabled = 1 ORDER BY id')
    .all(input.user_id) as AlarmRule[]
  const fired: FiredAlarm[] = []

  for (const rule of rules) {
    if (rule.last_fired_at?.slice(0, 10) === today) continue

    const violation = evaluateRule(db, rule, now)
    if (!violation) continue

    const delivery = await deliverNotification({
      config,
      body: violation.body,
      kind: rule.threshold_type,
      fetcher: input.fetcher,
    })
    db.run(
      'INSERT INTO notifications_log(user_id, channel, kind, body, generated_by) VALUES (?, ?, ?, ?, ?)',
      [rule.user_id, delivery.channel, rule.threshold_type, violation.body, delivery.generated_by],
    )
    db.run('UPDATE alarm_rules SET last_fired_at = ? WHERE id = ?', [nowIso, rule.id])

    fired.push({
      rule: { ...rule, last_fired_at: nowIso },
      channel: delivery.channel,
      generated_by: delivery.generated_by,
      body: violation.body,
      current_value: violation.current_value,
    })
  }

  return { fired }
}
