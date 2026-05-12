import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { z } from 'zod'
import { createAlarmRule, disableAlarmRule, listAlarmRules } from '../domain/alarms'
import { zv } from '../lib/validator'

const AlarmRuleSchema = z.object({
  scope: z.enum(['exercise', 'global']),
  exercise_id: z.number().int().positive().optional(),
  threshold_type: z.enum([
    '1rm_below',
    'days_inactive_above',
    'smm_below',
    'weight_above',
    'weight_below',
  ]),
  threshold_value: z.number().nonnegative(),
})

export function alarmsRoutes(db: Database) {
  const routes = new Hono()

  routes.post('/create_alarm_rule', zv('json', AlarmRuleSchema), (c) =>
    c.json(createAlarmRule(db, { user_id: c.get('userId'), ...c.req.valid('json') })),
  )

  routes.post('/list_alarm_rules', zv('json', z.object({})), (c) =>
    c.json({ rules: listAlarmRules(db, { user_id: c.get('userId') }) }),
  )

  routes.post('/disable_alarm_rule', zv('json', z.object({ id: z.number().int().positive() })), (c) =>
    c.json(disableAlarmRule(db, { user_id: c.get('userId'), id: c.req.valid('json').id })),
  )

  return routes
}
